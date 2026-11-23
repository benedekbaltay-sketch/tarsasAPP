import test from 'node:test';
import assert from 'node:assert/strict';

import { firestoreBuildingToUiBuilding } from '../src/services/firestoreAdapter.js';

test('1. Building defaults to 10 000 totalOwnershipShare when unspecified', () => {
  const buildingDoc = {
    id: 'bld-legacy-1',
    name: 'Régi Ház 10.',
  };
  const uiBuilding = firestoreBuildingToUiBuilding(buildingDoc);
  assert.equal(uiBuilding.totalOwnershipShare, 10000);
});

test('2. Building preserves custom totalOwnershipShare (e.g. 1 000 or custom deed 9 845)', () => {
  const buildingDoc1 = {
    id: 'bld-1000',
    name: 'Ezredes Ház',
    totalOwnershipShare: 1000,
  };
  const uiBuilding1 = firestoreBuildingToUiBuilding(buildingDoc1);
  assert.equal(uiBuilding1.totalOwnershipShare, 1000);

  const buildingDocCustom = {
    id: 'bld-custom',
    name: 'Egyedi Alapító Okirat Ház',
    totalOwnershipShare: 9845,
  };
  const uiBuildingCustom = firestoreBuildingToUiBuilding(buildingDocCustom);
  assert.equal(uiBuildingCustom.totalOwnershipShare, 9845);
});

test('3. Ownership share calculations accurately identify exact 100% matches', () => {
  const buildingTotal = 10000;
  const flats = [
    { flatNum: '1', ownershipShare: 2500 },
    { flatNum: '2', ownershipShare: 3500 },
    { flatNum: '3', ownershipShare: 4000 },
  ];

  const totalShareSum = flats.reduce((acc, f) => acc + Number(f.ownershipShare), 0);
  const sharePct = (totalShareSum / buildingTotal) * 100;
  const diff = buildingTotal - totalShareSum;

  assert.equal(totalShareSum, 10000);
  assert.equal(sharePct, 100);
  assert.equal(diff, 0);
  assert.equal(Math.abs(diff) < 0.001, true);
});

test('4. Ownership share calculations accurately report missing and surplus shares in custom base buildings', () => {
  const customBase = 1000;

  // Case A: Missing shares
  const flatsUnder = [
    { flatNum: '1', ownershipShare: 300 },
    { flatNum: '2', ownershipShare: 450 },
  ];
  const sumUnder = flatsUnder.reduce((acc, f) => acc + Number(f.ownershipShare), 0);
  const diffUnder = customBase - sumUnder;
  const pctUnder = (sumUnder / customBase) * 100;

  assert.equal(sumUnder, 750);
  assert.equal(diffUnder, 250); // 250 missing
  assert.equal(pctUnder, 75);

  // Case B: Surplus shares (over 100%)
  const flatsOver = [
    { flatNum: '1', ownershipShare: 600 },
    { flatNum: '2', ownershipShare: 550 },
  ];
  const sumOver = flatsOver.reduce((acc, f) => acc + Number(f.ownershipShare), 0);
  const diffOver = customBase - sumOver;
  const pctOver = (sumOver / customBase) * 100;

  assert.equal(sumOver, 1150);
  assert.equal(diffOver, -150); // 150 surplus
  assert.equal(Number(pctOver.toFixed(2)), 115);
});
