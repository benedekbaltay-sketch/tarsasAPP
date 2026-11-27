import { normalizeEmail, getNotificationsForUser } from './teamPermissions.js';
import { getUserSzvbRolesAcrossBuildings } from './szvb.js';
import { getUserEconomicAuditorRolesAcrossBuildings } from './economicAuditor.js';

const LAST_PROFILE_KEY_PREFIX = 'tarsashaz_last_profile_';

/**
 * Resolve all valid profiles (KK, SZVB, Owner apartments) belonging to a verified user email.
 *
 * Security invariants:
 * - Strictly matches by exact normalized email (zero substring/prefix matching).
 * - If a staff member is suspended (`active === false` in organizations), their KK profile
 *   is excluded, while any personal Owner / SZVB profiles remain safely accessible!
 * - Archived buildings are never included.
 */
export function resolveUserProfiles(user, { buildings = [], organizations = [], users = [] } = {}) {
  const empty = {
    kkProfile: null,
    szvbProfiles: [],
    auditorProfiles: [],
    ownerProfiles: [],
    allProfiles: [],
    isSuspendedStaff: false,
  };
  if (!user) return empty;

  const userEmail = normalizeEmail(user.email || user.username || '');
  const activeBuildings = (buildings || []).filter((b) => b && b.archived !== true);

  // 1. Check Organization membership (detect active KK/staff vs. suspended staff)
  let matchedOrg = null;
  let matchedOrgMember = null;
  if (userEmail && Array.isArray(organizations)) {
    for (const org of organizations) {
      if (!org || !Array.isArray(org.members)) continue;
      const m = org.members.find((item) => item && normalizeEmail(item.email) === userEmail);
      if (m) {
        matchedOrg = org;
        matchedOrgMember = m;
        break;
      }
    }
  }

  const isSuspendedStaff = Boolean(
    matchedOrgMember && matchedOrgMember.orgRole !== 'owner' && matchedOrgMember.active === false
  );

  // Check top-level users array & session/Firestore memberships for superadmin/admin
  const matchedAdminUser = userEmail
    ? (users || []).find(
        (u) => u && normalizeEmail(u.email) === userEmail && (u.role === 'superadmin' || u.role === 'admin')
      )
    : null;

  const isSuperAdmin =
    user.role === 'superadmin' ||
    user.isSuperAdmin === true ||
    matchedAdminUser?.role === 'superadmin';

  const hasFirestoreAdminMembership = Array.isArray(user.memberships)
    ? user.memberships.some((m) => m && m.active !== false && m.role === 'admin')
    : false;

  const hasActiveOrgAdmin = Boolean(
    matchedOrgMember && (matchedOrgMember.orgRole === 'owner' || matchedOrgMember.active !== false)
  );

  const hasLegacyAdmin = Boolean(
    !isSuspendedStaff &&
      (matchedAdminUser ||
        user.role === 'admin' ||
        user.isAdminUser === true ||
        hasFirestoreAdminMembership)
  );

  let kkProfile = null;
  if (isSuperAdmin || hasActiveOrgAdmin || hasLegacyAdmin) {
    const kkRole = isSuperAdmin ? 'superadmin' : 'admin';
    kkProfile = {
      id: 'kk',
      type: 'kk',
      role: kkRole,
      orgId: matchedOrg?.id || user.orgId || null,
      orgRole: matchedOrgMember?.orgRole || user.orgRole || (isSuperAdmin ? 'superadmin' : 'owner'),
      orgName: matchedOrg?.name || '',
      name: matchedOrgMember?.name || matchedAdminUser?.name || user.name || userEmail,
      email: userEmail,
      buildingId: null,
      flatNum: '0',
      labelHu: isSuperAdmin ? 'Rendszergazda' : 'Közös Képviselet',
      labelEn: isSuperAdmin ? 'SuperAdmin' : 'Common Representative',
      sublabelHu: matchedOrg?.name || 'Társasházaim (Portfólió)',
      sublabelEn: matchedOrg?.name || 'My Condominiums (Portfolio)',
    };
  }

  // 2. Owner / Apartment profiles (strictly exact email match across all non-archived buildings)
  const ownerProfiles = [];
  const seenOwnerKeys = new Set();

  if (userEmail) {
    for (const b of activeBuildings) {
      for (const flat of b.flats || []) {
        if (!flat) continue;
        let matchedOwner = null;
        if (Array.isArray(flat.owners) && flat.owners.length > 0) {
          matchedOwner = flat.owners.find((o) => {
            if (!o) return false;
            const oEmail = normalizeEmail(o.email);
            const oEmails = Array.isArray(o.emails) ? o.emails.map(normalizeEmail) : [];
            return oEmail === userEmail || oEmails.includes(userEmail);
          });
        }
        const mainFlatEmail = normalizeEmail(flat.email);
        const isFlatMatch = Boolean(matchedOwner || mainFlatEmail === userEmail);
        if (!isFlatMatch) continue;

        const flatNum = String(flat.flatNum || '').trim();
        const key = `owner:${b.id}:${flatNum}`;
        if (seenOwnerKeys.has(key)) continue;
        seenOwnerKeys.add(key);

        const ownerName =
          matchedOwner?.name ||
          (Array.isArray(flat.owners) && flat.owners.length === 1 && flat.owners[0]?.name) ||
          flat.ownerName ||
          user.name ||
          userEmail;

        ownerProfiles.push({
          id: key,
          type: 'owner',
          role: 'Owner',
          buildingId: b.id,
          buildingName: b.name || '',
          flatNum,
          unitId: flat.unitId || flat.id || null,
          ownerName,
          name: ownerName,
          email: userEmail,
          share: matchedOwner?.share || '',
          labelHu: `${flatNum}. lakás`,
          labelEn: `Flat ${flatNum}`,
          sublabelHu: b.name || '',
          sublabelEn: b.name || '',
        });
      }
    }
  }

  // 3. SZVB Audit profiles (strictly verified per building & linked to user's apartment in that building)
  const szvbRaw = getUserSzvbRolesAcrossBuildings(user, activeBuildings);
  const szvbProfiles = szvbRaw.map((r) => {
    const linkedOwnerFlat =
      ownerProfiles.find((o) => o.buildingId === r.buildingId && r.flatNum && String(o.flatNum) === String(r.flatNum)) ||
      ownerProfiles.find((o) => o.buildingId === r.buildingId) ||
      null;
    const resolvedFlatNum = r.flatNum || linkedOwnerFlat?.flatNum || '';
    return {
      id: `szvb:${r.buildingId}`,
      type: 'szvb',
      role: 'szvb',
      szvbRole: r.szvbRole,
      buildingId: r.buildingId,
      buildingName: r.buildingName || '',
      flatNum: resolvedFlatNum,
      linkedOwnerProfileId: linkedOwnerFlat?.id || null,
      name: r.name || user.name || userEmail,
      email: userEmail,
      labelHu: r.szvbRole === 'chairperson' ? 'SZVB Elnök' : 'SZVB Tag',
      labelEn: r.szvbRole === 'chairperson' ? 'SZVB Chairperson' : 'SZVB Member',
      sublabelHu: r.buildingName || '',
      sublabelEn: r.buildingName || '',
    };
  });

  // 4. Economic Auditor profiles (Tht. 51/A. § — internal owners OR external independent auditors)
  const auditorRaw = getUserEconomicAuditorRolesAcrossBuildings(user, activeBuildings);
  const auditorProfiles = auditorRaw.map((r) => {
    const linkedOwnerFlat =
      ownerProfiles.find((o) => o.buildingId === r.buildingId && r.flatNum && String(o.flatNum) === String(r.flatNum)) ||
      ownerProfiles.find((o) => o.buildingId === r.buildingId) ||
      null;
    const resolvedFlatNum = r.flatNum || linkedOwnerFlat?.flatNum || '';
    const isInternal = Boolean(linkedOwnerFlat);
    return {
      id: `auditor:${r.buildingId}`,
      type: 'auditor',
      role: 'auditor',
      auditorType: isInternal ? 'internal' : 'external',
      isInternal,
      buildingId: r.buildingId,
      buildingName: r.buildingName || '',
      flatNum: resolvedFlatNum,
      linkedOwnerProfileId: linkedOwnerFlat?.id || null,
      companyName: r.companyName || '',
      registrationNumber: r.registrationNumber || '',
      validFrom: r.validFrom || '',
      validTo: r.validTo || '',
      name: r.name || user.name || userEmail,
      email: userEmail,
      labelHu: 'Gazdasági ellenőr',
      labelEn: 'Financial Auditor',
      sublabelHu: r.buildingName || '',
      sublabelEn: r.buildingName || '',
    };
  });

  const allProfiles = [
    ...(kkProfile ? [kkProfile] : []),
    ...ownerProfiles,
    ...szvbProfiles,
    ...auditorProfiles,
  ];

  return {
    kkProfile,
    szvbProfiles,
    auditorProfiles,
    ownerProfiles,
    allProfiles,
    isSuspendedStaff,
  };
}

