/**
 * Pure, Deterministic Financial Math & Validation Engine for Cloud Firestore
 *
 * Shared between Cloud Functions atomic transactions and migration/parity verification
 * so that 100% of unit balances, building KK/FA reserves, aggregated arrears totals,
 * and monthly rollups are computed identically everywhere.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_KINDS = new Set(['payment', 'expense', 'debit', 'assessment', 'transfer', 'correction']);
const ALLOWED_DIRECTIONS = new Set(['credit', 'debit']);
const ALLOWED_PAYMENT_METHODS = new Set(['bank_transfer', 'cash', 'offset', 'system_assessment']);
const ALLOWED_STATUSES = new Set(['verified', 'pending', 'voided']);

/**
 * Normalize legacy Hungarian/English fund labels to canonical keys ('KK', 'FA', or custom account ID).
 */
export function normalizeFundKey(fund) {
  if (!fund) return 'KK';
  const str = String(fund).trim();
  if (str === 'KK' || str === 'Közös Költség' || str.toLowerCase() === 'common cost') return 'KK';
  if (str === 'FA' || str === 'Felújítási Alap' || str.toLowerCase() === 'renovation fund') return 'FA';
  return str;
}

/**
 * Deterministic ASCII slug for Firestore unitId from legacy flatNum / unitCode (e.g. "Fsz 1" -> "fsz-1", "II 7-8" -> "ii-7-8").
 */
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

/**
 * Normalize legacy payment method string to canonical enum.
 */
export function normalizePaymentMethod(method, kind = 'payment') {
  if (kind === 'assessment' || kind === 'debit') return 'system_assessment';
  const raw = String(method || '').trim().toLowerCase();
  if (raw === 'cash' || raw === 'készpénz' || raw === 'készpénz (pénztár)' || raw === 'cash (register)') {
    return 'cash';
  }
  if (raw === 'cash offset' || raw === 'offset') {
    return 'offset';
  }
  return 'bank_transfer';
}

/**
 * Strictly validate an incoming transaction payload before entering runTransaction.
 */
export function validateTransactionPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Transaction payload must be an object.');
  }

  const kind = String(raw.kind || 'payment').trim();
  if (!ALLOWED_KINDS.has(kind)) {
    throw new Error(`Invalid transaction kind: ${kind}`);
  }

  const direction = String(raw.direction || (kind === 'payment' ? 'credit' : 'debit')).trim();
  if (!ALLOWED_DIRECTIONS.has(direction)) {
    throw new Error(`Invalid direction: ${direction}`);
  }

  const amountHuf = Math.round(Number(raw.amountHuf));
  if (!Number.isFinite(amountHuf) || amountHuf <= 0 || amountHuf > 10_000_000_000) {
    throw new Error('amountHuf must be a positive integer within safe bounds.');
  }

  const date = String(raw.date || '').replace(/\./g, '-').trim().slice(0, 10);
  if (!ISO_DATE_RE.test(date)) {
    throw new Error('date must be a valid ISO YYYY-MM-DD string.');
  }

  const year = Number(date.slice(0, 4));
  const yearMonth = date.slice(0, 7);

  const unitId = raw.unitId ? String(raw.unitId).trim() : null;
  const unitCode = unitId ? String(raw.unitCode || unitId).trim().slice(0, 64) : null;

  // GDPR INVARIANT: visibility === 'building' is ONLY permitted when unitId === null
  const visibility = unitId ? 'unit' : 'building';

  const fund = normalizeFundKey(raw.fund || raw.targetAccount || 'KK');
  const paymentMethod = ALLOWED_PAYMENT_METHODS.has(raw.paymentMethod)
    ? raw.paymentMethod
    : normalizePaymentMethod(raw.paymentMethod || raw.method, kind);

  const status = ALLOWED_STATUSES.has(raw.status) ? raw.status : 'verified';

  const isCash = paymentMethod === 'cash' || paymentMethod === 'offset';
  const defaultAffectsBank = !isCash && kind !== 'assessment' && kind !== 'debit' && kind !== 'correction';
  const affectsBankBalance = raw.affectsBankBalance !== undefined ? Boolean(raw.affectsBankBalance) : defaultAffectsBank;
  const includeInFlatBalance = raw.includeInFlatBalance !== undefined ? Boolean(raw.includeInFlatBalance) : Boolean(unitId);

  const categoryId = String(raw.categoryId || (direction === 'credit' ? 'cat-inc-other' : 'cat-exp-other')).trim().slice(0, 80);
  const comment = String(raw.comment || '').trim().slice(0, 500);
  const provider = raw.provider ? String(raw.provider).trim().slice(0, 160) : '';
  const title = raw.title ? String(raw.title).trim().slice(0, 160) : '';
  const bankTxId = raw.bankTxId ? String(raw.bankTxId).trim().slice(0, 128) : null;
  const loanId = raw.loanId ? String(raw.loanId).trim().slice(0, 128) : null;
  const transferGroupId = raw.transferGroupId ? String(raw.transferGroupId).trim().slice(0, 128) : null;
  const source = String(raw.source || 'manual').trim().slice(0, 40);

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments.slice(0, 10).map((att) => ({
        id: String(att.id || ''),
        name: String(att.name || '').slice(0, 200),
        mimeType: String(att.mimeType || 'application/octet-stream').slice(0, 100),
        sizeBytes: Math.max(0, Math.round(Number(att.sizeBytes) || 0)),
        storagePath: String(att.storagePath || '').slice(0, 500),
      }))
    : [];

  const sanitized = {
    kind,
    visibility,
    unitId,
    unitCode,
    categoryId,
    fund,
    direction,
    amountHuf,
    date,
    year,
    yearMonth,
    paymentMethod,
    affectsBankBalance,
    includeInFlatBalance,
    status,
    provider,
    title,
    comment,
    bankTxId,
    loanId,
    transferGroupId,
    source,
    attachments,
  };

  const impacts = computeTxImpacts(sanitized);
  return {
    ...sanitized,
    signedUnitDeltaHuf: impacts.signedUnitDeltaHuf,
    signedBankDeltaHuf: impacts.signedBankDeltaHuf,
  };
}

