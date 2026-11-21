/**
 * Multi-Company Organization, Self-Service Team Delegation,
 * Owner-Controlled Permissions, Bank Account Security Diff & Alerting,
 * Per-Building Manager Contact Resolution, and Notification Helpers.
 *
 * Pure ES module (zero React/Firebase runtime dependencies) so it can be
 * shared cleanly across UI components, Context actions, and Node unit tests.
 */

export const DEFAULT_STAFF_PERMISSIONS = Object.freeze({
  canCreateBuildings: false,
  canManageTeam: false,
  canEditBankAccounts: false,
  canDeleteBuildings: false,
});

export const OWNER_PERMISSIONS = Object.freeze({
  canCreateBuildings: true,
  canManageTeam: true,
  canEditBankAccounts: true,
  canDeleteBuildings: true,
});

export const INVITE_TTL_DAYS = 7;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Normalizes staff permissions and strictly enforces that `canDeleteBuildings`
 * is ALWAYS false for staff members (deleting buildings is strictly Owner/SuperAdmin-only).
 */
export function normalizeStaffPermissions(raw = {}) {
  return {
    canCreateBuildings: Boolean(raw?.canCreateBuildings),
    canManageTeam: Boolean(raw?.canManageTeam),
    canEditBankAccounts: Boolean(raw?.canEditBankAccounts),
    canDeleteBuildings: false,
  };
}

/**
 * Generates a cryptographically strong URL-safe invite token (128-bit entropy).
 */
