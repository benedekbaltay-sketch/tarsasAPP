/**
 * Firestore Security Rules (Tht. & GDPR RBAC) Verification Test Suite
 *
 * Tests EVERY cell of the RBAC matrix against the local Firebase Firestore Emulator:
 *   - Unauthenticated -> DENIED everywhere
 *   - SuperAdmin -> Full cross-building read + auditLogs immutable
 *   - Admin (Building A) -> R/W Building A metadata/categories/docs, DENIED on Building B (cross-tenant),
 *                           DENIED on direct financial writes (Option A — Cloud Functions only),
 *                           DENIED on auditLogs update/delete (immutable)
 *   - SZVB (Building A) -> R/O full building (units, all transactions, MonthlyDetail, Loans, auditLogs),
 *                          DENIED on ANY write
 *   - Regular Owner (Unit fsz-1) ->
 *       ALLOWED: read buildings/b-a (reserves + aggregated arrears total), read monthlySummaries,
 *                read OWN unit (fsz-1), update ONLY {phone, emergencyContact, notes} on fsz-1,
 *                read OWN unit transactions (respecting accessFromDate), read building-level expenses
 *       DENIED:  read other unit (fsz-2), list all units without ownerUids filter,
 *                read other unit's transactions, list unfiltered transactions,
 *                read loans/ collection, read auditLogs/, read transactions before accessFromDate,
 *                modify balances/fees/ownerUids on own unit, modify members/
 *
 * Run against Firebase Emulator Suite (requires Java 21+ & `@firebase/rules-unit-testing`):
 *   firebase emulators:exec --only firestore "node --test tests/firestore.rules.test.mjs"
 */

import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

const PROJECT_ID = 'tarsashaz-rules-test';
const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // Seed Building A & Building B
    await setDoc(doc(db, 'buildings/b-a'), {
      id: 'b-a',
      name: 'Building A',
      balances: { KK: 1_000_000, FA: 500_000, totalReserve: 1_500_000 },
      aggregates: { totalArrearsHuf: 45_000, debtorUnitCount: 1, settledUnitCount: 1, totalUnitCount: 2 },
      bankApi: { provider: 'OTP CorpAPI', environment: 'sandbox', clientId: 'corp-a', secretManagedServerSide: true },
    });
    await setDoc(doc(db, 'buildings/b-b'), {
      id: 'b-b',
      name: 'Building B',
      balances: { KK: 200_000, FA: 100_000, totalReserve: 300_000 },
      aggregates: { totalArrearsHuf: 0, debtorUnitCount: 0, settledUnitCount: 1, totalUnitCount: 1 },
    });

    // Memberships
    await setDoc(doc(db, 'buildings/b-a/members/admin-a'), { uid: 'admin-a', role: 'admin', unitIds: [], active: true });
    await setDoc(doc(db, 'buildings/b-a/members/szvb-a'), { uid: 'szvb-a', role: 'szvb', unitIds: [], active: true });
    await setDoc(doc(db, 'buildings/b-a/members/owner-1'), { uid: 'owner-1', role: 'owner', unitIds: ['fsz-1'], active: true, accessFromDate: '2026-06-01' });
    await setDoc(doc(db, 'buildings/b-a/members/owner-2'), { uid: 'owner-2', role: 'owner', unitIds: ['fsz-2'], active: true, accessFromDate: null });

    // Units
    await setDoc(doc(db, 'buildings/b-a/units/fsz-1'), {
      id: 'fsz-1',
      unitCode: 'Fsz 1',
      ownerUids: ['owner-1'],
      phone: '+36 20 111 1111',
      emergencyContact: '',
      notes: '',
      balances: { KK: 0, FA: 0, total: 0 },
    });
    await setDoc(doc(db, 'buildings/b-a/units/fsz-2'), {
      id: 'fsz-2',
      unitCode: 'Fsz 2',
      ownerUids: ['owner-2'],
      phone: '+36 20 222 2222',
      balances: { KK: -45_000, FA: 0, total: -45_000 },
    });

    // Transactions: own (after accessFromDate), own (before accessFromDate — prior owner!), other unit, building expense
    await setDoc(doc(db, 'buildings/b-a/transactions/tx-u1-new'), {
      id: 'tx-u1-new',
      visibility: 'unit',
      unitId: 'fsz-1',
      amountHuf: 25_000,
      date: '2026-09-10',
    });
    await setDoc(doc(db, 'buildings/b-a/transactions/tx-u1-old-owner'), {
      id: 'tx-u1-old-owner',
      visibility: 'unit',
      unitId: 'fsz-1',
      amountHuf: 20_000,
      date: '2026-02-10', // Before owner-1's accessFromDate ('2026-06-01')!
    });
    await setDoc(doc(db, 'buildings/b-a/transactions/tx-u2'), {
      id: 'tx-u2',
      visibility: 'unit',
      unitId: 'fsz-2',
      amountHuf: 30_000,
      date: '2026-09-12',
    });
    await setDoc(doc(db, 'buildings/b-a/transactions/tx-exp-bld'), {
      id: 'tx-exp-bld',
      visibility: 'building',
      unitId: null,
      amountHuf: 48_000,
      date: '2026-09-15',
    });

    // Monthly Summary, Loan, AuditLog, Users
    await setDoc(doc(db, 'buildings/b-a/monthlySummaries/2026-09'), {
      yearMonth: '2026-09',
      totalInflowHuf: 55_000,
      totalOutflowHuf: 48_000,
      netMarginHuf: 7_000,
    });
    await setDoc(doc(db, 'buildings/b-a/loans/loan-1'), {
      id: 'loan-1',
      title: 'Roof Loan',
      participants: [{ unitId: 'fsz-2', ownerName: 'Secret Name', monthlyContribution: 5000 }],
    });
    await setDoc(doc(db, 'buildings/b-a/auditLogs/log-1'), {
      id: 'log-1',
      buildingId: 'b-a',
      action: 'tx.create',
      entityType: 'transaction',
      entityId: 'tx-u1-new',
      actorUid: 'admin-a',
      actorRole: 'admin',
      summary: 'Seeded log',
    });
    await setDoc(doc(db, 'users/owner-1'), {
      uid: 'owner-1',
      email: 'owner1@example.com',
      preferredLang: 'hu',
      isSuperAdmin: false,
      memberships: { 'b-a': { role: 'owner', unitIds: ['fsz-1'], active: true } },
    });
  });
});

