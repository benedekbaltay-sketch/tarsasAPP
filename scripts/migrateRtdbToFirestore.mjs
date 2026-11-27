#!/usr/bin/env node
/**
 * Zero-Downtime RTDB -> Cloud Firestore Migration Runner (Emulator-First + Strict Rule 3 Guard)
 *
 * Usage (Local Firebase Emulator — SAFE DEFAULT):
 *   node scripts/migrateRtdbToFirestore.mjs --input=./mock_export.json --target=emulator
 *
 * Usage (Production — requires explicit user approval flag & Admin SDK credentials):
 *   node scripts/migrateRtdbToFirestore.mjs \
 *     --input=./encrypted_backup/condo_state.json \
 *     --files-input=./encrypted_backup/condo_files.json \
 *     --target=prod \
 *     --confirm-prod-migration=I_APPROVE_LIVE_MIGRATION
 *
 * Safety Guarantees:
 *   1. Defaults strictly to Firebase Local Emulator (`127.0.0.1:8080`, `9099`, `9199`).
 *   2. Runs full 0-Ft parity & zero-secret verification BEFORE writing a single document.
 *   3. Idempotent deterministic document IDs; safe to re-run without creating duplicates.
 *   4. Decodes Base64 files into Cloud Storage and stores only `storagePath` in Firestore.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  transformRtdbSnapshotToFirestore,
  verifyFirestoreParityAgainstLegacy,
} from './rtdbToFirestoreTransform.js';

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const [k, ...rest] = raw.replace(/^--/, '').split('=');
    args[k] = rest.length > 0 ? rest.join('=') : true;
  }
  return args;
}

function decodeBase64DataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const target = args.target || 'emulator';
  const dryRun = Boolean(args['dry-run']);

  if (!args.input) {
    console.error('[ERROR] Missing --input=<path-to-rtdb-condo_state.json>');
    process.exit(1);
  }

  // RULE 3 HARD SAFETY GUARD: Never touch production unless explicitly authorized
  if (target === 'prod') {
    if (args['confirm-prod-migration'] !== 'I_APPROVE_LIVE_MIGRATION') {
      console.error('[BLOCKED — RULE 3] Production migration refused without --confirm-prod-migration=I_APPROVE_LIVE_MIGRATION');
      process.exit(1);
    }
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error('[ERROR] GOOGLE_APPLICATION_CREDENTIALS service account JSON path is required for production.');
      process.exit(1);
    }
  } else if (target === 'emulator') {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
  } else {
    console.error(`[ERROR] Unsupported --target=${target}. Use "emulator" or "prod".`);
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), String(args.input));
  const rawJson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const rtdbSnapshot = rawJson.condo_state || rawJson;

  let condoFilesMap = rawJson.condo_files && typeof rawJson.condo_files === 'object' ? rawJson.condo_files : {};
  if (args['files-input']) {
    const filesPath = path.resolve(process.cwd(), String(args['files-input']));
    condoFilesMap = { ...condoFilesMap, ...JSON.parse(fs.readFileSync(filesPath, 'utf8')) };
  }

  // Load firebase-admin dynamically from functions/node_modules or root node_modules
  let adminAppMod, adminFirestoreMod, adminAuthMod, adminStorageMod;
  try {
    adminAppMod = await import('firebase-admin/app');
    adminFirestoreMod = await import('firebase-admin/firestore');
    adminAuthMod = await import('firebase-admin/auth');
    adminStorageMod = await import('firebase-admin/storage');
  } catch {
    adminAppMod = await import('../functions/node_modules/firebase-admin/lib/app/index.js');
    adminFirestoreMod = await import('../functions/node_modules/firebase-admin/lib/firestore/index.js');
    adminAuthMod = await import('../functions/node_modules/firebase-admin/lib/auth/index.js');
    adminStorageMod = await import('../functions/node_modules/firebase-admin/lib/storage/index.js');
  }

  const projectId = args.project || 'tarsashaz-cfe5d';
  const app = adminAppMod.initializeApp({
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
  });

  const auth = adminAuthMod.getAuth(app);
  const db = adminFirestoreMod.getFirestore(app);
  const bucket = adminStorageMod.getStorage(app).bucket();

  // Step 1: Collect all emails and resolve Firebase Auth UIDs
  const uidByEmailMap = {};
  if (!dryRun) {
    let nextPageToken;
    do {
      const listRes = await auth.listUsers(1000, nextPageToken);
      for (const u of listRes.users) {
        if (u.email) {
          uidByEmailMap[u.email.toLowerCase().trim()] = u.uid;
        }
      }
      nextPageToken = listRes.pageToken;
    } while (nextPageToken);
  }

  console.log(`[1/4] Transforming RTDB snapshot (${Object.keys(uidByEmailMap).length} Auth users resolved)...`);
  const plan = transformRtdbSnapshotToFirestore(rtdbSnapshot, {
    uidByEmailMap,
    condoFilesMap,
  });

  // Step 2: Mandatory 0-Ft Parity & Zero-Secret Gate BEFORE writing anything!
  console.log('[2/4] Running mandatory 0-Ft financial parity & zero-secret verification...');
  const parity = verifyFirestoreParityAgainstLegacy(rtdbSnapshot, plan);
  if (!parity.ok) {
    console.error('[ABORTED] Parity/security verification FAILED:');
    parity.discrepancies.forEach((d) => console.error(`  - ${d}`));
    process.exit(1);
  }
  console.log(
    `[OK] Parity verified with 0 Ft discrepancy: ${parity.checkedBuildings} building(s), ` +
    `${parity.checkedUnits} units, ${parity.checkedTransactions} ledger entries, ` +
    `${parity.checkedMonths} monthly rollups, ${plan.storageUploads.length} Storage files queued.`
  );

  if (dryRun) {
    console.log('[DRY-RUN] Exiting before writing to Firestore/Storage.');
    process.exit(0);
  }

  // Step 3: Upload Base64 files to Cloud Storage
  console.log(`[3/4] Uploading ${plan.storageUploads.length} binary document(s) to Cloud Storage...`);
  for (const upload of plan.storageUploads) {
    const decoded = decodeBase64DataUrl(upload.base64DataUrl);
    if (!decoded) continue;
    const fileRef = bucket.file(upload.storagePath);
    await fileRef.save(decoded.buffer, {
      contentType: decoded.mimeType,
      resumable: false,
      metadata: {
        cacheControl: 'private, max-age=3600',
      },
    });
  }

  // Step 4: Commit Firestore documents in safe 400-write batches
  console.log('[4/4] Writing multi-tenant Firestore collections...');
  const ops = [];

  for (const [uid, userDoc] of Object.entries(plan.users)) {
    ops.push({ ref: db.doc(`users/${uid}`), data: userDoc });
    if (userDoc.isSuperAdmin) {
      await auth.setCustomUserClaims(uid, { superadmin: true });
    }
  }

  for (const [uid, notifMap] of Object.entries(plan.userNotifications || {})) {
    for (const [notifId, notifData] of Object.entries(notifMap || {})) {
      ops.push({ ref: db.doc(`users/${uid}/notifications/${notifId}`), data: notifData });
    }
  }

  for (const [orgId, orgPlan] of Object.entries(plan.organizations || {})) {
    ops.push({ ref: db.doc(`organizations/${orgId}`), data: orgPlan.orgDoc });
    for (const [uid, mDoc] of Object.entries(orgPlan.members || {})) {
      ops.push({ ref: db.doc(`organizations/${orgId}/members/${uid}`), data: mDoc });
    }
    for (const [invId, invDoc] of Object.entries(orgPlan.invites || {})) {
      ops.push({ ref: db.doc(`organizations/${orgId}/invites/${invId}`), data: invDoc });
    }
  }

  for (const [bId, bPlan] of Object.entries(plan.buildings)) {
    ops.push({ ref: db.doc(`buildings/${bId}`), data: bPlan.buildingDoc });

    const subCollections = [
      ['members', bPlan.members],
      ['units', bPlan.units],
      ['categories', bPlan.categories],
      ['transactions', bPlan.transactions],
      ['monthlySummaries', bPlan.monthlySummaries],
      ['loans', bPlan.loans],
      ['documents', bPlan.documents],
      ['infoSections', bPlan.infoSections],
      ['calendarEvents', bPlan.calendarEvents],
      ['emailRules', bPlan.emailRules || {}],
      ['emailOutbox', bPlan.emailOutbox || {}],
      ['auditLogs', bPlan.auditLogs],
    ];

    for (const [subName, mapObj] of subCollections) {
      for (const [docId, docData] of Object.entries(mapObj)) {
        ops.push({ ref: db.doc(`buildings/${bId}/${subName}/${docId}`), data: docData });
      }
    }
  }

  const BATCH_SIZE = 400;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const chunk = ops.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const op of chunk) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();
    console.log(`  Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, ops.length)}/${ops.length} docs)`);
  }

  console.log(`\n✅ Migration to ${target.toUpperCase()} completed successfully (${ops.length} documents written, 0 Ft variance).`);
}

main().catch((err) => {
  console.error('[MIGRATION FAILED]', err);
  process.exit(1);
});
