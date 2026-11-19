/**
 * Automated Unit Tests for:
 *   1. Atomic Firestore Financial Mutations (create, update, cross-unit/fund/month move, delete, calibrate)
 *   2. Idempotent Monthly Assessment Generation
 *   3. RTDB -> Cloud Firestore Transformer & 0-Ft Parity Verifier (zero PII/secret/Base64 leaks)
 *
 * Runs locally on Node.js built-in test runner (`node --test tests/atomicTransactions.test.mjs`)
 * with ZERO network access and ZERO live Firebase writes (Rule 3 compliant).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  executeCreateTransaction,
  executeUpdateTransaction,
  executeDeleteTransaction,
  executeCalibrateBalances,
} from '../functions/src/transactions.js';
import { executeGenerateMonthlyAssessments } from '../functions/src/assessments.js';
import {
  transformRtdbSnapshotToFirestore,
  verifyFirestoreParityAgainstLegacy,
} from '../scripts/rtdbToFirestoreTransform.js';

/**
 * ACID-compliant in-memory Firestore simulator verifying:
 *   - Strict Read-Before-Write ordering (throws if tx.get() is called after a write!)
 *   - Atomic rollback on any error inside runTransaction
 *   - Support for doc(), collection().get(), collection().where().get()
 */
function createInMemoryFirestore(initialDocs = {}) {
  let store = new Map();
  for (const [k, v] of Object.entries(initialDocs)) {
    store.set(k, JSON.parse(JSON.stringify(v)));
  }

  const FieldValue = {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  };

  const makeSnap = (path, mapRef) => ({
    id: path.split('/').pop(),
    ref: { path },
    exists: mapRef.has(path),
    data: () => (mapRef.has(path) ? JSON.parse(JSON.stringify(mapRef.get(path))) : undefined),
  });

  const db = {
    _store: store,
    doc(path) {
      return {
        path,
        async get() {
          return makeSnap(path, store);
        },
      };
    },
    collection(colPath) {
      const filters = [];
      const queryObj = {
        where(field, op, value) {
          filters.push({ field, op, value });
          return queryObj;
        },
        async get() {
          const prefix = `${colPath}/`;
          const docs = [];
          for (const [p, val] of store.entries()) {
            if (!p.startsWith(prefix)) continue;
            const remainder = p.slice(prefix.length);
            if (remainder.includes('/')) continue; // direct children only
            const passes = filters.every((f) => f.op === '==' && val[f.field] === f.value);
            if (passes) {
              docs.push(makeSnap(p, store));
            }
          }
          return { docs, forEach: (fn) => docs.forEach(fn) };
        },
      };
      return queryObj;
    },
    async runTransaction(fn) {
      const staged = new Map();
      for (const [k, v] of store.entries()) {
        staged.set(k, JSON.parse(JSON.stringify(v)));
      }
      let writeStarted = false;
      const pendingOps = [];

      const tx = {
        async get(docRef) {
          if (writeStarted) {
            throw new Error('Firestore rule violation: All tx.get() calls MUST happen before any writes!');
          }
          return makeSnap(docRef.path, staged);
        },
        set(docRef, data, opts = {}) {
          writeStarted = true;
          pendingOps.push({ type: 'set', path: docRef.path, data: JSON.parse(JSON.stringify(data)), merge: Boolean(opts.merge) });
        },
        update(docRef, data) {
          writeStarted = true;
          pendingOps.push({ type: 'update', path: docRef.path, data: JSON.parse(JSON.stringify(data)) });
        },
        delete(docRef) {
          writeStarted = true;
          pendingOps.push({ type: 'delete', path: docRef.path });
        },
      };

      const result = await fn(tx);

      // Commit staged ops atomically ONLY if fn(tx) succeeded without throwing
      for (const op of pendingOps) {
        if (op.type === 'set') {
          if (op.merge && staged.has(op.path)) {
            staged.set(op.path, { ...staged.get(op.path), ...op.data });
          } else {
            staged.set(op.path, op.data);
          }
        } else if (op.type === 'update') {
          if (!staged.has(op.path)) throw new Error(`Cannot update non-existent doc: ${op.path}`);
          staged.set(op.path, { ...staged.get(op.path), ...op.data });
        } else if (op.type === 'delete') {
          staged.delete(op.path);
        }
      }

      store = staged;
      db._store = store;
      return result;
    },
  };

  return { db, FieldValue };
}

