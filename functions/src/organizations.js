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
  const canManageTeam = Boolean(raw?.canManageTeam);
  return {
    canCreateBuildings: Boolean(raw?.canCreateBuildings),
    canManageTeam,
    teamManageScope: canManageTeam ? (raw?.teamManageScope === 'assigned' ? 'assigned' : 'all') : 'assigned',
    canEditBankAccounts: Boolean(raw?.canEditBankAccounts),
    canDeleteBuildings: false, // Strictly Owner-only invariant
  };
}

function stripUndefinedDeep(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => stripUndefinedDeep(item));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) out[k] = stripUndefinedDeep(v);
  }
  return out;
}

async function resolveUidByEmail(email) {
  const clean = normalizeEmail(email);
  if (!clean) return null;
  try {
    const userRec = await getAuth().getUserByEmail(clean);
    return userRec?.uid || null;
  } catch {
    return null;
  }
}

/**
 * Synchronizes a staff member's building-level RBAC documents (`buildings/{bId}/members/{uid}`
 * and `users/{uid}.memberships[bId]`) across all buildings owned by `orgId`.
 * Preserves existing unitIds (if the staff member also owns a flat) and never locks them
 * out of their personal apartment when suspended/removed from staff!
 */
async function syncStaffBuildingMemberships(db, { orgId, targetUid, targetEmail, memberObj, isRemoved = false }) {
  if (!targetUid) return;
  const bSnap = await db.collection('buildings').where('organizationId', '==', orgId).get();
  if (bSnap.empty) return;

  const isActiveStaff = !isRemoved && memberObj && memberObj.active !== false && memberObj.status !== 'suspended';
  const scope = memberObj?.buildingScope === 'all' ? 'all' : 'selected';
  const assignedIds = new Set(Array.isArray(memberObj?.buildingIds) ? memberObj.buildingIds : []);
  const assignments = memberObj?.buildingAssignments || {};
  const perms = normalizeStaffPermissions(memberObj?.permissions || memberObj);

  const batch = db.batch();
  const userMembershipsPatch = {};

  for (const bDoc of bSnap.docs) {
    const bId = bDoc.id;
    const bData = bDoc.data() || {};
    const mRef = db.doc(`buildings/${bId}/members/${targetUid}`);
    const mSnap = await mRef.get();
    const existing = mSnap.exists ? mSnap.data() : null;
    const existingUnitIds = Array.isArray(existing?.unitIds) ? existing.unitIds : [];

    const hasStaffAccess = isActiveStaff && (scope === 'all' || assignedIds.has(bId));
    const bAssign = assignments[bId] || {};
    const isViewerOnly = bAssign.role === 'viewer';
    const canEditBank = !isViewerOnly && Boolean(bAssign.canEditBankAccounts ?? perms.canEditBankAccounts);

    if (hasStaffAccess) {
      // Check if SZVB / Owner unitIds exist; staff access grants building admin (or viewer metadata)
      batch.set(
        mRef,
        {
          uid: targetUid,
          email: normalizeEmail(targetEmail || memberObj?.email || existing?.email),
          name: String(memberObj?.name || existing?.name || targetEmail || ''),
          role: 'admin',
          orgRole: 'staff',
          staffBuildingRole: isViewerOnly ? 'viewer' : 'manager',
          canEditBankAccounts: canEditBank,
          unitIds: existingUnitIds,
          active: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      userMembershipsPatch[bId] = {
        buildingName: bData.name || bId,
        role: 'admin',
        orgRole: 'staff',
        staffBuildingRole: isViewerOnly ? 'viewer' : 'manager',
        unitIds: existingUnitIds,
        active: true,
      };
    } else if (existing && existing.orgRole === 'staff') {
      // Revoke staff access on this building; fall back to personal Owner/SZVB role if they own a unit
      const hasPersonalUnits = existingUnitIds.length > 0;
      const fallbackRole = hasPersonalUnits ? 'owner' : 'admin';
      const fallbackActive = hasPersonalUnits;
      batch.set(
        mRef,
        {
          ...existing,
          role: fallbackRole,
          orgRole: null,
          staffBuildingRole: null,
          canEditBankAccounts: false,
          active: fallbackActive,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      userMembershipsPatch[bId] = {
        buildingName: bData.name || bId,
        role: fallbackRole,
        unitIds: existingUnitIds,
        active: fallbackActive,
      };
    }
  }

  if (Object.keys(userMembershipsPatch).length > 0) {
    batch.set(
      db.doc(`users/${targetUid}`),
      {
        uid: targetUid,
        email: normalizeEmail(targetEmail || memberObj?.email),
        orgIds: isRemoved ? FieldValue.arrayRemove(orgId) : FieldValue.arrayUnion(orgId),
        memberships: userMembershipsPatch,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
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

  const callerEmail = normalizeEmail(auth.token?.email);
  const memberSnap = await db.doc(`organizations/${orgId}/members/${auth.uid}`).get();
  const isDocOwner =
    orgData.ownerUid === auth.uid ||
    (callerEmail && normalizeEmail(orgData.ownerEmail) === callerEmail);

  if (!memberSnap.exists && !isDocOwner) {
    throw new HttpsError('permission-denied', 'You are not a member of this organization.');
  }
  const member = memberSnap.exists ? memberSnap.data() : { orgRole: 'owner', active: true, email: callerEmail };
  if (member?.active !== true && !isDocOwner) {
    throw new HttpsError('permission-denied', 'Your organization membership is inactive.');
  }

  const isOwner = isDocOwner || member.orgRole === 'owner';
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
    memberId = null,
    targetEmail = '',
    email = '',
    name = '',
    phone = '',
    buildingScope = 'selected',
    buildingIds = [],
    permissions = {},
    buildingAssignments = null,
    resetPersonalContacts = false,
    notification = null,
    memberRecord = null,
    inviteRecord = null,
    inviteId = null,
    fromMemberId = null,
    toMemberId = null,
    fromEmail = '',
    toEmail = '',
  } = request.data || {};

  const actor = await assertOrgTeamManager(db, request.auth, orgId);
  const orgMembersList = Array.isArray(actor.orgData?.members) ? [...actor.orgData.members] : [];
  const orgInvitesList = Array.isArray(actor.orgData?.invites) ? [...actor.orgData.invites] : [];

  const writeNotifToUid = async (uid, rawNotif) => {
    if (!uid || !rawNotif || typeof rawNotif !== 'object') return;
    const notifId = String(rawNotif.id || `notif-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
    const cleanNotif = stripUndefinedDeep({
      ...rawNotif,
      id: notifId,
      read: false,
      archived: false,
      deleted: false,
      dismissed: false,
    });
    await db.doc(`users/${uid}/notifications/${notifId}`).set({
      ...cleanNotif,
      createdAt: FieldValue.serverTimestamp(),
    });
  };

  if (action === 'attach') {
    const cleanEmail = normalizeEmail(email || targetEmail || memberRecord?.email);
    if (!EMAIL_RE.test(cleanEmail)) {
      throw new HttpsError('invalid-argument', 'A valid email address is required.');
    }
    const safePerms = normalizeStaffPermissions(permissions || memberRecord?.permissions);
    assertNoEscalation(actor, { email: cleanEmail, orgRole: 'staff' }, safePerms);

    let authUid = await resolveUidByEmail(cleanEmail);
    if (!authUid) {
      try {
        const created = await getAuth().createUser({
          email: cleanEmail,
          displayName: String(name || memberRecord?.name || cleanEmail.split('@')[0]).trim(),
          emailVerified: false,
        });
        authUid = created?.uid || null;
      } catch {
        authUid = null;
      }
    }

    const cleanScope = buildingScope === 'all' ? 'all' : 'selected';
    const cleanBuildingIds = cleanScope === 'all'
      ? []
      : Array.from(new Set((Array.isArray(buildingIds) ? buildingIds : []).map(String).filter(Boolean)));
    const nowIso = new Date().toISOString();
    const cleanMember = stripUndefinedDeep({
      ...(memberRecord || {}),
      id: memberRecord?.id || `member-${Date.now()}`,
      uid: authUid || memberRecord?.uid || null,
      email: cleanEmail,
      name: String(name || memberRecord?.name || cleanEmail.split('@')[0]).trim(),
      phone: String(phone || memberRecord?.phone || '').trim(),
      orgRole: 'staff',
      active: true,
      status: 'active',
      buildingScope: cleanScope,
      buildingIds: cleanBuildingIds,
      buildingAssignments: buildingAssignments || memberRecord?.buildingAssignments || {},
      permissions: safePerms,
      updatedAt: nowIso,
    });

    const existingIdx = orgMembersList.findIndex((m) => m && normalizeEmail(m.email) === cleanEmail);
    const nextMembers = existingIdx >= 0
      ? orgMembersList.map((m, i) => (i === existingIdx ? { ...m, ...cleanMember } : m))
      : [...orgMembersList, cleanMember];
    const nextInvites = inviteRecord
      ? [stripUndefinedDeep(inviteRecord), ...orgInvitesList.filter((i) => i && normalizeEmail(i.email) !== cleanEmail)]
      : orgInvitesList;

    await actor.orgRef.update({
      members: nextMembers,
      invites: nextInvites,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (authUid) {
      await db.doc(`organizations/${orgId}/members/${authUid}`).set(
        {
          uid: authUid,
          email: cleanEmail,
          name: cleanMember.name,
          phone: cleanMember.phone,
          orgRole: 'staff',
          active: true,
          status: 'active',
          buildingScope: cleanScope,
          buildingIds: cleanBuildingIds,
          buildingAssignments: cleanMember.buildingAssignments,
          permissions: safePerms,
          canCreateBuildings: safePerms.canCreateBuildings,
          canManageTeam: safePerms.canManageTeam,
          canEditBankAccounts: safePerms.canEditBankAccounts,
          canDeleteBuildings: false,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await syncStaffBuildingMemberships(db, {
        orgId,
        targetUid: authUid,
        targetEmail: cleanEmail,
        memberObj: cleanMember,
      });
      if (notification) {
        await writeNotifToUid(authUid, notification);
      }
    }

    return { success: true, uid: authUid };
  }

  if (action === 'revoke_invite') {
    if (!inviteId) throw new HttpsError('invalid-argument', 'inviteId is required.');
    const nextInvites = orgInvitesList.filter((i) => i && i.id !== inviteId);
    await actor.orgRef.update({
      invites: nextInvites,
      updatedAt: FieldValue.serverTimestamp(),
    });
    try { await db.doc(`organizations/${orgId}/invites/${inviteId}`).delete(); } catch {}
    return { success: true };
  }

  if (action === 'handover') {
    const fromMem = orgMembersList.find((m) => m && (m.id === fromMemberId || normalizeEmail(m.email) === normalizeEmail(fromEmail)));
    const toMem = orgMembersList.find((m) => m && (m.id === toMemberId || normalizeEmail(m.email) === normalizeEmail(toEmail)));
    if (!fromMem || !toMem || fromMem.orgRole === 'owner') {
      throw new HttpsError('not-found', 'Source or target member not found.');
    }
    assertNoEscalation(actor, fromMem, null);
    if (toMem.orgRole !== 'owner') assertNoEscalation(actor, toMem, null);

    const nowIso = new Date().toISOString();
    let updatedFrom = fromMem;
    let updatedTo = toMem;
    const nextMembers = orgMembersList.map((m) => {
      if (m.id === toMem.id && m.orgRole !== 'owner') {
        if (fromMem.buildingScope === 'all' || m.buildingScope === 'all') {
          updatedTo = { ...m, buildingScope: 'all', buildingIds: [], updatedAt: nowIso };
        } else {
          const mergedIds = Array.from(new Set([...(m.buildingIds || []), ...(fromMem.buildingIds || [])]));
          updatedTo = { ...m, buildingScope: 'selected', buildingIds: mergedIds, updatedAt: nowIso };
        }
        return updatedTo;
      }
      if (m.id === fromMem.id) {
        updatedFrom = { ...m, buildingScope: 'selected', buildingIds: [], updatedAt: nowIso };
        return updatedFrom;
      }
      return m;
    });

    await actor.orgRef.update({
      members: nextMembers,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const fromUid = await resolveUidByEmail(fromMem.email);
    const toUid = await resolveUidByEmail(toMem.email);
    if (fromUid) {
      await db.doc(`organizations/${orgId}/members/${fromUid}`).set({ buildingScope: 'selected', buildingIds: [], updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      await syncStaffBuildingMemberships(db, { orgId, targetUid: fromUid, targetEmail: fromMem.email, memberObj: updatedFrom });
    }
    if (toUid) {
      if (toMem.orgRole !== 'owner') {
        await db.doc(`organizations/${orgId}/members/${toUid}`).set({ buildingScope: updatedTo.buildingScope, buildingIds: updatedTo.buildingIds, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await syncStaffBuildingMemberships(db, { orgId, targetUid: toUid, targetEmail: toMem.email, memberObj: updatedTo });
      }
      if (notification) {
        await writeNotifToUid(toUid, notification);
      }
    }
    return { success: true };
  }

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

    // Ensure Auth identity exists, generate official password-setup link, and optionally send custom HTML welcome email
    let authUser = null;
    try {
      authUser = await getAuth().getUserByEmail(cleanEmail);
    } catch {
      try {
        authUser = await getAuth().createUser({
          email: cleanEmail,
          displayName: invitePayload.name,
          emailVerified: false,
        });
      } catch {
        authUser = null;
      }
    }

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

    const appOrigin = (process.env.APP_PUBLIC_ORIGIN || 'https://tarsashaz-cfe5d.web.app').replace(/\/+$/, '');
    const continueUrl = `${appOrigin}/?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(cleanEmail)}&passwordSet=1`;
    let passwordSetupLink = null;
    try {
      passwordSetupLink = await getAuth().generatePasswordResetLink(cleanEmail, { url: continueUrl });
    } catch {
      passwordSetupLink = null;
    }

    let emailDispatched = false;
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    const mailFrom = (process.env.INVITE_EMAIL_FROM || 'TarsasApp <noreply@tarsasapp.hu>').trim();
    if (resendKey && passwordSetupLink) {
      const orgTitle = String(actor.orgData.name || 'Közös Képviselet').replace(/[<>&"]/g, '');
      const recName = String(invitePayload.name || cleanEmail).replace(/[<>&"]/g, '');
      const safeLink = passwordSetupLink.replace(/"/g, '&quot;');
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: mailFrom,
            to: [cleanEmail],
            subject: `TarsasApp meghívó – ${orgTitle}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;border:1px solid #e5e7eb;border-radius:16px;"><h2 style="color:#1E3A8A;margin-top:0;">Meghívó a TarsasApp rendszerbe</h2><p>Kedves <strong>${recName}</strong>!</p><p><strong>${orgTitle}</strong> társasházkezelői hozzáférést adott számodra a TarsasApp portálon.</p><p>Az alábbi gombra kattintva megadhatod a saját jelszavadat, majd a mentés után a rendszer azonnal a bejelentkezési felületre irányít:</p><p style="margin:24px 0;"><a href="${safeLink}" style="display:inline-block;background:#1E3A8A;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">Jelszó beállítása és aktiválás</a></p></div>`,
          }),
        });
        emailDispatched = resp.ok;
      } catch {
        emailDispatched = false;
      }
    }

    return {
      success: true,
      inviteId: inviteRef.id,
      token,
      emailDispatched,
    };
  }

  // Locate target member cleanly by memberId, email, or Firebase Auth UID
  const cleanTargetEmail = normalizeEmail(targetEmail || email);
  const targetInOrgArray = orgMembersList.find(
    (m) =>
      m &&
      ((memberId && m.id === memberId) ||
        (targetUid && (m.uid === targetUid || m.id === targetUid)) ||
        (cleanTargetEmail && normalizeEmail(m.email) === cleanTargetEmail))
  );

  const resolvedEmail = normalizeEmail(cleanTargetEmail || targetInOrgArray?.email);
  let resolvedUid = (targetUid && !String(targetUid).startsWith('member-')) ? targetUid : (targetInOrgArray?.uid && !String(targetInOrgArray.uid).startsWith('member-') ? targetInOrgArray.uid : null);
  if (!resolvedUid && resolvedEmail) {
    resolvedUid = await resolveUidByEmail(resolvedEmail);
  }

  let targetRef = resolvedUid ? db.doc(`organizations/${orgId}/members/${resolvedUid}`) : null;
  let targetSnap = targetRef ? await targetRef.get() : null;
  const targetMember = targetSnap?.exists ? targetSnap.data() : targetInOrgArray;

  if (!targetMember) {
    throw new HttpsError('not-found', 'Target organization member not found.');
  }

  if (action === 'update') {
    const safePerms = normalizeStaffPermissions(permissions);
    assertNoEscalation(actor, targetMember, safePerms);

    const cleanScope = buildingScope === 'all' ? 'all' : 'selected';
    const cleanBuildingIds = cleanScope === 'all'
      ? []
      : Array.from(new Set((Array.isArray(buildingIds) ? buildingIds : []).map(String).filter(Boolean)));
    const cleanAssignments = buildingAssignments && typeof buildingAssignments === 'object'
      ? stripUndefinedDeep(buildingAssignments)
      : (targetInOrgArray?.buildingAssignments || targetMember.buildingAssignments || {});
    const cleanName = name ? String(name).trim() : (targetInOrgArray?.name || targetMember.name || resolvedEmail);
    const cleanPhone = phone !== undefined ? String(phone).trim() : (targetInOrgArray?.phone || targetMember.phone || '');
    const nowIso = new Date().toISOString();

    const claimedContactBuildingIds = new Set(
      Object.entries(cleanAssignments || {})
        .filter(([bId, a]) => a && a.showManagerContact && (cleanScope === 'all' || cleanBuildingIds.includes(bId)))
        .map(([bId]) => bId)
    );

    let updatedMemberObj = null;
    const nextMembers = orgMembersList.map((m) => {
      if (
        m &&
        ((memberId && m.id === memberId) ||
          (resolvedEmail && normalizeEmail(m.email) === resolvedEmail) ||
          (resolvedUid && m.uid === resolvedUid))
      ) {
        updatedMemberObj = {
          ...m,
          uid: resolvedUid || m.uid || null,
          name: cleanName,
          phone: cleanPhone,
          buildingScope: cleanScope,
          buildingIds: cleanBuildingIds,
          permissions: safePerms,
          buildingAssignments: cleanAssignments,
          updatedAt: nowIso,
        };
        return updatedMemberObj;
      }
      if (claimedContactBuildingIds.size > 0 && m && m.buildingAssignments) {
        let changedOther = false;
        const nextOther = { ...m.buildingAssignments };
        claimedContactBuildingIds.forEach((bId) => {
          if (nextOther[bId]?.showManagerContact) {
            nextOther[bId] = { ...nextOther[bId], showManagerContact: false };
            changedOther = true;
          }
        });
        if (changedOther) return { ...m, buildingAssignments: nextOther };
      }
      return m;
    });

    await actor.orgRef.update({
      members: nextMembers,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (targetRef && resolvedUid) {
      await targetRef.set(
        {
          uid: resolvedUid,
          email: resolvedEmail || normalizeEmail(targetMember.email),
          name: cleanName,
          phone: cleanPhone,
          orgRole: targetMember.orgRole || 'staff',
          active: targetMember.active !== false,
          status: targetMember.status || 'active',
          buildingScope: cleanScope,
          buildingIds: cleanBuildingIds,
          buildingAssignments: cleanAssignments,
          permissions: safePerms,
          canCreateBuildings: safePerms.canCreateBuildings,
          canManageTeam: safePerms.canManageTeam,
          canEditBankAccounts: safePerms.canEditBankAccounts,
          canDeleteBuildings: false,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      await syncStaffBuildingMemberships(db, {
        orgId,
        targetUid: resolvedUid,
        targetEmail: resolvedEmail,
        memberObj: updatedMemberObj || {
          ...targetMember,
          name: cleanName,
          buildingScope: cleanScope,
          buildingIds: cleanBuildingIds,
          buildingAssignments: cleanAssignments,
          permissions: safePerms,
        },
      });
    }

    // Sync resident contact mode on affected org buildings
    const bSnap = await db.collection('buildings').where('organizationId', '==', orgId).get();
    const contactBatch = db.batch();
    let hasContactWrites = false;
    bSnap.forEach((bDoc) => {
      const b = bDoc.data() || {};
      const isAssigned = cleanScope === 'all' || cleanBuildingIds.includes(bDoc.id);
      const bAssign = cleanAssignments[bDoc.id];
      const patch = {};
      if (isAssigned && bAssign) {
        if (bAssign.showManagerContact) {
          patch.contactDisplayMode = 'manager';
          patch.managerContact = {
            name: cleanName,
            email: resolvedEmail,
            phone: cleanPhone || b.managerContact?.phone || '',
            officeHours: b.managerContact?.officeHours || '',
            titleHu: 'Felelős házkezelő',
            titleEn: 'Responsible Property Manager',
          };
        } else if (
          b.contactDisplayMode === 'manager' &&
          normalizeEmail(b.managerContact?.email) === resolvedEmail
        ) {
          patch.contactDisplayMode = 'company';
        }
        if (bAssign.showCentralContact !== undefined) {
          patch.showCentralContactToResidents = Boolean(bAssign.showCentralContact);
        }
      } else if (
        b.contactDisplayMode === 'manager' &&
        normalizeEmail(b.managerContact?.email) === resolvedEmail
      ) {
        patch.contactDisplayMode = 'company';
      }
      if (Object.keys(patch).length > 0) {
        contactBatch.update(bDoc.ref, { ...patch, updatedAt: FieldValue.serverTimestamp() });
        hasContactWrites = true;
      }
    });
    if (hasContactWrites) await contactBatch.commit();

    // Deliver bilingual team permission change notification to the colleague's Firestore inbox
    if (notification && resolvedUid) {
      await writeNotifToUid(resolvedUid, notification);
    }

    return { success: true, notified: Boolean(notification && resolvedUid) };
  }

  if (action === 'suspend' || action === 'reactivate') {
    assertNoEscalation(actor, targetMember, null);
    const nextActive = action === 'reactivate';
    const nowIso = new Date().toISOString();
    let updatedMemberObj = null;
    const nextMembers = orgMembersList.map((m) => {
      if (
        m &&
        ((memberId && m.id === memberId) ||
          (resolvedEmail && normalizeEmail(m.email) === resolvedEmail) ||
          (resolvedUid && m.uid === resolvedUid))
      ) {
        updatedMemberObj = { ...m, active: nextActive, status: nextActive ? 'active' : 'suspended', updatedAt: nowIso };
        return updatedMemberObj;
      }
      return m;
    });
    await actor.orgRef.update({ members: nextMembers, updatedAt: FieldValue.serverTimestamp() });
    if (targetRef && resolvedUid) {
      await targetRef.set(
        { active: nextActive, status: nextActive ? 'active' : 'suspended', updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      await syncStaffBuildingMemberships(db, {
        orgId,
        targetUid: resolvedUid,
        targetEmail: resolvedEmail,
        memberObj: updatedMemberObj || { ...targetMember, active: nextActive, status: nextActive ? 'active' : 'suspended' },
      });
    }
    return { success: true, active: nextActive };
  }

  if (action === 'remove') {
    assertNoEscalation(actor, targetMember, null);
    const nextMembers = orgMembersList.filter(
      (m) =>
        !(m &&
          ((memberId && m.id === memberId) ||
            (resolvedEmail && normalizeEmail(m.email) === resolvedEmail) ||
            (resolvedUid && m.uid === resolvedUid)))
    );
    const nextInvites = orgInvitesList.filter((inv) => !(inv && resolvedEmail && normalizeEmail(inv.email) === resolvedEmail));
    await actor.orgRef.update({
      members: nextMembers,
      invites: nextInvites,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const batch = db.batch();
    if (targetRef) batch.delete(targetRef);

    if (resetPersonalContacts && resolvedEmail) {
      const bSnap = await db.collection('buildings').where('organizationId', '==', orgId).get();
      bSnap.forEach((docSnap) => {
        const b = docSnap.data();
        if (
          b?.contactDisplayMode === 'manager' &&
          normalizeEmail(b?.managerContact?.email) === resolvedEmail
        ) {
          batch.update(docSnap.ref, {
            contactDisplayMode: 'company',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
    }

    await batch.commit();
    if (resolvedUid) {
      await syncStaffBuildingMemberships(db, {
        orgId,
        targetUid: resolvedUid,
        targetEmail: resolvedEmail,
        memberObj: targetMember,
        isRemoved: true,
      });
    }
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
