/**
 * Deterministic, Pure RTDB -> Multi-Tenant Cloud Firestore Transformer & 0-Ft Parity Verifier
 *
 * ZERO network calls, ZERO side effects. Used by:
 *   - scripts/migrateRtdbToFirestore.mjs (Emulator & Production migration)
 *   - scripts/verifyMigrationParity.mjs  (0-Ft post-migration audit)
 *   - tests/atomicTransactions.test.mjs  (Automated unit verification)
 */

import {
  normalizeFundKey,
  slugifyUnitId,
  normalizePaymentMethod,
  computeTxImpacts,
  computeUnitArrearsContribution,
  applyUnitBalanceDelta,
  applyBuildingBankDelta,
  applyAggregatesTransitions,
  applyMonthlySummaryDelta,
  getEffectiveUnitFeeForMonth,
} from '../functions/src/financeMath.js';

import {
  getLedgerMonths,
  isMatchingFlat,
  recalculateFlatBalances,
  getBuildingReserve,
  getBuildingRenovationFund,
  getBuildingAccountReserve,
  getMonthlyStats,
} from '../src/utils/finances.js';

const SENSITIVE_FIELD_NAMES = new Set([
  'pass',
  'password',
  'resetToken',
  'resetTokenExpiry',
  'apiKey',
  'clientSecret',
  'secretKey',
]);

const DEFAULT_CATEGORIES = [
  { id: 'cat-inc-kk', nameHu: 'Közös Költség befizetés', nameEn: 'Common Cost Payment', type: 'income', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['közös költség', 'kozos koltseg', 'kk'], isSystem: true, isActive: true, sortOrder: 1 },
  { id: 'cat-inc-fa', nameHu: 'Felújítási Alap befizetés', nameEn: 'Renovation Fund Payment', type: 'income', defaultFund: 'FA', allocationBasis: 'ownership_share', keywords: ['felújítási', 'felujitasi', 'fa'], isSystem: true, isActive: true, sortOrder: 2 },
  { id: 'cat-inc-extra', nameHu: 'Rendkívüli célbefizetés', nameEn: 'Special Assessment', type: 'income', defaultFund: 'FA', allocationBasis: 'ownership_share', keywords: ['célbefizetés', 'celbefizetes'], isSystem: true, isActive: true, sortOrder: 3 },
  { id: 'cat-inc-rent', nameHu: 'Helyiségbérlet / Reklámbevétel', nameEn: 'Rental / Advertising Income', type: 'income', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['bérleti', 'reklám'], isSystem: true, isActive: true, sortOrder: 4 },
  { id: 'cat-inc-interest', nameHu: 'Kamatbevétel', nameEn: 'Interest Income', type: 'income', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['kamat'], isSystem: true, isActive: true, sortOrder: 5 },
  { id: 'cat-inc-refund', nameHu: 'Kártérítés / Visszatérítés', nameEn: 'Refund / Insurance Claim', type: 'income', defaultFund: 'KK', allocationBasis: 'direct', keywords: ['kártérítés', 'visszatérítés'], isSystem: true, isActive: true, sortOrder: 6 },
  { id: 'cat-inc-other', nameHu: 'Egyéb jóváírás', nameEn: 'Other Income', type: 'income', defaultFund: 'KK', allocationBasis: 'direct', keywords: [], isSystem: true, isActive: true, sortOrder: 7 },
  { id: 'cat-exp-utility', nameHu: 'Közüzemi díj (Víz, Gáz, Áram)', nameEn: 'Utilities (Water, Gas, Electricity)', type: 'expense', defaultFund: 'KK', allocationBasis: 'meter', keywords: ['mvm', 'vízművek', 'vizmuvek', 'főgáz', 'elmű', 'főtáv'], isSystem: true, isActive: true, sortOrder: 10 },
  { id: 'cat-exp-garbage', nameHu: 'Szemétszállítás', nameEn: 'Waste Management', type: 'expense', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['fkf', 'mohu', 'hulladék', 'szemét'], isSystem: true, isActive: true, sortOrder: 11 },
  { id: 'cat-exp-cleaning', nameHu: 'Takarítás & Kertgondozás', nameEn: 'Cleaning & Gardening', type: 'expense', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['takarítás', 'kert'], isSystem: true, isActive: true, sortOrder: 12 },
  { id: 'cat-exp-maintenance', nameHu: 'Karbantartás & Kisjavítás', nameEn: 'Maintenance & Repairs', type: 'expense', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['karbantartás', 'javítás', 'szerelés'], isSystem: true, isActive: true, sortOrder: 13 },
  { id: 'cat-exp-renovation', nameHu: 'Felújítási munkálatok', nameEn: 'Renovation Works', type: 'expense', defaultFund: 'FA', allocationBasis: 'ownership_share', keywords: ['felújítás', 'kivitelezés'], isSystem: true, isActive: true, sortOrder: 14 },
  { id: 'cat-exp-insurance', nameHu: 'Épületbiztosítás', nameEn: 'Building Insurance', type: 'expense', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['allianz', 'generali', 'alfa', 'groupama', 'biztosítás'], isSystem: true, isActive: true, sortOrder: 15 },
  { id: 'cat-exp-bank', nameHu: 'Bankköltség & Számlavezetés', nameEn: 'Bank Fees & Account Charges', type: 'expense', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['számlavezetési', 'tranzakciós illeték', 'bankköltség'], isSystem: true, isActive: true, sortOrder: 16 },
  { id: 'cat-exp-rep', nameHu: 'Közös képviseleti díj', nameEn: 'Condominium Management Fee', type: 'expense', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['képviseleti díj', 'közös képviselet'], isSystem: true, isActive: true, sortOrder: 17 },
  { id: 'cat-exp-elevator', nameHu: 'Lift üzemeltetés & Karbantartás', nameEn: 'Elevator Service & Maintenance', type: 'expense', defaultFund: 'KK', allocationBasis: 'ownership_share', keywords: ['lift', 'felvonó', 'otis', 'schindler', 'kone'], isSystem: true, isActive: true, sortOrder: 18 },
  { id: 'cat-exp-chimney', nameHu: 'Kéményseprés & Érintésvédelem', nameEn: 'Chimney Sweeping & Safety Inspection', type: 'expense', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['kémény', 'érintésvédelem'], isSystem: true, isActive: true, sortOrder: 19 },
  { id: 'cat-exp-legal', nameHu: 'Jogi & Könyvelési költség', nameEn: 'Legal & Accounting Fees', type: 'expense', defaultFund: 'KK', allocationBasis: 'equal', keywords: ['ügyvédi', 'könyvelés', 'jogtanácsos'], isSystem: true, isActive: true, sortOrder: 20 },
  { id: 'cat-exp-other', nameHu: 'Egyéb kiadás', nameEn: 'Other Expense', type: 'expense', defaultFund: 'KK', allocationBasis: 'direct', keywords: [], isSystem: true, isActive: true, sortOrder: 21 },
];

function cleanDateStr(raw, fallback = '2026-01-01') {
  if (!raw) return fallback;
  const cleaned = String(raw).replace(/\./g, '-').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(cleaned)) return `${cleaned}-01`;
  return fallback;
}

function parseSharePercent(shareStr) {
  if (!shareStr) return 100;
  const str = String(shareStr).trim().replace(',', '.');
  if (str.includes('/')) {
    const [n, d] = str.split('/').map(Number);
    if (n && d) return Math.round((n / d) * 10000) / 100;
  }
  const num = parseFloat(str.replace('%', ''));
  if (isNaN(num)) return 100;
  return num <= 1 && !str.includes('%') ? Math.round(num * 10000) / 100 : num;
}

function mapLegacyCategoryId(rawCat, direction) {
  const s = String(rawCat || '').trim();
  if (s.startsWith('cat-')) return s;
  const lower = s.toLowerCase();
  if (direction === 'credit') {
    if (lower.includes('felújít') || lower === 'fa') return 'cat-inc-fa';
    if (lower.includes('célbefizetés')) return 'cat-inc-extra';
    if (lower.includes('kamat')) return 'cat-inc-interest';
    if (lower.includes('bérlet')) return 'cat-inc-rent';
    if (lower.includes('közös') || lower === 'kk') return 'cat-inc-kk';
    return 'cat-inc-other';
  }
  if (lower.includes('utility') || lower.includes('közüzem') || lower.includes('víz') || lower.includes('gáz') || lower.includes('áram')) return 'cat-exp-utility';
  if (lower.includes('garbage') || lower.includes('szemét')) return 'cat-exp-garbage';
  if (lower.includes('clean') || lower.includes('takarít')) return 'cat-exp-cleaning';
  if (lower.includes('maint') || lower.includes('karbantart')) return 'cat-exp-maintenance';
  if (lower.includes('renov') || lower.includes('felújít')) return 'cat-exp-renovation';
  if (lower.includes('insur') || lower.includes('biztosít')) return 'cat-exp-insurance';
  if (lower.includes('bank')) return 'cat-exp-bank';
  if (lower.includes('admin') || lower.includes('képvisel')) return 'cat-exp-rep';
  if (lower.includes('elev') || lower.includes('lift')) return 'cat-exp-elevator';
  if (lower.includes('legal') || lower.includes('jogi') || lower.includes('könyvel')) return 'cat-exp-legal';
  return 'cat-exp-other';
}

