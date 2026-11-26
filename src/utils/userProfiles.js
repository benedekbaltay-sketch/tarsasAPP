import { normalizeEmail, getNotificationsForUser } from './teamPermissions.js';
import { getUserSzvbRolesAcrossBuildings } from './szvb.js';

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

  const allProfiles = [
    ...(kkProfile ? [kkProfile] : []),
    ...ownerProfiles,
    ...szvbProfiles,
  ];

  return {
    kkProfile,
    szvbProfiles,
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
    allProfiles[0]
  );
}