/**
 * Compute exact unit ledger delta, building bank reserve delta, and monthly summary inflow/outflow deltas.
 * Matches legacy finances.js formulas 100% (including cash offset & correction exclusions).
 */
export function computeTxImpacts(txData) {
  const amt = Math.abs(Math.round(Number(txData.amountHuf) || 0));
  if (amt <= 0) {
    return {
      signedUnitDeltaHuf: 0,
      signedBankDeltaHuf: 0,
      monthlyInflowDelta: 0,
      monthlyOutflowDelta: 0,
      requiredDelta: 0,
      paidDelta: 0,
    };
  }

  const isVerified = txData.status === 'verified';
  const isCash = txData.paymentMethod === 'cash' || txData.paymentMethod === 'offset';

  const isBankMovement =
    isVerified &&
    txData.affectsBankBalance !== false &&
    !isCash &&
    txData.kind !== 'assessment' &&
    txData.kind !== 'debit' &&
    txData.kind !== 'correction';

  const signedUnitDeltaHuf =
    txData.unitId && isVerified && txData.includeInFlatBalance !== false
      ? (txData.direction === 'credit' ? amt : -amt)
      : 0;

  const signedBankDeltaHuf = isBankMovement
    ? (txData.direction === 'credit' ? amt : -amt)
    : 0;

  // Inter-account transfers (kind === 'transfer') adjust bank balances & fund inflows (netting to 0 across paired legs)
  // without artificially inflating building expenses (monthlyOutflowDelta).
  const isTransfer = txData.kind === 'transfer';
  const monthlyInflowDelta = isBankMovement
    ? (txData.direction === 'credit' ? amt : (isTransfer ? -amt : 0))
    : 0;
  const monthlyOutflowDelta = isBankMovement && txData.direction === 'debit' && !isTransfer ? amt : 0;

  const requiredDelta =
    txData.unitId && isVerified && txData.includeInFlatBalance !== false && txData.direction === 'debit'
      ? amt
      : 0;
  const paidDelta =
    txData.unitId && isVerified && txData.includeInFlatBalance !== false && txData.direction === 'credit'
      ? amt
      : 0;

  return {
    signedUnitDeltaHuf,
    signedBankDeltaHuf,
    monthlyInflowDelta,
    monthlyOutflowDelta,
    requiredDelta,
    paidDelta,
  };
}

/**
 * Compute a unit's exact contribution to building-level GDPR aggregates.
 */
