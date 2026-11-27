/**
 * Multi-Tenant Cloud Firestore <-> React UI State Runtime Adapter (D-1.1)
 *
 * Bridges the normalized Firestore multi-tenant schema (`buildings/{bId}/units`,
 * `transactions`, `monthlySummaries`, `loans`, `documents`, `infoSections`,
 * `calendarEvents`, `categories`) cleanly with the existing React UI state shape
 * with ZERO UI/UX regressions and ZERO PII/financial data in localStorage.
 */

import {
  fetchUserProfile,
  fetchUserNotifications,
  fetchOrganization,
  fetchBuildingEmailRules,
  fetchBuildingEmailOutbox,
  fetchBuildingMember,
  fetchBuildingMembers,
  fetchBuildingRoot,
  fetchAllBuildingsForSuperAdmin,
  fetchBuildingCategories,
  fetchMonthlySummaries,
  fetchScopedUnits,
  fetchScopedLoans,
  fetchPaginatedTransactions,
  fetchBuildingDocuments,
  fetchBuildingInfoSections,
  fetchBuildingCalendarEvents,
  uploadBase64ToStorage,
} from './firestoreService.js';
import { sanitizeFileName } from '../utils/fileSecurity.js';

// =============================================================================
// 1. PURE CANONICAL ID & FUND MAPPING HELPERS (Unit-Testable)
// =============================================================================

export function slugifyUnitId(unitCode) {
  const raw = String(unitCode || '').trim();
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'unit-unknown';
}

export function uiAccountToFundKey(accountNameOrId, customAccounts = []) {
  const raw = String(accountNameOrId || '').trim();
  if (!raw || raw === 'KK' || raw === 'Közös Költség' || raw.toLowerCase() === 'common cost') {
    return 'KK';
  }
  if (raw === 'FA' || raw === 'Felújítási Alap' || raw.toLowerCase() === 'renovation fund') {
    return 'FA';
  }
  const matched = (customAccounts || []).find((a) => a && (a.id === raw || a.name === raw));
  return matched ? matched.id : raw;
}

export function fundKeyToUiAccount(fund, customAccounts = []) {
  const raw = String(fund || 'KK').trim();
  if (raw === 'KK' || raw === 'Közös Költség') return 'Közös Költség';
  if (raw === 'FA' || raw === 'Felújítási Alap') return 'Felújítási Alap';
  const matched = (customAccounts || []).find((a) => a && (a.id === raw || a.name === raw));
  return matched ? matched.name : raw;
}

export function normalizeRoleForUi(fsRole) {
  const r = String(fsRole || '').toLowerCase().trim();
  if (r === 'superadmin') return 'superadmin';
  if (r === 'admin') return 'admin';
  if (r === 'szvb') return 'szvb';
  if (r === 'auditor') return 'auditor';
  return 'Owner';
}

export function normalizeRoleForFirestore(uiRole) {
  const r = String(uiRole || '').toLowerCase().trim();
  if (r === 'superadmin') return 'superadmin';
  if (r === 'admin') return 'admin';
  if (r === 'szvb') return 'szvb';
  if (r === 'auditor') return 'auditor';
  return 'owner';
}

/**
 * Removes all sensitive PII / financial cache keys from localStorage.
 * In Firestore mode, localStorage ONLY stores non-sensitive UI preferences (language, sound toggle).
 */
export function purgeSensitiveLocalStorage() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem('tarsashaz_state');
    localStorage.removeItem('tarsashaz_permanent_vault');
    localStorage.removeItem('tarsashaz_logged_in_user');
    localStorage.removeItem('tarsashaz_role_mode');
    localStorage.removeItem('tarsashaz_is_portfolio');
  } catch {
    // ignore storage access errors
  }
}

// =============================================================================
// 2. FIRESTORE -> UI STATE MAPPERS (Pure & Deterministic)
// =============================================================================

