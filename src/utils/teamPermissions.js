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
    teamManageScope: raw?.teamManageScope === 'assigned' ? 'assigned' : 'all',
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

  // Strictly isolate non-admin active profiles (SZVB, Resident/Owner):
  // Even if the same email also owns/belongs to a KK organization, an active SZVB or Owner
  // session MUST NEVER inherit KK/admin write permissions.
  const normalizedRole = String(user.role || '').toLowerCase();
  if (normalizedRole === 'szvb' || normalizedRole === 'owner' || normalizedRole === 'tenant' || normalizedRole === 'resident') {
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
  if (!building || building.archived) return false;
  if (!org) return !building.organizationId;
  if (building.organizationId) {
    return building.organizationId === org.id;
  }
  return org.includeLegacyBuildings !== false;
}

/**
 * Returns the subset of active (non-archived) buildings the user is authorized to manage/view in Admin/Portfolio mode.
 * Non-admin roles (Residents / SZVB) receive the active list for downstream unit/flat scoping.
 */
export function getAccessibleBuildings(user, buildings = [], organizations = []) {
  const list = (Array.isArray(buildings) ? buildings : []).filter((b) => b && !b.archived);
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
  if (building && building.archived) return false;
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
  if (ctx.isStaff) {
    if (building && !canUserAccessBuilding(user, building, organizations, buildings)) {
      return false;
    }
    const member = (ctx.org?.members || []).find((m) => m && normalizeEmail(m.email) === normalizeEmail(user?.email));
    const perBuilding = building?.id ? member?.buildingAssignments?.[building.id] : null;
    if (perBuilding && perBuilding.canEditBankAccounts !== undefined) {
      return Boolean(perBuilding.canEditBankAccounts);
    }
    return Boolean(ctx.permissions?.canEditBankAccounts);
  }
  return false;
}

/**
 * Checks whether a staff member has active management/write permissions on a given building
 * (returns false if the colleague was explicitly assigned 'viewer' role on that building,
 * or if they only have read-only viewer rights).
 */
export function canUserManageBuilding(user, building, organizations = [], buildings = []) {
  if (!user) return false;
  const normalizedRole = String(user.role || '').toLowerCase();
  if (
    normalizedRole === 'viewer' ||
    normalizedRole === 'szvb' ||
    normalizedRole === 'owner' ||
    normalizedRole === 'tenant' ||
    normalizedRole === 'resident' ||
    user.isViewer === true
  ) {
    return false;
  }
  const ctx = resolveUserOrgContext(user, organizations, buildings);
  if (ctx.isSuspended) return false;
  if (ctx.isSuperAdmin) return true;
  if (ctx.isOwner) {
    const rawId = typeof building === 'object' && building !== null ? building.id : building;
    const bId = rawId !== undefined && rawId !== null ? String(rawId) : '';
    const bObj = typeof building === 'object' && building !== null ? building : (buildings || []).find((b) => String(b?.id) === bId);
    return bObj ? isBuildingInOrganization(bObj, ctx.org) : true;
  }
  if (ctx.isStaff) {
    const rawId = typeof building === 'object' && building !== null ? building.id : building;
    const bId = rawId !== undefined && rawId !== null ? String(rawId) : '';
    const bObj = typeof building === 'object' && building !== null ? building : (buildings || []).find((b) => String(b?.id) === bId);
    if (bObj && !canUserAccessBuilding(user, bObj, organizations, buildings)) {
      return false;
    }
    const member = (ctx.org?.members || []).find((m) => m && normalizeEmail(m.email) === normalizeEmail(user?.email));
    if (bId) {
      const perBuilding = member?.buildingAssignments?.[bId] ||
        (member?.buildingAssignments && Object.entries(member.buildingAssignments).find(([k]) => String(k) === bId)?.[1]);
      if (perBuilding && perBuilding.role === 'viewer') {
        return false;
      }
      if (!perBuilding && (member?.role === 'viewer' || member?.defaultRole === 'viewer')) {
        return false;
      }
    } else {
      const assignments = Object.values(member?.buildingAssignments || {});
      if (assignments.length > 0 && assignments.every((a) => a?.role === 'viewer')) {
        return false;
      }
      if (member?.role === 'viewer' || member?.defaultRole === 'viewer') {
        return false;
      }
    }
    return true;
  }
  return false;
}

/**
 * Checks whether a user has read-only (viewer) rights on a given building or globally.
 * Returns true if the user is a staff member whose role on this building (or all assigned buildings) is 'viewer'.
 */