export function computeUnitArrearsContribution(balances = {}) {
  const kk = Math.round(Number(balances.KK) || 0);
  const fa = Math.round(Number(balances.FA) || 0);
  const customMap = balances.custom && typeof balances.custom === 'object' ? balances.custom : {};
  const customSum = Object.values(customMap).reduce((sum, v) => sum + Math.round(Number(v) || 0), 0);
  const total = kk + fa + customSum;

  return {
    total,
    isDebtor: total < 0,
    totalDebt: total < 0 ? Math.abs(total) : 0,
    kkDebt: kk < 0 ? Math.abs(kk) : 0,
    faDebt: fa < 0 ? Math.abs(fa) : 0,
    overpayment: total > 0 ? total : 0,
  };
}

/**
 * Apply a signed balance delta to a unit's balances map immutably.
 */
export function applyUnitBalanceDelta(currentBalances = {}, fundKey, unitDeltaHuf, requiredDelta = 0, paidDelta = 0) {
  const next = {
    initialKK: Math.round(Number(currentBalances.initialKK) || 0),
    initialFA: Math.round(Number(currentBalances.initialFA) || 0),
    customInitial: { ...(currentBalances.customInitial || {}) },
    KK: Math.round(Number(currentBalances.KK) || 0),
    FA: Math.round(Number(currentBalances.FA) || 0),
    custom: { ...(currentBalances.custom || {}) },
    totalRequiredKK: Math.round(Number(currentBalances.totalRequiredKK) || 0),
    totalPaidKK: Math.round(Number(currentBalances.totalPaidKK) || 0),
    totalRequiredFA: Math.round(Number(currentBalances.totalRequiredFA) || 0),
    totalPaidFA: Math.round(Number(currentBalances.totalPaidFA) || 0),
  };

  const canonicalFund = normalizeFundKey(fundKey);
  if (canonicalFund === 'KK') {
    next.KK += Math.round(unitDeltaHuf);
    next.totalRequiredKK += Math.round(requiredDelta);
    next.totalPaidKK += Math.round(paidDelta);
  } else if (canonicalFund === 'FA') {
    next.FA += Math.round(unitDeltaHuf);
    next.totalRequiredFA += Math.round(requiredDelta);
    next.totalPaidFA += Math.round(paidDelta);
  } else {
    next.custom[canonicalFund] = Math.round(Number(next.custom[canonicalFund]) || 0) + Math.round(unitDeltaHuf);
  }

  const contrib = computeUnitArrearsContribution(next);
  next.total = contrib.total;
  next.isDebtor = contrib.isDebtor;
  return next;
}

/**
 * Apply a signed bank movement delta to a building's balances map immutably.
 */
export function applyBuildingBankDelta(currentBalances = {}, fundKey, bankDeltaHuf) {
  const next = {
    KK: Math.round(Number(currentBalances.KK) || 0),
    FA: Math.round(Number(currentBalances.FA) || 0),
    custom: { ...(currentBalances.custom || {}) },
  };

  const canonicalFund = normalizeFundKey(fundKey);
  if (canonicalFund === 'KK') {
    next.KK += Math.round(bankDeltaHuf);
  } else if (canonicalFund === 'FA') {
    next.FA += Math.round(bankDeltaHuf);
  } else {
    next.custom[canonicalFund] = Math.round(Number(next.custom[canonicalFund]) || 0) + Math.round(bankDeltaHuf);
  }

  const customSum = Object.values(next.custom).reduce((s, v) => s + Math.round(Number(v) || 0), 0);
  next.totalReserve = next.KK + next.FA + customSum;
  return next;
}

/**
 * Apply O(1) net arrears deltas across one or more affected units to building.aggregates.
 * @param {object} currentAggregates
 * @param {Array<{ before: object, after: object }>} unitTransitions
 */
