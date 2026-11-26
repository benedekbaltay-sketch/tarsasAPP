/**
 * Atomic Server-Side Economic Auditor (Tht. 51/A. §) Management Cloud Function (v2, europe-west1)
 *
 * Atomically synchronizes in a single Firestore transaction:
 *   1. buildings/{buildingId}.economicAuditor
 *   2. buildings/{buildingId}/members/{uid} (role: 'auditor' <-> 'owner'/inactive; preserves admin/szvb & unitIds)
 *   3. users/{uid}.memberships[buildingId]
 *   4. users/{uid}/notifications/{notifId} (bilingual HU/EN appointment / revocation notices)
 *   5. buildings/{buildingId}/auditLogs/{auditLogId} (immutable forensic trail)
 */

import crypto from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { assertBuildingAdmin } from './authGuard.js';

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeAuditorInput(raw = {}, actorEmail = '') {
  const enabled = Boolean(raw?.enabled);
  const exemptQualifiedSzvbMember = Boolean(raw?.exemptQualifiedSzvbMember);
  const type = raw?.type === 'internal' ? 'internal' : 'external';
  const email = enabled ? normalizeEmail(raw?.email) : '';
  return {
    enabled: Boolean(enabled && email),
    type,
    name: enabled ? String(raw?.name || '').trim().slice(0, 120) : '',
    email,
    phone: enabled ? String(raw?.phone || '').trim().slice(0, 40) : '',
    companyName: enabled ? String(raw?.companyName || '').trim().slice(0, 140) : '',
    qualification: enabled ? String(raw?.qualification || '').trim().slice(0, 140) : '',
    registrationNumber: enabled ? String(raw?.registrationNumber || '').trim().slice(0, 80) : '',
    flatNum: enabled && type === 'internal' ? String(raw?.flatNum || '').trim().slice(0, 40) : '',
    isSzvbMember: Boolean(enabled && raw?.isSzvbMember),
    validFrom: enabled ? String(raw?.validFrom || '').trim().slice(0, 20) : '',
    validTo: enabled ? String(raw?.validTo || '').trim().slice(0, 20) : '',
    exemptQualifiedSzvbMember,
    updatedBy: normalizeEmail(actorEmail),
  };
}