test.after(async () => {
  await testEnv?.cleanup();
});

test('1. Unauthenticated clients are denied everywhere', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'buildings/b-a')));
  await assertFails(getDoc(doc(db, 'buildings/b-a/units/fsz-1')));
  await assertFails(getDoc(doc(db, 'buildings/b-a/transactions/tx-exp-bld')));
});

test('2. Regular Owner GDPR Isolation: allowed own unit & building aggregates/expenses, BLOCKED from other units, prior owner tx, loans & auditLogs', async () => {
  const db = testEnv.authenticatedContext('owner-1').firestore();

  // ALLOWED: building root (KK/FA balances + aggregated arrears total), monthlySummaries, own unit, building expenses, own unit tx >= accessFromDate
  await assertSucceeds(getDoc(doc(db, 'buildings/b-a')));
  await assertSucceeds(getDoc(doc(db, 'buildings/b-a/monthlySummaries/2026-09')));
  await assertSucceeds(getDoc(doc(db, 'buildings/b-a/units/fsz-1')));
  await assertSucceeds(getDocs(query(collection(db, 'buildings/b-a/units'), where('ownerUids', 'array-contains', 'owner-1'))));
  await assertSucceeds(getDocs(query(collection(db, 'buildings/b-a/transactions'), where('visibility', '==', 'building'))));
  await assertSucceeds(getDocs(query(collection(db, 'buildings/b-a/transactions'), where('unitId', '==', 'fsz-1'), where('date', '>=', '2026-06-01'))));

  // DENIED: other flat's unit, listing all units, other flat's tx, prior owner's tx before accessFromDate,
  // own unit list WITHOUT accessFromDate filter, unfiltered tx list, loans, auditLogs
  await assertFails(getDoc(doc(db, 'buildings/b-a/units/fsz-2')));
  await assertFails(getDocs(collection(db, 'buildings/b-a/units')));
  await assertFails(getDoc(doc(db, 'buildings/b-a/transactions/tx-u2')));
  await assertFails(getDoc(doc(db, 'buildings/b-a/transactions/tx-u1-old-owner')));
  await assertFails(getDocs(query(collection(db, 'buildings/b-a/transactions'), where('unitId', '==', 'fsz-1'))));
  await assertFails(getDocs(collection(db, 'buildings/b-a/transactions')));
  await assertFails(getDoc(doc(db, 'buildings/b-a/loans/loan-1')));
  await assertFails(getDocs(collection(db, 'buildings/b-a/loans')));
  await assertFails(getDoc(doc(db, 'buildings/b-a/auditLogs/log-1')));

  // ALLOWED: Owner updating own personal contact fields ONLY
  await assertSucceeds(updateDoc(doc(db, 'buildings/b-a/units/fsz-1'), { phone: '+36 20 999 8888', notes: 'Updated note' }));

  // DENIED: Owner tampering with balances, ownerUids, or self-escalating memberships
  await assertFails(updateDoc(doc(db, 'buildings/b-a/units/fsz-1'), { balances: { KK: 9_999_999 } }));
  await assertFails(updateDoc(doc(db, 'buildings/b-a/units/fsz-1'), { ownerUids: ['owner-1', 'attacker'] }));
  await assertFails(updateDoc(doc(db, 'users/owner-1'), { isSuperAdmin: true }));
  await assertFails(setDoc(doc(db, 'buildings/b-a/members/owner-1'), { role: 'admin', active: true }));
});