export function firestoreUnitToUiFlat(unit) {
  if (!unit) return null;
  const fees = unit.fees || {};
  const bal = unit.balances || {};
  const owners = Array.isArray(unit.owners) ? unit.owners : [];
  const primaryOwner = owners[0] || {};
  const primaryEmail = primaryOwner.email || (Array.isArray(primaryOwner.emails) ? primaryOwner.emails[0] : '') || '';

  return {
    id: unit.id,
    unitId: unit.id,
    flatNum: unit.unitCode || unit.id,
    unitType: unit.unitType || 'flat',
    staircase: unit.staircase || '',
    floor: unit.floor || '',
    door: unit.door || '',
    hrsz: unit.hrsz || '',
    area: Number(unit.areaSqm) || 0,
    areaSqm: Number(unit.areaSqm) || 0,
    volume: Number(unit.volumeCbm) || 0,
    terraceArea: Number(unit.terraceAreaSqm) || 0,
    ownershipShare: Number(unit.ownershipSharePct) || 0,
    tenantCount: Number(unit.residentsCount) || 1,
    paymentCode: unit.paymentCode || unit.unitCode || '',
    purchaseDate: unit.purchaseDate || '',
    saleDate: unit.saleDate || '',
    isCompany: Boolean(unit.isCompany),
    excludeUtility: Boolean(unit.excludeUtility),
    notes: unit.notes || '',
    phone: unit.phone || primaryOwner.phone || '',
    emergencyContact: unit.emergencyContact || '',
    ownerName: unit.ownerDisplayName || primaryOwner.name || '',
    email: primaryEmail,
    owners,
    ownerUids: Array.isArray(unit.ownerUids) ? unit.ownerUids : [],
    tenants: Array.isArray(unit.tenants) ? unit.tenants : [],
    meters: Array.isArray(unit.meters) ? unit.meters : [],
    annexes: Array.isArray(unit.accessories) ? unit.accessories : [],
    startDateKK: fees.startDateKK || '2026-09-01',
    startDateFA: fees.startDateFA || '2026-09-01',
    monthlyFee: Math.round(Number(fees.monthlyFeeKK) || 0),
    renovationFee: Math.round(Number(fees.monthlyFeeFA) || 0),
    customFees: fees.customFees ? { ...fees.customFees } : {},
    feeChangesKK: Array.isArray(fees.feeChangesKK) ? fees.feeChangesKK : [],
    feeChangesFA: Array.isArray(fees.feeChangesFA) ? fees.feeChangesFA : [],
    cancelledDebits: Array.isArray(unit.cancelledDebits) ? unit.cancelledDebits : [],
    debitComments: unit.debitComments && typeof unit.debitComments === 'object' ? { ...unit.debitComments } : {},
    initialBalance: Math.round(Number(bal.initialKK) || 0),
    initialRenovationBalance: Math.round(Number(bal.initialFA) || 0),
    customInitialBalances: bal.customInitial ? { ...bal.customInitial } : {},
    balance: Math.round(Number(bal.KK) || 0),
    renovationBalance: Math.round(Number(bal.FA) || 0),
    customBalances: bal.custom ? { ...bal.custom } : {},
    totalRequired: Math.round(Number(bal.totalRequiredKK) || 0),
    totalPaid: Math.round(Number(bal.totalPaidKK) || 0),
    renovationTotalRequired: Math.round(Number(bal.totalRequiredFA) || 0),
    renovationTotalPaid: Math.round(Number(bal.totalPaidFA) || 0),
    activeLoanShares: Array.isArray(unit.activeLoanShares) ? unit.activeLoanShares : [],
    // Authoritative server-computed balances marker (prevents client double-calculation drift)
    firestoreBalances: {
      KK: Math.round(Number(bal.KK) || 0),
      FA: Math.round(Number(bal.FA) || 0),
      custom: bal.custom ? { ...bal.custom } : {},
      totalRequiredKK: Math.round(Number(bal.totalRequiredKK) || 0),
      totalPaidKK: Math.round(Number(bal.totalPaidKK) || 0),
      totalRequiredFA: Math.round(Number(bal.totalRequiredFA) || 0),
      totalPaidFA: Math.round(Number(bal.totalPaidFA) || 0),
    },
  };
}

function firestoreMethodToUiMethod(paymentMethod) {
  if (paymentMethod === 'cash') return 'Cash';
  if (paymentMethod === 'offset') return 'Cash Offset';
  if (paymentMethod === 'system_assessment') return 'Előírás';
  return 'Bank Transfer';
}

function firestoreStatusToUiStatus(status) {
  if (status === 'pending') return 'Pending';
  if (status === 'voided') return 'Voided';
  return 'Verified';
}

function toTimestampMs(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  return 0;
}

/**
 * Splits canonical Firestore transactions into the 3 UI ledger arrays
 * (`transactions`, `expenses`, `manualDebits`) while keeping `assessment` documents
 * separate from `manualDebits` so `getFlatLedgerTimeline()` never double-counts monthly bills.
 */
export function firestoreTransactionsToUiCollections(txDocs = [], customAccounts = []) {
  const transactions = [];
  const expenses = [];
  const manualDebits = [];

  for (const tx of txDocs) {
    if (!tx) continue;
    const targetAccount = fundKeyToUiAccount(tx.fund, customAccounts);
    const createdAtMs = toTimestampMs(tx.createdAt);
    const updatedAtMs = toTimestampMs(tx.updatedAt) || createdAtMs;

    const baseCommon = {
      id: tx.id,
      date: tx.date || '',
      flatNum: tx.unitCode || null,
      unitId: tx.unitId || null,
      targetAccount,
      account: targetAccount,
      category: tx.categoryId || '',
      comment: tx.comment || '',
      title: tx.title || '',
      provider: tx.provider || '',
      method: firestoreMethodToUiMethod(tx.paymentMethod),
      paymentMethod: firestoreMethodToUiMethod(tx.paymentMethod),
      status: firestoreStatusToUiStatus(tx.status),
      includeInBalance: tx.affectsBankBalance !== false,
      affectsBankBalance: tx.affectsBankBalance !== false,
      includeInFlatBalance: tx.includeInFlatBalance !== false,
      bankTxId: tx.bankTxId || null,
      transferGroupId: tx.transferGroupId || null,
      attachments: Array.isArray(tx.attachments) ? tx.attachments : [],
      createdAt: createdAtMs,
      lastUpdated: updatedAtMs,
      firestoreKind: tx.kind,
    };

    if (tx.kind === 'assessment') {
      // Materialized monthly assessment is already synthesized in UI timeline & reflected in unit.firestoreBalances
      continue;
    }

    if (tx.kind === 'expense') {
      expenses.push({
        ...baseCommon,
        amount: Math.abs(Math.round(Number(tx.amountHuf) || 0)),
        provider: tx.provider || tx.title || tx.comment || targetAccount,
        title: tx.title || tx.provider || tx.comment || 'Kiadás',
        type: 'Expense',
      });
    } else if (tx.kind === 'debit') {
      manualDebits.push({
        ...baseCommon,
        amount: Math.abs(Math.round(Number(tx.amountHuf) || 0)),
        type: 'Debit',
      });
    } else {
      // payment | transfer | correction
      const absAmt = Math.abs(Math.round(Number(tx.amountHuf) || 0));
      const signedAmt = tx.direction === 'debit' ? -absAmt : absAmt;
      transactions.push({
        ...baseCommon,
        amount: signedAmt,
        type:
          tx.kind === 'correction'
            ? 'Correction'
            : tx.kind === 'transfer'
              ? 'Transfer'
              : 'Payment',
      });
    }
  }

  return { transactions, expenses, manualDebits };
}