export const manageEconomicAuditor = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const { buildingId, auditor = {} } = request.data || {};
    const db = getFirestore();
    const actor = await assertBuildingAdmin(db, request.auth, buildingId);

    const nextAuditor = sanitizeAuditorInput(auditor, actor.email);
    const buildingRef = db.doc(`buildings/${buildingId}`);
    const buildingPreSnap = await buildingRef.get();
    if (!buildingPreSnap.exists) {
      throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
    }

    const prevAuditor = buildingPreSnap.data()?.economicAuditor || {};
    const prevEmail = prevAuditor?.enabled ? normalizeEmail(prevAuditor.email) : '';
    const nextEmail = nextAuditor.enabled ? normalizeEmail(nextAuditor.email) : '';

    const auth = getAuth();
    const resolveOrProvisionUid = async (email, displayName, allowCreate) => {
      if (!email) return null;
      try {
        const u = await auth.getUserByEmail(email);
        return u?.uid || null;
      } catch {
        if (!allowCreate) return null;
        try {
          const created = await auth.createUser({
            email,
            displayName: displayName || email.split('@')[0],
            emailVerified: false,
          });
          return created?.uid || null;
        } catch {
          return null;
        }
      }
    };

    const [prevUid, nextUid] = await Promise.all([
      prevEmail ? resolveOrProvisionUid(prevEmail, '', false) : Promise.resolve(null),
      nextEmail ? resolveOrProvisionUid(nextEmail, nextAuditor.name, nextAuditor.type === 'external') : Promise.resolve(null),
    ]);

    const touchedUids = Array.from(new Set([prevUid, nextUid].filter(Boolean)));
    const auditLogId = makeId('audit');
    const auditRef = db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`);

    await db.runTransaction(async (tx) => {
      const buildingSnap = await tx.get(buildingRef);
      if (!buildingSnap.exists) {
        throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
      }
      const bData = buildingSnap.data() || {};
      const bName = bData.name || buildingId;

      const existingMembers = new Map();
      for (const uid of touchedUids) {
        const mSnap = await tx.get(db.doc(`buildings/${buildingId}/members/${uid}`));
        if (mSnap.exists) existingMembers.set(uid, mSnap.data());
      }

      const nowTs = FieldValue.serverTimestamp();
      const nowIso = new Date().toISOString();

      tx.update(buildingRef, {
        economicAuditor: { ...nextAuditor, updatedAt: nowIso },
        updatedAt: nowTs,
        lastAuditLogId: auditLogId,
      });

      // Revoke old auditor if replaced or disabled
      if (prevUid && prevUid !== nextUid) {
        const oldMem = existingMembers.get(prevUid);
        if (oldMem && oldMem.role === 'auditor') {
          const unitIds = Array.isArray(oldMem.unitIds) ? oldMem.unitIds : [];
          const hasUnits = unitIds.length > 0;
          const nextRole = hasUnits ? 'owner' : 'auditor';
          const nextActive = hasUnits;
          tx.set(
            db.doc(`buildings/${buildingId}/members/${prevUid}`),
            {
              ...oldMem,
              role: nextRole,
              active: nextActive,
              updatedAt: nowTs,
            },
            { merge: true }
          );
          tx.set(
            db.doc(`users/${prevUid}`),
            {
              memberships: {
                [buildingId]: {
                  role: nextRole,
                  unitIds,
                  active: nextActive,
                  buildingName: bName,
                },
              },
              updatedAt: nowTs,
            },
            { merge: true }
          );
        }

        const revokeNotifId = makeId('notif');
        tx.set(db.doc(`users/${prevUid}/notifications/${revokeNotifId}`), {
          id: revokeNotifId,
          type: 'auditor_updated',
          severity: 'info',
          buildingId,
          buildingName: bName,
          recipientEmail: prevEmail,
          actorName: actor.email,
          actorEmail: actor.email,
          titleHu: `Gazdasági ellenőri megbízás megszűnt (${bName})`,
          titleEn: `Financial Auditor Access Revoked (${bName})`,
          messageHu: `A(z) ${bName} társasházban a gazdasági ellenőrzést segítő szerepköröd megszüntetésre került.`,
          messageEn: `Your Financial Auditor read-only access for ${bName} has been revoked.`,
          read: false,
          archived: false,
          deleted: false,
          dismissed: false,
          meta: { action: 'revoked' },
          createdAt: nowTs,
        });
      }

      // Grant new auditor membership
      if (nextUid && nextAuditor.enabled) {
        const existing = existingMembers.get(nextUid) || {};
        const unitIds = Array.isArray(existing.unitIds) ? existing.unitIds : [];
        // Never downgrade existing admin or szvb role
        const nextRole =
          existing.role === 'admin' || existing.role === 'szvb'
            ? existing.role
            : 'auditor';
        tx.set(
          db.doc(`buildings/${buildingId}/members/${nextUid}`),
          {
            uid: nextUid,
            email: nextEmail,
            name: nextAuditor.name || existing.name || nextEmail,
            role: nextRole,
            isEconomicAuditor: true,
            unitIds,
            active: true,
            grantedBy: actor.uid,
            grantedAt: existing.grantedAt || nowTs,
            updatedAt: nowTs,
          },
          { merge: true }
        );
        tx.set(
          db.doc(`users/${nextUid}`),
          {
            uid: nextUid,
            email: nextEmail,
            memberships: {
              [buildingId]: {
                role: nextRole,
                isEconomicAuditor: true,
                unitIds,
                active: true,
                buildingName: bName,
              },
            },
            updatedAt: nowTs,
          },
          { merge: true }
        );

        if (nextEmail !== prevEmail) {
          const grantNotifId = makeId('notif');
          tx.set(db.doc(`users/${nextUid}/notifications/${grantNotifId}`), {
            id: grantNotifId,
            type: 'auditor_updated',
            severity: 'info',
            buildingId,
            buildingName: bName,
            recipientEmail: nextEmail,
            actorName: actor.email,
            actorEmail: actor.email,
            titleHu: `Gazdasági ellenőri megbízás (${bName})`,
            titleEn: `Appointed as Financial Auditor (${bName})`,
            messageHu: `Kijelölésre kerültél a(z) ${bName} társasház gazdasági ellenőrzést segítő személyeként (csak olvasási ellenőri és véleményező jogkörrel).`,
            messageEn: `You have been appointed as Financial Audit Assistant for ${bName} with read-only audit & opinion access.`,
            read: false,
            archived: false,
            deleted: false,
            dismissed: false,
            meta: { action: 'granted' },
            createdAt: nowTs,
          });
        }
      }

      tx.set(auditRef, {
        id: auditLogId,
        buildingId,
        action: 'auditor.update',
        entityType: 'building',
        entityId: buildingId,
        actorUid: actor.uid,
        actorEmail: actor.email || '',
        actorRole: actor.role,
        timestamp: nowTs,
        summary: nextAuditor.enabled
          ? `Economic auditor set to ${nextAuditor.name || nextAuditor.email} (${nextAuditor.type})`
          : 'Economic auditor disabled',
        before: prevAuditor || null,
        after: nextAuditor,
      });
    });

    return {
      success: true,
      buildingId,
      auditLogId,
      auditor: nextAuditor,
    };
  }
);