function seedTwoUnitBuilding() {
  return createInMemoryFirestore({
    'buildings/b-demo': {
      id: 'b-demo',
      name: 'Példa utca 1. Társasház',
      bankAccounts: { KK: { shortName: 'KK' }, FA: { shortName: 'FA' }, custom: [] },
      initialReserves: { KK: 1_000_000, FA: 500_000, custom: {} },
      balances: { KK: 1_000_000, FA: 500_000, custom: {}, totalReserve: 1_500_000 },
      aggregates: {
        totalArrearsHuf: 40_000,
        totalArrearsKK: 30_000,
        totalArrearsFA: 10_000,
        totalOverpaymentHuf: 0,
        debtorUnitCount: 1,
        settledUnitCount: 1,
        totalUnitCount: 2,
      },
    },
    'buildings/b-demo/units/fsz-1': {
      id: 'fsz-1',
      unitCode: 'Fsz 1',
      ownerUids: ['uid-owner-1'],
      fees: {
        startDateKK: '2026-09-01',
        startDateFA: '2026-06-01',
        monthlyFeeKK: 30_000,
        monthlyFeeFA: 10_000,
        feeChangesKK: [],
        feeChangesFA: [],
      },
      balances: {
        initialKK: -30_000,
        initialFA: -10_000,
        customInitial: {},
        KK: -30_000,
        FA: -10_000,
        custom: {},
        total: -40_000,
        isDebtor: true,
        totalRequiredKK: 30_000,
        totalPaidKK: 0,
        totalRequiredFA: 10_000,
        totalPaidFA: 0,
      },
    },
    'buildings/b-demo/units/fsz-2': {
      id: 'fsz-2',
      unitCode: 'Fsz 2',
      ownerUids: ['uid-owner-2'],
      fees: {
        startDateKK: '2026-09-01',
        startDateFA: '2026-06-01',
        monthlyFeeKK: 25_000,
        monthlyFeeFA: 8_000,
        feeChangesKK: [],
        feeChangesFA: [],
      },
      balances: {
        initialKK: 0,
        initialFA: 0,
        customInitial: {},
        KK: 0,
        FA: 0,
        custom: {},
        total: 0,
        isDebtor: false,
        totalRequiredKK: 0,
        totalPaidKK: 0,
        totalRequiredFA: 0,
        totalPaidFA: 0,
      },
    },
  });
}

const ADMIN_ACTOR = { uid: 'uid-admin', email: 'admin@example.com', role: 'admin' };

test('Atomic CREATE payment settles unit arrears, updates KK bank reserve, monthly summary & immutable audit log', async () => {
  const { db, FieldValue } = seedTwoUnitBuilding();

  const res = await executeCreateTransaction(
    db,
    FieldValue,
    'b-demo',
    {
      id: 'tx-pay-1',
      kind: 'payment',
      unitId: 'fsz-1',
      fund: 'KK',
      direction: 'credit',
      amountHuf: 40_000,
      date: '2026-10-15',
      paymentMethod: 'bank_transfer',
      comment: 'KK és FA rendezés',
    },
    ADMIN_ACTOR
  );

  assert.equal(res.success, true);
  assert.equal(res.duplicate, false);

  const unit1 = db._store.get('buildings/b-demo/units/fsz-1');
  const bld = db._store.get('buildings/b-demo');
  const summary = db._store.get('buildings/b-demo/monthlySummaries/2026-10');
  const audit = db._store.get(`buildings/b-demo/auditLogs/${res.auditLogId}`);

  // Unit 1: KK went from -30k -> +10k, FA remains -10k, total = 0 (settled!)
  assert.equal(unit1.balances.KK, 10_000);
  assert.equal(unit1.balances.FA, -10_000);
  assert.equal(unit1.balances.total, 0);
  assert.equal(unit1.balances.isDebtor, false);

  // Building: KK reserve +40k, totalArrearsHuf went 40k -> 0, debtorUnitCount 1 -> 0, settledUnitCount 1 -> 2
  assert.equal(bld.balances.KK, 1_040_000);
  assert.equal(bld.balances.totalReserve, 1_540_000);
  assert.equal(bld.aggregates.totalArrearsHuf, 0);
  assert.equal(bld.aggregates.totalArrearsKK, 0);
  assert.equal(bld.aggregates.totalArrearsFA, 10_000);
  assert.equal(bld.aggregates.debtorUnitCount, 0);
  assert.equal(bld.aggregates.settledUnitCount, 2);

  // Monthly summary & Audit log
  assert.equal(summary.totalInflowHuf, 40_000);
  assert.equal(summary.netMarginHuf, 40_000);
  assert.equal(audit.action, 'tx.create');
  assert.equal(audit.actorUid, 'uid-admin');
  assert.equal(audit.deltas.buildingArrearsDeltaHuf, -40_000);

  // Idempotency: re-submitting same deterministic txId must NOT double-credit!
  const dupRes = await executeCreateTransaction(
    db,
    FieldValue,
    'b-demo',
    {
      id: 'tx-pay-1',
      kind: 'payment',
      unitId: 'fsz-1',
      fund: 'KK',
      direction: 'credit',
      amountHuf: 40_000,
      date: '2026-10-15',
    },
    ADMIN_ACTOR
  );
  assert.equal(dupRes.duplicate, true);
  assert.equal(db._store.get('buildings/b-demo').balances.KK, 1_040_000);
});