function buildUnitAccessories(flat) {
  if (Array.isArray(flat.annexes) && flat.annexes.length > 0) {
    return flat.annexes.map((a, idx) => ({
      id: a.id || `acc-${idx + 1}`,
      code: String(a.code || ''),
      name: String(a.name || ''),
      quantity: Number(a.quantity) || 1,
      unit: a.unit || 'db',
    }));
  }
  const list = [];
  if (Array.isArray(flat.garages)) {
    flat.garages.forEach((g, idx) => {
      list.push({
        id: `acc-g-${idx + 1}`,
        code: g.number ? `G-${g.number}` : `G-${idx + 1}`,
        name: 'Garázs / Gépkocsibeálló',
        quantity: Number(g.area) || 1,
        unit: g.area ? 'm²' : 'db',
      });
    });
  }
  if (Array.isArray(flat.storages)) {
    flat.storages.forEach((s, idx) => {
      list.push({
        id: `acc-s-${idx + 1}`,
        code: s.number ? `T-${s.number}` : `T-${idx + 1}`,
        name: 'Tárolóhelyiség / Pince',
        quantity: Number(s.area) || 1,
        unit: s.area ? 'm²' : 'db',
      });
    });
  }
  return list;
}

/**
 * Transforms an entire legacy RTDB `condo_state` snapshot into a clean, multi-tenant Firestore write plan.
 */