export function firestoreBuildingToUiBuilding(buildingDoc, extras = {}) {
  if (!buildingDoc) return null;
  const rep = buildingDoc.repContact || {};
  const bankAccounts = buildingDoc.bankAccounts || {};
  const initRes = buildingDoc.initialReserves || {};
  const liveBal = buildingDoc.balances || {};
  const customAccounts = Array.isArray(bankAccounts.custom) ? bankAccounts.custom : [];

  const monthlyMap = {};
  for (const ms of (extras.monthlySummaries || [])) {
    if (ms && ms.yearMonth) {
      const inflow = Math.round(Number(ms.totalInflowHuf ?? ms.inflow) || 0);
      const outflow = Math.round(Number(ms.totalOutflowHuf ?? ms.outflow) || 0);
      const margin = Math.round(Number(ms.netMarginHuf ?? ms.margin ?? (inflow - outflow)) || 0);
      const kkInflow = Math.round(Number(ms.inflowByFund?.KK ?? ms.kkInflow) || 0);
      const kkOutflow = Math.round(Number(ms.outflowByFund?.KK ?? ms.kkOutflow) || 0);
      const faInflow = Math.round(Number(ms.inflowByFund?.FA ?? ms.faInflow) || 0);
      const faOutflow = Math.round(Number(ms.outflowByFund?.FA ?? ms.faOutflow) || 0);
      monthlyMap[ms.yearMonth] = {
        yearMonth: ms.yearMonth,
        inflow,
        outflow,
        margin,
        kkInflow,
        kkOutflow,
        faInflow,
        faOutflow,
      };
    }
  }

  return {
    id: buildingDoc.id,
    name: buildingDoc.name || buildingDoc.id,
    officialName: buildingDoc.officialName || '',
    address: buildingDoc.address || '',
    taxNumber: buildingDoc.taxNumber || '',
    totalOwnershipShare: Number(buildingDoc.totalOwnershipShare) || 10000,
    organizationId: buildingDoc.organizationId || null,
    contactDisplayMode: buildingDoc.contactDisplayMode || 'company',
    managerContact: buildingDoc.managerContact || null,
    showCentralContactToResidents: Boolean(buildingDoc.showCentralContactToResidents),
    archived: Boolean(buildingDoc.archived),
    archivedAt: buildingDoc.archivedAt || null,
    archivedBy: buildingDoc.archivedBy || '',
    archivedByName: buildingDoc.archivedByName || '',
    archivedFromOrgId: buildingDoc.archivedFromOrgId || null,
    archivedFromOwnerEmail: buildingDoc.archivedFromOwnerEmail || '',
    archivedFromOwnerName: buildingDoc.archivedFromOwnerName || '',
    code: buildingDoc.paymentCodePrefix || 'TH',
    defaultBank: buildingDoc.defaultBank || 'OTP',
    repName: rep.name || '',
    phone: rep.phone || '',
    email: rep.email || '',
    repOfficeHours: rep.officeHours || '',
    repAddress: rep.address || '',
    bankKK: bankAccounts.KK || { name: buildingDoc.name || '', account: '', bank: 'OTP', shortName: 'KK' },
    bankFA: bankAccounts.FA || { name: buildingDoc.name || '', account: '', bank: 'OTP', shortName: 'FA' },
    bankAccountKK: bankAccounts.KK?.account || '',
    bankAccountFA: bankAccounts.FA?.account || '',
    customBankAccounts: customAccounts,
    bankApi: buildingDoc.bankApi || { provider: 'OTP CorpAPI', environment: 'sandbox', secretManagedServerSide: true },
    buildingInitialReserveCommon: Math.round(Number(initRes.KK) || 0),
    buildingInitialReserveRenovation: Math.round(Number(initRes.FA) || 0),
    initialReserves: {
      KK: Math.round(Number(initRes.KK) || 0),
      FA: Math.round(Number(initRes.FA) || 0),
      custom: initRes.custom ? { ...initRes.custom } : {},
    },
    firestoreBalances: {
      KK: Math.round(Number(liveBal.KK) || 0),
      FA: Math.round(Number(liveBal.FA) || 0),
      custom: liveBal.custom ? { ...liveBal.custom } : {},
      totalReserve: Math.round(Number(liveBal.totalReserve ?? ((Number(liveBal.KK) || 0) + (Number(liveBal.FA) || 0))) || 0),
    },
    aggregates: buildingDoc.aggregates || null,
    hrsz: buildingDoc.hrsz || '',
    szvb: buildingDoc.szvb || null,
    economicAuditor: buildingDoc.economicAuditor || null,
    auditOpinions: Array.isArray(buildingDoc.auditOpinions) ? buildingDoc.auditOpinions : [],
    auditObservations: Array.isArray(buildingDoc.auditObservations) ? buildingDoc.auditObservations : [],
    dismissedAlerts: Array.isArray(buildingDoc.dismissedAlerts) ? buildingDoc.dismissedAlerts : [],
    firestoreMonthlySummaries: monthlyMap,
    categories: Array.isArray(extras.categories) ? extras.categories : [],
    docFolders: Array.isArray(buildingDoc.docFolders) ? buildingDoc.docFolders : [],
    flats: Array.isArray(extras.flats) ? extras.flats : [],
    transactions: Array.isArray(extras.transactions) ? extras.transactions : [],
    expenses: Array.isArray(extras.expenses) ? extras.expenses : [],
    manualDebits: Array.isArray(extras.manualDebits) ? extras.manualDebits : [],
    loans: Array.isArray(extras.loans) ? extras.loans : [],
    documents: Array.isArray(extras.documents) ? extras.documents : [],
    infoSections: Array.isArray(extras.infoSections) ? extras.infoSections : [],
    hydrated: Boolean(extras.hydrated),
  };
}