test('Atomic UPDATE moving transaction across units, funds, and months keeps 0-Ft consistency', async () => {
  const { db, FieldValue } = seedTwoUnitBuilding();

  // Create initial 30k KK payment on fsz-1 in 2026-10
  await executeCreateTransaction(
    db,
    FieldValue,
    'b-demo',
    {
      id: 'tx-move-1',
      kind: 'payment',
      unitId: 'fsz-1',
      fund: 'KK',
      direction: 'credit',
      amountHuf: 30_000,
      date: '2026-10-10',
      paymentMethod: 'bank_transfer',
    },
    ADMIN_ACTOR
  );

  // Move that payment from fsz-1 (KK, 2026-10) -> fsz-2 (FA, 2026-11) with amount 20,000 HUF
  const upd = await executeUpdateTransaction(
    db,
    FieldValue,
    'b-demo',
    'tx-move-1',
    {
      kind: 'payment',
      unitId: 'fsz-2',
      fund: 'FA',
      direction: 'credit',
      amountHuf: 20_000,
      date: '2026-11-02',
      paymentMethod: 'bank_transfer',
    },
    ADMIN_ACTOR
  );

  assert.equal(upd.success, true);

  const u1 = db._store.get('buildings/b-demo/units/fsz-1');
  const u2 = db._store.get('buildings/b-demo/units/fsz-2');
  const bld = db._store.get('buildings/b-demo');
  const oct = db._store.get('buildings/b-demo/monthlySummaries/2026-10');
  const nov = db._store.get('buildings/b-demo/monthlySummaries/2026-11');

  // fsz-1 reverted completely back to -30k KK / -10k FA / -40k total
  assert.equal(u1.balances.KK, -30_000);
  assert.equal(u1.balances.total, -40_000);

  // fsz-2 gained +20k FA (overpayment = 20k)
  assert.equal(u2.balances.FA, 20_000);
  assert.equal(u2.balances.total, 20_000);

  // Building KK back to 1,000,000; FA now 520,000; arrears back to 40,000; overpayment = 20,000
  assert.equal(bld.balances.KK, 1_000_000);
  assert.equal(bld.balances.FA, 520_000);
  assert.equal(bld.balances.totalReserve, 1_520_000);
  assert.equal(bld.aggregates.totalArrearsHuf, 40_000);
  assert.equal(bld.aggregates.totalOverpaymentHuf, 20_000);

  // Monthly rollups cleanly shifted from Oct -> Nov
  assert.equal(oct.totalInflowHuf, 0);
  assert.equal(nov.totalInflowHuf, 20_000);
});

