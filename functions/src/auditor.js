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
    const [buildingPreSnap, unitsSnap] = await Promise.all([
      buildingRef.get(),
      db.collection(`buildings/${buildingId}/units`).get(),
    ]);
    if (!buildingPreSnap.exists) {
      throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
    }

    const unitsList = unitsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const findOwnedFlatInfo = (uid, email, fallbackFlatNum = '') => {
      const normEmail = normalizeEmail(email);
      for (const u of unitsList) {
        if (!u) continue;
        const uidMatch = Boolean(uid && Array.isArray(u.ownerUids) && u.ownerUids.includes(uid));
        const emailMatch = Boolean(
          normEmail &&
          Array.isArray(u.owners) &&
          u.owners.some((o) => {
            if (!o) return false;
            if (normalizeEmail(o.email) === normEmail) return true;
            return Array.isArray(o.emails) && o.emails.some((em) => normalizeEmail(em) === normEmail);
          })
        );
        if (uidMatch || emailMatch) {
          return { isOwner: true, flatNum: String(u.unitCode || u.flatNum || fallbackFlatNum || '').trim() || null };
        }
      }
      if (fallbackFlatNum) {
        return { isOwner: true, flatNum: String(fallbackFlatNum).trim() };
      }
      return { isOwner: false, flatNum: null };
    };

    const prevAuditor = buildingPreSnap.data()?.economicAuditor || {};
    const prevEmail = prevAuditor?.enabled ? normalizeEmail(prevAuditor.email) : '';
    const nextEmail = nextAuditor.enabled ? normalizeEmail(nextAuditor.email) : '';

    const auth = getAuth();
    const resolveOrProvisionUid = async (email, displayName, allowCreate) => {
      if (!email) return null;
      try {
        const u = await auth.getUserByEmail(email);
        if (u?.uid) return u.uid;
      } catch {
        // Fallback: check Firestore users collection by normalized email before creating
      }
      try {
        const uSnap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (!uSnap.empty) return uSnap.docs[0].id;
      } catch {
        // Ignore lookup error and proceed
      }
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
              isEconomicAuditor: false,
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
                  isEconomicAuditor: false,
                  unitIds,
                  active: nextActive,
                  buildingName: bName,
                },
              },
              updatedAt: nowTs,
            },
            { merge: true }
          );
        } else if (oldMem && oldMem.isEconomicAuditor) {
          // Resident also holds admin/szvb/owner role: keep their role, clear isEconomicAuditor flag
          const unitIds = Array.isArray(oldMem.unitIds) ? oldMem.unitIds : [];
          tx.set(
            db.doc(`buildings/${buildingId}/members/${prevUid}`),
            {
              ...oldMem,
              isEconomicAuditor: false,
              updatedAt: nowTs,
            },
            { merge: true }
          );
          tx.set(
            db.doc(`users/${prevUid}`),
            {
              memberships: {
                [buildingId]: {
                  role: oldMem.role || 'owner',
                  isEconomicAuditor: false,
                  unitIds,
                  active: oldMem.active !== false,
                  buildingName: bName,
                },
              },
              updatedAt: nowTs,
            },
            { merge: true }
          );
        }

        const prevOwnerInfo = findOwnedFlatInfo(prevUid, prevEmail, prevAuditor?.flatNum || '');
        const prevTargetProfile = prevOwnerInfo.isOwner
          ? { type: 'owner', buildingId, flatNum: prevOwnerInfo.flatNum }
          : { type: 'auditor', buildingId, flatNum: null };

        const revokeNotifId = makeId('notif');
        tx.set(db.doc(`users/${prevUid}/notifications/${revokeNotifId}`), {
          id: revokeNotifId,
          type: 'auditor_updated',
          severity: 'info',
          buildingId,
          buildingName: bName,
          flatNum: prevOwnerInfo.flatNum,
          targetProfile: prevTargetProfile,
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
          meta: { action: 'revoked', flatNum: prevOwnerInfo.flatNum },
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
          const nextOwnerInfo = findOwnedFlatInfo(nextUid, nextEmail, nextAuditor?.flatNum || '');
          const nextTargetProfile = nextOwnerInfo.isOwner
            ? { type: 'owner', buildingId, flatNum: nextOwnerInfo.flatNum }
            : { type: 'auditor', buildingId, flatNum: null };

          const grantNotifId = makeId('notif');
          tx.set(db.doc(`users/${nextUid}/notifications/${grantNotifId}`), {
            id: grantNotifId,
            type: 'auditor_updated',
            severity: 'info',
            buildingId,
            buildingName: bName,
            flatNum: nextOwnerInfo.flatNum,
            targetProfile: nextTargetProfile,
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
            meta: { action: 'granted', flatNum: nextOwnerInfo.flatNum },
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