export function isUserBuildingViewer(user, building, organizations = [], buildings = []) {
  if (!user) return false;
  if (user.role === 'viewer' || user.isViewer === true) return true;
  const ctx = resolveUserOrgContext(user, organizations, buildings);
  if (!ctx.isStaff || ctx.isSuperAdmin || ctx.isOwner || ctx.isSuspended) {
    return false;
  }
  const member = (ctx.org?.members || []).find((m) => m && normalizeEmail(m.email) === normalizeEmail(user?.email));
  if (!member) return false;

  const rawId = typeof building === 'object' && building !== null ? building.id : building;
  const bId = rawId !== undefined && rawId !== null ? String(rawId) : '';
  if (bId) {
    const assignment = member.buildingAssignments?.[bId] ||
      (member.buildingAssignments && Object.entries(member.buildingAssignments).find(([k]) => String(k) === bId)?.[1]);
    if (assignment?.role === 'viewer') return true;
    if (assignment?.role === 'manager') return false;
    if (!assignment && (member?.role === 'viewer' || member?.defaultRole === 'viewer')) return true;
  }

  const assignments = Object.values(member.buildingAssignments || {});
  if (assignments.length > 0 && assignments.every((a) => a?.role === 'viewer')) {
    return true;
  }
  if (member?.role === 'viewer' || member?.defaultRole === 'viewer') return true;

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
export function canActorManageTargetMember(
  actorCtx,
  targetMember,
  requestedPermissions = null,
  actorEmail = '',
  requestedScopePayload = null
) {
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

    const actorHasAllScope =
      actorCtx.member?.buildingScope === 'all' &&
      actorCtx.permissions?.teamManageScope !== 'assigned';
    const actorAllowedBIds = new Set((actorCtx.member?.buildingIds || []).map(String));
    const actorHasAnyBankEdit =
      Boolean(actorCtx.permissions?.canEditBankAccounts) ||
      Object.values(actorCtx.member?.buildingAssignments || {}).some((a) => Boolean(a?.canEditBankAccounts));

    // Prevent a staff member from editing/suspending/removing a colleague who holds higher privileges or out-of-scope buildings
    if (targetMember && targetMember.orgRole === 'staff') {
      if (targetMember.permissions?.canCreateBuildings && !actorCtx.permissions.canCreateBuildings) {
        return { allowed: false, reason: 'privilege_escalation' };
      }
      if (
        targetMember.permissions?.canManageTeam &&
        targetMember.permissions?.teamManageScope !== 'assigned' &&
        actorCtx.permissions.teamManageScope === 'assigned'
      ) {
        return { allowed: false, reason: 'privilege_escalation' };
      }
      if (!actorHasAllScope) {
        if (targetMember.buildingScope === 'all') {
          return { allowed: false, reason: 'privilege_escalation' };
        }
        const targetBIds = Array.isArray(targetMember.buildingIds) ? targetMember.buildingIds.map(String) : [];
        for (const bId of targetBIds) {
          if (!actorAllowedBIds.has(bId)) {
            return { allowed: false, reason: 'privilege_escalation' };
          }
        }
      }
    }

    if (requestedPermissions) {
      if (requestedPermissions.canCreateBuildings && !actorCtx.permissions.canCreateBuildings) {
        return { allowed: false, reason: 'privilege_escalation' };
      }
      if (requestedPermissions.canEditBankAccounts && !actorHasAnyBankEdit) {
        return { allowed: false, reason: 'privilege_escalation' };
      }
      if (requestedPermissions.canManageTeam && !actorCtx.permissions.canManageTeam) {
        return { allowed: false, reason: 'privilege_escalation' };
      }
      // Assigned-only delegator can NEVER grant Co-admin ('all') delegation scope
      if (
        requestedPermissions.canManageTeam &&
        requestedPermissions.teamManageScope !== 'assigned' &&
        actorCtx.permissions.teamManageScope === 'assigned'
      ) {
        return { allowed: false, reason: 'privilege_escalation' };
      }
    }

    // Strict per-building & scope anti-privilege-escalation checks
    if (requestedScopePayload) {
      const reqScope = requestedScopePayload.buildingScope === 'all' ? 'all' : 'selected';
      const reqBuildingIds = Array.isArray(requestedScopePayload.buildingIds)
        ? requestedScopePayload.buildingIds.map(String)
        : [];
      const reqAssignments = requestedScopePayload.buildingAssignments || {};

      if (reqScope === 'all' && !actorHasAllScope) {
        return { allowed: false, reason: 'privilege_escalation' };
      }

      if (reqScope === 'selected' && !actorHasAllScope) {
        for (const bId of reqBuildingIds) {
          if (!actorAllowedBIds.has(bId)) {
            return { allowed: false, reason: 'privilege_escalation' };
          }
        }
      }

      const evaluatedIds = reqScope === 'all' ? Object.keys(reqAssignments) : reqBuildingIds;
      for (const bId of evaluatedIds) {
        const reqAssign = reqAssignments[bId];
        if (!reqAssign) continue;

        const actorAssign = actorCtx.member?.buildingAssignments?.[bId] || {};
        const actorIsViewerHere =
          actorAssign.role === 'viewer' ||
          (!actorAssign.role && (actorCtx.member?.role === 'viewer' || actorCtx.member?.defaultRole === 'viewer'));
        const actorCanBankHere =
          !actorIsViewerHere &&
          Boolean(
            actorAssign.canEditBankAccounts !== undefined
              ? actorAssign.canEditBankAccounts
              : actorCtx.permissions?.canEditBankAccounts
          );
        // A viewer on building B cannot grant Full Manager on building B
        if (reqAssign.role !== 'viewer' && actorIsViewerHere) {
          return { allowed: false, reason: 'privilege_escalation' };
        }
        // Cannot grant bank account editing on building B without holding it on B
        if (reqAssign.canEditBankAccounts && !actorCanBankHere) {
          return { allowed: false, reason: 'privilege_escalation' };
        }
        // A viewer on building B cannot change resident contact or central contact visibility on building B
        if ((reqAssign.showManagerContact || reqAssign.showCentralContact) && actorIsViewerHere) {
          return { allowed: false, reason: 'privilege_escalation' };
        }
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
    targetProfile: { type: 'kk', buildingId: building?.id || null },
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
  flatNum = null,
  targetProfile = null,
  actorUser = null,
  titleHu = '',
  titleEn = '',
  messageHu = '',
  messageEn = '',
  changes = [],
  meta = null,
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
    ...(flatNum ? { flatNum: String(flatNum) } : {}),
    ...(targetProfile && typeof targetProfile === 'object' ? { targetProfile } : {}),
    actorEmail: normalizeEmail(actorUser?.email),
    actorName: String(actorUser?.name || actorUser?.email || '').trim(),
    titleHu,
    titleEn,
    messageHu,
    messageEn,
    changes: Array.isArray(changes) ? changes : [],
    ...(meta && typeof meta === 'object' ? { meta } : {}),
    read: false,
    dismissed: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Diffs an existing team member's configuration with the new update payload.
 * Identifies every added/revoked building, role changes (manager vs viewer),
 * bank account permissions, contact visibility, and global permissions.
 */
export function diffTeamMemberChanges(oldMember, newMemberData, buildings = []) {
  if (!oldMember || !newMemberData) {
    return { hasChanges: false, changes: [], summaryLinesHu: [], summaryLinesEn: [] };
  }

  const changes = [];
  const bMap = new Map((buildings || []).map((b) => [String(b.id), b.name || b.id]));

  // 1. Building scope change
  const oldScope = oldMember.buildingScope === 'all' ? 'all' : 'selected';
  const newScope = newMemberData.buildingScope === 'all' ? 'all' : 'selected';

  if (oldScope !== newScope) {
    if (newScope === 'all') {
      changes.push({
        type: 'granted',
        category: 'scope',
        labelHu: 'Minden céges társasházhoz hozzáférést kaptál',
        labelEn: 'Access expanded to all company condominiums',
      });
    } else {
      changes.push({
        type: 'revoked',
        category: 'scope',
        labelHu: 'Hozzáférés korlátozva a kijelölt társasházakra',
        labelEn: 'Access restricted to selected condominiums only',
      });
    }
  }

  // 2. Added and removed buildings
  const oldBIds = new Set((oldMember.buildingIds || []).map(String));
  const newBIds = new Set((newMemberData.buildingIds || []).map(String));
  const oldAssignments = oldMember.buildingAssignments || {};
  const newAssignments = newMemberData.buildingAssignments || {};
  const newlyAddedBuildingIds = new Set();

  if (newScope === 'selected') {
    // Check newly added
    for (const id of newBIds) {
      if (!oldBIds.has(id)) {
        newlyAddedBuildingIds.add(id);
        const name = bMap.get(id) || id;
        const initRole = newAssignments[id]?.role === 'viewer' ? 'viewer' : 'manager';
        const roleLabelHu = initRole === 'viewer' ? 'Csak megtekintő' : 'Teljes kezelő';
        const roleLabelEn = initRole === 'viewer' ? 'Viewer' : 'Full Manager';
        changes.push({
          type: 'granted',
          category: 'building_access',
          buildingId: id,
          buildingName: name,
          labelHu: `${name} — Hozzárendelve (${roleLabelHu})`,
          labelEn: `${name} — Assigned (${roleLabelEn})`,
        });
      }
    }
    // Check removed
    for (const id of oldBIds) {
      if (!newBIds.has(id)) {
        const name = bMap.get(id) || id;
        changes.push({
          type: 'revoked',
          category: 'building_access',
          buildingId: id,
          buildingName: name,
          labelHu: `${name} — Hozzáférés megvonva`,
          labelEn: `${name} — Access removed`,
        });
      }
    }
  }

  // 3. Per-building role and permission assignments (skip newly added buildings to avoid redundant role diffs)
  const evaluatedBuildingIds = new Set([
    ...Object.keys(oldAssignments),
    ...Object.keys(newAssignments),
  ]);

  for (const bId of evaluatedBuildingIds) {
    const bIdStr = String(bId);
    if (newScope === 'selected' && !newBIds.has(bIdStr)) continue;
    if (oldScope === 'selected' && newlyAddedBuildingIds.has(bIdStr)) continue;

    const oldCfg = oldAssignments[bId] || {};
    const newCfg = newAssignments[bId] || {};
    const bName = bMap.get(bIdStr) || bId;

    // A) Role: manager vs viewer
    const oldRole = oldCfg.role === 'viewer' ? 'viewer' : 'manager';
    const newRole = newCfg.role === 'viewer' ? 'viewer' : 'manager';

    if (oldRole !== newRole) {
      if (newRole === 'viewer') {
        changes.push({
          type: 'revoked',
          category: 'role',
          buildingId: bId,
          buildingName: bName,
          labelHu: `${bName} — Szerepkör: Teljes kezelő → Csak megtekintő`,
          labelEn: `${bName} — Role: Full Manager → Viewer`,
        });
      } else {
        changes.push({
          type: 'granted',
          category: 'role',
          buildingId: bId,
          buildingName: bName,
          labelHu: `${bName} — Szerepkör: Csak megtekintő → Teljes kezelő`,
          labelEn: `${bName} — Role: Viewer → Full Manager`,
        });
      }
    }

    // B) Bank account editing
    const oldBank = Boolean(oldCfg.canEditBankAccounts);
    const newBank = Boolean(newCfg.canEditBankAccounts);
    if (!oldBank && newBank) {
      changes.push({
        type: 'granted',
        category: 'bank_edit',
        buildingId: bId,
        buildingName: bName,
        labelHu: `${bName} — Bankszámla módosítás engedélyezve`,
        labelEn: `${bName} — Bank account editing granted`,
      });
    } else if (oldBank && !newBank) {
      changes.push({
        type: 'revoked',
        category: 'bank_edit',
        buildingId: bId,
        buildingName: bName,
        labelHu: `${bName} — Bankszámla módosítás megvonva`,
        labelEn: `${bName} — Bank account editing revoked`,
      });
    }

    // C) Resident Contact visibility
    const oldContact = Boolean(oldCfg.showManagerContact);
    const newContact = Boolean(newCfg.showManagerContact);
    if (!oldContact && newContact) {
      changes.push({
        type: 'granted',
        category: 'contact_display',
        buildingId: bId,
        buildingName: bName,
        labelHu: `${bName} — Lakói kapcsolattartó: Bekapcsolva`,
        labelEn: `${bName} — Resident contact: Enabled`,
      });
    } else if (oldContact && !newContact) {
      changes.push({
        type: 'revoked',
        category: 'contact_display',
        buildingId: bId,
        buildingName: bName,
        labelHu: `${bName} — Lakói kapcsolattartó: Kikapcsolva`,
        labelEn: `${bName} — Resident contact: Disabled`,
      });
    }
  }

  // 4. Global staff permissions
  const oldPerms = oldMember.permissions || {};
  const newPerms = newMemberData.permissions || {};

  const permChecks = [
    {
      key: 'canCreateBuildings',
      grantedHu: 'Új társasház létrehozása engedélyezve',
      grantedEn: 'Create new condominiums granted',
      revokedHu: 'Új társasház létrehozása megvonva',
      revokedEn: 'Create new condominiums revoked',
    },
    {
      key: 'canManageTeam',
      grantedHu: 'Munkatársak és jogosultságok kezelése engedélyezve',
      grantedEn: 'Team management permission granted',
      revokedHu: 'Munkatársak és jogosultságok kezelése megvonva',
      revokedEn: 'Team management permission revoked',
    },
    {
      key: 'canEditBankAccounts',
      grantedHu: 'Bankszámlaszámok módosítása (általános jog) engedélyezve',
      grantedEn: 'Bank account editing (general right) granted',
      revokedHu: 'Bankszámlaszámok módosítása (általános jog) megvonva',
      revokedEn: 'Bank account editing (general right) revoked',
    },
  ];

  for (const pc of permChecks) {
    const wasGranted = Boolean(oldPerms[pc.key]);
    const isNowGranted = Boolean(newPerms[pc.key]);
    if (!wasGranted && isNowGranted) {
      changes.push({
        type: 'granted',
        category: pc.key,
        labelHu: pc.grantedHu,
        labelEn: pc.grantedEn,
      });
    } else if (wasGranted && !isNowGranted) {
      changes.push({
        type: 'revoked',
        category: pc.key,
        labelHu: pc.revokedHu,
        labelEn: pc.revokedEn,
      });
    }
  }

  // Normalize teamManageScope before comparing so legacy undefined !== 'all' never triggers a false diff
  const oldTeamScope = oldPerms.teamManageScope === 'assigned' ? 'assigned' : 'all';
  const newTeamScope = newPerms.teamManageScope === 'assigned' ? 'assigned' : 'all';
  if (Boolean(oldPerms.canManageTeam) && Boolean(newPerms.canManageTeam) && oldTeamScope !== newTeamScope) {
    changes.push({
      type: 'modified',
      category: 'canManageTeam',
      labelHu: newTeamScope === 'assigned'
        ? 'Csapatkezelés hatásköre: Csak a kijelölt házakra korlátozva'
        : 'Csapatkezelés hatásköre: Kiterjesztve minden házra (Társadminisztrátor)',
      labelEn: newTeamScope === 'assigned'
        ? 'Team delegation scope: Restricted to assigned condominiums only'
        : 'Team delegation scope: Expanded to all condominiums (Co-admin)',
    });
  }

  // 5. Contact info update (strictly trimmed comparison so undefined vs "" never triggers false diff)
  const oldNameTrimmed = String(oldMember.name || '').trim();
  const newNameTrimmed = newMemberData.name !== undefined ? String(newMemberData.name || '').trim() : oldNameTrimmed;
  const oldPhoneTrimmed = String(oldMember.phone || '').trim();
  const newPhoneTrimmed = newMemberData.phone !== undefined ? String(newMemberData.phone || '').trim() : oldPhoneTrimmed;

  if (oldNameTrimmed !== newNameTrimmed && newNameTrimmed) {
    changes.push({
      type: 'modified',
      category: 'name',
      labelHu: `Név frissítve: ${oldNameTrimmed || '—'} → ${newNameTrimmed}`,
      labelEn: `Name updated: ${oldNameTrimmed || '—'} → ${newNameTrimmed}`,
    });
  }
  if (oldPhoneTrimmed !== newPhoneTrimmed) {
    changes.push({
      type: 'modified',
      category: 'phone',
      labelHu: `Telefonszám frissítve: ${oldPhoneTrimmed || '—'} → ${newPhoneTrimmed || '—'}`,
      labelEn: `Phone updated: ${oldPhoneTrimmed || '—'} → ${newPhoneTrimmed || '—'}`,
    });
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    summaryLinesHu: changes.map((c) => c.labelHu),
    summaryLinesEn: changes.map((c) => c.labelEn),
  };
}

/**
 * Builds a clean team update notification where the message is a concise summary line
 * and the exact granular changes are delivered once in `changes[]` (no duplicate text).
 */
export function buildTeamUpdateNotification({
  actorUser,
  targetEmail,
  targetUid = null,
  changes = [],
  diff = null,
}) {
  const actorName = actorUser?.name || actorUser?.email || 'A tulajdonos';
  const count = changes.length;

  return buildNotification({
    type: 'team_updated',
    severity: 'info',
    recipientEmail: targetEmail,
    recipientUid: targetUid,
    targetProfile: { type: 'kk' },
    actorUser,
    titleHu: 'Jogosultságaid módosultak',
    titleEn: 'Your Permissions Were Updated',
    messageHu: count > 0
      ? `${actorName} módosította a jogosultságaidat (${count} változás).`
      : `${actorName} frissítette a jogosultságaidat.`,
    messageEn: count > 0
      ? `${actorName} updated your access permissions (${count} ${count === 1 ? 'change' : 'changes'}).`
      : `${actorName} updated your access permissions.`,
    changes,
  });
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

  const showCentralEscalation = Boolean(
    building?.showCentralContactToResidents ?? 
    org?.showCentralContactToResidents ?? 
    repProfile?.showCentralContactToResidents ?? 
    false
  );

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
        showCentralEscalation,
        centralCompany: {
          name: companyContact.name,
          phone: companyContact.phone,
          email: companyContact.email,
          officeHours: companyContact.officeHours,
        },
      };
    }
  }

  return {
    ...companyContact,
    showCentralEscalation: false,
    centralCompany: null,
  };
}

/**
 * Filters notifications belonging to the currently logged-in user, sorted newest first.
 */
export function getNotificationsForUser(notifications = [], user) {
  if (!user || !Array.isArray(notifications)) return [];
  const userEmail = normalizeEmail(user.email || user.username || '');
  const userUid = user.uid || user.id || null;
  const userBuildingId = user.buildingId || null;

  return notifications
    .filter((n) => {
      if (!n || n.dismissed) return false;
      const rEmail = normalizeEmail(n.recipientEmail);
      if (rEmail && userEmail && rEmail === userEmail) {
        return true;
      }
      if (n.recipientUid && userUid && (String(n.recipientUid) === String(userUid) || String(n.recipientUid) === String(user.uid) || String(n.recipientUid) === String(user.id))) {
        return true;
      }
      if (n.recipientScope === 'all') {
        return true;
      }
      if (n.recipientScope === 'building' && n.buildingId && userBuildingId && String(n.buildingId) === String(userBuildingId)) {
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
 * containing who invited the colleague (name + email), the assigned buildings, and an elegant
 * CTA button to set their password (hiding raw ugly URLs in HTML).
 */
export function buildInviteWelcomeEmailContent({
  recipientName = '',
  recipientEmail = '',
  orgName = '',
  inviterName = '',
  inviterEmail = '',
  buildingNames = [],
  buildingScope = 'selected',
  actionUrl = 'https://tarsashaz-cfe5d.web.app/',
  isEn = false,
} = {}) {
  const cleanRecipientName = String(recipientName || '').trim();
  const cleanRecipientEmail = String(recipientEmail || '').trim().toLowerCase();
  const cleanRecipient = cleanRecipientName || cleanRecipientEmail || (isEn ? 'Colleague' : 'Kolléga');
  const cleanOrg = String(orgName || (isEn ? 'Property Management' : 'Közös Képviselet')).trim();
  const cleanInviterName = String(inviterName || '').trim();
  const cleanInviterEmail = String(inviterEmail || '').trim().toLowerCase();
  const inviterDisplay = cleanInviterName && cleanInviterEmail
    ? `${cleanInviterName} (${cleanInviterEmail})`
    : cleanInviterName || cleanInviterEmail || cleanOrg;

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
      `${inviterDisplay} has granted you property management access in TarsasApp for ${cleanOrg}.`,
      `Assigned condominium(s): ${buildingsTextEn}`,
      `Your login email: ${cleanRecipientEmail || cleanRecipient}`,
      '',
      'Please click the link below to set your password and activate your account:',
      actionUrl,
      '',
      'After setting your password, you will be automatically redirected to the login page.',
      '',
      'Best regards,',
      cleanOrg,
    ].join('\n');

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px;color:#1e293b;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
        <div style="display:flex;align-items:center;margin-bottom:20px;border-bottom:2px solid #f1f5f9;padding-bottom:16px;">
          <h2 style="margin:0;color:#1E3A8A;font-size:20px;font-weight:800;letter-spacing:-0.02em;">TarsasApp</h2>
          <span style="margin-left:auto;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;padding:4px 10px;border-radius:20px;border:1px solid #e2e8f0;">${escapeHtmlForEmail(cleanOrg)}</span>
        </div>
        <h3 style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:700;">Welcome to the Team!</h3>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
          Hello <strong>${escapeHtmlForEmail(cleanRecipient)}</strong>,
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#334155;">
          <strong>${escapeHtmlForEmail(inviterDisplay)}</strong> invited you to manage condominiums in TarsasApp.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 24px;font-size:13px;line-height:1.7;">
          <div><strong style="color:#475569;">Assigned properties:</strong> <span style="color:#0f172a;font-weight:600;">${escapeHtmlForEmail(buildingsTextEn)}</span></div>
          <div><strong style="color:#475569;">Login email address:</strong> <span style="color:#1E3A8A;font-weight:700;">${escapeHtmlForEmail(cleanRecipientEmail || cleanRecipient)}</span></div>
        </div>
        <div style="text-align:center;margin:28px 0;">
          <a href="${escapeHtmlForEmail(actionUrl)}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;font-size:14px;box-shadow:0 2px 6px rgba(30,58,138,0.25);">
            Set Password &amp; Activate Account &rarr;
          </a>
        </div>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:24px 0 0;text-align:center;">
          If the button above does not work, <a href="${escapeHtmlForEmail(actionUrl)}" style="color:#1E3A8A;font-weight:600;text-decoration:underline;">click here to set your password</a>.
        </p>
      </div>
    `.trim();

    return { subject, textBody, htmlBody };
  }

  const subject = `TarsasApp meghívó – ${cleanOrg}`;
  const textBody = [
    `Kedves ${cleanRecipient}!`,
    '',
    `${inviterDisplay} társasházkezelői hozzáférést adott számodra a TarsasApp rendszerben (${cleanOrg}).`,
    `Kezelt társasház(ak): ${buildingsTextHu}`,
    `Belépési e-mail címed: ${cleanRecipientEmail || cleanRecipient}`,
    '',
    'Kattints az alábbi hivatkozásra a saját jelszavad beállításához és a fiók aktiválásához:',
    actionUrl,
    '',
    'A jelszó megadása után a rendszer automatikusan a bejelentkezési oldalra irányít.',
    '',
    'Üdvözlettel,',
    cleanOrg,
  ].join('\n');

  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px;color:#1e293b;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
      <div style="display:flex;align-items:center;margin-bottom:20px;border-bottom:2px solid #f1f5f9;padding-bottom:16px;">
        <h2 style="margin:0;color:#1E3A8A;font-size:20px;font-weight:800;letter-spacing:-0.02em;">TarsasApp</h2>
        <span style="margin-left:auto;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;padding:4px 10px;border-radius:20px;border:1px solid #e2e8f0;">${escapeHtmlForEmail(cleanOrg)}</span>
      </div>
      <h3 style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:700;">Meghívó a csapatba</h3>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
        Kedves <strong>${escapeHtmlForEmail(cleanRecipient)}</strong>!
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#334155;">
        <strong>${escapeHtmlForEmail(inviterDisplay)}</strong> hozzáférést adott számodra a <strong>${escapeHtmlForEmail(cleanOrg)}</strong> kezelésében lévő társasházakhoz.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 24px;font-size:13px;line-height:1.7;">
        <div><strong style="color:#475569;">Kezelt társasház(ak):</strong> <span style="color:#0f172a;font-weight:600;">${escapeHtmlForEmail(buildingsTextHu)}</span></div>
        <div><strong style="color:#475569;">Belépési e-mail címed:</strong> <span style="color:#1E3A8A;font-weight:700;">${escapeHtmlForEmail(cleanRecipientEmail || cleanRecipient)}</span></div>
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${escapeHtmlForEmail(actionUrl)}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;font-size:14px;box-shadow:0 2px 6px rgba(30,58,138,0.25);">
          Jelszó beállítása és fiók aktiválása &rarr;
        </a>
      </div>
      <p style="font-size:12px;color:#64748b;line-height:1.5;margin:24px 0 0;text-align:center;">
        Ha a fenti gomb nem kattintható, <a href="${escapeHtmlForEmail(actionUrl)}" style="color:#1E3A8A;font-weight:600;text-decoration:underline;">kattints ide a jelszavad beállításához</a>.
      </p>
    </div>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Builds professional Hungarian or English forgot-password copy (subject, plain text, HTML)
 * with a clean CTA button ("Új jelszó megadása") and security notices, omitting ugly raw URLs in HTML.
 */
export function buildForgotPasswordEmailContent({
  recipientEmail = '',
  actionUrl = 'https://tarsashaz-cfe5d.web.app/',
  isEn = false,
} = {}) {
  const cleanEmail = normalizeEmail(recipientEmail);

  if (isEn) {
    const subject = 'TarsasApp – Password Reset Request';
    const textBody = [
      'Hello,',
      '',
      `We received a request to reset the password for your TarsasApp account (${cleanEmail || 'your email'}).`,
      '',
      'Please click the link below to set a new password:',
      actionUrl,
      '',
      'If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.',
      'For security reasons, this link is valid for 1 hour.',
      '',
      'Best regards,',
      'The TarsasApp Team',
    ].join('\n');

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px;color:#1e293b;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
        <div style="display:flex;align-items:center;margin-bottom:20px;border-bottom:2px solid #f1f5f9;padding-bottom:16px;">
          <h2 style="margin:0;color:#1E3A8A;font-size:20px;font-weight:800;letter-spacing:-0.02em;">TarsasApp</h2>
          <span style="margin-left:auto;font-size:11px;font-weight:700;color:#b45309;background:#fef3c7;padding:4px 10px;border-radius:20px;">Security Notice</span>
        </div>
        <h3 style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:700;">Password Reset</h3>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#334155;">
          We received a request to reset the password for your account: <strong style="color:#1E3A8A;">${escapeHtmlForEmail(cleanEmail)}</strong>.
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#334155;">
          Click the button below to choose a new, secure password:
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${escapeHtmlForEmail(actionUrl)}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;font-size:14px;box-shadow:0 2px 6px rgba(30,58,138,0.25);">
            Set New Password &rarr;
          </a>
        </div>
        <p style="font-size:12px;color:#64748b;line-height:1.5;margin:24px 0 0;text-align:center;">
          If the button above does not work, <a href="${escapeHtmlForEmail(actionUrl)}" style="color:#1E3A8A;font-weight:600;text-decoration:underline;">click here to reset your password</a>.
        </p>
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;line-height:1.5;">
          If you did not request this change, please ignore this email. Your current password remains secure.
        </div>
      </div>
    `.trim();

    return { subject, textBody, htmlBody };
  }

  const subject = 'TarsasApp – Jelszó visszaállítása';
  const textBody = [
    'Kedves Felhasználónk!',
    '',
    `Jelszó-visszaállítást kezdeményeztek a TarsasApp rendszerben a(z) ${cleanEmail || 'fiókodhoz'} tartozó profilhoz.`,
    '',
    'Az új jelszavad megadásához kattints az alábbi hivatkozásra:',
    actionUrl,
    '',
    'Amennyiben nem te kérted a jelszó módosítását, ezt az e-mailt nyugodtan figyelmen kívül hagyhatod, a fiókod és jelenlegi jelszavad biztonságban marad.',
    'A hivatkozás biztonsági okokból 1 órán keresztül érvényes.',
    '',
    'Üdvözlettel,',
    'A TarsasApp Csapata',
  ].join('\n');

  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px;color:#1e293b;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
      <div style="display:flex;align-items:center;margin-bottom:20px;border-bottom:2px solid #f1f5f9;padding-bottom:16px;">
        <h2 style="margin:0;color:#1E3A8A;font-size:20px;font-weight:800;letter-spacing:-0.02em;">TarsasApp</h2>
        <span style="margin-left:auto;font-size:11px;font-weight:700;color:#b45309;background:#fef3c7;padding:4px 10px;border-radius:20px;">Biztonsági értesítés</span>
      </div>
      <h3 style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:700;">Jelszó visszaállítása</h3>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#334155;">
        Jelszó-visszaállítást kezdeményeztél a(z) <strong style="color:#1E3A8A;">${escapeHtmlForEmail(cleanEmail)}</strong> e-mail címhez tartozó TarsasApp fiókodhoz.
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px;color:#334155;">
        Kattints az alábbi gombra új jelszavad megadásához:
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${escapeHtmlForEmail(actionUrl)}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;font-size:14px;box-shadow:0 2px 6px rgba(30,58,138,0.25);">
          Új jelszó megadása &rarr;
        </a>
      </div>
      <p style="font-size:12px;color:#64748b;line-height:1.5;margin:24px 0 0;text-align:center;">
        Ha a fenti gomb nem kattintható, <a href="${escapeHtmlForEmail(actionUrl)}" style="color:#1E3A8A;font-weight:600;text-decoration:underline;">kattints ide az új jelszavad beállításához</a>.
      </p>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;line-height:1.5;">
        Amennyiben nem te kérted ezt a módosítást, kérjük, hagyd figyelmen kívül ezt a levelet. A fiókod és jelenlegi jelszavad biztonságban marad.
      </div>
    </div>
  `.trim();

  return { subject, textBody, htmlBody };
}

/**
 * Builds professional Hungarian or English email content (subject, textBody, htmlBody)
 * for notifying a colleague when an Owner updates their condominium access or permissions,
 * including a structured breakdown with badges (+ Megadva, − Visszavonva, ~ Módosítva).
 */
export function buildPermissionUpdateEmailContent({
  recipientName = '',
  recipientEmail = '',
  orgName = '',
  actorName = '',
  actorEmail = '',
  changes = [],
  actionUrl = 'https://hazapp.hu',
  isEn = false,
} = {}) {
  const cleanRecipientName = String(recipientName || '').trim();
  const cleanRecipientEmail = String(recipientEmail || '').trim().toLowerCase();
  const cleanRecipient = cleanRecipientName || cleanRecipientEmail || (isEn ? 'Colleague' : 'Kolléga');
  const cleanOrg = String(orgName || (isEn ? 'Property Management' : 'Közös Képviselet')).trim();
  const cleanActorName = String(actorName || '').trim();
  const cleanActorEmail = String(actorEmail || '').trim().toLowerCase();
  const actorDisplay = cleanActorName && cleanActorEmail
    ? `${cleanActorName} (${cleanActorEmail})`
    : cleanActorName || cleanActorEmail || cleanOrg;

  const changesList = Array.isArray(changes) ? changes : [];

  if (isEn) {
    const subject = `TarsasApp – Condominium Access Updated (${cleanOrg})`;
    const textChanges = changesList.map((ch) => {
      const tag = ch.type === 'granted' ? '[+ Granted]' : ch.type === 'revoked' ? '[− Revoked]' : '[~ Modified]';
      return `• ${tag} ${ch.labelEn || ch.labelHu}`;
    }).join('\n');

    const textBody = [
      `Hello ${cleanRecipient},`,
      '',
      `${actorDisplay} has updated your property management access permissions in TarsasApp for ${cleanOrg}.`,
      '',
      'Summary of changes:',
      textChanges || '• Your permissions were updated.',
      '',
      'You can access the updated condominiums and details at:',
      actionUrl,
      '',
      'Best regards,',
      cleanOrg,
    ].join('\n');

    const htmlChanges = changesList.map((ch) => {
      const badgeStyle = ch.type === 'granted'
        ? 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;'
        : ch.type === 'revoked'
        ? 'background:#fff1f2;color:#be123c;border:1px solid #fecdd3;'
        : 'background:#fffbeb;color:#b45309;border:1px solid #fde68a;';
      const badgeText = ch.type === 'granted' ? '+ Granted' : ch.type === 'revoked' ? '− Revoked' : '~ Modified';
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;${badgeStyle}">${badgeText}</span>
          <span style="font-size:13px;color:#1e293b;font-weight:500;line-height:1.4;">${escapeHtmlForEmail(ch.labelEn || ch.labelHu)}</span>
        </div>
      `;
    }).join('');

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px;color:#1e293b;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
        <div style="display:flex;align-items:center;margin-bottom:20px;border-bottom:2px solid #f1f5f9;padding-bottom:16px;">
          <h2 style="margin:0;color:#1E3A8A;font-size:20px;font-weight:800;letter-spacing:-0.02em;">TarsasApp</h2>
          <span style="margin-left:auto;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;padding:4px 10px;border-radius:20px;border:1px solid #e2e8f0;">${escapeHtmlForEmail(cleanOrg)}</span>
        </div>
        <h3 style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:700;">Condominium Access Updated</h3>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
          Hello <strong>${escapeHtmlForEmail(cleanRecipient)}</strong>,
        </p>
        <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#334155;">
          <strong>${escapeHtmlForEmail(actorDisplay)}</strong> has updated your condominium access permissions in TarsasApp for <strong>${escapeHtmlForEmail(cleanOrg)}</strong>.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 24px;">
          <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;">
            Detailed changes:
          </div>
          ${htmlChanges || '<p style="font-size:13px;color:#64748b;margin:0;">Your permissions have been updated.</p>'}
        </div>
        <div style="text-align:center;margin:28px 0;">
          <a href="${escapeHtmlForEmail(actionUrl)}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;font-size:14px;box-shadow:0 2px 6px rgba(30,58,138,0.25);">
            Open TarsasApp &rarr;
          </a>
        </div>
      </div>
    `.trim();

    return { subject, textBody, htmlBody };
  }

  const subject = `TarsasApp – Házkezelési jogosultságaid módosultak (${cleanOrg})`;
  const textChanges = changesList.map((ch) => {
    const tag = ch.type === 'granted' ? '[+ Megadva]' : ch.type === 'revoked' ? '[− Visszavonva]' : '[~ Módosítva]';
    return `• ${tag} ${ch.labelHu || ch.labelEn}`;
  }).join('\n');

  const textBody = [
    `Kedves ${cleanRecipient}!`,
    '',
    `${actorDisplay} módosította a társasházkezelési jogosultságaidat a TarsasApp rendszerben (${cleanOrg}).`,
    '',
    'Változtatások összefoglalása:',
    textChanges || '• A jogosultságaid frissültek.',
    '',
    'A módosított társasházakat és felületeket közvetlenül megtekintheted itt:',
    actionUrl,
    '',
    'Üdvözlettel,',
    cleanOrg,
  ].join('\n');

  const htmlChanges = changesList.map((ch) => {
    const badgeStyle = ch.type === 'granted'
      ? 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;'
      : ch.type === 'revoked'
      ? 'background:#fff1f2;color:#be123c;border:1px solid #fecdd3;'
      : 'background:#fffbeb;color:#b45309;border:1px solid #fde68a;';
    const badgeText = ch.type === 'granted' ? '+ Megadva' : ch.type === 'revoked' ? '− Visszavonva' : '~ Módosítva';
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;">
        <span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;${badgeStyle}">${badgeText}</span>
        <span style="font-size:13px;color:#1e293b;font-weight:500;line-height:1.4;">${escapeHtmlForEmail(ch.labelHu || ch.labelEn)}</span>
      </div>
    `;
  }).join('');

  const htmlBody = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:580px;margin:0 auto;padding:32px 24px;color:#1e293b;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.04);">
      <div style="display:flex;align-items:center;margin-bottom:20px;border-bottom:2px solid #f1f5f9;padding-bottom:16px;">
        <h2 style="margin:0;color:#1E3A8A;font-size:20px;font-weight:800;letter-spacing:-0.02em;">TarsasApp</h2>
        <span style="margin-left:auto;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;padding:4px 10px;border-radius:20px;border:1px solid #e2e8f0;">${escapeHtmlForEmail(cleanOrg)}</span>
      </div>
      <h3 style="margin:0 0 14px;color:#0f172a;font-size:17px;font-weight:700;">Házkezelési jogosultságaid módosultak</h3>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
        Kedves <strong>${escapeHtmlForEmail(cleanRecipient)}</strong>!
      </p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#334155;">
        <strong>${escapeHtmlForEmail(actorDisplay)}</strong> módosította a társasházkezelési jogosultságaidat a TarsasApp rendszerben (${escapeHtmlForEmail(cleanOrg)}).
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 24px;">
        <div style="font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px;">
          Részletes változások:
        </div>
        ${htmlChanges || '<p style="font-size:13px;color:#64748b;margin:0;">A jogosultságaid módosultak.</p>'}
      </div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${escapeHtmlForEmail(actionUrl)}" style="display:inline-block;background:#1E3A8A;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;font-size:14px;box-shadow:0 2px 6px rgba(30,58,138,0.25);">
          Megnyitás a TarsasApp-ban &rarr;
        </a>
      </div>
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

