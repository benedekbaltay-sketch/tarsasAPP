/**
 * Atomic Server-Side SZVB (Accounting Committee) Management Cloud Function (v2, europe-west1)
 *
 * Atomically synchronizes in a single Firestore transaction:
 *   1. buildings/{buildingId}.szvb (chairperson + members)
 *   2. buildings/{buildingId}/members/{uid} (role: 'szvb' <-> 'owner', preserving unitIds; never downgrades admins)
 *   3. users/{uid}.memberships[buildingId]
 *   4. buildings/{buildingId}/units/{unitId}.owners[] (isBoardMember + boardRole)
 *   5. users/{uid}/notifications/{notifId} (bilingual HU/EN grant/change/revoke guidance messages)
 *   6. buildings/{buildingId}/auditLogs/{auditLogId} (immutable forensic trail)
 */

import crypto from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { assertBuildingAdmin } from './authGuard.js';
import {
  normalizeEmail,
  sanitizeSzvbPayload,
  computeSzvbMembershipPlan,
} from './szvbCore.js';

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Resolve Firebase Auth UIDs for a set of normalized emails.
 * Missing accounts are simply omitted so the caller receives them in `unresolvedEmails`.
 */
async function resolveUidsByEmails(db, emails = []) {
  const map = new Map();
  const unique = Array.from(new Set(emails.map(normalizeEmail).filter(Boolean)));
  if (unique.length === 0) return map;

  const auth = getAuth();
  await Promise.all(
    unique.map(async (email) => {
      try {
        const userRec = await auth.getUserByEmail(email);
        if (userRec?.uid) {
          map.set(email, userRec.uid);
          return;
        }
      } catch {
        // Fallback to Firestore users collection below
      }
      try {
        const uSnap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!uSnap.empty) {
          map.set(email, uSnap.docs[0].id);
        }
      } catch {
        // Owner does not have a provisioned account yet
      }
    })
  );
  return map;
}