export function generateInviteToken() {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolves the authenticated user's organization context and effective permissions.
 *
 * Backwards-compatibility guarantee:
 * - Existing legacy `admin` users without an explicit `organizations` record
 *   automatically resolve as implicit `org_owner` with full permissions so zero
 *   existing RTDB accounts break on upgrade.
 */
export function resolveUserOrgContext(user, organizations = [], buildings = []) {
  if (!user) {
    return {
      org: null,
      member: null,
      isSuperAdmin: false,
      isOwner: false,
      isStaff: false,
      isSuspended: false,
      isAdminRole: false,
      ownerEmail: '',
      permissions: { ...DEFAULT_STAFF_PERMISSIONS },
    };
  }

  const userEmail = normalizeEmail(user.email);
  const orgList = Array.isArray(organizations) ? organizations : [];

  if (user.role === 'superadmin') {
    return {
      org: orgList[0] || null,
      member: null,
      isSuperAdmin: true,
      isOwner: false,
      isStaff: false,
      isSuspended: false,
      isAdminRole: true,
      ownerEmail: userEmail,
      permissions: { ...OWNER_PERMISSIONS },
    };
  }

  // 1. Explicit organization owner match
  if (userEmail) {
    for (const org of orgList) {
      if (!org) continue;
      const orgOwnerEmail = normalizeEmail(org.ownerEmail);
      const members = Array.isArray(org.members) ? org.members : [];
      const ownerMember = members.find(
        (m) => m && normalizeEmail(m.email) === userEmail && m.orgRole === 'owner'
      );
      if (orgOwnerEmail === userEmail || ownerMember) {
        return {
          org,
          member: ownerMember || {
            id: `owner-${org.id}`,
            email: userEmail,
            name: user.name || org.ownerName || userEmail,
            orgRole: 'owner',
            active: true,
            buildingScope: 'all',
            buildingIds: [],
            permissions: { ...OWNER_PERMISSIONS },
          },
          isSuperAdmin: false,
          isOwner: true,
          isStaff: false,
          isSuspended: false,
          isAdminRole: true,
          ownerEmail: orgOwnerEmail || userEmail,
          permissions: { ...OWNER_PERMISSIONS },
        };
      }
    }

    // 2. Explicit organization staff member match (active first, then suspended)
    let suspendedMatch = null;
    for (const org of orgList) {
      if (!org || !Array.isArray(org.members)) continue;
      const matched = org.members.find(
        (m) => m && normalizeEmail(m.email) === userEmail && m.orgRole !== 'owner'
      );
      if (!matched) continue;

      if (matched.active === false) {
        suspendedMatch = { org, member: matched };
        continue;
      }

      return {
        org,
        member: matched,
        isSuperAdmin: false,
        isOwner: false,
        isStaff: true,
        isSuspended: false,
        isAdminRole: true,
        ownerEmail: normalizeEmail(org.ownerEmail),
        permissions: normalizeStaffPermissions(matched.permissions),
      };
    }

    if (suspendedMatch) {
      return {
        org: suspendedMatch.org,
        member: suspendedMatch.member,
        isSuperAdmin: false,
        isOwner: false,
        isStaff: false,
        isSuspended: true,
        isAdminRole: false,
        ownerEmail: normalizeEmail(suspendedMatch.org.ownerEmail),
        permissions: { ...DEFAULT_STAFF_PERMISSIONS },
      };
    }
  }

  // 3. Backwards-compatible legacy admin (no organization record created yet)
  if (user.role === 'admin') {
    return {
      org: null,
      member: null,
      isSuperAdmin: false,
      isOwner: true,
      isStaff: false,
      isSuspended: false,
      isAdminRole: true,
      ownerEmail: userEmail,
      permissions: { ...OWNER_PERMISSIONS },
    };
  }

  // 4. Regular Owner (Resident) / SZVB
  return {
    org: null,
    member: null,
    isSuperAdmin: false,
    isOwner: false,
    isStaff: false,
    isSuspended: false,
    isAdminRole: false,
    ownerEmail: '',
    permissions: { ...DEFAULT_STAFF_PERMISSIONS },
  };
}

/**
 * Checks whether a building belongs to an organization (including legacy un-tagged buildings
 * when `org.includeLegacyBuildings !== false`).
 */
export function isBuildingInOrganization(building, org) {
  if (!building) return false;
  if (!org) return !building.organizationId;
  if (building.organizationId) {
    return building.organizationId === org.id;
  }
  return org.includeLegacyBuildings !== false;
}

/**
 * Returns the subset of buildings the user is authorized to manage/view in Admin/Portfolio mode.
 * Non-admin roles (Residents / SZVB) receive the input list for downstream unit/flat scoping.
 */
export function getAccessibleBuildings(user, buildings = [], organizations = []) {
  const list = Array.isArray(buildings) ? buildings : [];
  if (!user) return [];
  if (user.role === 'superadmin') return list;

  const ctx = resolveUserOrgContext(user, organizations, list);
  if (ctx.isSuspended) return [];

  if (ctx.isOwner) {
    if (!ctx.org) {
      return list.filter((b) => b && !b.organizationId);
    }
    return list.filter((b) => isBuildingInOrganization(b, ctx.org));
  }

  if (ctx.isStaff && ctx.org && ctx.member) {
    const orgBuildings = list.filter((b) => isBuildingInOrganization(b, ctx.org));
    if (ctx.member.buildingScope === 'all') {
      return orgBuildings;
    }
    const allowedIds = new Set(Array.isArray(ctx.member.buildingIds) ? ctx.member.buildingIds : []);
    return orgBuildings.filter((b) => allowedIds.has(b.id));
  }

  // Non-admin user (Resident / SZVB)
  return list;
}

export function canUserAccessBuilding(user, building, organizations = [], allBuildings = []) {
  if (!user || !building) return false;
  if (user.role === 'superadmin') return true;
  const ctx = resolveUserOrgContext(user, organizations, allBuildings);
  if (ctx.isSuspended) return false;
  if (ctx.isOwner || ctx.isStaff) {
    const accessible = getAccessibleBuildings(user, [building], organizations);
    return accessible.some((b) => b.id === building.id);
  }
  return true;
}

export function canUserCreateBuilding(user, organizations = [], buildings = []) {
  const ctx = resolveUserOrgContext(user, organizations, buildings);
  if (ctx.isSuspended) return false;
  return Boolean(ctx.isSuperAdmin || ctx.isOwner || (ctx.isStaff && ctx.permissions.canCreateBuildings));
}

/**
 * Strictly Owner & SuperAdmin ONLY. Staff can NEVER delete a condominium building.
 */
export function canUserDeleteBuilding(user, building, organizations = [], buildings = []) {
  if (!user) return false;
  const ctx = resolveUserOrgContext(user, organizations, buildings);
  if (ctx.isSuperAdmin) return true;
  if (!ctx.isOwner || ctx.isStaff || ctx.isSuspended) return false;
  if (!building) return true;
  return isBuildingInOrganization(building, ctx.org);
}

export function canUserManageTeam(user, organizations = [], buildings = []) {
  const ctx = resolveUserOrgContext(user, organizations, buildings);
  if (ctx.isSuspended) return false;
  return Boolean(ctx.isSuperAdmin || ctx.isOwner || (ctx.isStaff && ctx.permissions.canManageTeam));
}

export function canUserEditBankAccountNumbers(user, building, organizations = [], buildings = []) {
  const ctx = resolveUserOrgContext(user, organizations, buildings);
  if (ctx.isSuspended) return false;
  if (ctx.isSuperAdmin) return true;
  if (ctx.isOwner) {
    return building ? isBuildingInOrganization(building, ctx.org) : true;
  }
  if (ctx.isStaff && ctx.permissions.canEditBankAccounts) {
    return building ? canUserAccessBuilding(user, building, organizations, buildings) : true;
  }
  return false;
}

/**
 * Anti-privilege-escalation guard for team member mutations.
 * Prevents staff managers from:
 *  - Modifying or removing the Organization Owner
 *  - Granting `canDeleteBuildings` to anyone
 *  - Granting permissions they themselves do not possess
 *  - Modifying their own permission flags
 */
export function canActorManageTargetMember(actorCtx, targetMember, requestedPermissions = null, actorEmail = '') {
  if (!actorCtx || actorCtx.isSuspended) {
    return { allowed: false, reason: 'unauthorized' };
  }
  if (!actorCtx.isSuperAdmin && !actorCtx.isOwner && !actorCtx.permissions?.canManageTeam) {
    return { allowed: false, reason: 'no_team_permission' };
  }
  if (targetMember?.orgRole === 'owner' && !actorCtx.isSuperAdmin) {
    return { allowed: false, reason: 'cannot_modify_owner' };
  }
  if (requestedPermissions && requestedPermissions.canDeleteBuildings === true) {
    return { allowed: false, reason: 'delete_is_owner_only' };
  }

  if (actorCtx.isStaff) {
    const cleanActor = normalizeEmail(actorEmail || actorCtx.member?.email);
    const cleanTarget = normalizeEmail(targetMember?.email);
    if (cleanActor && cleanTarget && cleanActor === cleanTarget) {
      return { allowed: false, reason: 'cannot_modify_self' };
    }

    if (requestedPermissions) {
      if (requestedPermissions.canCreateBuildings && !actorCtx.permissions.canCreateBuildings) {
        return { allowed: false, reason: 'privilege_escalation' };
      }
      if (requestedPermissions.canEditBankAccounts && !actorCtx.permissions.canEditBankAccounts) {
        return { allowed: false, reason: 'privilege_escalation' };
      }
      if (requestedPermissions.canManageTeam && !actorCtx.permissions.canManageTeam) {
        return { allowed: false, reason: 'privilege_escalation' };
      }
    }
  }

  return { allowed: true, reason: null };
}

/**
 * Normalizes a bank account number / IBAN for change comparison (ignores spacing/casing).
 */
export function normalizeBankAccountForDiff(accountStr) {
  return String(accountStr || '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Detects ANY addition, modification, or removal of bank account numbers across
 * KK, FA, and custom sub-accounts.
 */
export function detectBankAccountChanges(prevBuilding, nextBankKK, nextBankFA, nextCustomAccounts) {
  const changes = [];
  if (!prevBuilding) return changes;

  const prevKKAcc = String(prevBuilding.bankKK?.account || '').trim();
  const nextKKAcc = String(nextBankKK?.account ?? prevKKAcc).trim();
  if (normalizeBankAccountForDiff(prevKKAcc) !== normalizeBankAccountForDiff(nextKKAcc)) {
    changes.push({
      accountKey: 'KK',
      accountLabelHu: 'Közös Költség (KK) főszámla',
      accountLabelEn: 'Common Cost (KK) Main Account',
      oldAccount: prevKKAcc || '—',
      newAccount: nextKKAcc || '—',
      changeType: 'modified',
    });
  }

  const prevFAAcc = String(prevBuilding.bankFA?.account || '').trim();
  const nextFAAcc = String(nextBankFA?.account ?? prevFAAcc).trim();
  if (normalizeBankAccountForDiff(prevFAAcc) !== normalizeBankAccountForDiff(nextFAAcc)) {
    changes.push({
      accountKey: 'FA',
      accountLabelHu: 'Felújítási Alap (FA) számla',
      accountLabelEn: 'Renovation Fund (FA) Account',
      oldAccount: prevFAAcc || '—',
      newAccount: nextFAAcc || '—',
      changeType: 'modified',
    });
  }

  const prevCustom = Array.isArray(prevBuilding.customBankAccounts) ? prevBuilding.customBankAccounts : [];
  const nextCustom = Array.isArray(nextCustomAccounts) ? nextCustomAccounts : prevCustom;
  const prevById = new Map(prevCustom.map((a) => [a.id, a]));
  const nextById = new Map(nextCustom.map((a) => [a.id, a]));

  for (const [id, nextAcc] of nextById.entries()) {
    const prevAcc = prevById.get(id);
    const label = nextAcc.name || 'Alszámla';
    if (!prevAcc) {
      changes.push({
        accountKey: id,
        accountLabelHu: `${label} (új alszámla)`,
        accountLabelEn: `${label} (new sub-account)`,
        oldAccount: '—',
        newAccount: String(nextAcc.account || '').trim() || '—',
        changeType: 'added',
      });
    } else {
      const oldNum = String(prevAcc.account || '').trim();
      const newNum = String(nextAcc.account || '').trim();
      if (normalizeBankAccountForDiff(oldNum) !== normalizeBankAccountForDiff(newNum)) {
        changes.push({
          accountKey: id,
          accountLabelHu: label,
          accountLabelEn: label,
          oldAccount: oldNum || '—',
          newAccount: newNum || '—',
          changeType: 'modified',
        });
      }
    }
  }

  for (const [id, prevAcc] of prevById.entries()) {
    if (!nextById.has(id)) {
      const label = prevAcc.name || 'Alszámla';
      changes.push({
        accountKey: id,
        accountLabelHu: `${label} (törölt alszámla)`,
        accountLabelEn: `${label} (removed sub-account)`,
        oldAccount: String(prevAcc.account || '').trim() || '—',
        newAccount: '—',
        changeType: 'removed',
      });
    }
  }

  return changes;
}

/**
 * Builds a high-priority (pale-red) security notification for the Organization Owner
 * whenever a colleague modifies a condominium's bank account number.
 */
export function buildBankChangeNotification({ actorUser, ownerEmail, building, changes = [] }) {
  const recipient = normalizeEmail(ownerEmail);
  const actorEmail = normalizeEmail(actorUser?.email);
  const actorName = String(actorUser?.name || actorEmail || 'Munkatárs').trim();
  const bName = String(building?.name || 'Társasház').trim();

  const summaryHu = changes
    .map((c) => `${c.accountLabelHu}: ${c.oldAccount} → ${c.newAccount}`)
    .join('; ');
  const summaryEn = changes
    .map((c) => `${c.accountLabelEn}: ${c.oldAccount} → ${c.newAccount}`)
    .join('; ');

  return {
    id: `notif-bank-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'bank_account_changed',
    severity: 'critical',
    recipientEmail: recipient,
    buildingId: building?.id || null,
    buildingName: bName,
    actorEmail,
    actorName,
    titleHu: `Bankszámlaszám módosítva – ${bName}`,
    titleEn: `Bank Account Changed – ${bName}`,
    messageHu: `${actorName} módosította a(z) ${bName} bankszámlaszámát: ${summaryHu}`,
    messageEn: `${actorName} changed bank account details for ${bName}: ${summaryEn}`,
    changes,
    read: false,
    dismissed: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Builds a standard informational notification (e.g. team assignment, building handover, offboarding warning).
 */
export function buildNotification({
  type = 'info',
  severity = 'info',
  recipientEmail = '',
  recipientUid = null,
  recipientScope = null,
  buildingId = null,
  buildingName = '',
  actorUser = null,
  titleHu = '',
  titleEn = '',
  messageHu = '',
  messageEn = '',
}) {
  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    severity,
    recipientEmail: normalizeEmail(recipientEmail),
    recipientUid: recipientUid || null,
    recipientScope: recipientScope || null,
    buildingId: buildingId || null,
    buildingName: buildingName || '',
    actorEmail: normalizeEmail(actorUser?.email),
    actorName: String(actorUser?.name || actorUser?.email || '').trim(),
    titleHu,
    titleEn,
    messageHu,
    messageEn,
    read: false,
    dismissed: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Resolves what contact information should be displayed to Residents on the
 * TenantView top Quick Contact Card:
 *  - 'manager': shows the actual building manager's personal contact (`building.managerContact`)
 *  - 'company' (default / legacy): shows the central company / building representative contact
 */
export function resolveBuildingResidentContact(building, repProfile = {}, organizations = []) {
  const org = (Array.isArray(organizations) ? organizations : []).find(
    (o) => o && building?.organizationId && o.id === building.organizationId
  );

  const companyContact = {
    mode: 'company',
    isPersonalManager: false,
    name: String(
      building?.repName ||
      org?.centralContact?.name ||
      repProfile?.companyName ||
      repProfile?.name ||
      ''
    ).trim(),
    phone: String(
      building?.phone ||
      org?.centralContact?.phone ||
      repProfile?.phone ||
      ''
    ).trim(),
    email: String(
      building?.email ||
      org?.centralContact?.email ||
      repProfile?.email ||
      ''
    ).trim(),
    officeHours: String(
      building?.repOfficeHours ||
      org?.centralContact?.officeHours ||
      ''
    ).trim(),
    roleLabelHu: '',
    roleLabelEn: '',
  };

  if (building?.contactDisplayMode === 'manager' && building?.managerContact) {
    const mc = building.managerContact;
    const hasManagerData = Boolean(
      String(mc.name || '').trim() ||
      String(mc.phone || '').trim() ||
      String(mc.email || '').trim()
    );
    if (hasManagerData) {
      return {
        mode: 'manager',
        isPersonalManager: true,
        name: String(mc.name || companyContact.name).trim(),
        phone: String(mc.phone || companyContact.phone).trim(),
        email: String(mc.email || companyContact.email).trim(),
        officeHours: String(mc.officeHours || '').trim(),
        roleLabelHu: String(mc.titleHu || 'Felelős házkezelő').trim(),
        roleLabelEn: String(mc.titleEn || 'Responsible Property Manager').trim(),
      };
    }
  }

  return companyContact;
}

/**
 * Filters notifications belonging to the currently logged-in user, sorted newest first.
 */
export function getNotificationsForUser(notifications = [], user) {
  if (!user || !Array.isArray(notifications)) return [];
  const userEmail = normalizeEmail(user.email);
  const userUid = user.uid || null;
  const userBuildingId = user.buildingId || null;

  return notifications
    .filter((n) => {
      if (!n || n.dismissed) return false;
      if (n.recipientEmail && userEmail && normalizeEmail(n.recipientEmail) === userEmail) {
        return true;
      }
      if (n.recipientUid && userUid && n.recipientUid === userUid) {
        return true;
      }
      if (n.recipientScope === 'all') {
        return true;
      }
      if (n.recipientScope === 'building' && n.buildingId && userBuildingId && n.buildingId === userBuildingId) {
        return true;
      }
      return false;
    })
    .sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime() || 0;
      const tb = new Date(b.createdAt || 0).getTime() || 0;
      return tb - ta;
    });
}

export function countUnreadNotifications(notifications = [], user) {
  return getNotificationsForUser(notifications, user).filter((n) => !n.read).length;
}

/**
 * Finds an active, non-expired invite matching the provided token across organizations.
 */
export function findPendingInviteByToken(organizations = [], token = '') {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || !Array.isArray(organizations)) return null;
  const now = Date.now();

  for (const org of organizations) {
    if (!org || !Array.isArray(org.invites)) continue;
    const inv = org.invites.find((item) => item && item.token === cleanToken);
    if (!inv) continue;
    const expiresMs = inv.expiresAt ? new Date(inv.expiresAt).getTime() : 0;
    const isExpired = Boolean(expiresMs && expiresMs < now);
    return {
      org,
      invite: inv,
      isExpired,
      isValid: inv.status === 'pending' && !isExpired,
    };
  }
  return null;
}

/**
 * Finds the organization that owns a specific building (or falls back to the user's org).
 */
export function findOrganizationForBuilding(building, organizations = []) {
  const list = Array.isArray(organizations) ? organizations : [];
  if (building?.organizationId) {
    const match = list.find((o) => o && o.id === building.organizationId);
    if (match) return match;
  }
  return list.find((o) => o && o.includeLegacyBuildings !== false) || list[0] || null;
}

/**
 * Generates a cryptographically strong throwaway password (never stored or logged)
 * used solely to provision a new colleague's Firebase Auth identity before immediately
 * dispatching the official password-setup email link.
 */
export function generateTemporaryInvitePassword(length = 28) {
  const safeLen = Math.max(20, Math.min(64, Number(length) || 28));
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+';
  const all = upper + lower + digits + symbols;

  const bytes = new Uint8Array(safeLen);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Guarantee at least one character from each class for strict password policies
  const chars = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];
  for (let i = 4; i < safeLen; i += 1) {
    chars.push(all[bytes[i] % all.length]);
  }
  return chars.join('');
}

/**
 * Builds the post-password-setup return URL back to the TarsasApp Login page
 * with the invite token and invited email pre-attached.
 */
export function buildInviteContinueUrl({ origin = 'https://tarsashaz-cfe5d.web.app', token = '', email = '', passwordSet = true } = {}) {
  const cleanOrigin = String(origin || 'https://tarsashaz-cfe5d.web.app').replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (token) params.set('invite', String(token).trim());
  const cleanEmail = normalizeEmail(email);
  if (cleanEmail) params.set('email', cleanEmail);
  if (passwordSet) params.set('passwordSet', '1');
  const qs = params.toString();
  return qs ? `${cleanOrigin}/?${qs}` : `${cleanOrigin}/`;
}

/**
 * Extracts invite token, email, passwordSet flag, and Firebase password-reset oobCode
 * from window.location.search / hash AND any nested Firebase `continueUrl` parameter.
 */
export function extractInviteContextFromUrl(searchStr = '', hashStr = '') {
  const mergeParams = (raw) => {
    try {
      const cleaned = String(raw || '').replace(/^[?#]/, '');
      const queryPart = cleaned.includes('?') ? cleaned.split('?')[1] : cleaned;
      return new URLSearchParams(queryPart);
    } catch {
      return new URLSearchParams();
    }
  };

  const searchParams = mergeParams(searchStr);
  const hashParams = mergeParams(hashStr);
  const pick = (key) => searchParams.get(key) || hashParams.get(key) || '';

  const mode = pick('mode').trim();
  const oobCode = pick('oobCode').trim();
  let rawInvite = pick('invite').trim();
  let rawEmail = normalizeEmail(pick('email'));
  let passwordSet = pick('passwordSet') === '1';

  const continueUrlRaw = pick('continueUrl').trim();
  if (continueUrlRaw) {
    try {
      const parsed = new URL(continueUrlRaw);
      if (!rawInvite && parsed.searchParams.get('invite')) {
        rawInvite = parsed.searchParams.get('invite').trim();
      }
      if (!rawEmail && parsed.searchParams.get('email')) {
        rawEmail = normalizeEmail(parsed.searchParams.get('email'));
      }
      if (!passwordSet && parsed.searchParams.get('passwordSet') === '1') {
        passwordSet = true;
      }
    } catch {
      // Ignore malformed continueUrl
    }
  }

  const inviteToken = /^[a-fA-F0-9]{16,64}$/.test(rawInvite) ? rawInvite : '';
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : '';

  return {
    mode,
    oobCode,
    inviteToken,
    email,
    passwordSet,
    isInvitePasswordReset: Boolean(mode === 'resetPassword' && oobCode && (inviteToken || passwordSet)),
  };
}

/**
 * Escapes HTML special characters for safe transactional HTML email rendering.
 */
function escapeHtmlForEmail(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds concise, polite Hungarian or English welcome invitation copy (subject, plain text, HTML)
 * containing a short introduction, assigned building(s), and password-setup / login link.
 */
export function buildInviteWelcomeEmailContent({
  recipientName = '',
  recipientEmail = '',
  orgName = '',
  inviterName = '',
  buildingNames = [],
  buildingScope = 'selected',
  actionUrl = 'https://tarsashaz-cfe5d.web.app/',
  isEn = false,
} = {}) {
  const cleanRecipient = String(recipientName || recipientEmail || '').trim();
  const cleanOrg = String(orgName || (isEn ? 'Property Management' : 'Közös Képviselet')).trim();
  const cleanInviter = String(inviterName || cleanOrg).trim();
  const bList = Array.isArray(buildingNames) ? buildingNames.filter(Boolean) : [];
  const buildingsTextHu =
    buildingScope === 'all'
      ? 'az összes céges társasház'
      : bList.length > 0
      ? bList.join(', ')
      : 'a hozzád rendelt társasház(ak)';
  const buildingsTextEn =
    buildingScope === 'all'
      ? 'all company condominiums'
      : bList.length > 0
      ? bList.join(', ')
      : 'your assigned condominium(s)';

  if (isEn) {
    const subject = `TarsasApp Invitation – ${cleanOrg}`;
    const textBody = [
      `Hello ${cleanRecipient},`,
      '',
      `${cleanInviter} (${cleanOrg}) has granted you property management access in TarsasApp for: ${buildingsTextEn}.`,
      '',
      'Please open the link below to set your own password. Once saved, you will be redirected to the login page where you can sign in immediately with your email address:',
      actionUrl,
      '',
      'Best regards,',
      cleanOrg,
    ].join('\n');

    const htmlBody = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
        <h2 style="margin:0 0 12px;color:#1E3A8A;font-size:20px;">Welcome to TarsasApp!</h2>
        <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">
          Hello <strong>${escapeHtmlForEmail(cleanRecipient)}</strong>,
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">
          <strong>${escapeHtmlForEmail(cleanInviter)}</strong> (${escapeHtmlForEmail(cleanOrg)}) has granted you condominium management access for:
          <strong>${escapeHtmlForEmail(buildingsTextEn)}</strong>.
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 20px;">
          Click the button below to set your own password. Once confirmed, you will be redirected straight to the login page where you can sign in immediately.
        </p>
        <p style="margin:0 0 20px;">
          <a href="${escapeHtmlForEmail(actionUrl)}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:14px;">
            Set Password &amp; Activate Account
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280;line-height:1.5;margin:0;">
          If the button does not work, copy this link into your browser:<br/>
          <a href="${escapeHtmlForEmail(actionUrl)}" style="color:#1E3A8A;word-break:break-all;">${escapeHtmlForEmail(actionUrl)}</a>
        </p>
      </div>
    `.trim();

    return { subject, textBody, htmlBody };
  }

  const subject = `TarsasApp meghívó – ${cleanOrg}`;
  const textBody = [
    `Kedves ${cleanRecipient}!`,
    '',
    `${cleanInviter} (${cleanOrg}) hozzáférést adott számodra a TarsasApp társasházkezelő rendszerhez a következő társasház(ak) kezelésére: ${buildingsTextHu}.`,
    '',
    'Az alábbi linkre kattintva tudsz magadnak saját jelszót beállítani. A jelszó mentése után a rendszer automatikusan a bejelentkezési felületre irányít, ahol az e-mail címeddel azonnal beléphetsz:',
    actionUrl,
    '',
    'Üdvözlettel,',
    cleanOrg,
  ].join('\n');

  const htmlBody = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;">
      <h2 style="margin:0 0 12px;color:#1E3A8A;font-size:20px;">Meghívó a TarsasApp rendszerbe</h2>
      <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">
        Kedves <strong>${escapeHtmlForEmail(cleanRecipient)}</strong>!
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">
        <strong>${escapeHtmlForEmail(cleanInviter)}</strong> (${escapeHtmlForEmail(cleanOrg)}) társasházkezelői hozzáférést adott számodra:
        <strong>${escapeHtmlForEmail(buildingsTextHu)}</strong>.
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 20px;">
        Kattints az alábbi gombra a saját jelszavad beállításához. A mentés után a rendszer automatikusan a bejelentkezési felületre irányít, ahol azonnal be tudsz lépni.
      </p>
      <p style="margin:0 0 20px;">
        <a href="${escapeHtmlForEmail(actionUrl)}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:14px;">
          Jelszó beállítása és aktiválás
        </a>
      </p>
      <p style="font-size:12px;color:#6b7280;line-height:1.5;margin:0;">
        Ha a gomb nem működik, másold be ezt a hivatkozást a böngésződbe:<br/>
        <a href="${escapeHtmlForEmail(actionUrl)}" style="color:#1E3A8A;word-break:break-all;">${escapeHtmlForEmail(actionUrl)}</a>
      </p>
    </div>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Builds a pre-filled `mailto:` URL so an Owner can optionally send a personal welcome
 * email directly from their own mail client alongside the automatic password-setup email.
 */
export function buildInviteMailtoUrl(options = {}) {
  const recipientEmail = normalizeEmail(options.recipientEmail);
  const { subject, textBody } = buildInviteWelcomeEmailContent(options);
  return `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;
}