test('Atomic DELETE reverses cash vs bank impacts accurately and preserves deleted snapshot in auditLog', async () => {
  const { db, FieldValue } = seedTwoUnitBuilding();

  // Cash payment credits flat but MUST NOT change bank reserve!
  await executeCreateTransaction(
    db,
    FieldValue,
    'b-demo',
    {
      id: 'tx-cash-1',
      kind: 'payment',
      unitId: 'fsz-1',
      fund: 'FA',
      direction: 'credit',
      amountHuf: 10_000,
      date: '2026-10-12',
      paymentMethod: 'cash',
      comment: 'Készpénzes befizetés',
    },
    ADMIN_ACTOR
  );

  assert.equal(db._store.get('buildings/b-demo').balances.FA, 500_000); // Bank untouched
  assert.equal(db._store.get('buildings/b-demo/units/fsz-1').balances.FA, 0);
  assert.equal(db._store.get('buildings/b-demo').aggregates.totalArrearsHuf, 30_000);

  // Delete cash payment -> reverts flat & arrears back to initial state
  const del = await executeDeleteTransaction(db, FieldValue, 'b-demo', 'tx-cash-1', 'Hibás rögzítés', ADMIN_ACTOR);
  assert.equal(del.success, true);
  assert.equal(db._store.has('buildings/b-demo/transactions/tx-cash-1'), false);
  assert.equal(db._store.get('buildings/b-demo/units/fsz-1').balances.FA, -10_000);
  assert.equal(db._store.get('buildings/b-demo').aggregates.totalArrearsHuf, 40_000);

  const audit = db._store.get(`buildings/b-demo/auditLogs/${del.auditLogId}`);
  assert.equal(audit.action, 'tx.delete');
  assert.equal(audit.before.amountHuf, 10_000);
  assert.equal(audit.after, null);
});

test('Atomic CALIBRATE shifts initialReserves and writes auditLog', async () => {
  const { db, FieldValue } = seedTwoUnitBuilding();
  const res = await executeCalibrateBalances(
    db,
    FieldValue,
    'b-demo',
    { targetKK: 1_250_000, targetFA: 600_000 },
    ADMIN_ACTOR
  );

  assert.equal(res.success, true);
  assert.equal(db._store.get('buildings/b-demo').balances.KK, 1_250_000);
  assert.equal(db._store.get('buildings/b-demo').initialReserves.KK, 1_250_000);
  assert.equal(db._store.get('buildings/b-demo').balances.totalReserve, 1_850_000);
  assert.equal(db._store.get(`buildings/b-demo/auditLogs/${res.auditLogId}`).action, 'balance.calibrate');
});

test('Idempotent Monthly Assessment Generator bills each unit once and skips duplicates on re-run', async () => {
  const { db, FieldValue } = seedTwoUnitBuilding();

  const firstRun = await executeGenerateMonthlyAssessments(db, FieldValue, 'b-demo', '2026-11', ADMIN_ACTOR);
  assert.equal(firstRun.createdCount, 4); // 2 units x (KK + FA)
  assert.equal(firstRun.skippedCount, 0);

  // fsz-1: -40k - 30k - 10k = -80k; fsz-2: 0 - 25k - 8k = -33k -> totalArrearsHuf = 113,000
  assert.equal(db._store.get('buildings/b-demo').aggregates.totalArrearsHuf, 113_000);
  assert.equal(db._store.get('buildings/b-demo').aggregates.debtorUnitCount, 2);
  // Bank reserves unchanged by monthly assessments!
  assert.equal(db._store.get('buildings/b-demo').balances.totalReserve, 1_500_000);

  // Second run for same month MUST create 0 new assessments and skip all 4!
  const secondRun = await executeGenerateMonthlyAssessments(db, FieldValue, 'b-demo', '2026-11', ADMIN_ACTOR);
  assert.equal(secondRun.createdCount, 0);
  assert.equal(secondRun.skippedCount, 4);
  assert.equal(db._store.get('buildings/b-demo').aggregates.totalArrearsHuf, 113_000);
});

