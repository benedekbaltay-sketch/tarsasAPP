import {
  normalizeEmail,
  normalizeStaffPermissions,
  OWNER_PERMISSIONS,
  INVITE_TTL_DAYS,
  generateInviteToken,
  resolveUserOrgContext,
  canUserManageTeam,
  canActorManageTargetMember,
  findPendingInviteByToken,
  buildNotification,
  diffTeamMemberChanges,
  buildTeamUpdateNotification,
  buildPermissionUpdateEmailContent,
  getNotificationsForUser,
  buildInviteMailtoUrl,
} from '../utils/teamPermissions';
import {
  provisionAndSendColleagueInviteEmail,
  sendColleaguePasswordSetupEmail,
} from '../services/inviteAuthService';
import {
  resolveEffectiveEmailSettings,
  sendColleagueInviteCustomEmail,
  sendColleaguePermissionUpdateEmail,
} from '../services/emailService';
import { formatTaxNumber } from '../utils/taxNumber';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createTeamActions({ state, persistState, showToast, t }) {
  const isEn = () => state.currentLang === 'en';

  /**
   * Lazily initializes an organization for an existing legacy admin when they first
   * configure team settings or invite a colleague. Never mutates state on mount.
   */
  const ensureOrgInDraftState = (draftState, actorUser) => {
    const existingOrgs = Array.isArray(draftState.organizations) ? [...draftState.organizations] : [];
    const ctx = resolveUserOrgContext(actorUser, existingOrgs, draftState.buildings || []);
    if (ctx.org) {
      return { orgs: existingOrgs, orgIndex: existingOrgs.findIndex((o) => o.id === ctx.org.id), org: ctx.org };
    }

    const ownerEmail = normalizeEmail(actorUser?.email);
    const rep = draftState.repProfile || {};
    const orgId = `org-${Date.now()}`;
    const newOrg = {
      id: orgId,
      name: String(rep.companyName || rep.name || actorUser?.name || 'Közös Képviselet').trim(),
      ownerEmail,
      ownerName: String(actorUser?.name || rep.name || ownerEmail).trim(),
      ownerUid: actorUser?.uid || null,
      includeLegacyBuildings: true,
      centralContact: {
        name: String(rep.companyName || rep.name || actorUser?.name || '').trim(),
        phone: String(rep.phone || '').trim(),
        email: String(rep.email || ownerEmail).trim(),
        officeHours: String(rep.officeHours || '').trim(),
      },
      members: [
        {
          id: `member-owner-${Date.now()}`,
          uid: actorUser?.uid || null,
          email: ownerEmail,
          name: String(actorUser?.name || rep.name || ownerEmail).trim(),
          orgRole: 'owner',
          active: true,
          status: 'active',
          buildingScope: 'all',
          buildingIds: [],
          permissions: { ...OWNER_PERMISSIONS },
          addedAt: new Date().toISOString(),
        },
      ],
      invites: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    existingOrgs.push(newOrg);
    return { orgs: existingOrgs, orgIndex: existingOrgs.length - 1, org: newOrg };
  };

  // Invite or attach a colleague by email with assigned buildings, automatic Auth provisioning & password-setup email
  const inviteOrAttachTeamMember = async ({
    email,
    name = '',
    phone = '',
    buildingScope = 'selected',
    buildingIds = [],
    permissions = {},
    buildingAssignments = {},
  }) => {
    const actor = state.currentUser;
    if (!actor || !canUserManageTeam(actor, state.organizations, state.buildings)) {
      showToast(
        t.error_unauthorized || (isEn() ? 'Unauthorized action.' : 'Nincs jogosultságod ehhez a művelethez.'),
        'error'
      );
      return { success: false, error: 'unauthorized' };
    }

    const cleanEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(cleanEmail)) {
      const msg = t.team_invalid_email || (isEn() ? 'Please enter a valid email address.' : 'Kérjük, adj meg egy érvényes e-mail címet!');
      showToast(msg, 'error');
      return { success: false, error: 'invalid_email' };
    }

    const actorCtx = resolveUserOrgContext(actor, state.organizations, state.buildings);
    const normalizedPerms = normalizeStaffPermissions(permissions);

    // Prevent attaching the owner's own email as staff
    if (actorCtx.ownerEmail && cleanEmail === normalizeEmail(actorCtx.ownerEmail)) {
      const msg = t.team_cannot_invite_owner || (isEn() ? 'The organization owner already has full access.' : 'A tulajdonos e-mail címe már teljes jogosultsággal rendelkezik.');
      showToast(msg, 'error');
      return { success: false, error: 'cannot_invite_owner' };
    }

    // Check existing member if updating via invite flow
    const existingMember = (actorCtx.org?.members || []).find(
      (m) => m && normalizeEmail(m.email) === cleanEmail
    );

    const guard = canActorManageTargetMember(actorCtx, existingMember || { email: cleanEmail, orgRole: 'staff' }, normalizedPerms, actor.email);
    if (!guard.allowed) {
      const msg =
        guard.reason === 'privilege_escalation'
          ? (t.team_escalation_blocked || (isEn() ? 'You cannot grant permissions that you do not hold yourself.' : 'Nem adhatsz olyan jogosultságot, amellyel saját magad nem rendelkezel.'))
          : (t.error_unauthorized || (isEn() ? 'Unauthorized action.' : 'Nincs jogosultságod ehhez a művelethez.'));
      showToast(msg, 'error');
      return { success: false, error: guard.reason };
    }

    const cleanScope = buildingScope === 'all' ? 'all' : 'selected';
    const cleanBuildingIds = cleanScope === 'all'
      ? []
      : Array.from(new Set((Array.isArray(buildingIds) ? buildingIds : []).filter(Boolean)));

    const cleanPhone = phone !== undefined ? String(phone).trim() : (existingMember?.phone || '');
    const cleanBuildingAssignments = buildingAssignments && typeof buildingAssignments === 'object'
      ? buildingAssignments
      : (existingMember?.buildingAssignments || {});

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const token = generateInviteToken();
    const memberId = existingMember?.id || `member-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const inviteId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const displayName = String(name || existingMember?.name || cleanEmail.split('@')[0]).trim();

    const memberRecord = {
      ...(existingMember || {}),
      id: memberId,
      email: cleanEmail,
      name: displayName,
      phone: cleanPhone,
      orgRole: 'staff',
      active: true,
      status: 'active',
      buildingScope: cleanScope,
      buildingIds: cleanBuildingIds,
      permissions: normalizedPerms,
      buildingAssignments: cleanBuildingAssignments,
      invitedBy: normalizeEmail(actor.email),
      addedAt: existingMember?.addedAt || nowIso,
      updatedAt: nowIso,
    };

    const inviteRecord = {
      id: inviteId,
      token,
      email: cleanEmail,
      name: displayName,
      phone: cleanPhone,
      buildingScope: cleanScope,
      buildingIds: cleanBuildingIds,
      permissions: normalizedPerms,
      buildingAssignments: cleanBuildingAssignments,
      status: 'pending',
      createdBy: normalizeEmail(actor.email),
      createdAt: nowIso,
      expiresAt: expiresIso,
    };

    const assignedCountLabelHu = cleanScope === 'all'
      ? 'minden céges társasház'
      : `${cleanBuildingIds.length} kiválasztott társasház`;
    const assignedCountLabelEn = cleanScope === 'all'
      ? 'all company condominiums'
      : `${cleanBuildingIds.length} selected condominium(s)`;

    const welcomeNotif = buildNotification({
      type: 'team_assigned',
      severity: 'info',
      recipientEmail: cleanEmail,
      actorUser: actor,
      titleHu: existingMember ? 'Jogosultságaid frissültek' : 'Meghívást kaptál társasház-kezelésre',
      titleEn: existingMember ? 'Your Permissions Were Updated' : 'You Were Assigned to Manage Condominiums',
      messageHu: `${actor.name || actor.email} hozzáférést adott számodra (${assignedCountLabelHu}).`,
      messageEn: `${actor.name || actor.email} granted you access (${assignedCountLabelEn}).`,
    });

    await persistState((s) => {
      const { orgs, orgIndex, org } = ensureOrgInDraftState(s, actor);
      const nextMembers = existingMember
        ? (org.members || []).map((m) => (m.id === memberId ? memberRecord : m))
        : [...(org.members || []), memberRecord];

      // Replace any previous pending invite for the same email
      const nextInvites = [
        inviteRecord,
        ...(org.invites || []).filter((inv) => !(inv.status === 'pending' && normalizeEmail(inv.email) === cleanEmail)),
      ];

      orgs[orgIndex] = {
        ...org,
        members: nextMembers,
        invites: nextInvites,
        updatedAt: nowIso,
      };

      // Tag legacy buildings with this orgId if needed and update resident contact visibility based on per-building assignments
      const nextBuildings = (s.buildings || []).map((b) => {
        if (!b) return b;
        let updatedB = !b.organizationId ? { ...b, organizationId: org.id } : { ...b };
        const isAssigned = cleanScope === 'all' || cleanBuildingIds.includes(b.id);
        const bAssigned = cleanBuildingAssignments[b.id];

        if (isAssigned && bAssigned) {
          if (bAssigned.showManagerContact) {
            updatedB.contactDisplayMode = 'manager';
            updatedB.managerContact = {
              name: displayName,
              email: cleanEmail,
              phone: cleanPhone || updatedB.managerContact?.phone || '',
              officeHours: updatedB.managerContact?.officeHours || '',
              titleHu: 'Felelős házkezelő',
              titleEn: 'Responsible Property Manager',
            };
          } else if (
            updatedB.contactDisplayMode === 'manager' &&
            normalizeEmail(updatedB.managerContact?.email) === cleanEmail
          ) {
            updatedB.contactDisplayMode = 'company';
          }
          if (bAssigned.showCentralContact !== undefined) {
            updatedB.showCentralContactToResidents = Boolean(bAssigned.showCentralContact);
          }
        } else {
          if (
            updatedB.contactDisplayMode === 'manager' &&
            normalizeEmail(updatedB.managerContact?.email) === cleanEmail
          ) {
            updatedB.contactDisplayMode = 'company';
          }
        }
        return updatedB;
      });

      // Ensure colleague has an admin profile record in s.users for seamless RTDB login
      const existingAdminUser = (s.users || []).find(
        (u) => u && normalizeEmail(u.email) === cleanEmail && (u.role === 'admin' || u.role === 'superadmin')
      );
      const nextUsers = existingAdminUser
        ? (s.users || []).map((u) =>
            u === existingAdminUser && u.role !== 'superadmin'
              ? { ...u, name: displayName || u.name, orgId: org.id, orgRole: 'staff' }
              : u
          )
        : [
            ...(s.users || []),
            {
              id: `staff-${memberId}`,
              name: displayName,
              email: cleanEmail,
              role: 'admin',
              flatNum: '0',
              orgId: org.id,
              orgRole: 'staff',
            },
          ];

      return {
        ...s,
        organizations: orgs,
        buildings: nextBuildings,
        users: nextUsers,
        notifications: [welcomeNotif, ...(s.notifications || [])].slice(0, 300),
      };
    }, true);

    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://tarsashaz-cfe5d.web.app';
    const inviteUrl = `${origin}/?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(cleanEmail)}`;

    const assignedBuildingNames = cleanScope === 'all'
      ? []
      : (state.buildings || []).filter((b) => cleanBuildingIds.includes(b.id)).map((b) => b.name).filter(Boolean);
    const orgDisplayName =
      actorCtx.org?.name ||
      state.repProfile?.companyName ||
      state.repProfile?.name ||
      actor.name ||
      (isEn() ? 'Property Management' : 'Közös Képviselet');

    // 1. Try sending via central Resend service with dynamically resolved building resident Reply-To header
    const emailSettings = resolveEffectiveEmailSettings(state.globalSettings?.emailSettings || state.repProfile?.emailSettings);
    const targetBuilding = cleanBuildingIds.length > 0
      ? (state.buildings || []).find((b) => cleanBuildingIds.includes(b.id))
      : null;

    let customEmailResult = null;
    if (emailSettings.isConfigured) {
      customEmailResult = await sendColleagueInviteCustomEmail({
        recipientName: displayName,
        recipientEmail: cleanEmail,
        orgName: orgDisplayName,
        inviterName: actor.name || actor.email,
        inviterEmail: actor.email,
        buildingNames: assignedBuildingNames,
        buildingScope: cleanScope,
        actionUrl: inviteUrl,
        targetBuilding,
        repProfile: state.repProfile,
        organizations: state.organizations,
        isEn: isEn(),
        emailSettings,
      });
    }

    const wasCustomSent = Boolean(customEmailResult?.success);

    // 2. Automatically provision the colleague's Firebase Auth identity (in isolated memory) & send localized password-setup email if not already sent by custom provider
    const emailResult = await provisionAndSendColleagueInviteEmail({
      email: cleanEmail,
      token,
      lang: state.currentLang || 'hu',
      origin,
      skipFirebaseResetEmail: wasCustomSent,
    });

    const isEmailSent = wasCustomSent || Boolean(emailResult.sent);

    // Record email delivery status on the pending invite metadata
    const emailSentAt = isEmailSent ? new Date().toISOString() : null;
    persistState((s) => ({
      ...s,
      organizations: (s.organizations || []).map((org) => ({
        ...org,
        invites: (org.invites || []).map((inv) =>
          inv && inv.id === inviteId
            ? {
                ...inv,
                emailDeliveryStatus: isEmailSent ? 'sent' : 'failed',
                emailSentAt,
                emailProvider: wasCustomSent ? emailSettings.provider : 'firebase',
                emailError: isEmailSent ? null : (customEmailResult?.message || emailResult.errorCode || 'send-failed'),
              }
            : inv
        ),
      })),
    }), true);

    const mailtoUrl = buildInviteMailtoUrl({
      recipientName: displayName,
      recipientEmail: cleanEmail,
      orgName: orgDisplayName,
      inviterName: actor.name || actor.email,
      inviterEmail: actor.email,
      buildingNames: assignedBuildingNames,
      buildingScope: cleanScope,
      actionUrl: inviteUrl,
      isEn: isEn(),
    });

    if (isEmailSent) {
      const replyToNote = wasCustomSent && emailSettings.replyTo ? ` (Válaszcím: ${emailSettings.replyTo})` : '';
      showToast(
        t.team_invite_email_sent_toast
          ? `${t.team_invite_email_sent_toast.replace('{email}', cleanEmail)}${replyToNote}`
          : (isEn()
              ? `Invitation & password setup email sent to ${cleanEmail}!${replyToNote}`
              : `Meghívó és jelszóbeállító e-mail elküldve ide: ${cleanEmail}!${replyToNote}`)
      );
    } else {
      showToast(
        t.team_invite_email_failed_toast || (isEn()
          ? 'Colleague attached, but the automatic password email could not be sent. You can retry or share the invite link.'
          : 'Munkatárs csatolva, de az automatikus jelszóbeállító e-mail küldése sikertelen volt. Próbáld újra vagy küldd el a meghívó linket!'),
        'error'
      );
    }

    return {
      success: true,
      member: memberRecord,
      invite: {
        ...inviteRecord,
        emailDeliveryStatus: isEmailSent ? 'sent' : 'failed',
        emailSentAt,
      },
      inviteUrl,
      mailtoUrl,
      emailSent: isEmailSent,
      emailError: isEmailSent ? null : (customEmailResult?.message || emailResult.errorCode),
      accountCreated: Boolean(emailResult.accountCreated),
      alreadyExists: Boolean(emailResult.alreadyExists),
    };
  };

  // Resend localized password-setup email for an attached/invited colleague
  const resendTeamInviteEmail = async (email, token = '') => {
    const cleanEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(cleanEmail)) {
      showToast(t.team_invalid_email || (isEn() ? 'Please enter a valid email address.' : 'Kérjük, adj meg egy érvényes e-mail címet!'), 'error');
      return { sent: false, errorCode: 'invalid-email' };
    }

    const actor = state.currentUser || {};
    const actorCtx = resolveUserOrgContext(actor, state.organizations, state.buildings);
    const orgDisplayName =
      actorCtx.org?.name ||
      state.repProfile?.companyName ||
      state.repProfile?.name ||
      actor.name ||
      (isEn() ? 'Property Management' : 'Közös Képviselet');

    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://tarsashaz-cfe5d.web.app';
    const inviteUrl = token
      ? `${origin}/?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(cleanEmail)}`
      : `${origin}/?email=${encodeURIComponent(cleanEmail)}`;

    const emailSettings = resolveEffectiveEmailSettings(state.globalSettings?.emailSettings || state.repProfile?.emailSettings);
    const existingMember = (actorCtx.org?.members || []).find((m) => normalizeEmail(m.email) === cleanEmail);
    const existingInvite = (actorCtx.org?.invites || []).find((inv) => normalizeEmail(inv.email) === cleanEmail);
    const bIds = existingMember?.buildingIds || existingInvite?.buildingIds || [];
    const targetBuilding = bIds.length > 0 ? (state.buildings || []).find((b) => bIds.includes(b.id)) : null;

    let customRes = null;
    if (emailSettings.isConfigured) {
      customRes = await sendColleagueInviteCustomEmail({
        recipientEmail: cleanEmail,
        orgName: orgDisplayName,
        inviterName: actor.name || actor.email,
        inviterEmail: actor.email,
        actionUrl: inviteUrl,
        targetBuilding,
        repProfile: state.repProfile,
        organizations: state.organizations,
        isEn: isEn(),
        emailSettings,
      });
    }

    if (customRes?.success) {
      const replyToNote = customRes.replyTo ? (isEn() ? ` (Reply-To: ${customRes.replyTo})` : ` (Válaszcím: ${customRes.replyTo})`) : '';
      showToast(
        t.team_invite_email_sent_toast
          ? `${t.team_invite_email_sent_toast.replace('{email}', cleanEmail)}${replyToNote}`
          : (isEn()
              ? `Password setup email sent to ${cleanEmail}!${replyToNote}`
              : `Jelszóbeállító e-mail elküldve ide: ${cleanEmail}!${replyToNote}`)
      );
      return { sent: true, provider: emailSettings.provider, replyTo: customRes.replyTo };
    }

    const result = await sendColleaguePasswordSetupEmail({
      email: cleanEmail,
      token,
      lang: state.currentLang || 'hu',
      origin,
    });

    if (result.sent) {
      showToast(
        t.team_invite_email_sent_toast
          ? t.team_invite_email_sent_toast.replace('{email}', cleanEmail)
          : (isEn()
              ? `Password setup email sent to ${cleanEmail}!`
              : `Jelszóbeállító e-mail elküldve ide: ${cleanEmail}!`)
      );
    } else {
      showToast(
        t.team_invite_email_failed_toast || (isEn()
          ? 'Could not send the password setup email right now. Please try again shortly.'
          : 'Nem sikerült elküldeni a jelszóbeállító e-mailt. Kérjük, próbáld újra kicsit később!'),
        'error'
      );
    }
    return result;
  };

  // Update an existing staff member's building scope, per-building assignments & permissions
  const updateTeamMember = (memberId, { name, phone, buildingScope, buildingIds, permissions, buildingAssignments, sendNotification = true }) => {
    const actor = state.currentUser;
    const actorCtx = resolveUserOrgContext(actor, state.organizations, state.buildings);
    if (!actor || !actorCtx.org || !canUserManageTeam(actor, state.organizations, state.buildings)) {
      showToast(t.error_unauthorized || (isEn() ? 'Unauthorized action.' : 'Nincs jogosultságod ehhez a művelethez.'), 'error');
      return false;
    }

    const target = (actorCtx.org.members || []).find((m) => m && m.id === memberId);
    if (!target) return false;

    const normalizedPerms = permissions !== undefined ? normalizeStaffPermissions(permissions) : target.permissions;
    const guard = canActorManageTargetMember(actorCtx, target, normalizedPerms, actor.email);
    if (!guard.allowed) {
      showToast(
        guard.reason === 'privilege_escalation'
          ? (t.team_escalation_blocked || (isEn() ? 'You cannot grant permissions that you do not hold yourself.' : 'Nem adhatsz olyan jogosultságot, amellyel saját magad nem rendelkezel.'))
          : (t.error_unauthorized || (isEn() ? 'Unauthorized action.' : 'Nincs jogosultságod ehhez a művelethez.')),
        'error'
      );
      return false;
    }

    const cleanScope = buildingScope !== undefined ? (buildingScope === 'all' ? 'all' : 'selected') : target.buildingScope;
    const cleanBuildingIds = cleanScope === 'all'
      ? []
      : (buildingIds !== undefined ? Array.from(new Set(buildingIds.filter(Boolean))) : (target.buildingIds || []));

    const cleanPhone = phone !== undefined ? String(phone).trim() : (target.phone || '');
    const cleanBuildingAssignments = buildingAssignments !== undefined
      ? buildingAssignments
      : (target.buildingAssignments || {});

    const targetEmail = normalizeEmail(target.email);
    const targetName = name !== undefined ? String(name).trim() || target.name : target.name;

    const diff = diffTeamMemberChanges(target, {
      name: targetName,
      phone: cleanPhone,
      buildingScope: cleanScope,
      buildingIds: cleanBuildingIds,
      permissions: normalizedPerms,
      buildingAssignments: cleanBuildingAssignments,
    }, state.buildings || []);

    let updateNotif = null;
    if (sendNotification !== false && diff.hasChanges && diff.changes.length > 0) {
      updateNotif = buildTeamUpdateNotification({
        actorUser: actor,
        targetEmail: target.email,
        targetUid: target.uid || target.id || null,
        changes: diff.changes,
        diff,
      });
    }

    persistState((s) => {
      // Collect buildings where this member is being set as the sole Resident Contact
      const claimedContactBuildingIds = new Set(
        Object.entries(cleanBuildingAssignments || {})
          .filter(([bId, a]) => a && a.showManagerContact && (cleanScope === 'all' || cleanBuildingIds.includes(bId)))
          .map(([bId]) => bId)
      );

      const nextOrgs = (s.organizations || []).map((org) => {
        if (org.id !== actorCtx.org.id) return org;
        return {
          ...org,
          members: (org.members || []).map((m) => {
            if (m.id === memberId) {
              return {
                ...m,
                name: targetName,
                phone: cleanPhone,
                buildingScope: cleanScope,
                buildingIds: cleanBuildingIds,
                permissions: normalizedPerms,
                buildingAssignments: cleanBuildingAssignments,
                updatedAt: new Date().toISOString(),
              };
            }
            // Enforce single Resident Contact per building: unset showManagerContact on other members for claimed buildings
            if (claimedContactBuildingIds.size > 0 && m && m.buildingAssignments) {
              let changedOther = false;
              const nextOtherAssignments = { ...m.buildingAssignments };
              claimedContactBuildingIds.forEach((bId) => {
                if (nextOtherAssignments[bId]?.showManagerContact) {
                  nextOtherAssignments[bId] = { ...nextOtherAssignments[bId], showManagerContact: false };
                  changedOther = true;
                }
              });
              if (changedOther) {
                return { ...m, buildingAssignments: nextOtherAssignments };
              }
            }
            return m;
          }),
          updatedAt: new Date().toISOString(),
        };
      });

      const nextBuildings = (s.buildings || []).map((b) => {
        if (!b) return b;
        const isAssigned = cleanScope === 'all' || cleanBuildingIds.includes(b.id);
        const bAssigned = cleanBuildingAssignments[b.id];

        let updatedB = { ...b };
        if (isAssigned && bAssigned) {
          if (bAssigned.showManagerContact) {
            updatedB.contactDisplayMode = 'manager';
            updatedB.managerContact = {
              name: targetName,
              email: targetEmail,
              phone: cleanPhone || updatedB.managerContact?.phone || '',
              officeHours: updatedB.managerContact?.officeHours || '',
              titleHu: 'Felelős házkezelő',
              titleEn: 'Responsible Property Manager',
            };
          } else if (
            updatedB.contactDisplayMode === 'manager' &&
            normalizeEmail(updatedB.managerContact?.email) === targetEmail
          ) {
            updatedB.contactDisplayMode = 'company';
          }
          if (bAssigned.showCentralContact !== undefined) {
            updatedB.showCentralContactToResidents = Boolean(bAssigned.showCentralContact);
          }
        } else {
          if (
            updatedB.contactDisplayMode === 'manager' &&
            normalizeEmail(updatedB.managerContact?.email) === targetEmail
          ) {
            updatedB.contactDisplayMode = 'company';
          }
        }
        return updatedB;
      });

      return {
        ...s,
        organizations: nextOrgs,
        buildings: nextBuildings,
        notifications: updateNotif ? [updateNotif, ...(s.notifications || [])].slice(0, 300) : (s.notifications || []),
      };
    }, true);

    showToast(t.team_member_updated_toast || (isEn() ? 'Team member permissions updated!' : 'Munkatárs jogosultságai frissítve!'));
    return true;
  };

  // Suspend or reactivate a staff member immediately
  const toggleTeamMemberActive = (memberId, active) => {
    const actor = state.currentUser;
    const actorCtx = resolveUserOrgContext(actor, state.organizations, state.buildings);
    if (!actor || !actorCtx.org) return false;

    const target = (actorCtx.org.members || []).find((m) => m && m.id === memberId);
    if (!target) return false;

    const guard = canActorManageTargetMember(actorCtx, target, null, actor.email);
    if (!guard.allowed) {
      showToast(t.error_unauthorized || (isEn() ? 'Unauthorized action.' : 'Nincs jogosultságod ehhez a művelethez.'), 'error');
      return false;
    }

    const nextActive = Boolean(active);
    persistState((s) => ({
      ...s,
      organizations: (s.organizations || []).map((org) => {
        if (org.id !== actorCtx.org.id) return org;
        return {
          ...org,
          members: (org.members || []).map((m) =>
            m.id === memberId
              ? { ...m, active: nextActive, status: nextActive ? 'active' : 'suspended', updatedAt: new Date().toISOString() }
              : m
          ),
          updatedAt: new Date().toISOString(),
        };
      }),
    }), true);

    showToast(
      nextActive
        ? (t.team_member_reactivated_toast || (isEn() ? 'Team member access reactivated.' : 'Munkatárs hozzáférése újraaktiválva.'))
        : (t.team_member_suspended_toast || (isEn() ? 'Team member access suspended immediately.' : 'Munkatárs hozzáférése azonnal felfüggesztve.'))
    );
    return true;
  };

  // Permanently remove a staff member (optionally resetting buildings displaying their personal contact)
  const removeTeamMember = (memberId, { resetPersonalContacts = false } = {}) => {
    const actor = state.currentUser;
    const actorCtx = resolveUserOrgContext(actor, state.organizations, state.buildings);
    if (!actor || !actorCtx.org) return false;

    const target = (actorCtx.org.members || []).find((m) => m && m.id === memberId);
    if (!target) return false;

    const guard = canActorManageTargetMember(actorCtx, target, null, actor.email);
    if (!guard.allowed) {
      showToast(t.error_unauthorized || (isEn() ? 'Unauthorized action.' : 'Nincs jogosultságod ehhez a művelethez.'), 'error');
      return false;
    }

    const targetEmail = normalizeEmail(target.email);

    persistState((s) => {
      const nextOrgs = (s.organizations || []).map((org) => {
        if (org.id !== actorCtx.org.id) return org;
        return {
          ...org,
          members: (org.members || []).filter((m) => m.id !== memberId),
          invites: (org.invites || []).filter((inv) => normalizeEmail(inv.email) !== targetEmail),
          updatedAt: new Date().toISOString(),
        };
      });

      const nextBuildings = resetPersonalContacts
        ? (s.buildings || []).map((b) => {
            if (
              b &&
              b.contactDisplayMode === 'manager' &&
              normalizeEmail(b.managerContact?.email) === targetEmail
            ) {
              return { ...b, contactDisplayMode: 'company' };
            }
            return b;
          })
        : s.buildings;

      const nextUsers = (s.users || []).filter(
        (u) => !(u && normalizeEmail(u.email) === targetEmail && u.role === 'admin' && u.orgRole === 'staff')
      );

      return {
        ...s,
        organizations: nextOrgs,
        buildings: nextBuildings,
        users: nextUsers,
      };
    }, true);

    showToast(t.team_member_removed_toast || (isEn() ? 'Team member removed.' : 'Munkatárs eltávolítva a csapatból.'));
    return true;
  };

  // 1-Click Handover: Transfer all buildings from one staff member to another
  const handoverMemberBuildings = (fromMemberId, toMemberId) => {
    const actor = state.currentUser;
    const actorCtx = resolveUserOrgContext(actor, state.organizations, state.buildings);
    if (!actor || !actorCtx.org || !canUserManageTeam(actor, state.organizations, state.buildings)) {
      showToast(t.error_unauthorized || (isEn() ? 'Unauthorized action.' : 'Nincs jogosultságod ehhez a művelethez.'), 'error');
      return false;
    }

    if (!fromMemberId || !toMemberId || fromMemberId === toMemberId) return false;

    const fromMember = (actorCtx.org.members || []).find((m) => m.id === fromMemberId);
    const toMember = (actorCtx.org.members || []).find((m) => m.id === toMemberId);
    if (!fromMember || !toMember || fromMember.orgRole === 'owner') return false;

    const toGuard = canActorManageTargetMember(actorCtx, toMember, null, actor.email);
    const fromGuard = canActorManageTargetMember(actorCtx, fromMember, null, actor.email);
    if (!fromGuard.allowed || (toMember.orgRole !== 'owner' && !toGuard.allowed)) {
      showToast(t.error_unauthorized || (isEn() ? 'Unauthorized action.' : 'Nincs jogosultságod ehhez a művelethez.'), 'error');
      return false;
    }

    const handoverNotif = buildNotification({
      type: 'team_handover',
      severity: 'info',
      recipientEmail: toMember.email,
      actorUser: actor,
      titleHu: 'Társasházak átadva számodra',
      titleEn: 'Condominiums Handed Over to You',
      messageHu: `${actor.name || actor.email} átadta ${fromMember.name || fromMember.email} társasházait a kezelésedbe.`,
      messageEn: `${actor.name || actor.email} handed over ${fromMember.name || fromMember.email}'s condominiums to you.`,
    });

    persistState((s) => {
      const nextOrgs = (s.organizations || []).map((org) => {
        if (org.id !== actorCtx.org.id) return org;
        return {
          ...org,
          members: (org.members || []).map((m) => {
            if (m.id === toMemberId && m.orgRole !== 'owner') {
              if (fromMember.buildingScope === 'all' || m.buildingScope === 'all') {
                return { ...m, buildingScope: 'all', buildingIds: [], updatedAt: new Date().toISOString() };
              }
              const mergedIds = Array.from(new Set([...(m.buildingIds || []), ...(fromMember.buildingIds || [])]));
              return { ...m, buildingScope: 'selected', buildingIds: mergedIds, updatedAt: new Date().toISOString() };
            }
            if (m.id === fromMemberId) {
              return { ...m, buildingScope: 'selected', buildingIds: [], updatedAt: new Date().toISOString() };
            }
            return m;
          }),
          updatedAt: new Date().toISOString(),
        };
      });

      return {
        ...s,
        organizations: nextOrgs,
        notifications: [handoverNotif, ...(s.notifications || [])].slice(0, 300),
      };
    }, true);

    showToast(t.team_handover_success || (isEn() ? 'Buildings handed over successfully!' : 'A társasházak sikeresen átadva!'));
    return true;
  };

  // Revoke a pending invite token
  const revokeTeamInvite = (inviteId) => {
    const actor = state.currentUser;
    const actorCtx = resolveUserOrgContext(actor, state.organizations, state.buildings);
    if (!actor || !actorCtx.org || !canUserManageTeam(actor, state.organizations, state.buildings)) return false;

    persistState((s) => ({
      ...s,
      organizations: (s.organizations || []).map((org) => {
        if (org.id !== actorCtx.org.id) return org;
        return {
          ...org,
          invites: (org.invites || []).filter((inv) => inv.id !== inviteId),
          updatedAt: new Date().toISOString(),
        };
      }),
    }), true);

    showToast(t.team_invite_revoked_toast || (isEn() ? 'Invite revoked.' : 'Meghívó visszavonva.'));
    return true;
  };

  // Accept a pending invite token for the currently authenticated user (strict email match!)
  const acceptTeamInvite = (token) => {
    const actor = state.currentUser;
    if (!actor || !token) return { success: false, reason: 'missing_auth_or_token' };

    const match = findPendingInviteByToken(state.organizations, token);
    if (!match || !match.isValid) {
      return { success: false, reason: match?.isExpired ? 'expired' : 'invalid' };
    }

    const userEmail = normalizeEmail(actor.email);
    if (normalizeEmail(match.invite.email) !== userEmail) {
      return { success: false, reason: 'email_mismatch' };
    }

    const nowIso = new Date().toISOString();
    persistState((s) => ({
      ...s,
      organizations: (s.organizations || []).map((org) => {
        if (org.id !== match.org.id) return org;
        const hasMember = (org.members || []).some((m) => normalizeEmail(m.email) === userEmail);
        const nextMembers = hasMember
          ? (org.members || []).map((m) =>
              normalizeEmail(m.email) === userEmail
                ? { ...m, uid: actor.uid || m.uid, active: true, status: 'active', acceptedAt: nowIso }
                : m
            )
          : [
              ...(org.members || []),
              {
                id: `member-${Date.now()}`,
                uid: actor.uid || null,
                email: userEmail,
                name: actor.name || match.invite.name || userEmail,
                orgRole: 'staff',
                active: true,
                status: 'active',
                buildingScope: match.invite.buildingScope || 'selected',
                buildingIds: match.invite.buildingIds || [],
                permissions: normalizeStaffPermissions(match.invite.permissions),
                addedAt: nowIso,
                acceptedAt: nowIso,
              },
            ];

        return {
          ...org,
          members: nextMembers,
          invites: (org.invites || []).map((inv) =>
            inv.id === match.invite.id
              ? { ...inv, status: 'accepted', acceptedAt: nowIso, acceptedByUid: actor.uid || null }
              : inv
          ),
          updatedAt: nowIso,
        };
      }),
    }), true);

    showToast(
      t.team_invite_accepted_toast || (isEn() ? 'Team invitation accepted! Welcome aboard.' : 'Csapat meghívó elfogadva! Üdv a csapatban.')
    );
    return { success: true, orgName: match.org.name };
  };

  // Update Organization Name & Central Contact Info (Owner / SuperAdmin only)
  const updateOrganizationSettings = ({ name, taxNumber, centralContact, showCentralContactToResidents }) => {
    const actor = state.currentUser;
    const actorCtx = resolveUserOrgContext(actor, state.organizations, state.buildings);
    if (!actor || (!actorCtx.isOwner && !actorCtx.isSuperAdmin)) {
      showToast(t.error_unauthorized || (isEn() ? 'Only the organization owner can edit company details.' : 'Csak a cég tulajdonosa módosíthatja a cégadatokat.'), 'error');
      return false;
    }

    persistState((s) => {
      const { orgs, orgIndex, org } = ensureOrgInDraftState(s, actor);
      const updatedCentralContact = centralContact !== undefined
        ? { ...(org.centralContact || {}), ...centralContact }
        : org.centralContact;
      const updatedShowCentral = showCentralContactToResidents !== undefined
        ? Boolean(showCentralContactToResidents)
        : (org.showCentralContactToResidents !== undefined ? org.showCentralContactToResidents : false);
      const resolvedTaxNumber = taxNumber !== undefined
        ? formatTaxNumber(taxNumber).trim()
        : formatTaxNumber(org.taxNumber || '');

      orgs[orgIndex] = {
        ...org,
        name: name !== undefined ? String(name).trim() || org.name : org.name,
        taxNumber: resolvedTaxNumber,
        centralContact: updatedCentralContact,
        showCentralContactToResidents: updatedShowCentral,
        updatedAt: new Date().toISOString(),
      };

      // Keep repProfile synchronized with organization central contact
      const nextRepProfile = {
        ...(s.repProfile || {}),
        companyName: name !== undefined ? String(name).trim() || s.repProfile?.companyName : s.repProfile?.companyName,
        taxNumber: resolvedTaxNumber,
        name: updatedCentralContact?.name || s.repProfile?.name,
        phone: updatedCentralContact?.phone || s.repProfile?.phone,
        email: updatedCentralContact?.email || s.repProfile?.email,
        address: updatedCentralContact?.address !== undefined ? updatedCentralContact.address : s.repProfile?.address,
        officeHours: updatedCentralContact?.officeHours || s.repProfile?.officeHours,
        showCentralContactToResidents: updatedShowCentral,
      };

      return {
        ...s,
        organizations: orgs,
        repProfile: nextRepProfile,
      };
    }, true);

    showToast(t.team_org_saved_toast || (isEn() ? 'Company settings saved!' : 'Cégadatok elmentve!'));
    return true;
  };

  // --- Universal Notification Center Actions (available to ALL users) ---

  const pushNotification = (notif) => {
    if (!notif || !notif.id) return;
    persistState((s) => ({
      ...s,
      notifications: [notif, ...(s.notifications || [])].slice(0, 300),
    }), true);
  };

  const markNotificationRead = (notifId) => {
    if (!notifId || !state.currentUser) return;
    const existsUnread = (state.notifications || []).some((n) => n && n.id === notifId && !n.read);
    if (!existsUnread) return;
    persistState((s) => ({
      ...s,
      notifications: (s.notifications || []).map((n) =>
        n && n.id === notifId ? { ...n, read: true, readAt: new Date().toISOString() } : n
      ),
    }), true);
  };

  const markAllNotificationsRead = () => {
    if (!state.currentUser) return;
    const myUnreadIds = new Set(
      getNotificationsForUser(state.notifications || [], state.currentUser)
        .filter((n) => !n.read)
        .map((n) => n.id)
    );
    if (myUnreadIds.size === 0) return;

    const nowIso = new Date().toISOString();
    persistState((s) => ({
      ...s,
      notifications: (s.notifications || []).map((n) =>
        n && myUnreadIds.has(n.id) ? { ...n, read: true, readAt: nowIso } : n
      ),
    }), true);
  };

  const dismissNotification = (notifId) => {
    if (!notifId || !state.currentUser) return;
    persistState((s) => ({
      ...s,
      notifications: (s.notifications || []).map((n) =>
        n && n.id === notifId ? { ...n, read: true, dismissed: true } : n
      ),
    }), true);
  };

  // --- SuperAdmin Owner Management Actions (STRICTLY SUPERADMIN ONLY) ---

  /**
   * SuperAdmin ONLY: Creates a brand new Organization Owner (Közös Képviselő / Cég tulajdonos)
   * with their own isolated organization (includeLegacyBuildings: false) so they can create
   * and manage their own condominiums. Automatically provisions Firebase Auth & sends password-setup email.
   */
  const createOrganizationOwner = async ({
    email,
    name = '',
    companyName = '',
    phone = '',
    sendInviteEmail = true,
  } = {}) => {
    const actor = state.currentUser;
    if (!actor || actor.role !== 'superadmin') {
      showToast(
        isEn()
          ? 'Only SuperAdmin can create new Organization Owners.'
          : 'Új tulajdonost (Ownert) kizárólag a Rendszergazda (SuperAdmin) hozhat létre!',
        'error'
      );
      return { success: false, error: 'unauthorized' };
    }

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      showToast(
        t.team_invalid_email || (isEn() ? 'Please enter a valid email address.' : 'Kérjük, adj meg egy érvényes e-mail címet!'),
        'error'
      );
      return { success: false, error: 'invalid-email' };
    }

    const alreadyOwnerOrg = (state.organizations || []).find(
      (o) => o && normalizeEmail(o.ownerEmail) === cleanEmail
    );
    if (alreadyOwnerOrg) {
      showToast(
        isEn()
          ? 'An Organization Owner with this email address already exists.'
          : 'Ezzel az e-mail címmel már létezik tulajdonos (Owner) a rendszerben!',
        'error'
      );
      return { success: false, error: 'already-exists' };
    }

    const cleanName = String(name || '').trim() || cleanEmail.split('@')[0];
    const cleanCompanyName = String(companyName || '').trim() || cleanName;
    const cleanPhone = String(phone || '').trim();
    const nowIso = new Date().toISOString();
    const orgId = `org-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const memberId = `owner-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

    const newOrg = {
      id: orgId,
      name: cleanCompanyName,
      ownerEmail: cleanEmail,
      ownerName: cleanName,
      includeLegacyBuildings: false,
      taxNumber: '',
      centralContact: {
        name: cleanCompanyName,
        email: cleanEmail,
        phone: cleanPhone,
        officeHours: '',
      },
      showCentralContactToResidents: true,
      members: [
        {
          id: memberId,
          email: cleanEmail,
          name: cleanName,
          phone: cleanPhone,
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
      updatedAt: nowIso,
      createdBySuperAdmin: normalizeEmail(actor.email),
    };

    const newUserRecord = {
      id: `owner-user-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role: 'admin',
      flatNum: '0',
      orgId,
      orgRole: 'owner',
      isAdminUser: true,
      createdAt: nowIso,
    };

    await persistState((s) => {
      const existingUsers = Array.isArray(s.users) ? s.users : [];
      const hasAdminUser = existingUsers.some(
        (u) => u && normalizeEmail(u.email) === cleanEmail && (u.role === 'admin' || u.role === 'superadmin')
      );
      const nextUsers = hasAdminUser
        ? existingUsers.map((u) =>
            u && normalizeEmail(u.email) === cleanEmail && u.role !== 'superadmin'
              ? { ...u, name: cleanName, phone: cleanPhone || u.phone || '', orgId, orgRole: 'owner', isAdminUser: true }
              : u
          )
        : [...existingUsers, newUserRecord];

      return {
        ...s,
        organizations: [...(s.organizations || []), newOrg],
        users: nextUsers,
      };
    }, true);

    let emailSent = false;
    if (sendInviteEmail) {
      const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://tarsashaz-cfe5d.web.app';
      const provResult = await provisionAndSendColleagueInviteEmail({
        email: cleanEmail,
        token: '',
        lang: state.currentLang || 'hu',
        origin,
        skipFirebaseResetEmail: false,
      });
      emailSent = Boolean(provResult?.sent);
    }

    showToast(
      emailSent
        ? (isEn()
            ? `Owner "${cleanName}" created and password setup email sent to ${cleanEmail}!`
            : `„${cleanName}” tulajdonos létrehozva, és jelszóbeállító e-mail elküldve ide: ${cleanEmail}!`)
        : (isEn()
            ? `Owner "${cleanName}" (${cleanEmail}) created successfully!`
            : `„${cleanName}” (${cleanEmail}) tulajdonos sikeresen létrehozva!`)
    );

    return { success: true, organization: newOrg, user: newUserRecord, emailSent };
  };

  /**
   * SuperAdmin ONLY: Changes an Organization Owner's email address across organizations,
   * users, buildings, manager contacts, archived records, and notifications.
   * Optionally provisions Firebase Auth & sends password-setup email to the new email address.
   */
  const updateOrganizationOwnerEmail = async ({
    orgId = null,
    oldEmail,
    newEmail,
    provisionNewAuth = true,
  } = {}) => {
    const actor = state.currentUser;
    if (!actor || actor.role !== 'superadmin') {
      showToast(
        isEn()
          ? 'Only SuperAdmin can change an Owner’s email address.'
          : 'Tulajdonos (Owner) e-mail címét kizárólag a Rendszergazda (SuperAdmin) módosíthatja!',
        'error'
      );
      return { success: false, error: 'unauthorized' };
    }

    const cleanOldEmail = normalizeEmail(oldEmail);
    const cleanNewEmail = normalizeEmail(newEmail);

    if (!cleanNewEmail || !cleanNewEmail.includes('@') || !cleanNewEmail.includes('.')) {
      showToast(
        t.team_invalid_email || (isEn() ? 'Please enter a valid email address.' : 'Kérjük, adj meg egy érvényes e-mail címet!'),
        'error'
      );
      return { success: false, error: 'invalid-email' };
    }

    if (cleanOldEmail === cleanNewEmail) {
      showToast(
        isEn() ? 'The new email address is the same as the current one.' : 'Az új e-mail cím megegyezik a jelenlegivel.',
        'error'
      );
      return { success: false, error: 'same-email' };
    }

    const conflictOrg = (state.organizations || []).find(
      (o) => o && o.id !== orgId && normalizeEmail(o.ownerEmail) === cleanNewEmail
    );
    if (conflictOrg) {
      showToast(
        isEn()
          ? 'Another Organization Owner already uses this email address.'
          : 'Ezt az e-mail címet már egy másik tulajdonos használja!',
        'error'
      );
      return { success: false, error: 'email-in-use' };
    }

    const nowIso = new Date().toISOString();

    await persistState((s) => {
      const nextOrgs = (s.organizations || []).map((org) => {
        if (!org) return org;
        const isTargetOrg = (orgId && org.id === orgId) || (cleanOldEmail && normalizeEmail(org.ownerEmail) === cleanOldEmail);
        if (!isTargetOrg) return org;

        const nextMembers = (org.members || []).map((m) => {
          if (!m) return m;
          if (m.orgRole === 'owner' || (cleanOldEmail && normalizeEmail(m.email) === cleanOldEmail)) {
            return { ...m, email: cleanNewEmail, updatedAt: nowIso };
          }
          return m;
        });

        const nextCentralContact = org.centralContact
          ? {
              ...org.centralContact,
              email:
                !org.centralContact.email || normalizeEmail(org.centralContact.email) === cleanOldEmail
                  ? cleanNewEmail
                  : org.centralContact.email,
            }
          : org.centralContact;

        return {
          ...org,
          ownerEmail: cleanNewEmail,
          centralContact: nextCentralContact,
          members: nextMembers,
          updatedAt: nowIso,
        };
      });

      const nextUsers = (s.users || []).map((u) => {
        if (!u) return u;
        if (cleanOldEmail && normalizeEmail(u.email) === cleanOldEmail && u.role === 'admin') {
          return { ...u, email: cleanNewEmail };
        }
        return u;
      });

      const nextBuildings = (s.buildings || []).map((b) => {
        if (!b) return b;
        let updated = b;
        const belongsToOrg = orgId && b.organizationId === orgId;
        if (
          (cleanOldEmail && normalizeEmail(b.email) === cleanOldEmail) ||
          (belongsToOrg && (!b.email || normalizeEmail(b.email) === cleanOldEmail))
        ) {
          updated = { ...updated, email: cleanNewEmail };
        }
        if (updated.managerContact && cleanOldEmail && normalizeEmail(updated.managerContact.email) === cleanOldEmail) {
          updated = {
            ...updated,
            managerContact: { ...updated.managerContact, email: cleanNewEmail },
          };
        }
        if (updated.archivedFromOwnerEmail && cleanOldEmail && normalizeEmail(updated.archivedFromOwnerEmail) === cleanOldEmail) {
          updated = { ...updated, archivedFromOwnerEmail: cleanNewEmail };
        }
        return updated;
      });

      const nextNotifications = (s.notifications || []).map((n) => {
        if (!n) return n;
        if (cleanOldEmail && normalizeEmail(n.recipientEmail) === cleanOldEmail) {
          return { ...n, recipientEmail: cleanNewEmail };
        }
        return n;
      });

      return {
        ...s,
        organizations: nextOrgs,
        users: nextUsers,
        buildings: nextBuildings,
        notifications: nextNotifications,
      };
    }, true);

    let emailSent = false;
    if (provisionNewAuth) {
      const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'https://tarsashaz-cfe5d.web.app';
      const provResult = await provisionAndSendColleagueInviteEmail({
        email: cleanNewEmail,
        token: '',
        lang: state.currentLang || 'hu',
        origin,
        skipFirebaseResetEmail: false,
      });
      emailSent = Boolean(provResult?.sent);
    }

    showToast(
      emailSent
        ? (isEn()
            ? `Owner email changed to ${cleanNewEmail} and password setup link sent!`
            : `Tulajdonos e-mail címe módosítva (${cleanNewEmail}), jelszóbeállító link elküldve!`)
        : (isEn()
            ? `Owner email changed to ${cleanNewEmail}!`
            : `Tulajdonos e-mail címe sikeresen módosítva: ${cleanNewEmail}!`)
    );

    return { success: true, oldEmail: cleanOldEmail, newEmail: cleanNewEmail, emailSent };
  };

  return {
    inviteOrAttachTeamMember,
    resendTeamInviteEmail,
    updateTeamMember,
    toggleTeamMemberActive,
    removeTeamMember,
    handoverMemberBuildings,
    revokeTeamInvite,
    acceptTeamInvite,
    updateOrganizationSettings,
    createOrganizationOwner,
    updateOrganizationOwnerEmail,
    pushNotification,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
  };
}
