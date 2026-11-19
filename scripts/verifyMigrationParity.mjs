#!/usr/bin/env node
/**
 * Read-Only Post-Migration 0-Ft Parity Verifier
 *
 * Reads actual documents back from Cloud Firestore (Emulator or Production)
 * and verifies HUF-for-HUF parity against the source RTDB export snapshot.
 *
 * Usage:
 *   node scripts/verifyMigrationParity.mjs --input=./mock_export.json --target=emulator
 */

import fs from 'node:fs';
import path from 'node:path';
import { verifyFirestoreParityAgainstLegacy } from './rtdbToFirestoreTransform.js';

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const [k, ...rest] = raw.replace(/^--/, '').split('=');
    args[k] = rest.length > 0 ? rest.join('=') : true;
  }
  return args;
}

async function readCollectionMap(colRef) {
  const snap = await colRef.get();
  const out = {};
  snap.forEach((doc) => {
    out[doc.id] = doc.data();
  });
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const target = args.target || 'emulator';

  if (!args.input) {
    console.error('[ERROR] Missing --input=<path-to-rtdb-condo_state.json>');
    process.exit(1);
  }

  if (target === 'emulator') {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  } else if (target === 'prod' && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('[ERROR] GOOGLE_APPLICATION_CREDENTIALS is required to verify against production.');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), String(args.input));
  const rawJson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const rtdbSnapshot = rawJson.condo_state || rawJson;

  let adminAppMod, adminFirestoreMod;
  try {
    adminAppMod = await import('firebase-admin/app');
    adminFirestoreMod = await import('firebase-admin/firestore');
  } catch {
    adminAppMod = await import('../functions/node_modules/firebase-admin/lib/app/index.js');
    adminFirestoreMod = await import('../functions/node_modules/firebase-admin/lib/firestore/index.js');
  }

  const projectId = args.project || 'tarsashaz-cfe5d';
  const app = adminAppMod.initializeApp({ projectId });
  const db = adminFirestoreMod.getFirestore(app);

  // Reconstruct read-back plan from live/emulator Firestore
  const users = await readCollectionMap(db.collection('users'));
  const buildings = {};
  const bSnaps = await db.collection('buildings').get();

  for (const bDoc of bSnaps.docs) {
    const bId = bDoc.id;
    buildings[bId] = {
      buildingDoc: bDoc.data(),
      members: await readCollectionMap(db.collection(`buildings/${bId}/members`)),
      units: await readCollectionMap(db.collection(`buildings/${bId}/units`)),
      categories: await readCollectionMap(db.collection(`buildings/${bId}/categories`)),
      transactions: await readCollectionMap(db.collection(`buildings/${bId}/transactions`)),
      monthlySummaries: await readCollectionMap(db.collection(`buildings/${bId}/monthlySummaries`)),
      loans: await readCollectionMap(db.collection(`buildings/${bId}/loans`)),
      documents: await readCollectionMap(db.collection(`buildings/${bId}/documents`)),
      infoSections: await readCollectionMap(db.collection(`buildings/${bId}/infoSections`)),
      calendarEvents: await readCollectionMap(db.collection(`buildings/${bId}/calendarEvents`)),
      auditLogs: await readCollectionMap(db.collection(`buildings/${bId}/auditLogs`)),
    };
  }

  const report = verifyFirestoreParityAgainstLegacy(rtdbSnapshot, { users, buildings });

  if (!report.ok) {
    console.error(`❌ PARITY CHECK FAILED (${report.discrepancies.length} issue(s)):`);
    report.discrepancies.forEach((d) => console.error(`  - ${d}`));
    process.exit(1);
  }

  console.log(
    `✅ 100% 0-FT PARITY VERIFIED on ${target.toUpperCase()}: ` +
    `${report.checkedBuildings} building(s), ${report.checkedUnits} units, ` +
    `${report.checkedTransactions} transactions, ${report.checkedMonths} monthly rollups, 0 security leaks.`
  );
}

main().catch((err) => {
  console.error('[VERIFICATION ERROR]', err);
  process.exit(1);
});