// =============================================================================
// 3. UI -> FIRESTORE PAYLOAD MAPPERS (Pure & Cloud-Function Compliant)
// =============================================================================

function resolveUnitFromFlats(rawFlatNum, flats = []) {
  if (!rawFlatNum || rawFlatNum === '-' || rawFlatNum === 'Global' || rawFlatNum === 'Kiadás') {
    return { unitId: null, unitCode: null };
  }
  const clean = String(rawFlatNum).trim();
  const matched = (flats || []).find(
    (f) => f && (f.flatNum === clean || f.unitId === clean || f.id === clean)
  );
  if (matched) {
    return {
      unitId: matched.unitId || matched.id || slugifyUnitId(matched.flatNum),
      unitCode: matched.flatNum,
    };
  }
  return { unitId: slugifyUnitId(clean), unitCode: clean };
}

/**
 * Converts a legacy UI Payment / Expense / Debit item into the strict schema
 * expected by Cloud Function `mutateTransaction`.
 */
export function uiItemToFirestoreTxPayload(uiItem, itemKindHint = 'payment', { flats = [], customAccounts = [] } = {}) {
  const item = uiItem || {};
  const rawAmt = Number(item.amount) || 0;
  const absAmt = Math.abs(Math.round(rawAmt));
  const fund = uiAccountToFundKey(item.targetAccount || item.account || 'KK', customAccounts);
  const { unitId, unitCode } = resolveUnitFromFlats(item.flatNum, flats);

  let kind = itemKindHint;
  if (item.type === 'Correction') kind = 'correction';
  else if (item.type === 'Transfer' || String(item.id || '').endsWith('-from') || String(item.id || '').endsWith('-to')) kind = 'transfer';
  else if (itemKindHint === 'expense' || item.type === 'Expense') kind = 'expense';
  else if (itemKindHint === 'debit' || item.type === 'Debit') kind = 'debit';
  else kind = 'payment';

  let direction = 'credit';
  if (kind === 'expense' || kind === 'debit') {
    direction = 'debit';
  } else if (rawAmt < 0) {
    direction = 'debit';
  } else {
    direction = 'credit';
  }

  const rawDate = String(item.date || new Date().toISOString().slice(0, 10)).replace(/\./g, '-').trim();
  const isoDate = /^\d{4}-\d{2}-\d{2}/.test(rawDate)
    ? rawDate.slice(0, 10)
    : (/^\d{4}-\d{2}$/.test(rawDate) ? `${rawDate}-01` : new Date().toISOString().slice(0, 10));

  const affectsBankBalance =
    item.affectsBankBalance !== undefined
      ? Boolean(item.affectsBankBalance)
      : (item.includeInBalance !== undefined ? Boolean(item.includeInBalance) : (kind !== 'debit' && kind !== 'correction'));

  return {
    id: item.id || undefined,
    kind,
    direction,
    amountHuf: absAmt,
    date: isoDate,
    unitId,
    unitCode,
    fund,
    categoryId: String(item.category || (direction === 'credit' ? (fund === 'FA' ? 'cat-inc-fa' : 'cat-inc-kk') : 'cat-exp-other')),
    paymentMethod: item.paymentMethod || item.method || 'bank_transfer',
    affectsBankBalance,
    includeInFlatBalance: item.includeInFlatBalance !== undefined ? Boolean(item.includeInFlatBalance) : Boolean(unitId),
    status: item.status === 'Pending' ? 'pending' : (item.status === 'Voided' ? 'voided' : 'verified'),
    provider: String(item.provider || ''),
    title: String(item.title || ''),
    comment: String(item.comment || item.title || ''),
    bankTxId: item.bankTxId || null,
    transferGroupId: item.transferGroupId || null,
    source: item.bankTxId ? 'bank_import' : 'manual',
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
  };
}

