/**
 * Atomic Server-Side Building Lifecycle Cloud Function (v2, europe-west1)
 *
 * Handles three strictly role-gated lifecycle operations in Cloud Firestore:
 *   1. `archive` (Organization Owner or SuperAdmin ONLY — NEVER staff/viewers/residents):
 *      Soft-deletes a condominium into the SuperAdmin Archive (`archived: true`, `organizationId: null`),
 *      strips it from org staff assignments, deactivates memberships so it disappears from KK/staff/resident
 *      sessions, and records an immutable forensic auditLog.
 *   2. `restore` (SuperAdmin ONLY):
 *      Restores an archived (or unassigned) condominium and assigns it to the chosen Organization Owner,
 *      granting admin/owner membership and re-enabling previously active resident unit memberships.
 *   3. `permanent_delete` (SuperAdmin ONLY, strictly from Archive + exact name confirmation):
 *      Cleans up all user memberships, deletes Cloud Storage objects under `buildings/{buildingId}/`,
 *      and permanently erases `buildings/{buildingId}` + all subcollections via `db.recursiveDelete()`.
 */

import crypto from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { assertSuperAdmin } from './authGuard.js';

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function resolveUidByEmail(db, email) {
  const norm = normalizeEmail(email);
  if (!norm) return null;
  try {
    const rec = await getAuth().getUserByEmail(norm);
    if (rec?.uid) return rec.uid;
  } catch {
    // Fallback to Firestore users collection
  }
  try {
    const snap = await db.collection('users').where('email', '==', norm).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Verifies caller is either SuperAdmin OR the verified Organization Owner of `buildingId`.
 * Strictly rejects delegated staff, viewers, SZVB, auditors, and residents.
 */
async function assertBuildingOwnerOrSuperAdmin(db, auth, buildingId, buildingData) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  const callerEmail = normalizeEmail(auth.token?.email);
  if (auth.token?.superadmin === true) {
    return { uid: auth.uid, email: callerEmail, role: 'superadmin' };
  }

  const orgId = buildingData?.organizationId || null;
  if (orgId) {
    const [orgSnap, orgMemSnap] = await Promise.all([
      db.doc(`organizations/${orgId}`).get(),
      db.doc(`organizations/${orgId}/members/${auth.uid}`).get(),
    ]);
    const orgData = orgSnap.exists ? orgSnap.data() : null;
    const isOwnerEmail = Boolean(orgData && normalizeEmail(orgData.ownerEmail) === callerEmail && callerEmail);
    const isOwnerMember = Boolean(
      orgMemSnap.exists &&
      orgMemSnap.data()?.active === true &&
      orgMemSnap.data()?.orgRole === 'owner'
    );
    if (isOwnerEmail || isOwnerMember) {
      return { uid: auth.uid, email: callerEmail, role: 'owner', orgData };
    }
    throw new HttpsError(
      'permission-denied',
      'Only the organization owner or SuperAdmin can delete (archive) a condominium.'
    );
  }

  // Legacy building without organizationId: allow only active non-staff owner/admin member
  const memSnap = await db.doc(`buildings/${buildingId}/members/${auth.uid}`).get();
  const mem = memSnap.exists ? memSnap.data() : null;
  const isLegacyOwnerAdmin = Boolean(
    mem &&
    mem.active === true &&
    mem.role === 'admin' &&
    mem.staffBuildingRole !== 'viewer' &&
    (!mem.orgRole || mem.orgRole === 'owner')
  );
  if (!isLegacyOwnerAdmin) {
    throw new HttpsError(
      'permission-denied',
      'Only the account owner or SuperAdmin can delete (archive) a condominium.'
    );
  }
  return { uid: auth.uid, email: callerEmail || normalizeEmail(mem.email), role: 'owner', orgData: null };
}

export const manageBuildingLifecycle = onCall(
  { region: 'europe-west1', enforceAppCheck: false },
  async (request) => {
    const {
      action,
      buildingId,
      targetOrgId = null,
      targetOwnerEmail = '',
      targetOwnerName = '',
      confirmBuildingName = '',
    } = request.data || {};

    if (!buildingId || typeof buildingId !== 'string') {
      throw new HttpsError('invalid-argument', 'A valid buildingId is required.');
    }

    const db = getFirestore();
    const buildingRef = db.doc(`buildings/${buildingId}`);
    const buildingSnap = await buildingRef.get();
    if (!buildingSnap.exists) {
      throw new HttpsError('not-found', `Building "${buildingId}" not found.`);
    }
    const bData = buildingSnap.data() || {};
    const nowIso = new Date().toISOString();
    const nowTs = FieldValue.serverTimestamp();

    // =========================================================================
    // 1. ARCHIVE (Soft-Delete -> SuperAdmin Archive)
    // =========================================================================
    if (action === 'archive') {
      const actor = await assertBuildingOwnerOrSuperAdmin(db, request.auth, buildingId, bData);
      if (bData.archived === true) {
        return {
          success: true,
          action: 'archive',
          buildingId,
          alreadyArchived: true,
        };
      }

      const prevOrgId = bData.organizationId || null;
      let prevOrgData = actor.orgData || null;
      if (!prevOrgData && prevOrgId) {
        const orgSnap = await db.doc(`organizations/${prevOrgId}`).get();
        if (orgSnap.exists) prevOrgData = orgSnap.data();
      }

      const prevOwnerEmail = normalizeEmail(
        prevOrgData?.ownerEmail || bData.repContact?.email || bData.email || actor.email
      );
      const prevOwnerName = String(
        prevOrgData?.ownerName || prevOrgData?.name || bData.repContact?.name || bData.repName || actor.email || ''
      ).trim();

      const membersSnap = await db.collection(`buildings/${buildingId}/members`).get();
      const auditLogId = makeId('audit');

      const batch = db.batch();
      batch.update(buildingRef, {
        archived: true,
        archivedAt: nowIso,
        archivedBy: actor.email || '',
        archivedByName: String(request.auth.token?.name || actor.email || '').trim(),
        archivedFromOrgId: prevOrgId,
        archivedFromOwnerEmail: prevOwnerEmail,
        archivedFromOwnerName: prevOwnerName,
        organizationId: null,
        updatedAt: nowTs,
        lastAuditLogId: auditLogId,
      });

      // Remove buildingId from staff buildingIds inside the previous organization
      if (prevOrgId && prevOrgData && Array.isArray(prevOrgData.members)) {
        const cleanedMembers = prevOrgData.members.map((m) => ({
          ...m,
          buildingIds: Array.isArray(m?.buildingIds)
            ? m.buildingIds.filter((id) => id !== buildingId)
            : [],
        }));
        batch.update(db.doc(`organizations/${prevOrgId}`), {
          members: cleanedMembers,
          updatedAt: nowTs,
        });
      }

      // Deactivate memberships so KK, staff, SZVB, auditors & residents no longer load this archived building
      for (const mDoc of membersSnap.docs) {
        const mUid = mDoc.id;
        const mData = mDoc.data() || {};
        const wasActive = mData.active !== false;
        batch.set(
          mDoc.ref,
          {
            active: false,
            archivedPrevActive: wasActive,
            updatedAt: nowTs,
          },
          { merge: true }
        );
        batch.set(
          db.doc(`users/${mUid}`),
          {
            memberships: {
              [buildingId]: {
                role: mData.role || 'owner',
                unitIds: Array.isArray(mData.unitIds) ? mData.unitIds : [],
                active: false,
                archived: true,
                buildingName: bData.name || buildingId,
              },
            },
            updatedAt: nowTs,
          },
          { merge: true }
        );
      }

      batch.set(db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`), {
        id: auditLogId,
        buildingId,
        action: 'building.archive',
        entityType: 'building',
        entityId: buildingId,
        actorUid: actor.uid,
        actorEmail: actor.email || '',
        actorRole: actor.role,
        timestamp: nowTs,
        summary: `Condominium "${bData.name || buildingId}" archived by ${actor.email || actor.uid}`,
        before: { archived: false, organizationId: prevOrgId },
        after: { archived: true, organizationId: null, archivedFromOrgId: prevOrgId },
      });

      await batch.commit();

      return {
        success: true,
        action: 'archive',
        buildingId,
        archivedAt: nowIso,
        archivedFromOrgId: prevOrgId,
        archivedFromOwnerEmail: prevOwnerEmail,
        archivedFromOwnerName: prevOwnerName,
      };
    }

    // =========================================================================
    // 2. RESTORE / TRANSFER TO OWNER (SuperAdmin ONLY)
    // =========================================================================
    if (action === 'restore') {
      const actor = assertSuperAdmin(request.auth);
      const normTargetEmail = normalizeEmail(targetOwnerEmail);
      const cleanTargetName = String(targetOwnerName || '').trim();

      if (!targetOrgId && !normTargetEmail) {
        throw new HttpsError('invalid-argument', 'A target owner organization or email is required.');
      }

      let resolvedOrgId = targetOrgId || null;
      let resolvedOrgData = null;

      if (resolvedOrgId) {
        const orgSnap = await db.doc(`organizations/${resolvedOrgId}`).get();
        if (orgSnap.exists) resolvedOrgData = orgSnap.data();
      }
      if (!resolvedOrgData && normTargetEmail) {
        const orgQuery = await db
          .collection('organizations')
          .where('ownerEmail', '==', normTargetEmail)
          .limit(1)
          .get();
        if (!orgQuery.empty) {
          resolvedOrgId = orgQuery.docs[0].id;
          resolvedOrgData = orgQuery.docs[0].data();
        }
      }

      const resolvedEmail = normalizeEmail(resolvedOrgData?.ownerEmail || normTargetEmail);
      const resolvedOwnerName = String(
        resolvedOrgData?.ownerName || resolvedOrgData?.name || cleanTargetName || resolvedEmail.split('@')[0] || 'Közös Képviselő'
      ).trim();

      const targetUid = await resolveUidByEmail(db, resolvedEmail);
      const membersSnap = await db.collection(`buildings/${buildingId}/members`).get();
      const auditLogId = makeId('audit');
      const batch = db.batch();

      // Create an explicit organization doc if the target owner didn't have one yet
      if (!resolvedOrgId && resolvedEmail) {
        resolvedOrgId = makeId('org');
        const newOrgDoc = {
          id: resolvedOrgId,
          name: resolvedOwnerName,
          ownerEmail: resolvedEmail,
          ownerName: resolvedOwnerName,
          includeLegacyBuildings: false,
          taxNumber: '',
          centralContact: {
            name: resolvedOwnerName,
            email: resolvedEmail,
            phone: '',
            officeHours: '',
          },
          showCentralContactToResidents: true,
          members: [
            {
              id: `owner-${Date.now()}`,
              ...(targetUid ? { uid: targetUid } : {}),
              email: resolvedEmail,
              name: resolvedOwnerName,
              phone: '',
              orgRole: 'owner',
              active: true,
              status: 'active',
              buildingScope: 'all',
              buildingIds: [],
              permissions: {
                canCreateBuildings: true,
                canManageTeam: true,
                teamManageScope: 'all',
                canEditBankAccounts: true,
                canDeleteBuildings: true,
              },
              createdAt: nowIso,
            },
          ],
          invites: [],
          createdAt: nowIso,
          updatedAt: nowTs,
        };
        batch.set(db.doc(`organizations/${resolvedOrgId}`), newOrgDoc);
        if (targetUid) {
          batch.set(
            db.doc(`organizations/${resolvedOrgId}/members/${targetUid}`),
            {
              uid: targetUid,
              email: resolvedEmail,
              name: resolvedOwnerName,
              orgRole: 'owner',
              active: true,
              canCreateBuildings: true,
              canManageTeam: true,
              teamManageScope: 'all',
              canEditBankAccounts: true,
              canDeleteBuildings: true,
              updatedAt: nowTs,
            },
            { merge: true }
          );
        }
      }

      batch.update(buildingRef, {
        archived: false,
        organizationId: resolvedOrgId,
        'repContact.name': resolvedOwnerName,
        'repContact.email': resolvedEmail,
        restoredAt: nowIso,
        restoredBy: actor.email || '',
        restoredToOrgId: resolvedOrgId,
        restoredToOwnerEmail: resolvedEmail,
        archivedAt: FieldValue.delete(),
        archivedBy: FieldValue.delete(),
        archivedByName: FieldValue.delete(),
        updatedAt: nowTs,
        lastAuditLogId: auditLogId,
      });

      // Re-activate previously active resident/SZVB memberships (never re-enable old unrelated admins!)
      for (const mDoc of membersSnap.docs) {
        const mUid = mDoc.id;
        const mData = mDoc.data() || {};
        if (mUid === targetUid) continue;
        if (mData.archivedPrevActive === true && (mData.role === 'owner' || mData.role === 'szvb')) {
          batch.set(
            mDoc.ref,
            {
              active: true,
              archivedPrevActive: FieldValue.delete(),
              updatedAt: nowTs,
            },
            { merge: true }
          );
          batch.set(
            db.doc(`users/${mUid}`),
            {
              memberships: {
                [buildingId]: {
                  role: mData.role,
                  unitIds: Array.isArray(mData.unitIds) ? mData.unitIds : [],
                  active: true,
                  archived: false,
                  buildingName: bData.name || buildingId,
                },
              },
              updatedAt: nowTs,
            },
            { merge: true }
          );
        }
      }

      // Grant the target Owner active admin/owner membership on this building
      if (targetUid) {
        const existingTargetMem = membersSnap.docs.find((d) => d.id === targetUid)?.data() || {};
        const unitIds = Array.isArray(existingTargetMem.unitIds) ? existingTargetMem.unitIds : [];
        batch.set(
          db.doc(`buildings/${buildingId}/members/${targetUid}`),
          {
            uid: targetUid,
            email: resolvedEmail,
            name: resolvedOwnerName,
            role: 'admin',
            orgRole: 'owner',
            staffBuildingRole: null,
            canEditBankAccounts: true,
            unitIds,
            active: true,
            archivedPrevActive: FieldValue.delete(),
            grantedBy: actor.uid,
            grantedAt: existingTargetMem.grantedAt || nowTs,
            updatedAt: nowTs,
          },
          { merge: true }
        );
        batch.set(
          db.doc(`users/${targetUid}`),
          {
            uid: targetUid,
            email: resolvedEmail,
            ...(resolvedOrgId ? { orgIds: FieldValue.arrayUnion(resolvedOrgId) } : {}),
            memberships: {
              [buildingId]: {
                role: 'admin',
                orgRole: 'owner',
                unitIds,
                active: true,
                archived: false,
                buildingName: bData.name || buildingId,
              },
            },
            updatedAt: nowTs,
          },
          { merge: true }
        );
      }

      batch.set(db.doc(`buildings/${buildingId}/auditLogs/${auditLogId}`), {
        id: auditLogId,
        buildingId,
        action: 'building.restore',
        entityType: 'building',
        entityId: buildingId,
        actorUid: actor.uid,
        actorEmail: actor.email || '',
        actorRole: actor.role,
        timestamp: nowTs,
        summary: `Condominium "${bData.name || buildingId}" restored & assigned to ${resolvedEmail}`,
        before: { archived: true, organizationId: null },
        after: { archived: false, organizationId: resolvedOrgId, ownerEmail: resolvedEmail },
      });

      await batch.commit();

      return {
        success: true,
        action: 'restore',
        buildingId,
        organizationId: resolvedOrgId,
        ownerEmail: resolvedEmail,
        ownerName: resolvedOwnerName,
      };
    }

    // =========================================================================
    // 3. PERMANENT DELETE FROM ARCHIVE (SuperAdmin ONLY + Name Confirmation)
    // =========================================================================
    if (action === 'permanent_delete') {
      assertSuperAdmin(request.auth);

      if (bData.archived !== true) {
        throw new HttpsError(
          'failed-precondition',
          'Only archived condominiums can be permanently deleted. Archive the condominium first.'
        );
      }

      const expectedName = String(bData.name || '').trim().toLowerCase();
      const providedName = String(confirmBuildingName || '').trim().toLowerCase();
      if (!expectedName || providedName !== expectedName) {
        throw new HttpsError(
          'invalid-argument',
          'Building name confirmation does not match.'
        );
      }

      // 1. Clean up every user's `memberships[buildingId]` entry
      const membersSnap = await db.collection(`buildings/${buildingId}/members`).get();
      if (!membersSnap.empty) {
        const cleanupBatch = db.batch();
        for (const mDoc of membersSnap.docs) {
          const mUid = mDoc.id;
          cleanupBatch.set(
            db.doc(`users/${mUid}`),
            {
              memberships: {
                [buildingId]: FieldValue.delete(),
              },
              updatedAt: nowTs,
            },
            { merge: true }
          );
        }
        await cleanupBatch.commit();
      }

      // 2. Best-effort delete all Cloud Storage files under `buildings/{buildingId}/`
      try {
        const bucket = getStorage().bucket();
        await bucket.deleteFiles({ prefix: `buildings/${buildingId}/` });
      } catch (storageErr) {
        console.warn(`Storage cleanup warning for building ${buildingId}:`, storageErr?.message);
      }

      // 3. Recursively & permanently delete `buildings/{buildingId}` and ALL its subcollections
      await db.recursiveDelete(buildingRef);

      return {
        success: true,
        action: 'permanent_delete',
        buildingId,
      };
    }

    throw new HttpsError('invalid-argument', `Unsupported lifecycle action "${action}".`);
  }
);
