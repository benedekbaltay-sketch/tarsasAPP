import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCloudPayload,
  extractBuildingReservesMap,
  protectBuildingReserves,
  mergeStateWithCloud,
} from '../src/context/syncEngine.js';
import {
  getBuildingReserve,
  getBuildingRenovationFund,
  getBuildingAccountReserve,
} from '../src/utils/finances.js';

test('1. Regression: Portfolio View (currentBuildingId=null, top-level reserves=0) NEVER zeroes out buildings[0] reserves in createCloudPayload', () => {
  const stateInPortfolioView = {
    currentBuildingId: null,
    isPortfolioView: true,
    buildingInitialReserveCommon: 0,
    buildingInitialReserveRenovation: 0,
    revision: 42,
    lastUpdated: Date.now(),
    buildings: [
      {
        id: 'b-main',
        name: 'Fő Társasház',
        buildingInitialReserveCommon: 4_850_000,
        buildingInitialReserveRenovation: 12_300_000,
        customBankAccounts: [
          { id: 'acc-1', name: 'Lift Alap', initialReserve: 1_500_000 },
        ],
        flats: [],
        transactions: [],
        expenses: [],
      },
      {
        id: 'b-second',
        name: 'Második Ház',
        buildingInitialReserveCommon: 900_000,
        buildingInitialReserveRenovation: 2_100_000,
        flats: [],
        transactions: [],
        expenses: [],
      },
    ],
    users: [],
    notifications: [{ id: 'n-1', read: true }],
  };

  const payload = createCloudPayload(stateInPortfolioView);

  assert.equal(payload.buildings[0].buildingInitialReserveCommon, 4_850_000);
  assert.equal(payload.buildings[0].buildingInitialReserveRenovation, 12_300_000);
  assert.equal(payload.buildings[0].customBankAccounts[0].initialReserve, 1_500_000);
  assert.equal(payload.buildings[1].buildingInitialReserveCommon, 900_000);
  assert.equal(payload.buildings[1].buildingInitialReserveRenovation, 2_100_000);
  assert.equal(payload.buildingInitialReserveCommon, 4_850_000);
  assert.equal(payload.buildingInitialReserveRenovation, 12_300_000);
});

test('2. Circuit-breaker: protectBuildingReserves blocks ANY unintended reserve drop or mutation unless allowReserveChange=true', () => {
  const cloudBuildings = [
    {
      id: 'b-main',
      name: 'Fő Társasház',
      buildingInitialReserveCommon: 3_200_000,
      buildingInitialReserveRenovation: 7_450_000,
      customBankAccounts: [
        { id: 'acc-1', name: 'Célalap', initialReserve: 600_000 },
      ],
    },
  ];
  const baseline = extractBuildingReservesMap(cloudBuildings);

  const corruptedAttempt = [
    {
      id: 'b-main',
      name: 'Fő Társasház',
      buildingInitialReserveCommon: 0,
      buildingInitialReserveRenovation: 0,
      customBankAccounts: [
        { id: 'acc-1', name: 'Célalap', initialReserve: 0 },
      ],
    },
  ];

  // Without explicit calibration flag -> ALL mutations blocked and authoritative reserves restored!
  const blocked = protectBuildingReserves(corruptedAttempt, baseline, { allowReserveChange: false });
  assert.equal(blocked.blockedMutations.length, 3);
  assert.equal(blocked.buildings[0].buildingInitialReserveCommon, 3_200_000);
  assert.equal(blocked.buildings[0].buildingInitialReserveRenovation, 7_450_000);
  assert.equal(blocked.buildings[0].customBankAccounts[0].initialReserve, 600_000);

  // Also verified end-to-end inside createCloudPayload
  const payload = createCloudPayload(
    {
      currentBuildingId: 'b-main',
      buildings: corruptedAttempt,
      users: [],
      revision: 10,
    },
    { authoritativeReservesMap: baseline, allowReserveChange: false }
  );
  assert.equal(payload.buildings[0].buildingInitialReserveCommon, 3_200_000);
  assert.equal(payload.buildings[0].buildingInitialReserveRenovation, 7_450_000);
  assert.equal(payload.buildings[0].customBankAccounts[0].initialReserve, 600_000);

  // With explicit admin calibration flag (allowReserveChange: true) -> change is permitted
  const calibrated = protectBuildingReserves(
    [
      {
        ...cloudBuildings[0],
        buildingInitialReserveCommon: 5_000_000,
        buildingInitialReserveRenovation: 8_000_000,
      },
    ],
    baseline,
    { allowReserveChange: true }
  );
  assert.equal(calibrated.blockedMutations.length, 0);
  assert.equal(calibrated.buildings[0].buildingInitialReserveCommon, 5_000_000);
  assert.equal(calibrated.buildings[0].buildingInitialReserveRenovation, 8_000_000);
});