/**
 * Uploads any inline Base64 data URL attachments to Cloud Storage and returns clean metadata descriptors
 * so zero Base64 blobs ever enter Cloud Firestore.
 */
export async function uploadAttachmentsToStorage(buildingId, pathPrefix, attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  const uploaded = [];
  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    if (!att) continue;
    const rawData = att.data || att.fileData;
    const safeName = sanitizeFileName(att.name || att.fileName || `attachment-${i + 1}`);
    if (typeof rawData === 'string' && rawData.startsWith('data:')) {
      const storagePath = `buildings/${buildingId}/${pathPrefix}/${Date.now()}-${i}-${safeName}`;
      const meta = await uploadBase64ToStorage(storagePath, rawData, att.mimeType || att.fileType);
      uploaded.push({
        id: att.id || `att-${Date.now()}-${i}`,
        name: safeName,
        fileName: safeName,
        mimeType: meta.mimeType,
        fileType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
        storagePath: meta.storagePath,
      });
    } else if (att.storagePath) {
      uploaded.push({
        id: att.id || `att-${i}`,
        name: safeName,
        fileName: safeName,
        mimeType: att.mimeType || att.fileType || 'application/octet-stream',
        fileType: att.mimeType || att.fileType || 'application/octet-stream',
        sizeBytes: Math.round(Number(att.sizeBytes) || 0),
        storagePath: att.storagePath,
      });
    }
  }
  return uploaded;
}

/**
 * Maps legacy `EditFlatMasterModal` updates into Firestore `units/{unitId}` safe master fields.
 * Strictly strips server-protected fields (`balances`, `ownerUids`, `activeLoanShares`).
 */
export function uiFlatMasterToFirestoreUnitUpdate(safeUpdate = {}, existingFlat = {}) {
  const out = {};
  if (safeUpdate.unitType !== undefined) out.unitType = safeUpdate.unitType;
  if (safeUpdate.staircase !== undefined) out.staircase = String(safeUpdate.staircase || '');
  if (safeUpdate.floor !== undefined) out.floor = String(safeUpdate.floor || '');
  if (safeUpdate.door !== undefined) out.door = String(safeUpdate.door || '');
  if (safeUpdate.hrsz !== undefined) out.hrsz = String(safeUpdate.hrsz || '');
  if (safeUpdate.area !== undefined || safeUpdate.areaSqm !== undefined) {
    out.areaSqm = Number(safeUpdate.areaSqm ?? safeUpdate.area) || 0;
  }
  if (safeUpdate.volume !== undefined || safeUpdate.volumeCbm !== undefined) {
    out.volumeCbm = Number(safeUpdate.volumeCbm ?? safeUpdate.volume) || 0;
  }
  if (safeUpdate.terraceArea !== undefined || safeUpdate.terraceAreaSqm !== undefined) {
    out.terraceAreaSqm = Number(safeUpdate.terraceAreaSqm ?? safeUpdate.terraceArea) || 0;
  }
  if (safeUpdate.ownershipShare !== undefined || safeUpdate.ownershipSharePct !== undefined) {
    out.ownershipSharePct = Number(safeUpdate.ownershipSharePct ?? safeUpdate.ownershipShare) || 0;
  }
  if (safeUpdate.tenantCount !== undefined || safeUpdate.residentsCount !== undefined) {
    out.residentsCount = Number(safeUpdate.residentsCount ?? safeUpdate.tenantCount) || 1;
  }
  if (safeUpdate.paymentCode !== undefined) out.paymentCode = String(safeUpdate.paymentCode || '');
  if (safeUpdate.purchaseDate !== undefined) out.purchaseDate = String(safeUpdate.purchaseDate || '');
  if (safeUpdate.saleDate !== undefined) out.saleDate = String(safeUpdate.saleDate || '');
  if (safeUpdate.isCompany !== undefined) out.isCompany = Boolean(safeUpdate.isCompany);
  if (safeUpdate.excludeUtility !== undefined) out.excludeUtility = Boolean(safeUpdate.excludeUtility);
  if (safeUpdate.notes !== undefined) out.notes = String(safeUpdate.notes || '');
  if (safeUpdate.phone !== undefined) out.phone = String(safeUpdate.phone || '');
  if (safeUpdate.emergencyContact !== undefined) out.emergencyContact = String(safeUpdate.emergencyContact || '');
  if (safeUpdate.ownerName !== undefined || safeUpdate.ownerDisplayName !== undefined) {
    out.ownerDisplayName = String(safeUpdate.ownerDisplayName ?? safeUpdate.ownerName ?? '');
  }
  if (Array.isArray(safeUpdate.owners)) out.owners = safeUpdate.owners;
  if (Array.isArray(safeUpdate.tenants)) out.tenants = safeUpdate.tenants;
  if (Array.isArray(safeUpdate.meters)) out.meters = safeUpdate.meters;
  if (Array.isArray(safeUpdate.annexes || safeUpdate.accessories)) {
    out.accessories = safeUpdate.accessories || safeUpdate.annexes;
  }

  // Fee updates (merge safely into fees map)
  const hasFeeUpdate =
    safeUpdate.monthlyFee !== undefined ||
    safeUpdate.renovationFee !== undefined ||
    safeUpdate.startDateKK !== undefined ||
    safeUpdate.startDateFA !== undefined ||
    safeUpdate.feeChangesKK !== undefined ||
    safeUpdate.feeChangesFA !== undefined ||
    safeUpdate.customFees !== undefined;

  if (hasFeeUpdate) {
    out.fees = {
      startDateKK: safeUpdate.startDateKK ?? existingFlat.startDateKK ?? '2026-09-01',
      startDateFA: safeUpdate.startDateFA ?? existingFlat.startDateFA ?? '2026-09-01',
      monthlyFeeKK: Math.round(Number(safeUpdate.monthlyFee ?? existingFlat.monthlyFee ?? 0) || 0),
      monthlyFeeFA: Math.round(Number(safeUpdate.renovationFee ?? existingFlat.renovationFee ?? 0) || 0),
      customFees: safeUpdate.customFees ?? existingFlat.customFees ?? {},
      feeChangesKK: safeUpdate.feeChangesKK ?? existingFlat.feeChangesKK ?? [],
      feeChangesFA: safeUpdate.feeChangesFA ?? existingFlat.feeChangesFA ?? [],
    };
  }

  return out;
}

