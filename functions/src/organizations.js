/**
 * Server-Side Multi-Company Organization Delegation, Invite Acceptance,
 * and Critical Bank Account Change Notification Cloud Functions (v2, europe-west1).
 *
 * Security Invariants Enforced Strictly Server-Side:
 * 1. Deleting buildings is strictly Owner/SuperAdmin-only (canDeleteBuildings is NEVER granted to staff).
 * 2. Staff with canManageTeam can NEVER modify/remove the Owner, modify themselves, or grant permissions they lack.
 * 3. Invites are cryptographically random, 7-day expiring, and strictly email-bound to request.auth.token.email.
 * 4. Whenever a colleague modifies a bank account number, a high-priority `severity: 'critical'` notification
 *    is written server-side to the Organization Owner's `users/{ownerUid}/notifications` subcollection
 *    alongside an immutable audit log entry.
 */

import crypto from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { assertBuildingAdmin } from './authGuard.js';

const REGION = 'europe-west1';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeStaffPermissions(raw = {}) {
  return {
    canCreateBuildings: Boolean(raw?.canCreateBuildings),
    canManageTeam: Boolean(raw?.canManageTeam),
    canEditBankAccounts: Boolean(raw?.canEditBankAccounts),
    canDeleteBuildings: false, // Strictly Owner-only invariant
  };
}

async function assertOrgTeamManager(db, auth, orgId) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  if (!orgId || typeof orgId !== 'string') {
    throw new HttpsError('invalid-argument', 'A valid orgId is required.');
  }

  const orgRef = db.doc(`organizations/${orgId}`);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) {
    throw new HttpsError('not-found', 'Organization not found.');
  }
  const orgData = orgSnap.data();

  if (auth.token?.superadmin === true) {
    return {
      uid: auth.uid,
      email: normalizeEmail(auth.token?.email),
      isSuperAdmin: true,
      isOwner: false,
      isStaff: false,
      permissions: {
        canCreateBuildings: true,
        canManageTeam: true,
        canEditBankAccounts: true,
        canDeleteBuildings: true,
      },
      orgRef,
      orgData,
    };
  }

  const memberSnap = await db.doc(`organizations/${orgId}/members/${auth.uid}`).get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', 'You are not a member of this organization.');
  }
  const member = memberSnap.data();
  if (member?.active !== true) {
    throw new HttpsError('permission-denied', 'Your organization membership is inactive.');
  }

  const isOwner = member.orgRole === 'owner';
  const perms = isOwner
    ? {
        canCreateBuildings: true,
        canManageTeam: true,
        canEditBankAccounts: true,
        canDeleteBuildings: true,
      }
    : normalizeStaffPermissions(member.permissions || member);

  if (!isOwner && !perms.canManageTeam) {
    throw new HttpsError('permission-denied', 'Team management permission is required.');
  }

  return {
    uid: auth.uid,
    email: normalizeEmail(auth.token?.email || member.email),
    isSuperAdmin: false,
    isOwner,
    isStaff: !isOwner,
    permissions: perms,
    orgRef,
    orgData,
  };
}

function assertNoEscalation(actor, targetMember, requestedPerms) {
  if (targetMember?.orgRole === 'owner' && !actor.isSuperAdmin) {
    throw new HttpsError('permission-denied', 'Organization owner cannot be modified or removed.');
  }
  if (requestedPerms?.canDeleteBuildings === true) {
    throw new HttpsError('permission-denied', 'Deleting buildings is strictly Owner-only.');
  }
  if (actor.isStaff) {
    if (targetMember && normalizeEmail(targetMember.email) === actor.email) {
      throw new HttpsError('permission-denied', 'Staff members cannot modify their own permissions.');
    }
    if (requestedPerms) {
      if (requestedPerms.canCreateBuildings && !actor.permissions.canCreateBuildings) {
        throw new HttpsError('permission-denied', 'Cannot grant permission you do not hold.');
      }
      if (requestedPerms.canEditBankAccounts && !actor.permissions.canEditBankAccounts) {
        throw new HttpsError('permission-denied', 'Cannot grant permission you do not hold.');
      }
      if (requestedPerms.canManageTeam && !actor.permissions.canManageTeam) {
        throw new HttpsError('permission-denied', 'Cannot grant permission you do not hold.');
      }
    }
  }
}