export function applyAggregatesTransitions(currentAggregates = {}, unitTransitions = []) {
  const next = {
    totalArrearsHuf: Math.round(Number(currentAggregates.totalArrearsHuf) || 0),
    totalArrearsKK: Math.round(Number(currentAggregates.totalArrearsKK) || 0),
    totalArrearsFA: Math.round(Number(currentAggregates.totalArrearsFA) || 0),
    totalOverpaymentHuf: Math.round(Number(currentAggregates.totalOverpaymentHuf) || 0),
    debtorUnitCount: Math.round(Number(currentAggregates.debtorUnitCount) || 0),
    settledUnitCount: Math.round(Number(currentAggregates.settledUnitCount) || 0),
    totalUnitCount: Math.round(Number(currentAggregates.totalUnitCount) || 0),
  };

  for (const { before, after } of unitTransitions) {
    const b = computeUnitArrearsContribution(before);
    const a = computeUnitArrearsContribution(after);
    next.totalArrearsHuf = Math.max(0, next.totalArrearsHuf + (a.totalDebt - b.totalDebt));
    next.totalArrearsKK = Math.max(0, next.totalArrearsKK + (a.kkDebt - b.kkDebt));
    next.totalArrearsFA = Math.max(0, next.totalArrearsFA + (a.faDebt - b.faDebt));
    next.totalOverpaymentHuf = Math.max(0, next.totalOverpaymentHuf + (a.overpayment - b.overpayment));

    const debtorDelta = (a.isDebtor ? 1 : 0) - (b.isDebtor ? 1 : 0);
    next.debtorUnitCount = Math.max(0, next.debtorUnitCount + debtorDelta);
    next.settledUnitCount = Math.max(0, next.settledUnitCount - debtorDelta);
  }

  return next;
}

/**
 * Apply monthly inflow/outflow deltas to a monthlySummaries/{YYYY-MM} document immutably.
 */
export function applyMonthlySummaryDelta(currentSummary, yearMonth, fundKey, inflowDelta, outflowDelta) {
  const [yStr, mStr] = String(yearMonth).split('-');
  const canonicalFund = normalizeFundKey(fundKey);

  const inflowByFund = {
    KK: Math.round(Number(currentSummary?.inflowByFund?.KK) || 0),
    FA: Math.round(Number(currentSummary?.inflowByFund?.FA) || 0),
    ...(currentSummary?.inflowByFund || {}),
  };
  const outflowByFund = {
    KK: Math.round(Number(currentSummary?.outflowByFund?.KK) || 0),
    FA: Math.round(Number(currentSummary?.outflowByFund?.FA) || 0),
    ...(currentSummary?.outflowByFund || {}),
  };

  inflowByFund[canonicalFund] = Math.round(Number(inflowByFund[canonicalFund]) || 0) + Math.round(inflowDelta);
  outflowByFund[canonicalFund] = Math.round(Number(outflowByFund[canonicalFund]) || 0) + Math.round(outflowDelta);

  const totalInflowHuf = Math.round(Number(currentSummary?.totalInflowHuf) || 0) + Math.round(inflowDelta);
  const totalOutflowHuf = Math.round(Number(currentSummary?.totalOutflowHuf) || 0) + Math.round(outflowDelta);

  return {
    yearMonth,
    year: Number(yStr),
    month: Number(mStr),
    totalInflowHuf,
    totalOutflowHuf,
    netMarginHuf: totalInflowHuf - totalOutflowHuf,
    inflowByFund,
    outflowByFund,
  };
}

/**
 * Resolve a unit's effective monthly fee for a given YYYY-MM-01 date and fund,
 * matching getFlatLedgerTimeline in src/utils/finances.js 100%.
 */
export function getEffectiveUnitFeeForMonth(unit, fundKey, monthDateStr) {
  const canonicalFund = normalizeFundKey(fundKey);
  const targetDate = new Date(monthDateStr);
  const fees = unit?.fees || {};

  let baseFee = 0;
  let changes = [];

  if (canonicalFund === 'KK') {
    baseFee = Number(fees.monthlyFeeKK ?? unit?.monthlyFee ?? 0) || 0;
    changes = fees.feeChangesKK || unit?.feeChangesKK || [];
  } else if (canonicalFund === 'FA') {
    baseFee = Number(fees.monthlyFeeFA ?? unit?.renovationFee ?? 0) || 0;
    changes = fees.feeChangesFA || unit?.feeChangesFA || [];
  } else {
    baseFee = Number(fees.customFees?.[canonicalFund] ?? unit?.customFees?.[canonicalFund] ?? 0) || 0;
    changes = fees.customFeeChanges?.[canonicalFund] || unit?.customFeeChanges?.[canonicalFund] || [];
  }

  if (Array.isArray(changes) && changes.length > 0) {
    const active = changes
      .filter((c) => c && c.date && new Date(c.date) <= targetDate)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    if (active.length > 0 && active[0].amount !== undefined && active[0].amount !== null) {
      return Math.round(Number(active[0].amount) || 0);
    }
  }

  return Math.round(baseFee);
}