test('RTDB -> Cloud Firestore Transformer achieves exact 0-Ft parity with legacy finances.js & strips all secrets/Base64', () => {
  // Synthetic anonymized pilot-like RTDB dataset exercising ALL edge cases:
  // fee changes, cancelled debits, cash offset, manual special assessments, custom sub-account, loans, secrets, Base64 doc
  const mockRtdb = {
    currentLang: 'hu',
    users: [
      { id: 'superadmin', name: 'Super Admin', email: 'super@example.com', role: 'superadmin', pass: 'OLD_SECRET_1' },
      { id: 'admin', name: 'Közös Képviselő', email: 'rep@example.com', role: 'admin', buildingId: 'b-pilot', pass: 'OLD_SECRET_2' },
      { id: 'Fsz 1', name: 'Minta Anna', email: 'anna@example.com', role: 'Owner', flatNum: 'Fsz 1', buildingId: 'b-pilot', pass: 'OLD_SECRET_3', resetToken: 'rst_old' },
      { id: 'Fsz 2', name: 'Minta Béla', email: 'bela@example.com', role: 'Owner', flatNum: 'Fsz 2', buildingId: 'b-pilot', pass: 'OLD_SECRET_4' },
    ],
    buildings: [
      {
        id: 'b-pilot',
        name: 'Példa utca 10. Társasház',
        address: '1051 Budapest, Példa utca 10.',
        taxNumber: '12345678-1-41',
        repName: 'Közös Képviselő',
        email: 'rep@example.com',
        phone: '+36 20 123 4567',
        bankKK: { name: 'Példa utca 10. Társasház', account: '11700000 00000001', bank: 'OTP' },
        bankFA: { name: 'Példa utca 10. Társasház', account: '11700000 00000002', bank: 'OTP' },
        bankApi: { provider: 'OTP CorpAPI', environment: 'sandbox', clientId: 'corp-01', apiKey: 'LEAKED_KEY_TO_STRIP' },
        customBankAccounts: [
          { id: 'acc-lift', name: 'Lift Alap', shortName: 'LIFT', account: '11700000 00000003', bank: 'OTP', hasMonthlyFee: true, initialReserve: 100_000 },
        ],
        buildingInitialReserveCommon: 1_200_000,
        buildingInitialReserveRenovation: 951_300,
        flats: [
          {
            flatNum: 'Fsz 1',
            unitType: 'flat',
            ownerName: 'Minta Anna',
            email: 'anna@example.com',
            pass: 'FLAT_PASS_TO_STRIP',
            startDateKK: '2026-09-01',
            startDateFA: '2026-06-01',
            monthlyFee: 24_000,
            renovationFee: 5_981,
            initialBalance: -12_000,
            initialRenovationBalance: -11_962,
            feeChangesKK: [{ date: '2026-10-01', amount: 26_000 }],
            cancelledDebits: ['2026-09-01_Közös Költség'],
            customFees: { 'acc-lift': 2_000 },
            customInitialBalances: { 'acc-lift': 0 },
            owners: [{ id: 'o1', role: 'owner', name: 'Minta Anna', share: '1/1', email: 'anna@example.com', isBoardMember: true, bankAccounts: ['11700000-11111111'] }],
            tenants: [{ id: 't1', name: 'Bérlő Géza', isActive: true, payerName: 'Bérlő Géza', bankAccounts: ['11700000-22222222'] }],
            meters: [{ id: 'm1', serialNumber: 'W-001', type: 'cold_water', currentReading: 120 }],
            garages: [{ number: '1', area: 15 }],
          },
          {
            flatNum: 'Fsz 2',
            unitType: 'flat',
            ownerName: 'Minta Béla',
            email: 'bela@example.com',
            startDateKK: '2026-09-01',
            startDateFA: '2026-06-01',
            monthlyFee: 18_000,
            renovationFee: 4_214,
            initialBalance: 0,
            initialRenovationBalance: -4_214,
            customFees: { 'acc-lift': 2_000 },
            customInitialBalances: { 'acc-lift': 0 },
          },
        ],
        transactions: [
          { id: 't-1', flatNum: 'Fsz 1', date: '2026-09-10', amount: 54_066, targetAccount: 'Felújítási Alap', method: 'Bank Transfer', status: 'Verified', includeInBalance: true, affectsBankBalance: true },
          { id: 't-2', flatNum: 'Fsz 2', date: '2026-07-17', amount: 12_000, targetAccount: 'Felújítási Alap', method: 'Készpénz', status: 'Verified', includeInBalance: true, affectsBankBalance: false, comment: 'Kuka mozgatási díj KP' },
          { id: 't-3', flatNum: 'Fsz 1', date: '2026-10-05', amount: 30_000, targetAccount: 'Közös Költség', method: 'Bank Transfer', status: 'Verified', includeInBalance: true, affectsBankBalance: true },
          { id: 't-4', flatNum: 'Global', date: '2026-10-01', amount: 150, targetAccount: 'Felújítási Alap', method: 'Bank Transfer', status: 'Verified', includeInBalance: true, affectsBankBalance: true, comment: 'Banki kamat' },
          { id: 't-5', flatNum: 'Fsz 1', date: '2026-10-08', amount: 4_000, targetAccount: 'acc-lift', method: 'Bank Transfer', status: 'Verified', includeInBalance: true, affectsBankBalance: true },
          { id: 't-xfer-from', flatNum: 'Fsz 2', date: '2026-10-16', amount: -10_000, targetAccount: 'Közös Költség', method: 'Bank Transfer', status: 'Verified', includeInBalance: true, affectsBankBalance: true, includeInFlatBalance: true },
          { id: 't-xfer-to', flatNum: 'Fsz 2', date: '2026-10-16', amount: 10_000, targetAccount: 'Felújítási Alap', method: 'Bank Transfer', status: 'Verified', includeInBalance: true, affectsBankBalance: true, includeInFlatBalance: true },
        ],
        expenses: [
          { id: 'e-1', date: '2026-10-12', amount: 45_000, targetAccount: 'Közös Költség', provider: 'MVM', category: 'Utility', includeInBalance: true, affectsBankBalance: true },
        ],
        manualDebits: [
          { id: 'md-gate-1', flatNum: 'Fsz 1', date: '2026-10-01', amount: 70_290, targetAccount: 'Felújítási Alap', comment: 'Kocsikapu célbefizetés' },
        ],
        loans: [
          {
            id: 'loan-1',
            title: 'Tetőfelújítási hitel',
            status: 'active',
            startDate: '2026-09-01',
            principalAmount: 5_000_000,
            currentBalance: 4_800_000,
            participants: [
              { apartmentId: 'Fsz 1', paymentMethod: 'financed', monthlyContribution: 5_000, totalShare: 2_500_000 },
              { apartmentId: 'Fsz 2', paymentMethod: 'lump_sum', lumpSumAmountPaid: 2_500_000, monthlyContribution: 0 },
            ],
          },
        ],
        documents: [
          {
            id: 'doc-szmsz',
            title: 'SZMSZ',
            fileName: 'szmsz.pdf',
            fileType: 'pdf',
            uploadDate: '2026-01-10',
            fileData: 'data:application/pdf;base64,' + 'A'.repeat(400),
          },
        ],
      },
    ],
  };

  const uidMap = {
    'super@example.com': 'uid-super',
    'rep@example.com': 'uid-rep',
    'anna@example.com': 'uid-anna',
    'bela@example.com': 'uid-bela',
  };

  const plan = transformRtdbSnapshotToFirestore(mockRtdb, { uidByEmailMap: uidMap });
  const parity = verifyFirestoreParityAgainstLegacy(mockRtdb, plan);

  assert.equal(parity.ok, true, `Parity errors: ${parity.discrepancies.join('; ')}`);
  assert.equal(parity.checkedBuildings, 1);
  assert.equal(parity.checkedUnits, 2);

  // Verify RBAC role mapping: Anna has isBoardMember: true -> 'szvb', Béla -> 'owner', Rep -> 'admin'
  assert.equal(plan.buildings['b-pilot'].members['uid-rep'].role, 'admin');
  assert.equal(plan.buildings['b-pilot'].members['uid-anna'].role, 'szvb');
  assert.equal(plan.buildings['b-pilot'].members['uid-bela'].role, 'owner');
  assert.deepEqual(plan.buildings['b-pilot'].units['fsz-1'].ownerUids, ['uid-anna']);
  assert.deepEqual(plan.buildings['b-pilot'].units['fsz-2'].ownerUids, ['uid-bela']);

  // Verify GDPR visibility flags: building expense & Global interest = 'building'; unit payments = 'unit'
  assert.equal(plan.buildings['b-pilot'].transactions['e-1'].visibility, 'building');
  assert.equal(plan.buildings['b-pilot'].transactions['t-4'].visibility, 'building');
  assert.equal(plan.buildings['b-pilot'].transactions['t-1'].visibility, 'unit');

  // Verify owner loan slices copied to own units only
  assert.equal(plan.buildings['b-pilot'].units['fsz-1'].activeLoanShares.length, 1);
  assert.equal(plan.buildings['b-pilot'].units['fsz-1'].activeLoanShares[0].monthlyContributionHuf, 5_000);

  // Verify Base64 PDF was stripped from Firestore doc and queued for Cloud Storage upload!
  assert.equal(plan.storageUploads.length, 1);
  assert.equal(plan.buildings['b-pilot'].documents['doc-szmsz'].fileData, undefined);
  assert.equal(
    plan.buildings['b-pilot'].documents['doc-szmsz'].storagePath,
    'buildings/b-pilot/documents/doc-szmsz/szmsz.pdf'
  );
});
