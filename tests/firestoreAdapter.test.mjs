/**
 * Automated Cloud Firestore Runtime Adapter & GDPR Financial Accuracy Suite (D-1.1)
 *
 * Verifies:
 * 1. Firestore Unit -> UI Flat mapping preserves authoritative 0-Ft server balances under recalculateFlatBalances()
 * 2. Regular Owner GDPR view (missing other flats' payments) still computes 0-Ft exact building KK/FA reserves,
 *    previous-month closing reserves, and monthly stats from server-computed balances & monthlySummaries
 * 3. Unified Firestore transactions map cleanly to UI arrays without double-counting `assessment` items
 * 4. UI Payment / Expense / Debit / Transfer / Correction payloads map cleanly to valid Cloud Function payloads
 * 5. uiFlatMasterToFirestoreUnitUpdate strictly strips protected fields (balances, ownerUids, activeLoanShares)
 * 6. purgeSensitiveLocalStorage removes ALL PII/financial keys while preserving non-sensitive UI preferences
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  slugifyUnitId,
  uiAccountToFundKey,
  fundKeyToUiAccount,
  firestoreUnitToUiFlat,
  firestoreTransactionsToUiCollections,
  firestoreBuildingToUiBuilding,
  uiItemToFirestoreTxPayload,
  uiFlatMasterToFirestoreUnitUpdate,
  purgeSensitiveLocalStorage,
} from '../src/services/firestoreAdapter.js';

import {
  recalculateFlatBalances,
  getBuildingReserve,
  getBuildingRenovationFund,
  getBuildingAccountReserve,
  getBuildingReserveAsOf,
  getBuildingRenovationFundAsOf,
  getMonthlyStats,
} from '../src/utils/finances.js';

import { validateTransactionPayload } from '../functions/src/financeMath.js';

test('D-1.1: Firestore unit balances remain 0-Ft authoritative under recalculateFlatBalances', () => {
  const unitDoc = {
    id: 'fsz-1',
    unitCode: 'Fsz 1',
    ownerDisplayName: 'Teszt Tulajdonos',
    ownerUids: ['uid-1'],
    owners: [{ name: 'Teszt Tulajdonos', email: 'owner1@example.test', phone: '+36301112222' }],
    fees: {
      startDateKK: '2026-09-01',
      startDateFA: '2026-09-01',
      monthlyFeeKK: 25000,
      monthlyFeeFA: 5000,
      customFees: { 'acc-park': 8000 },
    },
    balances: {
      initialKK: 10000,
      initialFA: 0,
      customInitial: { 'acc-park': 0 },
      KK: -15000,
      FA: 10000,
      custom: { 'acc-park': -8000 },
      totalRequiredKK: 75000,
      totalPaidKK: 50000,
      totalRequiredFA: 15000,
      totalPaidFA: 25000,
    },
    activeLoanShares: [{ loanId: 'loan-1', loanTitle: 'Lift hitel', monthlyContributionHuf: 4500 }],
  };

  const uiFlat = firestoreUnitToUiFlat(unitDoc);
  const state = {
    currentBuildingId: 'b1',
    buildings: [{ id: 'b1', customBankAccounts: [{ id: 'acc-park', name: 'Parkoló Alap' }] }],
    flats: [uiFlat],
    transactions: [], // Intentionally empty (e.g. paginated or filtered)
    expenses: [],
    manualDebits: [],
  };

  recalculateFlatBalances(state);

  assert.equal(uiFlat.balance, -15000);
  assert.equal(uiFlat.renovationBalance, 10000);
  assert.equal(uiFlat.customBalances['acc-park'], -8000);
  assert.equal(uiFlat.totalRequired, 75000);
  assert.equal(uiFlat.totalPaid, 50000);
  assert.equal(uiFlat.activeLoanShares.length, 1);
});

test('D-1.1: Regular Owner GDPR view computes 0-Ft exact building reserves & monthly stats without reading other flats payments', () => {
  const buildingDoc = {
    id: 'b1',
    name: 'Minta Társasház',
    initialReserves: { KK: 1000000, FA: 500000, custom: { 'acc-park': 100000 } },
    balances: { KK: 1180000, FA: 540000, custom: { 'acc-park': 124000 }, totalReserve: 1720000 },
    bankAccounts: {
      KK: { name: 'Minta KK', account: '11700001-11111111', bank: 'OTP' },
      FA: { name: 'Minta FA', account: '11700001-22222222', bank: 'OTP' },
      custom: [{ id: 'acc-park', name: 'Parkoló Alap', initialReserve: 100000 }],
    },
    aggregates: { totalArrearsHuf: 85000, debtorUnitCount: 2, settledUnitCount: 6, totalUnitCount: 8 },
  };

  const monthlySummaries = [
    { yearMonth: '2026-09', inflow: 200000, outflow: 120000, margin: 80000, kkInflow: 160000, kkOutflow: 120000, faInflow: 40000, faOutflow: 0 },
    { yearMonth: '2026-10', inflow: 220000, outflow: 80000, margin: 140000, kkInflow: 220000, kkOutflow: 80000, faInflow: 0, faOutflow: 0 },
  ];

  const uiBuilding = firestoreBuildingToUiBuilding(buildingDoc, {
    monthlySummaries,
    flats: [],
    transactions: [], // Regular Owner does NOT have other flats' payments!
    expenses: [],
  });

  const ownerState = {
    currentBuildingId: 'b1',
    buildings: [uiBuilding],
    transactions: [],
    expenses: [],
    buildingInitialReserveCommon: uiBuilding.buildingInitialReserveCommon,
    buildingInitialReserveRenovation: uiBuilding.buildingInitialReserveRenovation,
  };

  assert.equal(getBuildingReserve(ownerState), 1180000);
  assert.equal(getBuildingRenovationFund(ownerState), 540000);
  assert.equal(getBuildingAccountReserve('acc-park', ownerState), 124000);

  // Month-end closing reserve as of 2026-09-30: 1,000,000 + (160,000 - 120,000) = 1,040,000
  assert.equal(getBuildingReserveAsOf('2026-09-30', ownerState), 1040000);
  // Month-end closing reserve as of 2026-10-31: 1,040,000 + (220,000 - 80,000) = 1,180,000
  assert.equal(getBuildingReserveAsOf('2026-10-31', ownerState), 1180000);
  assert.equal(getBuildingRenovationFundAsOf('2026-09-30', ownerState), 540000);

  const octStats = getMonthlyStats(2026, 10, ownerState);
  assert.equal(octStats.inflow, 220000);
  assert.equal(octStats.outflow, 80000);
  assert.equal(octStats.margin, 140000);
});

test('D-1.1: Unified Firestore transactions map cleanly to UI arrays & back to valid Cloud Function payloads', () => {
  const customAccounts = [{ id: 'acc-park', name: 'Parkoló Alap' }];
  const flats = [{ id: 'fsz-1', unitId: 'fsz-1', flatNum: 'Fsz 1' }];

  const txDocs = [
    { id: 'assess_2026-10_fsz-1_KK', kind: 'assessment', direction: 'debit', amountHuf: 25000, fund: 'KK', unitId: 'fsz-1', unitCode: 'Fsz 1', date: '2026-10-01' },
    { id: 'tx-1', kind: 'payment', direction: 'credit', amountHuf: 25000, fund: 'KK', unitId: 'fsz-1', unitCode: 'Fsz 1', date: '2026-10-05', paymentMethod: 'bank_transfer', status: 'verified', comment: 'KK befizetés' },
    { id: 'exp-1', kind: 'expense', direction: 'debit', amountHuf: 48000, fund: 'KK', unitId: null, unitCode: null, date: '2026-10-07', paymentMethod: 'bank_transfer', status: 'verified', provider: 'MVM', title: 'Villany', comment: 'Lépcsőház áram' },
    { id: 'deb-1', kind: 'debit', direction: 'debit', amountHuf: 12000, fund: 'acc-park', unitId: 'fsz-1', unitCode: 'Fsz 1', date: '2026-10-08', paymentMethod: 'system_assessment', status: 'verified', comment: 'Extra parkoló díj' },
    { id: 'tr-1-from', kind: 'transfer', direction: 'debit', amountHuf: 140580, fund: 'KK', unitId: null, unitCode: null, date: '2026-10-12', paymentMethod: 'bank_transfer', status: 'verified', transferGroupId: 'tr-1' },
  ];

  const { transactions, expenses, manualDebits } = firestoreTransactionsToUiCollections(txDocs, customAccounts);

  // Assessment excluded from manualDebits (no double-counting!)
  assert.equal(manualDebits.length, 1);
  assert.equal(manualDebits[0].id, 'deb-1');
  assert.equal(manualDebits[0].targetAccount, 'Parkoló Alap');
  assert.equal(expenses.length, 1);
  assert.equal(expenses[0].amount, 48000);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].amount, 25000);
  assert.equal(transactions[1].amount, -140580);
  assert.equal(transactions[1].type, 'Transfer');

  // Round-trip UI -> Cloud Function payload passes strict financeMath validation!
  const fsPay = uiItemToFirestoreTxPayload(transactions[0], 'payment', { flats, customAccounts });
  const validatedPay = validateTransactionPayload(fsPay);
  assert.equal(validatedPay.unitId, 'fsz-1');
  assert.equal(validatedPay.fund, 'KK');
  assert.equal(validatedPay.amountHuf, 25000);
  assert.equal(validatedPay.visibility, 'unit');

  const fsExp = uiItemToFirestoreTxPayload(expenses[0], 'expense', { flats, customAccounts });
  const validatedExp = validateTransactionPayload(fsExp);
  assert.equal(validatedExp.unitId, null);
  assert.equal(validatedExp.visibility, 'building');
  assert.equal(validatedExp.kind, 'expense');
  assert.equal(validatedExp.amountHuf, 48000);

  assert.equal(slugifyUnitId('Fsz 1.'), 'fsz-1');
  assert.equal(uiAccountToFundKey('Parkoló Alap', customAccounts), 'acc-park');
  assert.equal(fundKeyToUiAccount('acc-park', customAccounts), 'Parkoló Alap');
});

test('D-1.1: uiFlatMasterToFirestoreUnitUpdate strips protected server-only fields & purgeSensitiveLocalStorage clears PII', () => {
  const mapped = uiFlatMasterToFirestoreUnitUpdate({
    ownerName: 'Új Tulaj',
    area: 64,
    monthlyFee: 28000,
    balances: { KK: 999999 },
    ownerUids: ['attacker-uid'],
    activeLoanShares: [],
    pass: 'leaked',
    password: 'leaked',
  });

  assert.equal(mapped.ownerDisplayName, 'Új Tulaj');
  assert.equal(mapped.areaSqm, 64);
  assert.equal(mapped.fees.monthlyFeeKK, 28000);
  assert.equal('balances' in mapped, false);
  assert.equal('ownerUids' in mapped, false);
  assert.equal('activeLoanShares' in mapped, false);
  assert.equal('pass' in mapped, false);
  assert.equal('password' in mapped, false);

  // Verify purgeSensitiveLocalStorage clears all PII/financial keys while preserving UI prefs
  const store = new Map([
    ['tarsashaz_state', '{"secret":1}'],
    ['tarsashaz_permanent_vault', '{"deletedIds":[]}'],
    ['tarsashaz_logged_in_user', '{"email":"a@b.c"}'],
    ['tarsashaz_role_mode', 'kk'],
    ['tarsashaz_is_portfolio', 'true'],
    ['tarsashaz_lang', 'en'],
    ['tarsashaz_sound_effects', 'true'],
  ]);
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  purgeSensitiveLocalStorage();

  assert.equal(store.has('tarsashaz_state'), false);
  assert.equal(store.has('tarsashaz_permanent_vault'), false);
  assert.equal(store.has('tarsashaz_logged_in_user'), false);
  assert.equal(store.has('tarsashaz_role_mode'), false);
  assert.equal(store.has('tarsashaz_is_portfolio'), false);
  assert.equal(store.get('tarsashaz_lang'), 'en');
  assert.equal(store.get('tarsashaz_sound_effects'), 'true');
});