// =============================================================================
// 4. ASYNC MULTI-TENANT HYDRATION ORCHESTRATORS
// =============================================================================

/**
 * Hydrates a single building with strict GDPR query scoping matching `firestore.rules`.
 */
export async function hydrateFirestoreBuilding(
  buildingId,
  { role = 'owner', uid = null, unitIds = [], accessFromDate = null, txPageSize = 2000 } = {}
) {
  const fsRole = normalizeRoleForFirestore(role);
  const isPrivileged = fsRole === 'admin' || fsRole === 'superadmin' || fsRole === 'szvb' || fsRole === 'auditor';

  const [
    buildingDoc,
    unitDocs,
    categories,
    monthlySummaries,
    loans,
    documents,
    infoSections,
    calendarEvents,
    memberDocs,
  ] = await Promise.all([
    fetchBuildingRoot(buildingId),
    fetchScopedUnits(buildingId, fsRole, uid),
    fetchBuildingCategories(buildingId).catch(() => []),
    fetchMonthlySummaries(buildingId, 24).catch(() => []),
    fetchScopedLoans(buildingId, fsRole).catch(() => []),
    fetchBuildingDocuments(buildingId, fsRole).catch(() => []),
    fetchBuildingInfoSections(buildingId, fsRole).catch(() => []),
    fetchBuildingCalendarEvents(buildingId, fsRole).catch(() => []),
    (fsRole === 'admin' || fsRole === 'superadmin')
      ? fetchBuildingMembers(buildingId, fsRole).catch(() => [])
      : Promise.resolve([]),
  ]);

  if (!buildingDoc) return null;

  let txDocs = [];
  let txPagination = { cursorDoc: null, hasMore: false };

  if (isPrivileged) {
    const page = await fetchPaginatedTransactions({
      buildingId,
      role: fsRole,
      pageSize: txPageSize,
    });
    txDocs = page.items;
    txPagination = { cursorDoc: page.nextCursor, hasMore: page.hasMore };
  } else {
    // GDPR Owner queries:
    //  (a) Building-level expenses & non-unit entries (visibility == 'building')
    //  (b) Own unit(s) transactions ONLY (optionally bounded by accessFromDate)
    const ownedUnitIds = unitIds.length > 0 ? unitIds : unitDocs.map((u) => u.id);
    const [buildingLevelPage, ...ownUnitPages] = await Promise.all([
      fetchPaginatedTransactions({
        buildingId,
        role: 'owner',
        visibility: 'building',
        pageSize: txPageSize,
      }).catch(() => ({ items: [], nextCursor: null, hasMore: false })),
      ...ownedUnitIds.map((uId) =>
        fetchPaginatedTransactions({
          buildingId,
          role: 'owner',
          unitId: uId,
          accessFromDate: accessFromDate || null,
          pageSize: txPageSize,
        }).catch(() => ({ items: [], nextCursor: null, hasMore: false }))
      ),
    ]);

    const txById = new Map();
    for (const item of buildingLevelPage.items) txById.set(item.id, item);
    for (const p of ownUnitPages) {
      for (const item of p.items) txById.set(item.id, item);
    }
    txDocs = Array.from(txById.values()).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    txPagination = {
      cursorDoc: buildingLevelPage.nextCursor,
      hasMore: buildingLevelPage.hasMore || ownUnitPages.some((p) => p.hasMore),
    };
  }

  const customAccounts = Array.isArray(buildingDoc.bankAccounts?.custom) ? buildingDoc.bankAccounts.custom : [];
  const flats = unitDocs.map(firestoreUnitToUiFlat).filter(Boolean);
  const { transactions, expenses, manualDebits } = firestoreTransactionsToUiCollections(txDocs, customAccounts);

  const uiBuilding = firestoreBuildingToUiBuilding(buildingDoc, {
    flats,
    transactions,
    expenses,
    manualDebits,
    categories,
    monthlySummaries,
    loans,
    documents,
    infoSections,
    hydrated: true,
  });

  const uiUsers = memberDocs.map((m) => ({
    id: m.uid || m.id,
    uid: m.uid || m.id,
    email: m.email || '',
    name: m.name || m.email || '',
    role: normalizeRoleForUi(m.role),
    buildingId,
    flatNum: Array.isArray(m.unitIds) && m.unitIds.length > 0
      ? (flats.find((f) => f.unitId === m.unitIds[0])?.flatNum || m.unitIds[0])
      : '0',
    unitIds: Array.isArray(m.unitIds) ? m.unitIds : [],
    active: m.active === true,
  }));

  return {
    building: uiBuilding,
    calendarEvents,
    users: uiUsers,
    txPagination,
  };
}