test('3. mergeStateWithCloud never lets a stale zero local reserve overwrite a non-zero cloud reserve', () => {
  const local = {
    revision: 12,
    lastUpdated: 2000,
    currentBuildingId: 'b-main',
    buildingInitialReserveCommon: 0,
    buildingInitialReserveRenovation: 0,
    buildings: [
      {
        id: 'b-main',
        name: 'Fő Társasház',
        buildingInitialReserveCommon: 0,
        buildingInitialReserveRenovation: 0,
        flats: [],
        transactions: [],
        expenses: [],
      },
    ],
    users: [],
  };

  const cloud = {
    revision: 10,
    lastUpdated: 1000,
    currentBuildingId: 'b-main',
    buildingInitialReserveCommon: 2_500_000,
    buildingInitialReserveRenovation: 6_100_000,
    buildings: [
      {
        id: 'b-main',
        name: 'Fő Társasház',
        buildingInitialReserveCommon: 2_500_000,
        buildingInitialReserveRenovation: 6_100_000,
        flats: [],
        transactions: [],
        expenses: [],
      },
    ],
    users: [],
  };

  const merged = mergeStateWithCloud(local, cloud);
  assert.equal(merged.buildings[0].buildingInitialReserveCommon, 2_500_000);
  assert.equal(merged.buildings[0].buildingInitialReserveRenovation, 6_100_000);
  assert.equal(merged.buildingInitialReserveCommon, 2_500_000);
  assert.equal(merged.buildingInitialReserveRenovation, 6_100_000);
});

test('4. finances.js getBuildingReserve & getBuildingRenovationFund strictly use target building reserves over stale top-level 0', () => {
  const mixedState = {
    currentBuildingId: 'b-2',
    buildingInitialReserveCommon: 0,
    buildingInitialReserveRenovation: 0,
    transactions: [],
    expenses: [],
    buildings: [
      {
        id: 'b-1',
        buildingInitialReserveCommon: 1_000_000,
        buildingInitialReserveRenovation: 2_000_000,
        transactions: [],
        expenses: [],
      },
      {
        id: 'b-2',
        buildingInitialReserveCommon: 4_500_000,
        buildingInitialReserveRenovation: 9_250_000,
        customBankAccounts: [{ id: 'c1', name: 'Lift', initialReserve: 750_000 }],
        transactions: [
          { id: 't1', status: 'Verified', targetAccount: 'Közös Költség', amount: 100_000, method: 'Átutalás' },
          { id: 't2', status: 'Verified', targetAccount: 'Felújítási Alap', amount: 50_000, method: 'Átutalás' },
          { id: 't3', status: 'Verified', targetAccount: 'Lift', amount: 25_000, method: 'Átutalás' },
        ],
        expenses: [
          { id: 'e1', targetAccount: 'Közös Költség', amount: 40_000, method: 'Átutalás' },
        ],
      },
    ],
  };

  assert.equal(getBuildingReserve(mixedState), 4_560_000);
  assert.equal(getBuildingRenovationFund(mixedState), 9_300_000);
  assert.equal(getBuildingAccountReserve('c1', mixedState), 775_000);
});