export const manageOrganizationMember = onCall({ region: REGION }, async (request) => {
  const db = getFirestore();
  const {
    orgId,
    action,
    targetUid = null,
    email = '',
    name = '',
    buildingScope = 'selected',
    buildingIds = [],
    permissions = {},
    resetPersonalContacts = false,
  } = request.data || {};

  const actor = await assertOrgTeamManager(db, request.auth, orgId);

  if (action === 'invite') {
    const cleanEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(cleanEmail)) {
      throw new HttpsError('invalid-argument', 'A valid email address is required.');
    }
    if (normalizeEmail(actor.orgData.ownerEmail) === cleanEmail) {
      throw new HttpsError('invalid-argument', 'Organization owner already holds full access.');
    }

    const safePerms = normalizeStaffPermissions(permissions);
    assertNoEscalation(actor, { email: cleanEmail, orgRole: 'staff' }, safePerms);

    const token = crypto.randomBytes(16).toString('hex');
    const inviteRef = db.collection(`organizations/${orgId}/invites`).doc();
    const cleanScope = buildingScope === 'all' ? 'all' : 'selected';
    const cleanBuildingIds = cleanScope === 'all'
      ? []
      : Array.from(new Set((Array.isArray(buildingIds) ? buildingIds : []).map(String).filter(Boolean)));

    const invitePayload = {
      id: inviteRef.id,
      orgId,
      token,
      email: cleanEmail,
      name: String(name || cleanEmail.split('@')[0]).trim(),
      buildingScope: cleanScope,
      buildingIds: cleanBuildingIds,
      permissions: safePerms,
      status: 'pending',
      createdByUid: actor.uid,
      createdByEmail: actor.email,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
    };

    await inviteRef.set(invitePayload);

    // If the user already exists in Firebase Auth, also send a notification immediately
    try {
      const authUser = await getAuth().getUserByEmail(cleanEmail);
      if (authUser?.uid) {
        await db.collection(`users/${authUser.uid}/notifications`).add({
          type: 'team_assigned',
          severity: 'info',
          orgId,
          titleHu: 'Meghívást kaptál társasház-kezelésre',
          titleEn: 'You Were Invited to Manage Condominiums',
          messageHu: `${actor.email} meghívott a(z) ${actor.orgData.name || 'cég'} csapatába.`,
          messageEn: `${actor.email} invited you to join ${actor.orgData.name || 'the organization'}.`,
          read: false,
          dismissed: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch {
      // User may not have registered yet — invite link handles onboarding
    }

    return {
      success: true,
      inviteId: inviteRef.id,
      token,
    };
  }

  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'targetUid is required for this action.');
  }

  const targetRef = db.doc(`organizations/${orgId}/members/${targetUid}`);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new HttpsError('not-found', 'Target organization member not found.');
  }
  const targetMember = targetSnap.data();

  if (action === 'update') {
    const safePerms = normalizeStaffPermissions(permissions);
    assertNoEscalation(actor, targetMember, safePerms);

    const cleanScope = buildingScope === 'all' ? 'all' : 'selected';
    const cleanBuildingIds = cleanScope === 'all'
      ? []
      : Array.from(new Set((Array.isArray(buildingIds) ? buildingIds : []).map(String).filter(Boolean)));

    await targetRef.update({
      name: name ? String(name).trim() : targetMember.name,
      buildingScope: cleanScope,
      buildingIds: cleanBuildingIds,
      permissions: safePerms,
      canCreateBuildings: safePerms.canCreateBuildings,
      canManageTeam: safePerms.canManageTeam,
      canEditBankAccounts: safePerms.canEditBankAccounts,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  }

  if (action === 'suspend' || action === 'reactivate') {
    assertNoEscalation(actor, targetMember, null);
    const nextActive = action === 'reactivate';
    await targetRef.update({
      active: nextActive,
      status: nextActive ? 'active' : 'suspended',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true, active: nextActive };
  }

  if (action === 'remove') {
    assertNoEscalation(actor, targetMember, null);
    const batch = db.batch();
    batch.delete(targetRef);

    if (resetPersonalContacts && targetMember.email) {
      const bSnap = await db.collection('buildings').where('organizationId', '==', orgId).get();
      bSnap.forEach((docSnap) => {
        const b = docSnap.data();
        if (
          b?.contactDisplayMode === 'manager' &&
          normalizeEmail(b?.managerContact?.email) === normalizeEmail(targetMember.email)
        ) {
          batch.update(docSnap.ref, {
            contactDisplayMode: 'company',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
    }

    await batch.commit();
    return { success: true };
  }

  throw new HttpsError('invalid-argument', `Unsupported action: ${String(action)}`);
});

export const acceptOrganizationInvite = onCall({ region: REGION }, async (request) => {
  const db = getFirestore();
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  const { orgId, token } = request.data || {};
  if (!orgId || !token || typeof token !== 'string') {
    throw new HttpsError('invalid-argument', 'orgId and token are required.');
  }

  const callerEmail = normalizeEmail(request.auth.token?.email);
  if (!callerEmail) {
    throw new HttpsError('failed-precondition', 'Authenticated account has no email address.');
  }

  const invitesSnap = await db
    .collection(`organizations/${orgId}/invites`)
    .where('token', '==', token.trim())
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (invitesSnap.empty) {
    throw new HttpsError('not-found', 'Invite token is invalid or already used.');
  }

  const inviteDoc = invitesSnap.docs[0];
  const invite = inviteDoc.data();

  if (normalizeEmail(invite.email) !== callerEmail) {
    throw new HttpsError('permission-denied', 'This invitation belongs to a different email address.');
  }

  if (invite.expiresAt && invite.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError('deadline-exceeded', 'This invitation link has expired.');
  }

  const safePerms = normalizeStaffPermissions(invite.permissions);
  const memberRef = db.doc(`organizations/${orgId}/members/${request.auth.uid}`);

  await db.runTransaction(async (tx) => {
    tx.set(
      memberRef,
      {
        uid: request.auth.uid,
        email: callerEmail,
        name: String(request.auth.token?.name || invite.name || callerEmail).trim(),
        orgRole: 'staff',
        active: true,
        status: 'active',
        buildingScope: invite.buildingScope === 'all' ? 'all' : 'selected',
        buildingIds: Array.isArray(invite.buildingIds) ? invite.buildingIds : [],
        permissions: safePerms,
        canCreateBuildings: safePerms.canCreateBuildings,
        canManageTeam: safePerms.canManageTeam,
        canEditBankAccounts: safePerms.canEditBankAccounts,
        acceptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.update(inviteDoc.ref, {
      status: 'accepted',
      acceptedAt: FieldValue.serverTimestamp(),
      acceptedByUid: request.auth.uid,
    });
  });

  return { success: true, orgId };
});

export const notifyBankAccountChange = onCall({ region: REGION }, async (request) => {
  const db = getFirestore();
  const { buildingId, changes = [] } = request.data || {};
  const actor = await assertBuildingAdmin(db, request.auth, buildingId);

  if (!Array.isArray(changes) || changes.length === 0) {
    return { success: true, notified: false };
  }

  const buildingSnap = await db.doc(`buildings/${buildingId}`).get();
  if (!buildingSnap.exists) {
    throw new HttpsError('not-found', 'Building not found.');
  }
  const building = buildingSnap.data();
  const orgId = building?.organizationId;
  if (!orgId) {
    return { success: true, notified: false };
  }

  const orgSnap = await db.doc(`organizations/${orgId}`).get();
  const org = orgSnap.exists ? orgSnap.data() : null;
  const ownerUid = org?.ownerUid || null;
  const bName = String(building?.name || 'Társasház');

  const safeChanges = changes.slice(0, 10).map((c) => ({
    accountLabelHu: String(c?.accountLabelHu || 'Bankszámla').slice(0, 80),
    accountLabelEn: String(c?.accountLabelEn || 'Bank Account').slice(0, 80),
    oldAccount: String(c?.oldAccount || '—').slice(0, 64),
    newAccount: String(c?.newAccount || '—').slice(0, 64),
    changeType: String(c?.changeType || 'modified').slice(0, 20),
  }));

  const summaryHu = safeChanges.map((c) => `${c.accountLabelHu}: ${c.oldAccount} → ${c.newAccount}`).join('; ');
  const summaryEn = safeChanges.map((c) => `${c.accountLabelEn}: ${c.oldAccount} → ${c.newAccount}`).join('; ');

  const batch = db.batch();

  // Always write an immutable building audit log entry
  const auditRef = db.collection(`buildings/${buildingId}/auditLogs`).doc();
  batch.set(auditRef, {
    buildingId,
    action: 'BANK_ACCOUNT_CHANGED',
    entityType: 'building',
    entityId: buildingId,
    actorUid: actor.uid,
    actorEmail: actor.email,
    actorRole: actor.role,
    timestamp: FieldValue.serverTimestamp(),
    summary: `Bank account modified by ${actor.email}: ${summaryEn}`,
    changes: safeChanges,
  });

  // Notify Organization Owner with a highlighted pale-red (`severity: 'critical'`) notification
  let notified = false;
  if (ownerUid && ownerUid !== actor.uid) {
    const notifRef = db.collection(`users/${ownerUid}/notifications`).doc();
    batch.set(notifRef, {
      type: 'bank_account_changed',
      severity: 'critical',
      buildingId,
      buildingName: bName,
      actorUid: actor.uid,
      actorEmail: actor.email,
      titleHu: `Bankszámlaszám módosítva – ${bName}`,
      titleEn: `Bank Account Changed – ${bName}`,
      messageHu: `${actor.email} módosította a(z) ${bName} bankszámlaszámát: ${summaryHu}`,
      messageEn: `${actor.email} changed bank account details for ${bName}: ${summaryEn}`,
      changes: safeChanges,
      read: false,
      dismissed: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    notified = true;
  }

  await batch.commit();
  return { success: true, notified };
});