/**
 * Canonical key for the currently active profile in `state.currentUser`.
 */
export function getActiveProfileKey(currentUser) {
  if (!currentUser) return null;
  if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
    return 'kk';
  }
  if (currentUser.role === 'szvb') {
    return `szvb:${currentUser.buildingId || ''}`;
  }
  if (currentUser.role === 'auditor') {
    return `auditor:${currentUser.buildingId || ''}`;
  }
  return `owner:${currentUser.buildingId || ''}:${currentUser.flatNum || ''}`;
}

/**
 * Resolve the active profile descriptor object for `currentUser`.
 */
export function getActiveProfileDescriptor(currentUser, allProfiles = []) {
  if (!currentUser) return null;
  const activeKey = getActiveProfileKey(currentUser);
  const found = (allProfiles || []).find((p) => p && p.id === activeKey);
  if (found) return found;

  if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
    return {
      id: 'kk',
      type: 'kk',
      role: currentUser.role,
      buildingId: currentUser.buildingId || null,
      flatNum: '0',
    };
  }
  if (currentUser.role === 'szvb') {
    return {
      id: `szvb:${currentUser.buildingId || ''}`,
      type: 'szvb',
      role: 'szvb',
      buildingId: currentUser.buildingId || null,
      flatNum: currentUser.flatNum || '',
    };
  }
  if (currentUser.role === 'auditor') {
    return {
      id: `auditor:${currentUser.buildingId || ''}`,
      type: 'auditor',
      role: 'auditor',
      buildingId: currentUser.buildingId || null,
      flatNum: currentUser.flatNum || '',
    };
  }
  return {
    id: `owner:${currentUser.buildingId || ''}:${currentUser.flatNum || ''}`,
    type: 'owner',
    role: 'Owner',
    buildingId: currentUser.buildingId || null,
    flatNum: currentUser.flatNum || '',
  };
}