export function transformRtdbSnapshotToFirestore(rtdbSnapshot, options = {}) {
  const {
    uidByEmailMap = {},
    condoFilesMap = {},
    nowIso = new Date().toISOString(),
  } = options;

  const normalizedUidMap = {};
  for (const [email, uid] of Object.entries(uidByEmailMap)) {
    normalizedUidMap[String(email).toLowerCase().trim()] = String(uid).trim();
  }

  const resolveUid = (email) => {
    const clean = String(email || '').toLowerCase().trim();
    return clean ? (normalizedUidMap[clean] || null) : null;
  };

  const legacyUsers = Array.isArray(rtdbSnapshot?.users)
    ? rtdbSnapshot.users
    : Object.values(rtdbSnapshot?.users || {});
  const legacyBuildings = Array.isArray(rtdbSnapshot?.buildings)
    ? rtdbSnapshot.buildings
    : Object.values(rtdbSnapshot?.buildings || {});
  const legacyCalendarEvents = Array.isArray(rtdbSnapshot?.calendarEvents)
    ? rtdbSnapshot.calendarEvents
    : Object.values(rtdbSnapshot?.calendarEvents || {});
  const legacyOrganizations = Array.isArray(rtdbSnapshot?.organizations)
    ? rtdbSnapshot.organizations
    : Object.values(rtdbSnapshot?.organizations || {});
  const legacyNotifications = Array.isArray(rtdbSnapshot?.notifications)
    ? rtdbSnapshot.notifications
    : Object.values(rtdbSnapshot?.notifications || {});
  const legacyEmailRules = Array.isArray(rtdbSnapshot?.emailRules)
    ? rtdbSnapshot.emailRules
    : Object.values(rtdbSnapshot?.emailRules || {});
  const legacyEmailOutbox = Array.isArray(rtdbSnapshot?.emailOutbox)
    ? rtdbSnapshot.emailOutbox
    : Object.values(rtdbSnapshot?.emailOutbox || {});

  const usersDocs = {};        // uid -> UserDoc
  const userNotifications = {}; // uid -> { notifId -> NotifDoc }
  const organizationsPlan = {}; // orgId -> { orgDoc, members, invites }
  const buildingsPlan = {};    // buildingId -> { buildingDoc, members, units, categories, transactions, monthlySummaries, loans, documents, infoSections, calendarEvents, emailRules, emailOutbox, auditLogs }
  const storageUploads = [];   // { storagePath, base64DataUrl, mimeType, fileName }

  const sanitizeGlobalSettings = (rawGs) => {
    const base = rawGs && typeof rawGs === 'object'
      ? JSON.parse(JSON.stringify(rawGs))
      : {
          soundEffectsEnabled: true,
          rememberMe: true,
          notifications: { bankErrors: true, expiringLoans: true, upcomingAssemblies: true },
        };
    if (base.bankApi && typeof base.bankApi === 'object') {
      delete base.bankApi.apiKey;
      delete base.bankApi.clientSecret;
      delete base.bankApi.secretKey;
    }
    return base;
  };
  const safeGlobalSettings = sanitizeGlobalSettings(rtdbSnapshot?.globalSettings);

  const ensureUserDoc = (uid, email, displayName = '', isSuperAdmin = false, phone = '') => {
    if (!uid) return null;
    if (!usersDocs[uid]) {
      usersDocs[uid] = {
        uid,
        email: String(email || '').toLowerCase().trim(),
        displayName: String(displayName || ''),
        name: String(displayName || ''),
        phone: String(phone || ''),
        isSuperAdmin: Boolean(isSuperAdmin),
        preferredLang: rtdbSnapshot?.currentLang === 'en' ? 'en' : 'hu',
        orgIds: [],
        memberships: {},
        repProfile: rtdbSnapshot?.repProfile || {
          companyName: '',
          name: '',
          email: '',
          phone: '',
          address: '',
          officeHours: '',
        },
        globalSettings: safeGlobalSettings,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    } else if (isSuperAdmin) {
      usersDocs[uid].isSuperAdmin = true;
    }
    return usersDocs[uid];
  };

  // Pre-seed organizations & org members
  for (const org of legacyOrganizations) {
    if (!org || !org.id) continue;
    const orgId = String(org.id).trim();
    const orgMembers = {};
    const orgInvites = {};
    const rawMembers = Array.isArray(org.members) ? org.members : [];
    const ownerEmail = String(org.ownerEmail || '').toLowerCase().trim();
    const ownerUid = resolveUid(ownerEmail);
    if (ownerUid) {
      const uDoc = ensureUserDoc(ownerUid, ownerEmail, org.ownerName || org.name || ownerEmail, false);
      if (uDoc && !uDoc.orgIds.includes(orgId)) uDoc.orgIds.push(orgId);
      orgMembers[ownerUid] = {
        uid: ownerUid,
        email: ownerEmail,
        name: String(org.ownerName || org.name || ownerEmail),
        orgRole: 'owner',
        active: true,
        status: 'active',
        buildingScope: 'all',
        buildingIds: [],
        canCreateBuildings: true,
        canManageTeam: true,
        canEditBankAccounts: true,
        canDeleteBuildings: true,
        updatedAt: nowIso,
      };
    }
    for (const m of rawMembers) {
      if (!m || !m.email) continue;
      const mEmail = String(m.email).toLowerCase().trim();
      const mUid = resolveUid(mEmail);
      if (mUid) {
        const uDoc = ensureUserDoc(mUid, mEmail, m.name || mEmail, false, m.phone || '');
        if (uDoc && !uDoc.orgIds.includes(orgId)) uDoc.orgIds.push(orgId);
        const isOrgOwn = m.orgRole === 'owner' || mEmail === ownerEmail;
        orgMembers[mUid] = {
          uid: mUid,
          email: mEmail,
          name: String(m.name || mEmail),
          phone: String(m.phone || ''),
          orgRole: isOrgOwn ? 'owner' : 'staff',
          active: m.active !== false && m.status !== 'suspended',
          status: m.status || (m.active === false ? 'suspended' : 'active'),
          buildingScope: m.buildingScope || (isOrgOwn ? 'all' : 'selected'),
          buildingIds: Array.isArray(m.buildingIds) ? m.buildingIds : [],
          buildingPermissions: m.buildingPermissions || {},
          permissions: m.permissions || {},
          canCreateBuildings: isOrgOwn ? true : Boolean(m.permissions?.canCreateBuildings),
          canManageTeam: isOrgOwn ? true : Boolean(m.permissions?.canManageTeam),
          canEditBankAccounts: isOrgOwn ? true : Boolean(m.permissions?.canEditBankAccounts),
          canDeleteBuildings: isOrgOwn,
          updatedAt: nowIso,
        };
      }
    }
    for (const inv of (Array.isArray(org.invites) ? org.invites : [])) {
      if (!inv || !inv.id) continue;
      orgInvites[String(inv.id)] = { ...inv, orgId, updatedAt: nowIso };
    }
    organizationsPlan[orgId] = {
      orgDoc: {
        ...org,
        id: orgId,
        ownerEmail,
        updatedAt: nowIso,
      },
      members: orgMembers,
      invites: orgInvites,
    };
  }

  // Pre-seed user notifications (Inbox, Sent, Archive, Deleted tombstones)
  for (const n of legacyNotifications) {
    if (!n || !n.id) continue;
    const targetEmail = n.meta?.isSenderCopy
      ? (n.actorEmail || n.recipientEmail || '')
      : (n.recipientEmail || '');
    const uid = resolveUid(targetEmail);
    if (!uid) continue;
    if (!userNotifications[uid]) userNotifications[uid] = {};
    const cleanNotif = {
      ...n,
      id: String(n.id),
      attachments: Array.isArray(n.attachments)
        ? n.attachments.map(({ fileData: _omit, data: _omit2, inlineData: _omit3, ...rest }) => rest)
        : [],
    };
    userNotifications[uid][String(n.id)] = cleanNotif;
  }

  // Pre-seed superadmins from legacy users
  for (const u of legacyUsers) {
    if (!u || !u.email) continue;
    const uid = resolveUid(u.email);
    if (uid) {
      ensureUserDoc(uid, u.email, u.name, u.role === 'superadmin', u.phone || '');
    }
  }

  for (const b of legacyBuildings) {
    if (!b || !b.id) continue;
    const buildingId = String(b.id).trim();
    const migrationAuditId = `audit-migration-${buildingId}`;

    const customBankAccounts = (Array.isArray(b.customBankAccounts) ? b.customBankAccounts : []).map((acc, idx) => ({
      id: acc.id || `acc-${idx + 1}`,
      name: String(acc.name || ''),
      shortName: String(acc.shortName || (acc.name || '').slice(0, 4)),
      account: String(acc.account || ''),
      bank: String(acc.bank || 'OTP'),
      beneficiary: String(acc.beneficiary || b.name || ''),
      hasMonthlyFee: Boolean(acc.hasMonthlyFee),
      color: acc.color || 'emerald',
    }));

    const customNameToId = {};
    customBankAccounts.forEach((a) => {
      customNameToId[a.name] = a.id;
      customNameToId[a.id] = a.id;
    });

    const resolveFund = (rawAccount, fallbackProvider) => {
      if (rawAccount && customNameToId[rawAccount]) return customNameToId[rawAccount];
      if (!rawAccount && fallbackProvider === 'Felújítási Alap') return 'FA';
      return normalizeFundKey(rawAccount || 'KK');
    };

    const initialCustomReserves = {};
    (Array.isArray(b.customBankAccounts) ? b.customBankAccounts : []).forEach((acc, idx) => {
      const id = acc.id || `acc-${idx + 1}`;
      initialCustomReserves[id] = Math.round(Number(acc.initialReserve) || 0);
    });

    let liveBuildingBalances = {
      KK: Math.round(Number(b.buildingInitialReserveCommon) || 0),
      FA: Math.round(Number(b.buildingInitialReserveRenovation) || 0),
      custom: { ...initialCustomReserves },
      totalReserve:
        Math.round(Number(b.buildingInitialReserveCommon) || 0) +
        Math.round(Number(b.buildingInitialReserveRenovation) || 0) +
        Object.values(initialCustomReserves).reduce((s, v) => s + v, 0),
    };

    const members = {}; // uid -> BuildingMemberDoc
    const units = {};   // unitId -> UnitDoc
    const flatNumToUnitId = {};
    const legacyFlats = Array.isArray(b.flats) ? b.flats : [];
    const legacyLoans = Array.isArray(b.loans) ? b.loans : [];

    // 1. Build Units (5-tab model + initial balances + ownerUids)
    for (const flat of legacyFlats) {
      if (!flat || !flat.flatNum) continue;
      const unitId = slugifyUnitId(flat.flatNum);
      flatNumToUnitId[flat.flatNum] = unitId;

      const rawOwners = Array.isArray(flat.owners) && flat.owners.length > 0
        ? flat.owners
        : [{
            id: `owner-${unitId}-1`,
            role: 'owner',
            name: flat.ownerName || '',
            share: '1/1',
            email: flat.email || '',
            phone: flat.phone || '',
            isPrimaryContact: true,
            sendEmailNotification: true,
            isBoardMember: false,
            bankAccounts: flat.bankAccount ? [flat.bankAccount] : [],
          }];

      const ownerUidsSet = new Set();
      const owners = rawOwners.map((o, idx) => {
        const primaryEmail = String(o.email || (Array.isArray(o.emails) ? o.emails[0] : '') || '').toLowerCase().trim();
        const extraEmails = Array.isArray(o.emails)
          ? o.emails.map((e) => String(e || '').toLowerCase().trim()).filter(Boolean)
          : [];
        const allOwnerEmails = Array.from(new Set([primaryEmail, ...extraEmails].filter(Boolean)));
        let linkedUid = null;

        for (const em of allOwnerEmails) {
          const uid = resolveUid(em);
          if (uid) {
            if (!linkedUid) linkedUid = uid;
            ownerUidsSet.add(uid);
            ensureUserDoc(uid, em, o.name || flat.ownerName, false, o.phone || flat.phone || '');
            // Register owner (or szvb if isBoardMember) in building members
            const existingMem = members[uid];
            const role = existingMem?.role === 'admin'
              ? 'admin'
              : (o.isBoardMember || existingMem?.role === 'szvb' ? 'szvb' : 'owner');
            const nextUnitIds = Array.from(new Set([...(existingMem?.unitIds || []), unitId]));
            members[uid] = {
              uid,
              email: em,
              role,
              unitIds: nextUnitIds,
              active: true,
              accessFromDate: flat.purchaseDate || null,
              grantedBy: 'system:migration',
              grantedAt: nowIso,
              updatedAt: nowIso,
            };
          }
        }

        return {
          id: o.id || `owner-${unitId}-${idx + 1}`,
          uid: linkedUid,
          role: o.role || 'owner',
          name: String(o.name || ''),
          share: String(o.share || '1/1'),
          sharePercent: parseSharePercent(o.share),
          email: primaryEmail,
          emails: allOwnerEmails,
          phone: String(o.phone || ''),
          postalCode: String(o.postalCode || ''),
          city: String(o.city || ''),
          street: String(o.street || ''),
          isPrimaryContact: Boolean(o.isPrimaryContact || idx === 0),
          sendEmailNotification: o.sendEmailNotification !== undefined ? Boolean(o.sendEmailNotification) : true,
          isBoardMember: Boolean(o.isBoardMember),
          bankAccounts: Array.isArray(o.bankAccounts) ? o.bankAccounts.filter(Boolean) : (o.bankAccount ? [o.bankAccount] : []),
        };
      });

      // Fallback flat-level email lookup
      if (flat.email) {
        const uid = resolveUid(flat.email);
        if (uid) {
          ownerUidsSet.add(uid);
          ensureUserDoc(uid, flat.email, flat.ownerName || '', false, flat.phone || '');
          const existingMem = members[uid];
          members[uid] = {
            uid,
            email: String(flat.email).toLowerCase().trim(),
            role: existingMem?.role || 'owner',
            unitIds: Array.from(new Set([...(existingMem?.unitIds || []), unitId])),
            active: true,
            accessFromDate: flat.purchaseDate || null,
            grantedBy: 'system:migration',
            grantedAt: nowIso,
            updatedAt: nowIso,
          };
        }
      }

      const tenants = Array.isArray(flat.tenants)
        ? flat.tenants.map((t, idx) => ({
            id: t.id || `tenant-${unitId}-${idx + 1}`,
            name: String(t.name || ''),
            phone: String(t.phone || ''),
            email: String(t.email || '').toLowerCase().trim(),
            leaseStart: String(t.leaseStart || ''),
            leaseEnd: String(t.leaseEnd || ''),
            isActive: t.isActive !== undefined ? Boolean(t.isActive) : true,
            payerName: String(t.payerName || ''),
            bankAccounts: Array.isArray(t.bankAccounts) ? t.bankAccounts.filter(Boolean) : (t.bankAccount ? [t.bankAccount] : []),
          }))
        : [];

      const meters = Array.isArray(flat.meters)
        ? flat.meters.map((m, idx) => ({
            id: m.id || `meter-${unitId}-${idx + 1}`,
            serialNumber: String(m.serialNumber || ''),
            type: m.type || 'cold_water',
            installDate: String(m.installDate || ''),
            initialReading: m.initialReading !== undefined && m.initialReading !== '' ? Number(m.initialReading) : null,
            currentReading: m.currentReading !== undefined && m.currentReading !== '' ? Number(m.currentReading) : null,
            lastReadingDate: String(m.lastReadingDate || ''),
            expiryDate: String(m.expiryDate || ''),
            removalDate: String(m.removalDate || ''),
            finalReading: m.finalReading !== undefined && m.finalReading !== '' ? Number(m.finalReading) : null,
          }))
        : [];

      const initKK = Math.round(Number(flat.initialBalance) || 0);
      const initFA = Math.round(Number(flat.initialRenovationBalance) || 0);
      const customInit = {};
      customBankAccounts.forEach((acc) => {
        const val = flat.customInitialBalances?.[acc.id] ?? flat.customInitialBalances?.[acc.name] ?? 0;
        customInit[acc.id] = Math.round(Number(val) || 0);
      });

      const customFees = {};
      customBankAccounts.forEach((acc) => {
        const val = flat.customFees?.[acc.id] ?? flat.customFees?.[acc.name];
        if (val !== undefined && val !== null) customFees[acc.id] = Math.round(Number(val) || 0);
      });

      // Extract ONLY this unit's own loan participation slice for GDPR isolation
      const activeLoanShares = [];
      for (const loan of legacyLoans) {
        if (!loan || !Array.isArray(loan.participants)) continue;
        const part = loan.participants.find((p) => isMatchingFlat(p.apartmentId, flat.flatNum));
        if (part) {
          activeLoanShares.push({
            loanId: loan.id,
            loanTitle: loan.title || '',
            paymentMethod: part.paymentMethod || 'financed',
            monthlyContributionHuf: Math.round(Number(part.monthlyContribution) || 0),
            totalShareHuf: Math.round(Number(part.totalShare || part.lumpSumAmountPaid) || 0),
            lumpSumAmountPaidHuf: Math.round(Number(part.lumpSumAmountPaid) || 0),
            status: loan.status || 'active',
          });
        }
      }

      const startDateKK =
        flat.startDateKK ||
        (flat.startDate === '2026-06-01' ? (flat.flatNum === 'Fsz 2' ? '2026-07-01' : '2026-09-01') : (flat.startDate || '2026-09-01'));
      const startDateFA = flat.startDateFA || '2026-06-01';

      const initBalances = {
        initialKK: initKK,
        initialFA: initFA,
        customInitial: { ...customInit },
        KK: initKK,
        FA: initFA,
        custom: { ...customInit },
        total: initKK + initFA + Object.values(customInit).reduce((s, v) => s + v, 0),
        isDebtor: initKK + initFA + Object.values(customInit).reduce((s, v) => s + v, 0) < 0,
        totalRequiredKK: 0,
        totalPaidKK: 0,
        totalRequiredFA: 0,
        totalPaidFA: 0,
      };

      units[unitId] = {
        id: unitId,
        buildingId,
        ownerUids: Array.from(ownerUidsSet),
        unitCode: String(flat.flatNum),
        unitType: flat.unitType || 'flat',
        staircase: String(flat.staircase || ''),
        floor: flat.floor !== undefined ? String(flat.floor) : '',
        door: flat.door !== undefined ? String(flat.door) : '',
        hrsz: String(flat.hrsz || ''),
        areaSqm: Number(flat.area) || 0,
        volumeCbm: Number(flat.volume) || 0,
        terraceAreaSqm: Number(flat.terraceArea ?? flat.terrace) || 0,
        ownershipSharePct: Number(flat.ownershipShare) || 0,
        residentsCount: Number(flat.tenantCount ?? flat.residents ?? 1) || 1,
        paymentCode: String(flat.paymentCode || flat.utalaskod || flat.flatNum),
        purchaseDate: String(flat.purchaseDate || ''),
        saleDate: String(flat.saleDate || ''),
        isCompany: Boolean(flat.isCompany),
        excludeUtility: Boolean(flat.excludeUtility),
        notes: String(flat.notes || ''),
        phone: String(flat.phone || ''),
        emergencyContact: String(flat.emergencyContact || ''),
        ownerDisplayName: String(flat.ownerName || ''),
        owners,
        tenants,
        meters,
        accessories: buildUnitAccessories(flat),
        fees: {
          startDateKK,
          startDateFA,
          monthlyFeeKK: Math.round(Number(flat.monthlyFee) || 0),
          monthlyFeeFA: Math.round(Number(flat.renovationFee) || 0),
          customFees,
          customStartDates: flat.customStartDates || {},
          feeChangesKK: Array.isArray(flat.feeChangesKK) ? flat.feeChangesKK : [],
          feeChangesFA: Array.isArray(flat.feeChangesFA) ? flat.feeChangesFA : [],
          customFeeChanges: flat.customFeeChanges || {},
        },
        balances: initBalances,
        activeLoanShares,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastAuditLogId: migrationAuditId,
      };
    }

    // Register building Admins & SZVB users from top-level users array, organizations, and b.szvb
    for (const u of legacyUsers) {
      if (!u || !u.email) continue;
      if (u.role === 'admin' || u.role === 'szvb') {
        if (!u.buildingId || u.buildingId === buildingId) {
          const uid = resolveUid(u.email);
          if (uid) {
            ensureUserDoc(uid, u.email, u.name || '', false, u.phone || '');
            members[uid] = {
              uid,
              email: String(u.email).toLowerCase().trim(),
              name: String(u.name || u.email),
              role: u.role,
              unitIds: members[uid]?.unitIds || [],
              active: true,
              accessFromDate: null,
              grantedBy: 'system:migration',
              grantedAt: nowIso,
              updatedAt: nowIso,
            };
          }
        }
      }
    }

    // Register Organization Owner & active Staff members as building admins if org manages this building
    const linkedOrg = b.organizationId ? organizationsPlan[b.organizationId] : null;
    if (linkedOrg) {
      for (const [orgUid, orgMem] of Object.entries(linkedOrg.members || {})) {
        if (!orgMem || !orgMem.active) continue;
        const canAccess =
          orgMem.orgRole === 'owner' ||
          orgMem.buildingScope === 'all' ||
          (Array.isArray(orgMem.buildingIds) && orgMem.buildingIds.includes(buildingId));
        if (!canAccess) continue;
        const bPerm = orgMem.buildingPermissions?.[buildingId] || {};
        members[orgUid] = {
          ...(members[orgUid] || {}),
          uid: orgUid,
          email: orgMem.email,
          name: orgMem.name || orgMem.email,
          role: 'admin',
          orgRole: orgMem.orgRole,
          canEditBankAccounts: orgMem.orgRole === 'owner' || Boolean(bPerm.canEditBankAccounts ?? orgMem.canEditBankAccounts),
          unitIds: members[orgUid]?.unitIds || [],
          active: true,
          accessFromDate: null,
          grantedBy: 'system:migration',
          grantedAt: members[orgUid]?.grantedAt || nowIso,
          updatedAt: nowIso,
        };
      }
    }

    // Register explicit SZVB chairperson & members from b.szvb (without downgrading existing admins)
    const explicitSzvbPeople = [
      b.szvb?.chairperson,
      ...(Array.isArray(b.szvb?.members) ? b.szvb.members : []),
    ].filter((p) => p && p.email);
    for (const sp of explicitSzvbPeople) {
      const spEmail = String(sp.email).toLowerCase().trim();
      const spUid = resolveUid(spEmail);
      if (!spUid) continue;
      ensureUserDoc(spUid, spEmail, sp.name || spEmail, false);
      const existingMem = members[spUid];
      members[spUid] = {
        ...(existingMem || {}),
        uid: spUid,
        email: spEmail,
        name: sp.name || existingMem?.name || spEmail,
        role: existingMem?.role === 'admin' ? 'admin' : 'szvb',
        unitIds: existingMem?.unitIds || [],
        active: true,
        grantedBy: 'system:migration',
        grantedAt: existingMem?.grantedAt || nowIso,
        updatedAt: nowIso,
      };
    }

    // Mirror memberships into users/{uid}.memberships
    for (const mem of Object.values(members)) {
      const uDoc = usersDocs[mem.uid];
      if (uDoc) {
        uDoc.memberships[buildingId] = {
          buildingName: b.name || buildingId,
          role: mem.role,
          unitIds: mem.unitIds,
          active: mem.active,
        };
      }
    }

    // Helper: resolve legacy flatNum string -> unitId
    const resolveUnitId = (rawFlatNum) => {
      if (!rawFlatNum || rawFlatNum === 'Global' || rawFlatNum === '-' || rawFlatNum === 'Kiadás') return null;
      if (flatNumToUnitId[rawFlatNum]) return flatNumToUnitId[rawFlatNum];
      const matched = legacyFlats.find((f) => isMatchingFlat(f.flatNum, rawFlatNum));
      return matched ? flatNumToUnitId[matched.flatNum] : null;
    };

    // 2. Build Unified Transactions Collection + Apply Exact Balances & Monthly Rollups
    const transactions = {};
    const monthlySummaries = {};

    const recordMigratedTx = (txDoc) => {
      transactions[txDoc.id] = txDoc;
      const impacts = computeTxImpacts(txDoc);

      if (txDoc.unitId && units[txDoc.unitId]) {
        units[txDoc.unitId].balances = applyUnitBalanceDelta(
          units[txDoc.unitId].balances,
          txDoc.fund,
          impacts.signedUnitDeltaHuf,
          impacts.requiredDelta,
          impacts.paidDelta
        );
      }

      if (impacts.signedBankDeltaHuf !== 0) {
        liveBuildingBalances = applyBuildingBankDelta(liveBuildingBalances, txDoc.fund, impacts.signedBankDeltaHuf);
      }

      if (impacts.monthlyInflowDelta !== 0 || impacts.monthlyOutflowDelta !== 0) {
        monthlySummaries[txDoc.yearMonth] = {
          ...applyMonthlySummaryDelta(
            monthlySummaries[txDoc.yearMonth] || null,
            txDoc.yearMonth,
            txDoc.fund,
            impacts.monthlyInflowDelta,
            impacts.monthlyOutflowDelta
          ),
          updatedAt: nowIso,
        };
      }
    };

    const normalizeAttachments = (rawAtts, ownerPathPrefix) => {
      const arr = Array.isArray(rawAtts) ? rawAtts : [];
      return arr.map((att, idx) => {
        const attId = att.id || `att-${idx + 1}`;
        const safeName = String(att.name || `attachment-${idx + 1}`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `buildings/${buildingId}/${ownerPathPrefix}/${safeName}`;
        const rawData = att.fileData || att.data || condoFilesMap[attId];
        if (rawData && typeof rawData === 'string' && rawData.startsWith('data:')) {
          storageUploads.push({
            storagePath,
            base64DataUrl: rawData,
            mimeType: att.type || att.mimeType || 'application/octet-stream',
            fileName: safeName,
          });
        }
        return {
          id: attId,
          name: String(att.name || safeName),
          mimeType: String(att.type || att.mimeType || 'application/octet-stream'),
          sizeBytes: Math.round(Number(att.size || att.sizeBytes) || 0),
          storagePath,
        };
      });
    };

    // 2a. Materialize historical monthly recurring assessments (matching getFlatLedgerTimeline!)
    for (const flat of legacyFlats) {
      if (!flat || !flat.flatNum) continue;
      const unitId = flatNumToUnitId[flat.flatNum];
      const unit = units[unitId];
      const cancelled = Array.isArray(flat.cancelledDebits) ? flat.cancelledDebits : [];

      const accountsToBill = [
        { fund: 'KK', label: 'Közös Költség', startDate: unit.fees.startDateKK },
        { fund: 'FA', label: 'Felújítási Alap', startDate: unit.fees.startDateFA },
        ...customBankAccounts
          .filter((a) => a.hasMonthlyFee)
          .map((a) => ({
            fund: a.id,
            label: a.name,
            startDate: unit.fees.customStartDates?.[a.id] || unit.fees.startDateKK,
          })),
      ];

      for (const acc of accountsToBill) {
        const months = getLedgerMonths(acc.startDate);
        for (const m of months) {
          const cancelledKeys = [
            `${m.date}_${acc.label}`,
            `${m.date}_${acc.fund}`,
            `${m.date}_${acc.fund === 'KK' ? 'Közös Költség' : acc.fund === 'FA' ? 'Felújítási Alap' : acc.label}`,
          ];
          if (cancelled.some((k) => cancelledKeys.includes(k))) continue;

          const debitAmount = getEffectiveUnitFeeForMonth(unit, acc.fund, m.date);
          if (debitAmount <= 0) continue;

          const ym = m.date.slice(0, 7);
          const customComment = flat.debitComments && (
            flat.debitComments[`${m.date}_${acc.label}`] ||
            flat.debitComments[`${m.date}_${acc.fund}`]
          );

          const assessDoc = {
            id: `assess_${ym}_${unitId}_${acc.fund}`,
            buildingId,
            kind: 'assessment',
            visibility: 'unit',
            unitId,
            unitCode: unit.unitCode,
            categoryId: acc.fund === 'FA' ? 'cat-inc-fa' : 'cat-inc-kk',
            fund: acc.fund,
            direction: 'debit',
            amountHuf: debitAmount,
            signedUnitDeltaHuf: -debitAmount,
            signedBankDeltaHuf: 0,
            date: m.date,
            year: m.year,
            yearMonth: ym,
            paymentMethod: 'system_assessment',
            affectsBankBalance: false,
            includeInFlatBalance: true,
            status: 'verified',
            provider: '',
            title: '',
            comment: customComment || `Havi előírás - ${m.nameHu}`,
            bankTxId: null,
            loanId: null,
            transferGroupId: null,
            source: 'rtdb_migration',
            attachments: [],
            createdAt: nowIso,
            createdBy: 'system:migration',
            updatedAt: nowIso,
            updatedBy: 'system:migration',
            lastAuditLogId: migrationAuditId,
          };
          recordMigratedTx(assessDoc);
        }
      }

      // Financed loan installments
      for (const loan of legacyLoans) {
        if (!loan || loan.status === 'draft') continue;
        const participant = (loan.participants || []).find((p) => isMatchingFlat(p.apartmentId, flat.flatNum));
        if (participant && participant.paymentMethod === 'financed' && Number(participant.monthlyContribution) > 0) {
          const installment = Math.round(Number(participant.monthlyContribution));
          const loanMonths = getLedgerMonths(loan.startDate || '2024-01-01');
          const endLimit = loan.endDate ? new Date(loan.endDate) : null;
          for (const m of loanMonths) {
            if (endLimit && new Date(m.date) > endLimit) continue;
            if (cancelled.includes(`${m.date}_loan_${loan.id}`)) continue;
            const ym = m.date.slice(0, 7);
            recordMigratedTx({
              id: `assess_${ym}_${unitId}_loan_${loan.id}`,
              buildingId,
              kind: 'assessment',
              visibility: 'unit',
              unitId,
              unitCode: unit.unitCode,
              categoryId: 'cat-inc-fa',
              fund: 'FA',
              direction: 'debit',
              amountHuf: installment,
              signedUnitDeltaHuf: -installment,
              signedBankDeltaHuf: 0,
              date: m.date,
              year: m.year,
              yearMonth: ym,
              paymentMethod: 'system_assessment',
              affectsBankBalance: false,
              includeInFlatBalance: true,
              status: 'verified',
              provider: '',
              title: '',
              comment: `${loan.title || 'Hitel'} - Havi törlesztőrészlet`,
              bankTxId: null,
              loanId: loan.id,
              transferGroupId: null,
              source: 'rtdb_migration',
              attachments: [],
              createdAt: nowIso,
              createdBy: 'system:migration',
              updatedAt: nowIso,
              updatedBy: 'system:migration',
              lastAuditLogId: migrationAuditId,
            });
          }
        }
      }
    }

    // 2b. Migrate Manual Debits
    for (const d of (Array.isArray(b.manualDebits) ? b.manualDebits : [])) {
      if (!d) continue;
      const unitId = resolveUnitId(d.flatNum);
      const fund = resolveFund(d.targetAccount || d.account, null);
      const amt = Math.abs(Math.round(Number(d.amount) || 0));
      if (amt <= 0) continue;
      const date = cleanDateStr(d.date);
      const id = String(d.id || `deb-${date}-${Math.random().toString(36).slice(2, 7)}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      const txObj = {
        id,
        buildingId,
        kind: 'debit',
        visibility: unitId ? 'unit' : 'building',
        unitId,
        unitCode: unitId ? units[unitId]?.unitCode || d.flatNum : null,
        categoryId: mapLegacyCategoryId(d.category, 'debit'),
        fund,
        direction: 'debit',
        amountHuf: amt,
        date,
        year: Number(date.slice(0, 4)),
        yearMonth: date.slice(0, 7),
        paymentMethod: 'system_assessment',
        affectsBankBalance: false,
        includeInFlatBalance: d.includeInFlatBalance !== false,
        status: 'verified',
        provider: '',
        title: String(d.title || ''),
        comment: String(d.comment || d.title || 'Terhelés / Előírás'),
        bankTxId: null,
        loanId: null,
        transferGroupId: null,
        source: 'rtdb_migration',
        attachments: normalizeAttachments(d.attachments || (d.attachment ? [d.attachment] : []), `attachments/${id}`),
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : nowIso,
        createdBy: 'system:migration',
        updatedAt: nowIso,
        updatedBy: 'system:migration',
        lastAuditLogId: migrationAuditId,
      };
      const imp = computeTxImpacts(txObj);
      recordMigratedTx({ ...txObj, signedUnitDeltaHuf: imp.signedUnitDeltaHuf, signedBankDeltaHuf: imp.signedBankDeltaHuf });
    }

    // 2c. Migrate Expenses
    for (const e of (Array.isArray(b.expenses) ? b.expenses : [])) {
      if (!e) continue;
      const unitId = resolveUnitId(e.flatNum);
      const fund = resolveFund(e.targetAccount || e.account, e.provider);
      const amt = Math.abs(Math.round(Number(e.amount) || 0));
      if (amt <= 0) continue;
      const date = cleanDateStr(e.date);
      const id = String(e.id || `exp-${date}-${Math.random().toString(36).slice(2, 7)}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      const paymentMethod = normalizePaymentMethod(e.paymentMethod || e.method, 'expense');
      const txObj = {
        id,
        buildingId,
        kind: 'expense',
        visibility: unitId ? 'unit' : 'building',
        unitId,
        unitCode: unitId ? units[unitId]?.unitCode || e.flatNum : null,
        categoryId: mapLegacyCategoryId(e.category, 'debit'),
        fund,
        direction: 'debit',
        amountHuf: amt,
        date,
        year: Number(date.slice(0, 4)),
        yearMonth: date.slice(0, 7),
        paymentMethod,
        affectsBankBalance: e.affectsBankBalance !== false && e.includeInBalance !== false,
        includeInFlatBalance: unitId ? e.includeInFlatBalance !== false : false,
        status: 'verified',
        provider: String(e.provider || e.title || ''),
        title: String(e.title || e.provider || ''),
        comment: String(e.comment || e.title || e.provider || 'Kiadás'),
        bankTxId: e.bankTxId || null,
        loanId: null,
        transferGroupId: null,
        source: 'rtdb_migration',
        attachments: normalizeAttachments(e.attachments || (e.attachment ? [e.attachment] : []), `attachments/${id}`),
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : nowIso,
        createdBy: 'system:migration',
        updatedAt: nowIso,
        updatedBy: 'system:migration',
        lastAuditLogId: migrationAuditId,
      };
      const imp = computeTxImpacts(txObj);
      recordMigratedTx({ ...txObj, signedUnitDeltaHuf: imp.signedUnitDeltaHuf, signedBankDeltaHuf: imp.signedBankDeltaHuf });
    }

    // 2d. Migrate Transactions (Payments, Refunds, Corrections)
    for (const t of (Array.isArray(b.transactions) ? b.transactions : [])) {
      if (!t) continue;
      const unitId = resolveUnitId(t.flatNum);
      const fund = resolveFund(t.targetAccount || t.account, null);
      const rawAmt = Math.round(Number(t.amount) || 0);
      if (rawAmt === 0) continue;
      const isNegative = t.type === 'Debit' || rawAmt < 0;
      const direction = isNegative ? 'debit' : 'credit';
      const date = cleanDateStr(t.date);
      const id = String(t.id || `tx-${date}-${Math.random().toString(36).slice(2, 7)}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      const isTransferLeg =
        t.type === 'Transfer' ||
        id.endsWith('-from') ||
        id.endsWith('-to') ||
        (isNegative && t.type !== 'Debit' && t.type !== 'Correction' && t.affectsBankBalance !== false);
      const kind =
        t.type === 'Correction'
          ? 'correction'
          : isTransferLeg
            ? 'transfer'
            : (isNegative ? 'debit' : 'payment');
      const transferGroupId = (id.endsWith('-from') || id.endsWith('-to'))
        ? id.replace(/-(from|to)$/, '')
        : (t.transferGroupId || null);
      const paymentMethod = normalizePaymentMethod(t.paymentMethod || t.method, kind);
      const status = t.status === 'Pending' ? 'pending' : (t.status === 'Voided' ? 'voided' : 'verified');

      const txObj = {
        id,
        buildingId,
        kind,
        visibility: unitId ? 'unit' : 'building',
        unitId,
        unitCode: unitId ? units[unitId]?.unitCode || t.flatNum : null,
        categoryId: mapLegacyCategoryId(t.category || (fund === 'FA' ? 'cat-inc-fa' : 'cat-inc-kk'), direction),
        fund,
        direction,
        amountHuf: Math.abs(rawAmt),
        date,
        year: Number(date.slice(0, 4)),
        yearMonth: date.slice(0, 7),
        paymentMethod,
        affectsBankBalance: t.affectsBankBalance !== false && t.includeInBalance !== false,
        includeInFlatBalance: unitId ? t.includeInFlatBalance !== false : false,
        status,
        provider: '',
        title: String(t.title || ''),
        comment: String(t.comment || t.title || 'Befizetés'),
        bankTxId: t.bankTxId || null,
        loanId: null,
        transferGroupId,
        source: 'rtdb_migration',
        attachments: normalizeAttachments(t.attachments || (t.attachment ? [t.attachment] : []), `attachments/${id}`),
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : nowIso,
        createdBy: 'system:migration',
        updatedAt: nowIso,
        updatedBy: 'system:migration',
        lastAuditLogId: migrationAuditId,
      };
      const imp = computeTxImpacts(txObj);
      recordMigratedTx({ ...txObj, signedUnitDeltaHuf: imp.signedUnitDeltaHuf, signedBankDeltaHuf: imp.signedBankDeltaHuf });
    }

    // 3. Compute exact GDPR-safe building aggregates from all migrated units
    const allUnitsList = Object.values(units);
    const aggregates = {
      totalArrearsHuf: 0,
      totalArrearsKK: 0,
      totalArrearsFA: 0,
      totalOverpaymentHuf: 0,
      debtorUnitCount: 0,
      settledUnitCount: 0,
      totalUnitCount: allUnitsList.length,
      lastRecalculatedAt: nowIso,
    };
    for (const u of allUnitsList) {
      const c = computeUnitArrearsContribution(u.balances);
      aggregates.totalArrearsHuf += c.totalDebt;
      aggregates.totalArrearsKK += c.kkDebt;
      aggregates.totalArrearsFA += c.faDebt;
      aggregates.totalOverpaymentHuf += c.overpayment;
      if (c.isDebtor) aggregates.debtorUnitCount += 1;
      else aggregates.settledUnitCount += 1;
    }

    // 4. Categories (merge building categories with canonical defaults)
    const categories = {};
    const srcCategories = Array.isArray(b.categories) && b.categories.length > 0 ? b.categories : DEFAULT_CATEGORIES;
    srcCategories.forEach((cat, idx) => {
      const id = cat.id || `cat-${idx + 1}`;
      const def = DEFAULT_CATEGORIES.find((d) => d.id === id);
      categories[id] = {
        id,
        nameHu: cat.nameHu || cat.name || def?.nameHu || id,
        nameEn: cat.nameEn || def?.nameEn || cat.name || id,
        type: cat.type === 'income' ? 'income' : 'expense',
        defaultFund: normalizeFundKey(cat.defaultFund || def?.defaultFund || 'KK'),
        allocationBasis: cat.allocationBasis || def?.allocationBasis || 'ownership_share',
        keywords: Array.isArray(cat.keywords) ? cat.keywords : (def?.keywords || []),
        isSystem: cat.isSystem !== undefined ? Boolean(cat.isSystem) : Boolean(def),
        isActive: cat.isActive !== undefined ? Boolean(cat.isActive) : true,
        sortOrder: Number(cat.sortOrder ?? idx + 1),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });

    // 5. Loans (Admin & SZVB ONLY)
    const loans = {};
    for (const loan of legacyLoans) {
      if (!loan || !loan.id) continue;
      loans[loan.id] = {
        ...loan,
        buildingId,
        participants: (loan.participants || []).map((p) => ({
          ...p,
          unitId: p.unitId || resolveUnitId(p.apartmentId) || slugifyUnitId(p.apartmentId),
        })),
        updatedAt: nowIso,
      };
    }

    // 6. Documents (strip Base64 fileData; queue Cloud Storage uploads)
    const documents = {};
    for (const doc of (Array.isArray(b.documents) ? b.documents : [])) {
      if (!doc) continue;
      const docId = doc.id || `doc-${Math.random().toString(36).slice(2, 8)}`;
      const safeFileName = String(doc.fileName || `${docId}.${doc.fileType || 'pdf'}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `buildings/${buildingId}/documents/${docId}/${safeFileName}`;
      const rawBase64 = doc.fileData || condoFilesMap[docId];
      if (rawBase64 && typeof rawBase64 === 'string' && rawBase64.startsWith('data:')) {
        storageUploads.push({
          storagePath,
          base64DataUrl: rawBase64,
          mimeType: doc.mimeType || (doc.fileType === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
          fileName: safeFileName,
        });
      }
      documents[docId] = {
        id: docId,
        buildingId,
        title: String(doc.title || safeFileName),
        fileName: safeFileName,
        fileSize: String(doc.fileSize || ''),
        fileType: String(doc.fileType || 'pdf'),
        uploadDate: cleanDateStr(doc.uploadDate),
        folderId: doc.folderId || null,
        visibility: doc.visibility === 'admin' ? 'admin' : 'building',
        hasFile: Boolean(rawBase64 || doc.hasFile),
        storagePath: (rawBase64 || doc.hasFile) ? storagePath : null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    // 7. Info Sections (strip inline attachment Base64; queue Cloud Storage uploads)
    const infoSections = {};
    for (const sec of (Array.isArray(b.infoSections) ? b.infoSections : [])) {
      if (!sec) continue;
      const secId = sec.id || `sec-${Math.random().toString(36).slice(2, 8)}`;
      const cleanItems = (Array.isArray(sec.items) ? sec.items : []).map((it) => ({
        ...it,
        attachments: normalizeAttachments(it.attachments, `infoAttachments/${secId}`),
      }));
      infoSections[secId] = {
        ...sec,
        id: secId,
        buildingId,
        visibility: sec.visibility === 'admin' ? 'admin' : 'building',
        items: cleanItems,
        updatedAt: nowIso,
      };
    }

    // 8. Calendar Events scoped to this building
    const calendarEvents = {};
    for (const ev of legacyCalendarEvents) {
      if (!ev || !ev.id) continue;
      if (ev.buildingId === buildingId || ev.buildingId === 'all' || (!ev.buildingId && legacyBuildings.length === 1)) {
        calendarEvents[ev.id] = {
          ...ev,
          buildingId,
          visibility: ev.visibility === 'admin' ? 'admin' : 'building',
          updatedAt: nowIso,
        };
      }
    }

    // 9. Building Root Document (zero secrets, zero unit-level PII)
    const { apiKey, clientSecret, secretKey, ...safeBankApi } = (b.bankApi && typeof b.bankApi === 'object') ? b.bankApi : {};
    const buildingDoc = {
      id: buildingId,
      name: String(b.name || buildingId),
      officialName: String(b.officialName || ''),
      address: String(b.address || ''),
      taxNumber: String(b.taxNumber || ''),
      hrsz: String(b.hrsz || ''),
      totalOwnershipShare: Number(b.totalOwnershipShare) || 10000,
      organizationId: b.organizationId || null,
      contactDisplayMode: b.contactDisplayMode || 'company',
      managerContact: b.managerContact || null,
      showCentralContactToResidents: Boolean(b.showCentralContactToResidents),
      archived: Boolean(b.archived),
      ...(b.archivedAt ? { archivedAt: b.archivedAt } : {}),
      szvb: b.szvb || null,
      economicAuditor: b.economicAuditor || null,
      auditOpinions: Array.isArray(b.auditOpinions)
        ? b.auditOpinions.map(({ fileData: _omit, ...rest }) => rest)
        : [],
      auditObservations: Array.isArray(b.auditObservations) ? b.auditObservations : [],
      dismissedAlerts: Array.isArray(b.dismissedAlerts) ? b.dismissedAlerts : [],
      paymentCodePrefix: String(b.code || b.shortName || 'TH').trim().slice(0, 16),
      defaultBank: String(b.defaultBank || 'OTP'),
      repContact: {
        name: String(b.repName || ''),
        phone: String(b.phone || ''),
        email: String(b.email || ''),
        officeHours: String(b.repOfficeHours || ''),
        address: String(b.repAddress || ''),
      },
      bankAccounts: {
        KK: {
          name: String(b.bankKK?.name || b.name || ''),
          shortName: String(b.bankKK?.shortName || 'KK'),
          account: String(b.bankKK?.account || ''),
          bank: String(b.bankKK?.bank || 'OTP'),
          hasMonthlyFee: true,
        },
        FA: {
          name: String(b.bankFA?.name || b.name || ''),
          shortName: String(b.bankFA?.shortName || 'FA'),
          account: String(b.bankFA?.account || ''),
          bank: String(b.bankFA?.bank || 'OTP'),
          hasMonthlyFee: true,
        },
        custom: customBankAccounts,
      },
      bankApi: {
        provider: safeBankApi.provider || 'OTP CorpAPI',
        environment: safeBankApi.environment === 'production' ? 'production' : 'sandbox',
        clientId: String(safeBankApi.clientId || ''),
        autoSync: Boolean(safeBankApi.autoSync),
        syncInterval: 'daily',
        secretManagedServerSide: true,
      },
      initialReserves: {
        KK: Math.round(Number(b.buildingInitialReserveCommon) || 0),
        FA: Math.round(Number(b.buildingInitialReserveRenovation) || 0),
        custom: { ...initialCustomReserves },
      },
      balances: liveBuildingBalances,
      aggregates,
      docFolders: Array.isArray(b.docFolders) ? b.docFolders : [],
      createdAt: nowIso,
      updatedAt: nowIso,
      lastAuditLogId: migrationAuditId,
    };

    // Provision Economic Auditor membership if enabled and resolved in Auth
    if (b.economicAuditor?.enabled && b.economicAuditor?.email) {
      const audEmail = String(b.economicAuditor.email).toLowerCase().trim();
      const audUid = resolveUid(audEmail);
      if (audUid) {
        ensureUserDoc(audUid, audEmail, b.economicAuditor.name || audEmail, false, b.economicAuditor.phone || '');
        const existingMem = members[audUid];
        const nextRole = existingMem?.role === 'admin' || existingMem?.role === 'szvb'
          ? existingMem.role
          : 'auditor';
        members[audUid] = {
          ...(existingMem || {}),
          uid: audUid,
          email: audEmail,
          name: b.economicAuditor.name || existingMem?.name || audEmail,
          role: nextRole,
          isEconomicAuditor: true,
          unitIds: Array.isArray(existingMem?.unitIds) ? existingMem.unitIds : [],
          active: true,
          grantedBy: 'system:migration',
          grantedAt: existingMem?.grantedAt || nowIso,
          updatedAt: nowIso,
        };
        if (usersDocs[audUid]) {
          usersDocs[audUid].memberships[buildingId] = {
            role: nextRole,
            isEconomicAuditor: true,
            unitIds: members[audUid].unitIds,
            active: true,
            buildingName: String(b.name || buildingId),
          };
        }
      }
    }

    const auditLogs = {
      [migrationAuditId]: {
        id: migrationAuditId,
        buildingId,
        action: 'migration.import',
        entityType: 'building',
        entityId: buildingId,
        actorUid: 'system:migration',
        actorEmail: 'migration@tarsasapp.internal',
        actorRole: 'system',
        timestamp: nowIso,
        summary: `RTDB -> Firestore migration completed: ${allUnitsList.length} units, ${Object.keys(transactions).length} ledger entries, KK=${liveBuildingBalances.KK} HUF, FA=${liveBuildingBalances.FA} HUF, Arrears=${aggregates.totalArrearsHuf} HUF`,
        before: null,
        after: {
          unitCount: allUnitsList.length,
          transactionCount: Object.keys(transactions).length,
          balances: liveBuildingBalances,
          aggregates,
        },
      },
    };

    // 10. Email Dunning Rules & Outbox Logs scoped to this building
    const emailRules = {};
    for (const r of legacyEmailRules) {
      if (!r || !r.id) continue;
      if (!r.buildingId || r.buildingId === 'all' || r.buildingId === buildingId) {
        emailRules[String(r.id)] = { ...r, id: String(r.id), updatedAt: nowIso };
      }
    }

    const emailOutbox = {};
    for (const item of legacyEmailOutbox) {
      if (!item || !item.id) continue;
      if (!item.buildingId || item.buildingId === buildingId) {
        emailOutbox[String(item.id)] = {
          ...item,
          id: String(item.id),
          attachments: Array.isArray(item.attachments)
            ? item.attachments.map(({ fileData: _omit, data: _omit2, inlineData: _omit3, ...rest }) => rest)
            : [],
        };
      }
    }

    buildingsPlan[buildingId] = {
      buildingDoc,
      members,
      units,
      categories,
      transactions,
      monthlySummaries,
      loans,
      documents,
      infoSections,
      calendarEvents,
      emailRules,
      emailOutbox,
      auditLogs,
    };
  }

  return {
    users: usersDocs,
    userNotifications,
    organizations: organizationsPlan,
    buildings: buildingsPlan,
    storageUploads,
  };
}

/**
 * Recursively scan any transformed Firestore plan for forbidden plaintext secrets or inline Base64 blobs.
 */
function findForbiddenFields(obj, pathPrefix = '', findings = []) {
  if (!obj || typeof obj !== 'object') return findings;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => findForbiddenFields(item, `${pathPrefix}[${i}]`, findings));
    return findings;
  }
  for (const [key, val] of Object.entries(obj)) {
    const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (SENSITIVE_FIELD_NAMES.has(key)) {
      findings.push(`Forbidden sensitive key "${fullPath}"`);
    }
    if (typeof val === 'string' && val.startsWith('data:') && val.length > 256) {
      findings.push(`Inline Base64 blob found at "${fullPath}" (${val.length} chars)`);
    }
    if (val && typeof val === 'object') {
      findForbiddenFields(val, fullPath, findings);
    }
  }
  return findings;
}

/**
 * 0-Ft Parity Verifier: Compares every migrated building, unit, fund reserve, arrears total,
 * and monthly summary directly against legacy src/utils/finances.js calculations!
 */
export function verifyFirestoreParityAgainstLegacy(rtdbSnapshot, transformedPlan) {
  const discrepancies = [];
  let checkedBuildings = 0;
  let checkedUnits = 0;
  let checkedMonths = 0;
  let checkedTransactions = 0;

  // 1. Security scan: zero plaintext passwords, API secrets, or inline Base64 blobs
  const securityLeaks = [
    ...findForbiddenFields(transformedPlan.users, 'users'),
    ...findForbiddenFields(transformedPlan.buildings, 'buildings'),
  ];
  securityLeaks.forEach((msg) => discrepancies.push(`[SECURITY] ${msg}`));

  // 2. Financial 0-Ft parity check per building
  const legacyBuildings = Array.isArray(rtdbSnapshot?.buildings)
    ? rtdbSnapshot.buildings
    : Object.values(rtdbSnapshot?.buildings || {});

  for (const b of legacyBuildings) {
    if (!b || !b.id) continue;
    checkedBuildings++;
    const planB = transformedPlan.buildings[b.id];
    if (!planB) {
      discrepancies.push(`Missing building "${b.id}" in transformed plan.`);
      continue;
    }

    checkedTransactions += Object.keys(planB.transactions).length;

    // Run legacy finances.js engine on an isolated deep copy
    const legacyState = JSON.parse(JSON.stringify({
      currentLang: 'hu',
      currentBuildingId: b.id,
      buildings: [b],
      flats: b.flats || [],
      transactions: b.transactions || [],
      expenses: b.expenses || [],
      manualDebits: b.manualDebits || [],
      loans: b.loans || [],
      buildingInitialReserveCommon: Number(b.buildingInitialReserveCommon) || 0,
      buildingInitialReserveRenovation: Number(b.buildingInitialReserveRenovation) || 0,
    }));

    recalculateFlatBalances(legacyState);

    // Check building KK & FA bank reserves
    const legacyKK = Math.round(getBuildingReserve(legacyState));
    const legacyFA = Math.round(getBuildingRenovationFund(legacyState));
    if (planB.buildingDoc.balances.KK !== legacyKK) {
      discrepancies.push(`[${b.id}] Building KK reserve mismatch: legacy=${legacyKK}, firestore=${planB.buildingDoc.balances.KK}`);
    }
    if (planB.buildingDoc.balances.FA !== legacyFA) {
      discrepancies.push(`[${b.id}] Building FA reserve mismatch: legacy=${legacyFA}, firestore=${planB.buildingDoc.balances.FA}`);
    }

    // Check custom bank accounts reserves
    for (const acc of (b.customBankAccounts || [])) {
      const legacyCustom = Math.round(getBuildingAccountReserve(acc.id, legacyState));
      const fsCustom = Math.round(Number(planB.buildingDoc.balances.custom?.[acc.id]) || 0);
      if (fsCustom !== legacyCustom) {
        discrepancies.push(`[${b.id}] Custom reserve "${acc.id}" mismatch: legacy=${legacyCustom}, firestore=${fsCustom}`);
      }
    }

    // Check every unit's KK, FA, custom, and total balance
    let legacyTotalArrears = 0;
    let legacyDebtorCount = 0;

    for (const flat of legacyState.flats) {
      checkedUnits++;
      const unitId = slugifyUnitId(flat.flatNum);
      const fsUnit = planB.units[unitId];
      if (!fsUnit) {
        discrepancies.push(`[${b.id}] Missing unit "${unitId}" (${flat.flatNum})`);
        continue;
      }

      const legKK = Math.round(flat.balance || 0);
      const legFA = Math.round(flat.renovationBalance || 0);
      if (fsUnit.balances.KK !== legKK) {
        discrepancies.push(`[${b.id}/${flat.flatNum}] Unit KK balance mismatch: legacy=${legKK}, firestore=${fsUnit.balances.KK}`);
      }
      if (fsUnit.balances.FA !== legFA) {
        discrepancies.push(`[${b.id}/${flat.flatNum}] Unit FA balance mismatch: legacy=${legFA}, firestore=${fsUnit.balances.FA}`);
      }

      let legCustomSum = 0;
      for (const acc of (b.customBankAccounts || [])) {
        const legC = Math.round(flat.customBalances?.[acc.id] || 0);
        const fsC = Math.round(fsUnit.balances.custom?.[acc.id] || 0);
        legCustomSum += legC;
        if (fsC !== legC) {
          discrepancies.push(`[${b.id}/${flat.flatNum}] Unit custom "${acc.id}" mismatch: legacy=${legC}, firestore=${fsC}`);
        }
      }

      const legTotal = legKK + legFA + legCustomSum;
      if (fsUnit.balances.total !== legTotal) {
        discrepancies.push(`[${b.id}/${flat.flatNum}] Unit total balance mismatch: legacy=${legTotal}, firestore=${fsUnit.balances.total}`);
      }
      if (legTotal < 0) {
        legacyTotalArrears += Math.abs(legTotal);
        legacyDebtorCount += 1;
      }
    }

    if (planB.buildingDoc.aggregates.totalArrearsHuf !== legacyTotalArrears) {
      discrepancies.push(`[${b.id}] Building aggregated arrears mismatch: legacy=${legacyTotalArrears}, firestore=${planB.buildingDoc.aggregates.totalArrearsHuf}`);
    }
    if (planB.buildingDoc.aggregates.debtorUnitCount !== legacyDebtorCount) {
      discrepancies.push(`[${b.id}] Building debtorUnitCount mismatch: legacy=${legacyDebtorCount}, firestore=${planB.buildingDoc.aggregates.debtorUnitCount}`);
    }

    // Check every migrated monthlySummary against legacy getMonthlyStats
    for (const [ym, summary] of Object.entries(planB.monthlySummaries)) {
      checkedMonths++;
      const [yStr, mStr] = ym.split('-');
      const legStats = getMonthlyStats(Number(yStr), Number(mStr), legacyState);
      if (Math.round(summary.totalInflowHuf) !== Math.round(legStats.inflow)) {
        discrepancies.push(`[${b.id}/${ym}] Monthly inflow mismatch: legacy=${legStats.inflow}, firestore=${summary.totalInflowHuf}`);
      }
      if (Math.round(summary.totalOutflowHuf) !== Math.round(legStats.outflow)) {
        discrepancies.push(`[${b.id}/${ym}] Monthly outflow mismatch: legacy=${legStats.outflow}, firestore=${summary.totalOutflowHuf}`);
      }
    }
  }

  return {
    ok: discrepancies.length === 0,
    checkedBuildings,
    checkedUnits,
    checkedTransactions,
    checkedMonths,
    discrepancies,
  };
}