/**
 * Lightweight background financial reconciler: fetches ONLY building root balances,
 * unit balances, and monthlySummaries (3 tiny reads instead of 11 heavy subcollections)
 * to reconcile optimistic UI mutations with authoritative server totals.
 */
export async function hydrateFirestoreBuildingFinancials(buildingId, { role = 'owner', uid = null } = {}) {
  const fsRole = normalizeRoleForFirestore(role);
  const [buildingDoc, unitDocs, monthlySummaries] = await Promise.all([
    fetchBuildingRoot(buildingId),
    fetchScopedUnits(buildingId, fsRole, uid).catch(() => []),
    fetchMonthlySummaries(buildingId, 24).catch(() => []),
  ]);
  if (!buildingDoc) return null;

  const uiBuildingMeta = firestoreBuildingToUiBuilding(buildingDoc, { monthlySummaries });
  const flats = unitDocs.map(firestoreUnitToUiFlat).filter(Boolean);
  return {
    firestoreBalances: uiBuildingMeta.firestoreBalances,
    initialReserves: uiBuildingMeta.initialReserves,
    buildingInitialReserveCommon: uiBuildingMeta.buildingInitialReserveCommon,
    buildingInitialReserveRenovation: uiBuildingMeta.buildingInitialReserveRenovation,
    aggregates: uiBuildingMeta.aggregates,
    firestoreMonthlySummaries: uiBuildingMeta.firestoreMonthlySummaries,
    flats,
  };
}

/**
 * Hydrates the full authenticated user session from Cloud Firestore (zero RTDB, zero localStorage PII).
 */