/**
 * Determine which profile type/building/flat a notification belongs to.
 * Supports explicit `notif.targetProfile` AND backwards-compatible type inference for legacy notifications.
 */
export function inferNotificationTargetProfile(notif) {
  if (!notif || typeof notif !== 'object') {
    return { type: 'any', buildingId: null, flatNum: null };
  }

  if (notif.targetProfile && typeof notif.targetProfile === 'object' && notif.targetProfile.type) {
    return {
      type: notif.targetProfile.type, // 'kk' | 'owner' | 'szvb' | 'any'
      buildingId: notif.targetProfile.buildingId || notif.buildingId || null,
      flatNum: notif.targetProfile.flatNum || null,
    };
  }

  const nType = String(notif.type || '').toLowerCase();

  // KK / Company management notifications
  if (
    nType === 'bank_account_changed' ||
    nType === 'team_updated' ||
    nType === 'team_assigned' ||
    nType === 'team_handover' ||
    nType === 'team_invite'
  ) {
    return { type: 'kk', buildingId: null, flatNum: null };
  }

  // SZVB grant/change/revoke notifications ALWAYS belong to the resident's apartment (Owner) profile!
  if (nType === 'szvb_updated') {
    return {
      type: 'owner',
      buildingId: notif.buildingId || null,
      flatNum: notif.meta?.flatNum || notif.flatNum || null,
    };
  }

  // Economic Auditor grant/revoke notifications belong to Owner (if internal) or Auditor (if external)
  if (nType === 'auditor_updated') {
    const flatNum = notif.meta?.flatNum || notif.flatNum || null;
    return {
      type: flatNum ? 'owner' : 'auditor',
      buildingId: notif.buildingId || null,
      flatNum,
    };
  }

  // Flat-scoped notices (dunning, payment reminders, circulars, urgent resident notices)
  if (
    notif.recipientScope === 'flat' ||
    notif.flatNum ||
    nType === 'finance' ||
    nType === 'dunning' ||
    nType === 'payment_reminder' ||
    nType === 'circular' ||
    nType === 'urgent'
  ) {
    return {
      type: 'owner',
      buildingId: notif.buildingId || null,
      flatNum: notif.flatNum || null,
    };
  }

  return {
    type: 'any',
    buildingId: notif.buildingId || null,
    flatNum: null,
  };
}