/**
 * Safely resolves the human display name of a user across currentUser, repProfile,
 * organization members, and users lists, avoiding raw email prefixes where a real name exists.
 */
export function resolveUserDisplayName(currentUser = {}, state = {}) {
  if (!currentUser) return '';
  const email = (currentUser.email || '').toLowerCase().trim();
  const emailPrefix = email.includes('@') ? email.split('@')[0].toLowerCase() : '';

  const isRealName = (str) => {
    if (!str || typeof str !== 'string') return false;
    const clean = str.trim();
    if (!clean || clean.includes('@')) return false;
    if (emailPrefix && clean.toLowerCase() === emailPrefix) return false;
    return true;
  };

  // 1. currentUser.name if it's a real name (not an email or email-prefix)
  if (isRealName(currentUser.name)) {
    return currentUser.name.trim();
  }

  // 2. Organization members list
  if (email && Array.isArray(state?.organizations)) {
    for (const org of state.organizations) {
      if (Array.isArray(org.members)) {
        const m = org.members.find(item => item && (item.email || '').toLowerCase().trim() === email);
        if (m && isRealName(m.name)) {
          return m.name.trim();
        }
      }
      if (org.ownerEmail && (org.ownerEmail || '').toLowerCase().trim() === email && isRealName(org.centralContact?.name)) {
        return org.centralContact.name.trim();
      }
    }
  }

  // 3. Representative profile name
  if (isRealName(state?.repProfile?.name)) {
    return state.repProfile.name.trim();
  }

  // 4. Users list
  if (email && Array.isArray(state?.users)) {
    const u = state.users.find(item => item && (item.email || '').toLowerCase().trim() === email);
    if (u && isRealName(u.name)) {
      return u.name.trim();
    }
  }

  // 5. Flat owners list (if resident / owner)
  if (email && Array.isArray(state?.buildings)) {
    for (const b of state.buildings) {
      for (const f of (b.flats || [])) {
        if (Array.isArray(f.owners)) {
          const o = f.owners.find(item => item && (item.email || '').toLowerCase().trim() === email);
          if (o && isRealName(o.name)) {
            return o.name.trim();
          }
        }
        if ((f.email || '').toLowerCase().trim() === email && isRealName(f.ownerName)) {
          return f.ownerName.trim();
        }
      }
    }
  }

  // 6. Fallback to currentUser.name (even if prefix), or formatted name from email prefix, or email
  if (currentUser.name && currentUser.name.trim()) {
    const raw = currentUser.name.trim();
    if (raw.includes('.') && !raw.includes(' ') && !raw.includes('@')) {
      const parts = raw.split('.').filter(Boolean);
      if (parts.length > 0) {
        return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      }
    }
    return raw;
  }

  // If email has dots like "john.doe", format as "John Doe"
  if (emailPrefix && emailPrefix.includes('.')) {
    const parts = emailPrefix.split('.').filter(Boolean);
    if (parts.length > 0) {
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
  }

  return emailPrefix || email || (state?.currentLang === 'en' ? 'Property Manager' : 'Közös Képviselő');
}