export const manageSzvbMembers = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const { buildingId, chairperson = null, members = [] } = request.data || {};

    const db = getFirestore();
    const actor = await assertBuildingAdmin(db, request.auth, buildingId);

    const sanitizedInput = sanitizeSzvbPayload({ chairperson, members });

    // Pre-fetch building, current SZVB members, and building units to determine all emails/UIDs to lock in transaction
    const buildingRef = db.doc(`buildings/${buildingId}`);
    const [buildingPreSnap, currentSzvbMembersSnap, unitsSnap] = await Promise.all([
      buildingRef.get(),
      db.collection(`buildings/${buildingId}/members`).where('role', '==', 'szvb').get(),
      db.collection(`buildings/${buildingId}/units`).get(),
    ]);

    if (!buildingPreSnap.exists) {
      throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
    }

    const prevSzvbPre = sanitizeSzvbPayload(buildingPreSnap.data()?.szvb || {});
    const emailsToResolve = [
      sanitizedInput.chairperson?.email,
      ...sanitizedInput.members.map((m) => m.email),
      prevSzvbPre.chairperson?.email,
      ...prevSzvbPre.members.map((m) => m.email),
    ].filter(Boolean);

    const resolvedUidByEmail = await resolveUidsByEmails(db, emailsToResolve);

    // Collect every UID that will be read/updated inside the atomic transaction
    const touchedUidSet = new Set();
    for (const uid of resolvedUidByEmail.values()) {
      touchedUidSet.add(uid);
    }
    currentSzvbMembersSnap.docs.forEach((d) => touchedUidSet.add(d.id));
    const touchedUids = Array.from(touchedUidSet);

    const unitsList = unitsSnap.docs.map((d) => ({
      id: d.id,
      ref: d.ref,
      ...d.data(),
    }));

    const auditLogId = makeId('audit');
    const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

    let planResult = null;

    await db.runTransaction(async (tx) => {
      // 1. ALL READS FIRST (Firestore transaction requirement)
      const buildingSnap = await tx.get(buildingRef);
      if (!buildingSnap.exists) {
        throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
      }
      const buildingData = buildingSnap.data() || {};

      const existingMembersByUid = new Map();
      const memberRefsByUid = new Map();
      for (const uid of touchedUids) {
        const mRef = db.doc(`buildings/${buildingId}/members/${uid}`);
        memberRefsByUid.set(uid, mRef);
        const mSnap = await tx.get(mRef);
        if (mSnap.exists) {
          existingMembersByUid.set(uid, mSnap.data());
        }
      }

      // Compute deterministic mutation plan
      planResult = computeSzvbMembershipPlan({
        buildingId,
        buildingName: buildingData.name || buildingId,
        prevSzvb: buildingData.szvb || null,
        nextSzvbRaw: sanitizedInput,
        existingMembersByUid,
        resolvedUidByEmail,
        units: unitsList,
        actor,
      });

      const nowTs = FieldValue.serverTimestamp();
      const nowIso = new Date().toISOString();

      // 2. ATOMIC WRITES
      // 2a. Update buildings/{buildingId}.szvb
      tx.update(buildingRef, {
        szvb: {
          ...planResult.szvbDoc,
          updatedAt: nowIso,
        },
        updatedAt: nowTs,
        lastAuditLogId: auditLogId,
      });

      // 2b. Promote / downgrade buildings/{buildingId}/members/{uid} & users/{uid}.memberships
      for (const { uid, memberDoc, userMembershipPatch } of planResult.memberWrites) {
        const existing = existingMembersByUid.get(uid);
        const mRef = memberRefsByUid.get(uid) || db.doc(`buildings/${buildingId}/members/${uid}`);
        tx.set(
          mRef,
          {
            ...memberDoc,
            grantedAt: existing?.grantedAt || nowTs,
            updatedAt: nowTs,
          },
          { merge: true }
        );

        const uRef = db.doc(`users/${uid}`);
        tx.set(
          uRef,
          {
            uid,
            email: memberDoc.email,
            memberships: {
              [buildingId]: userMembershipPatch,
            },
            updatedAt: nowTs,
          },
          { merge: true }
        );
      }

      // 2c. Synchronize units/{unitId}.owners[] (isBoardMember + boardRole)
      for (const { unitId, owners } of planResult.unitUpdates) {
        tx.update(db.doc(`buildings/${buildingId}/units/${unitId}`), {
          owners,
          updatedAt: nowTs,
          lastAuditLogId: auditLogId,
        });
      }

      // 2d. Write bilingual notifications to users/{uid}/notifications/{notifId}
      for (const { uid, notification } of planResult.notificationsToSend) {
        const notifId = makeId('notif');
        tx.set(db.doc(`users/${uid}/notifications/${notifId}`), {
          id: notifId,
          ...notification,
          createdAt: nowTs,
        });
      }

      // 2e. Write immutable forensic audit log entry
      tx.set(auditRef, {
        id: auditLogId,
        buildingId,
        action: 'szvb.update',
        entityType: 'building',
        entityId: buildingId,
        actorUid: actor.uid,
        actorEmail: actor.email || '',
        actorRole: actor.role,
        timestamp: nowTs,
        summary: planResult.auditSummary,
        before: planResult.prevSzvb,
        after: planResult.szvbDoc,
        promotedUids: planResult.promotedUids,
        modifiedUids: planResult.modifiedUids,
        revokedUids: planResult.revokedUids,
        unresolvedEmails: planResult.unresolvedEmails,
      });
    });

    return {
      success: true,
      buildingId,
      auditLogId,
      szvb: planResult.szvbDoc,
      promotedUids: planResult.promotedUids,
      modifiedUids: planResult.modifiedUids,
      revokedUids: planResult.revokedUids,
      notifiedCount: planResult.notificationsToSend.length,
      unresolvedEmails: planResult.unresolvedEmails,
    };
  }
);