/**
 * Returns true strictly if `notif` belongs to the given `profile`.
 */
export function doesNotificationMatchProfile(notif, profile) {
  if (!notif || !profile) return false;
  const target = inferNotificationTargetProfile(notif);

  if (target.type === 'any') {
    if (target.buildingId && profile.buildingId && String(target.buildingId) !== String(profile.buildingId)) {
      return false;
    }
    return true;
  }

  if (target.type !== profile.type) {
    return false;
  }

  if (target.type === 'kk') {
    return true;
  }

  // Owner or SZVB: scope by buildingId (and flatNum when specified)
  if (target.buildingId && profile.buildingId && String(target.buildingId) !== String(profile.buildingId)) {
    return false;
  }
  if (target.flatNum && profile.flatNum && String(target.flatNum) !== String(profile.flatNum)) {
    return false;
  }

  return true;
}

/**
 * Filter notifications strictly to the currently active profile of `currentUser`.
 * Ensures e.g. apartment SZVB/dunning notices NEVER appear inside the KK profile's inbox.
 */
export function getNotificationsForActiveProfile(notifications = [], currentUser = null, allProfiles = []) {
  if (!currentUser) return [];
  const allMine = getNotificationsForUser(notifications, currentUser);
  const activeProfile = getActiveProfileDescriptor(currentUser, allProfiles);
  if (!activeProfile) return allMine;
  return allMine.filter((n) => doesNotificationMatchProfile(n, activeProfile));
}

/**
 * Check if a direct-message sender copy belongs to the user's active profile.
 */
function doesSenderCopyMatchProfile(notif, userEmail, activeProfile) {
  if (!notif || !notif.meta?.isSenderCopy) return false;
  const senderEmail = normalizeEmail(notif.actorEmail || notif.recipientEmail || '');
  if (!senderEmail || !userEmail || senderEmail !== userEmail) return false;
  if (!activeProfile) return true;
  const sp = notif.meta?.senderProfile || notif.targetProfile;
  if (!sp || !sp.type) return true;
  if (sp.type !== activeProfile.type) return false;
  if (sp.type === 'kk') return true;
  if (sp.buildingId && activeProfile.buildingId && String(sp.buildingId) !== String(activeProfile.buildingId)) {
    return false;
  }
  if (sp.flatNum && activeProfile.flatNum && String(sp.flatNum) !== String(activeProfile.flatNum)) {
    return false;
  }
  return true;
}

/**
 * Filter sent direct messages strictly to the currently active profile (non-archived).
 */
export function getSentMessagesForActiveProfile(notifications = [], currentUser = null, allProfiles = []) {
  if (!currentUser || !Array.isArray(notifications)) return [];
  const userEmail = normalizeEmail(currentUser.email || currentUser.username || '');
  if (!userEmail) return [];
  const activeProfile = getActiveProfileDescriptor(currentUser, allProfiles);

  return notifications
    .filter((n) => {
      if (!n || n.deleted || n.archived || n.dismissed) return false;
      return doesSenderCopyMatchProfile(n, userEmail, activeProfile);
    })
    .sort((a, b) => (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0));
}

/**
 * Filter archived (and legacy dismissed) messages strictly to the currently active profile
 * so users can always inspect or restore past correspondence.
 */
export function getArchivedNotificationsForActiveProfile(notifications = [], currentUser = null, allProfiles = []) {
  if (!currentUser || !Array.isArray(notifications)) return [];
  const userEmail = normalizeEmail(currentUser.email || currentUser.username || '');
  const userUid = currentUser.uid || currentUser.id || null;
  const userBuildingId = currentUser.buildingId || null;
  const activeProfile = getActiveProfileDescriptor(currentUser, allProfiles);

  return notifications
    .filter((n) => {
      if (!n || n.deleted || (!n.archived && !n.dismissed)) return false;
      if (n.meta?.isSenderCopy) {
        return doesSenderCopyMatchProfile(n, userEmail, activeProfile);
      }
      const rEmail = normalizeEmail(n.recipientEmail);
      const belongsToUser =
        (rEmail && userEmail && rEmail === userEmail) ||
        (n.recipientUid && userUid && (String(n.recipientUid) === String(userUid) || String(n.recipientUid) === String(currentUser.uid) || String(n.recipientUid) === String(currentUser.id))) ||
        n.recipientScope === 'all' ||
        (n.recipientScope === 'building' && n.buildingId && userBuildingId && String(n.buildingId) === String(userBuildingId));
      if (!belongsToUser) return false;
      if (!activeProfile) return true;
      return doesNotificationMatchProfile(n, activeProfile);
    })
    .sort((a, b) => {
      const ta = new Date(a.archivedAt || a.createdAt || 0).getTime() || 0;
      const tb = new Date(b.archivedAt || b.createdAt || 0).getTime() || 0;
      return tb - ta;
    });
}