test('3. SZVB (Accounting Committee): Read-Only access to entire building (units, all tx, loans, auditLogs) & ZERO writes', async () => {
  const db = testEnv.authenticatedContext('szvb-a').firestore();

  await assertSucceeds(getDoc(doc(db, 'buildings/b-a')));
  await assertSucceeds(getDocs(collection(db, 'buildings/b-a/units')));
  await assertSucceeds(getDocs(collection(db, 'buildings/b-a/transactions')));
  await assertSucceeds(getDocs(collection(db, 'buildings/b-a/loans')));
  await assertSucceeds(getDocs(collection(db, 'buildings/b-a/auditLogs')));

  // SZVB cannot write anywhere in building
  await assertFails(updateDoc(doc(db, 'buildings/b-a'), { name: 'Hacked' }));
  await assertFails(updateDoc(doc(db, 'buildings/b-a/units/fsz-2'), { notes: 'Unauthorized edit' }));
  await assertFails(setDoc(doc(db, 'buildings/b-a/categories/cat-x'), { nameHu: 'X' }));
  await assertFails(setDoc(doc(db, 'buildings/b-a/transactions/tx-fake'), { amountHuf: 100 }));
});

test('4. Admin: Tenant-isolated to Building A, Option A blocks direct financial bypasses, auditLogs immutable', async () => {
  const db = testEnv.authenticatedContext('admin-a').firestore();

  // Building A reads & non-financial metadata updates ALLOWED
  await assertSucceeds(getDocs(collection(db, 'buildings/b-a/units')));
  await assertSucceeds(getDocs(collection(db, 'buildings/b-a/loans')));
  await assertSucceeds(updateDoc(doc(db, 'buildings/b-a'), { name: 'Building A Updated' }));
  await assertSucceeds(setDoc(doc(db, 'buildings/b-a/categories/cat-custom'), { nameHu: 'Kert', nameEn: 'Garden', type: 'expense' }));

  // Cross-tenant isolation: Admin A is DENIED on Building B!
  await assertFails(getDoc(doc(db, 'buildings/b-b')));

  // Option A: Direct client tampering with balances/aggregates/transactions/bankApi secrets is DENIED
  await assertFails(updateDoc(doc(db, 'buildings/b-a'), { balances: { KK: 0, FA: 0, totalReserve: 0 } }));
  await assertFails(updateDoc(doc(db, 'buildings/b-a'), { bankApi: { apiKey: 'secret_forbidden' } }));
  await assertFails(setDoc(doc(db, 'buildings/b-a/transactions/tx-bypass'), { amountHuf: 50_000 }));
  await assertFails(updateDoc(doc(db, 'buildings/b-a/units/fsz-1'), { balances: { KK: 500_000 } }));

  // Immutable auditLogs: create with serverTimestamp ALLOWED, update & delete strictly DENIED!
  await assertSucceeds(
    setDoc(doc(db, 'buildings/b-a/auditLogs/log-new'), {
      buildingId: 'b-a',
      action: 'category.upsert',
      entityType: 'category',
      entityId: 'cat-custom',
      actorUid: 'admin-a',
      actorRole: 'admin',
      timestamp: serverTimestamp(),
      summary: 'Created Garden category',
    })
  );
  await assertFails(updateDoc(doc(db, 'buildings/b-a/auditLogs/log-1'), { summary: 'Tampered' }));
  await assertFails(deleteDoc(doc(db, 'buildings/b-a/auditLogs/log-1')));
});

test('5. SuperAdmin: Cross-tenant read access works, auditLogs still strictly immutable', async () => {
  const db = testEnv.authenticatedContext('super-1', { superadmin: true }).firestore();

  await assertSucceeds(getDoc(doc(db, 'buildings/b-a')));
  await assertSucceeds(getDoc(doc(db, 'buildings/b-b')));
  await assertFails(updateDoc(doc(db, 'buildings/b-a/auditLogs/log-1'), { summary: 'Tampered' }));
  await assertFails(deleteDoc(doc(db, 'buildings/b-a/auditLogs/log-1')));
});