export async function hydrateFirestoreSession(firebaseUser) {
  if (!firebaseUser || !firebaseUser.uid) return null;
  const uid = firebaseUser.uid;
  const verifiedEmail = String(firebaseUser.email || '').toLowerCase().trim();

  let tokenClaims = {};
  try {
    const tokenRes = await firebaseUser.getIdTokenResult();
    tokenClaims = tokenRes?.claims || {};
  } catch {
    tokenClaims = {};
  }

  const isSuperAdmin = tokenClaims.superadmin === true;
  const userProfile = await fetchUserProfile(uid);

  const rawMemberships = userProfile?.memberships || {};
  const activeMemberships = Object.entries(rawMemberships)
    .filter(([, m]) => m && m.active === true)
    .map(([bId, m]) => ({
      buildingId: bId,
      buildingName: m.buildingName || bId,
      role: normalizeRoleForFirestore(m.role),
      unitIds: Array.isArray(m.unitIds) ? m.unitIds : [],
    }));

  if (!isSuperAdmin && activeMemberships.length === 0) {
    return null; // Not provisioned to any active building -> caller fails closed
  }

  // Load accessible building root docs (GDPR-safe summary metadata + balances + aggregates)
  let buildingRootDocs = [];
  if (isSuperAdmin) {
    buildingRootDocs = await fetchAllBuildingsForSuperAdmin();
  } else {
    const roots = await Promise.all(
      activeMemberships.map((m) => fetchBuildingRoot(m.buildingId).catch(() => null))
    );
    buildingRootDocs = roots.filter(Boolean);
  }

  if (buildingRootDocs.length === 0 && !isSuperAdmin) {
    return null;
  }

  // Resolve primary role & initial building
  const hasAdminMembership = activeMemberships.some((m) => m.role === 'admin');
  const hasSzvbMembership = activeMemberships.some((m) => m.role === 'szvb');
  const hasAuditorMembership = activeMemberships.some((m) => m.role === 'auditor');
  const primaryRole = isSuperAdmin
    ? 'superadmin'
    : hasAdminMembership
      ? 'admin'
      : hasSzvbMembership
        ? 'szvb'
        : hasAuditorMembership
          ? 'auditor'
          : 'Owner';

  const primaryMembership =
    activeMemberships.find((m) => m.role === normalizeRoleForFirestore(primaryRole)) ||
    activeMemberships[0] ||
    null;

  const primaryBuildingId = primaryMembership?.buildingId || buildingRootDocs[0]?.id || null;

  // Fetch active member record (for accessFromDate on owners), notifications, orgs & admin email rules/outbox
  let accessFromDate = null;
  const candidateOrgIds = Array.from(
    new Set([
      ...(Array.isArray(userProfile?.orgIds) ? userProfile.orgIds : []),
      ...buildingRootDocs.map((b) => b?.organizationId).filter(Boolean),
    ])
  );
  const isAdminOrSuper = primaryRole === 'admin' || primaryRole === 'superadmin';

  const [memberDoc, userNotifications, orgDocs, emailRules, emailOutbox] = await Promise.all([
    primaryBuildingId && !isSuperAdmin
      ? fetchBuildingMember(primaryBuildingId, uid).catch(() => null)
      : Promise.resolve(null),
    fetchUserNotifications(uid, 200).catch(() => []),
    Promise.all(candidateOrgIds.map((oid) => fetchOrganization(oid).catch(() => null))),
    isAdminOrSuper && primaryBuildingId
      ? fetchBuildingEmailRules(primaryBuildingId).catch(() => [])
      : Promise.resolve([]),
    isAdminOrSuper && primaryBuildingId
      ? fetchBuildingEmailOutbox(primaryBuildingId, 200).catch(() => [])
      : Promise.resolve([]),
  ]);
  const organizations = orgDocs.filter(Boolean);
  if (memberDoc?.accessFromDate) {
    accessFromDate = memberDoc.accessFromDate;
  }

  // Hydrate the active building's scoped subcollections
  // For SuperAdmin, also fetch lightweight unit lists across all other active buildings in parallel
  // so SuperAdminView displays every condominium's flats, owners, emails, and "Act as resident" buttons!
  const otherActiveRootsForSuper = isSuperAdmin
    ? buildingRootDocs.filter((bDoc) => bDoc && bDoc.id !== primaryBuildingId && bDoc.archived !== true)
    : [];

  const [hydratedActive, otherUnitLists] = await Promise.all([
    primaryBuildingId
      ? hydrateFirestoreBuilding(primaryBuildingId, {
          role: primaryRole,
          uid,
          unitIds: primaryMembership?.unitIds || [],
          accessFromDate,
        })
      : Promise.resolve(null),
    otherActiveRootsForSuper.length > 0
      ? Promise.all(
          otherActiveRootsForSuper.map(async (bDoc) => {
            const uDocs = await fetchScopedUnits(bDoc.id, 'superadmin', uid).catch(() => []);
            return [bDoc.id, uDocs.map(firestoreUnitToUiFlat).filter(Boolean)];
          })
        )
      : Promise.resolve([]),
  ]);

  const superUnitsByBuildingId = new Map(otherUnitLists);

  const buildings = buildingRootDocs.map((bDoc) => {
    if (hydratedActive && bDoc.id === hydratedActive.building.id) {
      return hydratedActive.building;
    }
    const preloadedFlats = superUnitsByBuildingId.get(bDoc.id) || [];
    return firestoreBuildingToUiBuilding(bDoc, { flats: preloadedFlats, hydrated: false });
  });

  const firstOwnedFlat = hydratedActive?.building?.flats?.[0] || null;

  const currentUser = {
    id: uid,
    uid,
    name: userProfile?.name || firebaseUser.displayName || firstOwnedFlat?.ownerName || verifiedEmail,
    email: verifiedEmail,
    role: primaryRole,
    flatNum:
      primaryRole === 'admin' || primaryRole === 'superadmin' || primaryRole === 'szvb' || primaryRole === 'auditor'
        ? '0'
        : (firstOwnedFlat?.flatNum || ''),
    unitId:
      primaryRole === 'admin' || primaryRole === 'superadmin' || primaryRole === 'szvb' || primaryRole === 'auditor'
        ? null
        : (firstOwnedFlat?.unitId || primaryMembership?.unitIds?.[0] || null),
    buildingId: primaryBuildingId,
    isAdminUser: primaryRole === 'admin' || primaryRole === 'superadmin',
    isSuperAdmin: Boolean(isSuperAdmin),
    accessFromDate,
    memberships: rawMemberships,
  };

  return {
    currentUser,
    buildings,
    activeBuilding: hydratedActive?.building || buildings[0] || null,
    users: hydratedActive?.users || [],
    organizations,
    notifications: userNotifications,
    emailRules,
    emailOutbox,
    calendarEvents: hydratedActive?.calendarEvents || [],
    txPagination: hydratedActive?.txPagination || { cursorDoc: null, hasMore: false },
    repProfile: userProfile?.repProfile || null,
    globalSettings: userProfile?.globalSettings || null,
    preferredLang: userProfile?.preferredLang || null,
  };
}