/**
 * Compute per-profile unread notification counts and whether ANY OTHER (inactive) profile
 * has unread notifications — driving the red dot on the Profile Switcher button and next to each profile row!
 */
export function getUnreadNotificationCountsByProfile(notifications = [], currentUser = null, allProfiles = []) {
  const unreadByProfile = {};
  if (!currentUser) {
    return {
      unreadByProfile,
      activeProfileUnread: 0,
      otherProfilesUnreadCount: 0,
      hasOtherProfilesUnread: false,
    };
  }

  const allMyUnread = getNotificationsForUser(notifications, currentUser).filter((n) => !n.read);
  const activeProfile = getActiveProfileDescriptor(currentUser, allProfiles);
  const activeKey = activeProfile?.id || null;

  const activeNotifIds = new Set(
    allMyUnread.filter((n) => activeProfile && doesNotificationMatchProfile(n, activeProfile)).map((n) => n.id)
  );

  const otherUnreadIds = new Set();

  for (const profile of allProfiles || []) {
    if (!profile?.id) continue;
    const matching = allMyUnread.filter((n) => doesNotificationMatchProfile(n, profile));
    unreadByProfile[profile.id] = matching.length;
    if (profile.id !== activeKey) {
      matching.forEach((n) => {
        if (!activeNotifIds.has(n.id)) {
          otherUnreadIds.add(n.id);
        }
      });
    }
  }

  return {
    unreadByProfile,
    activeProfileUnread: activeNotifIds.size,
    otherProfilesUnreadCount: otherUnreadIds.size,
    hasOtherProfilesUnread: otherUnreadIds.size > 0,
  };
}

/**
 * Persist and restore the user's last active profile per normalized email.
 */
export function saveLastActiveProfile(email, profile) {
  const norm = normalizeEmail(email);
  if (!norm || !profile || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      `${LAST_PROFILE_KEY_PREFIX}${norm}`,
      JSON.stringify({
        id: profile.id || getActiveProfileKey(profile),
        type: profile.type || null,
        buildingId: profile.buildingId || null,
        flatNum: profile.flatNum || null,
        savedAt: Date.now(),
      })
    );
  } catch {
    // ignore storage quota/privacy mode errors
  }
}

export function loadLastActiveProfile(email) {
  const norm = normalizeEmail(email);
  if (!norm || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${LAST_PROFILE_KEY_PREFIX}${norm}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Choose the initial profile on login:
 * 1. Restore the user's last active profile if it is still valid & present in `allProfiles`.
 * 2. Otherwise default priority: KK profile -> first Owner apartment -> first SZVB profile.
 */
export function resolveInitialLoginProfile(allProfiles = [], savedProfile = null) {
  if (!Array.isArray(allProfiles) || allProfiles.length === 0) return null;
  if (savedProfile?.id) {
    const matched = allProfiles.find((p) => p && p.id === savedProfile.id);
    if (matched) return matched;
  }
  return (
    allProfiles.find((p) => p.type === 'kk') ||
    allProfiles.find((p) => p.type === 'owner') ||
    allProfiles.find((p) => p.type === 'szvb') ||
    allProfiles.find((p) => p.type === 'auditor') ||
    allProfiles[0]
  );
}

/**
 * Validates whether `currentUser`'s currently active profile is STILL authorized against the
 * latest live `buildings`, `organizations`, and `users` state.
 *
 * When a privileged / delegated role (SZVB, Financial Auditor, or offboarded KK staff) is revoked
 * while the user is actively viewing that profile, this deterministically selects the safest
 * fallback profile (prioritizing the user's own apartment Owner profile in that same building!).
 */
export function resolveActiveProfileValidity(
  currentUser,
  { buildings = [], organizations = [], users = [] } = {}
) {
  if (!currentUser) {
    return { isValid: true, matchedProfile: null, fallbackProfile: null, reason: null, szvbRoleChanged: false };
  }

  // SuperAdmin (including when viewing a flat or KK profile in their own session) is NEVER auto-ejected
  if (currentUser.role === 'superadmin' || currentUser.isSuperAdmin === true) {
    return { isValid: true, matchedProfile: null, fallbackProfile: null, reason: null, szvbRoleChanged: false };
  }

  const activeBuildings = (buildings || []).filter((b) => b && b.archived !== true);
  // Do not falsely eject building-scoped profiles before buildings have hydrated
  if (
    activeBuildings.length === 0 &&
    (currentUser.role === 'szvb' || currentUser.role === 'auditor' || currentUser.role === 'Owner')
  ) {
    return { isValid: true, matchedProfile: null, fallbackProfile: null, reason: null, szvbRoleChanged: false };
  }

  const resolved = resolveUserProfiles(currentUser, {
    buildings: activeBuildings,
    organizations,
    users,
  });

  const bId = currentUser.buildingId || null;
  let explicitMembership = null;
  if (bId && currentUser.memberships) {
    if (Array.isArray(currentUser.memberships)) {
      explicitMembership = currentUser.memberships.find((m) => m && m.buildingId === bId) || null;
    } else if (typeof currentUser.memberships === 'object') {
      explicitMembership = currentUser.memberships[bId] || null;
    }
  }
  const explicitlyDeactivatedInMembership = Boolean(explicitMembership && explicitMembership.active === false);

  // For KK / Admin mode: ONLY eject when the organization explicitly suspended this staff member (`isSuspendedStaff === true`).
  // Never falsely eject an active KK owner/admin due to partial/unhydrated state.
  if (currentUser.role === 'admin') {
    if (!resolved.isSuspendedStaff) {
      return {
        isValid: true,
        matchedProfile: resolved.kkProfile || null,
        fallbackProfile: null,
        reason: null,
        szvbRoleChanged: false,
      };
    }
  }

  // For Owner mode: NEVER falsely eject just because `building.flats` is empty/unhydrated!
  // Only eject an Owner if server-side membership explicitly marked them `active === false`.
  if (currentUser.role === 'Owner') {
    if (!explicitlyDeactivatedInMembership) {
      const activeKey = getActiveProfileKey(currentUser);
      const matchedOwner = (resolved.allProfiles || []).find((p) => p && p.id === activeKey) || null;
      return {
        isValid: true,
        matchedProfile: matchedOwner,
        fallbackProfile: null,
        reason: null,
        szvbRoleChanged: false,
      };
    }
  }

  const activeKey = getActiveProfileKey(currentUser);
  const matchedProfile = (resolved.allProfiles || []).find((p) => p && p.id === activeKey) || null;

  if (matchedProfile && !explicitlyDeactivatedInMembership) {
    const szvbRoleChanged = Boolean(
      currentUser.role === 'szvb' &&
      matchedProfile.szvbRole &&
      currentUser.szvbRole &&
      matchedProfile.szvbRole !== currentUser.szvbRole
    );
    return {
      isValid: true,
      matchedProfile,
      fallbackProfile: null,
      reason: null,
      szvbRoleChanged,
    };
  }

  // Active delegated profile (SZVB, Financial Auditor, or explicitly suspended KK staff / deactivated Owner)
  // is NO LONGER authorized -> choose the safest fallback profile!
  const remainingProfiles = (resolved.allProfiles || []).filter((p) => {
    if (!p) return false;
    if (explicitlyDeactivatedInMembership && bId && p.buildingId === bId) return false;
    return true;
  });

  // Priority 1: User's own apartment Owner profile in the SAME building (exact flatNum match first)
  const sameBuildingOwner = bId
    ? (remainingProfiles.find(
        (p) => p.type === 'owner' && p.buildingId === bId && currentUser.flatNum && String(p.flatNum) === String(currentUser.flatNum)
      ) || remainingProfiles.find((p) => p.type === 'owner' && p.buildingId === bId))
    : null;

  const fallbackProfile =
    sameBuildingOwner ||
    remainingProfiles.find((p) => p.type === 'owner') ||
    remainingProfiles.find((p) => p.type === 'szvb') ||
    remainingProfiles.find((p) => p.type === 'auditor') ||
    remainingProfiles.find((p) => p.type === 'kk') ||
    remainingProfiles[0] ||
    null;

  return {
    isValid: false,
    matchedProfile: null,
    revokedRole: currentUser.role,
    revokedBuildingId: bId,
    fallbackProfile,
    reason: fallbackProfile ? 'active_profile_revoked' : 'no_remaining_profiles',
    szvbRoleChanged: false,
  };
}
