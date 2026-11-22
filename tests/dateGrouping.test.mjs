import test from 'node:test';
import assert from 'node:assert/strict';
import { parseItemDate, formatMonthGroupHeader, groupItemsByMonth } from '../src/utils/dateGrouping.js';

test('1. Robust date parsing across all Hungarian and ISO date formats', () => {
  // Dot notation standard
  const d1 = parseItemDate('2026.11.20');
  assert.equal(d1?.getFullYear(), 2026);
  assert.equal(d1?.getMonth(), 10); // 0-indexed: 10 is Nov
  assert.equal(d1?.getDate(), 20);

  // Dot notation with trailing dot
  const d2 = parseItemDate('2026.11.20.');
  assert.equal(d2?.getFullYear(), 2026);
  assert.equal(d2?.getMonth(), 10);

  // Dot notation with spaces
  const d3 = parseItemDate('2026. 11. 20.');
  assert.equal(d3?.getFullYear(), 2026);
  assert.equal(d3?.getMonth(), 10);

  // ISO notation
  const d4 = parseItemDate('2026-10-15');
  assert.equal(d4?.getFullYear(), 2026);
  assert.equal(d4?.getMonth(), 9); // Oct

  // Timestamp number
  const ts = new Date(2026, 4, 1).getTime();
  const d5 = parseItemDate(ts);
  assert.equal(d5?.getFullYear(), 2026);
  assert.equal(d5?.getMonth(), 4);

  // Invalid or null
  assert.equal(parseItemDate(null), null);
  assert.equal(parseItemDate(''), null);
  assert.equal(parseItemDate('not-a-date'), null);
});

test('2. Uppercase month header formatting in HU and EN', () => {
  const dNov = new Date(2026, 10, 15);
  const dOct = new Date(2026, 9, 5);

  // Hungarian: "2026. NOV.", "2026. OKT."
  assert.match(formatMonthGroupHeader(dNov, false), /2026.*NOV/);
  assert.match(formatMonthGroupHeader(dOct, false), /2026.*OKT/);

  // English: "NOV 2026", "OCT 2026"
  assert.match(formatMonthGroupHeader(dNov, true), /NOV.*2026/);
  assert.match(formatMonthGroupHeader(dOct, true), /OCT.*2026/);

  // Fallback for null
  assert.equal(formatMonthGroupHeader(null, false), 'EGYÉB');
  assert.equal(formatMonthGroupHeader(null, true), 'OTHER');
});

test('3. Sequential monthly grouping groups items into separate month wrappers', () => {
  const items = [
    { id: 'tx-1', date: '2026.11.25', amount: 10000 },
    { id: 'tx-2', date: '2026. 11. 10.', amount: 15000 },
    { id: 'tx-3', date: '2026-10-30', amount: -5000 },
    { id: 'tx-4', date: '2026.10.02', amount: 20000 },
    { id: 'tx-5', date: '2026.09.15', amount: 12000 },
    { id: 'tx-6', date: '', amount: 1000 }
  ];

  const groupsHu = groupItemsByMonth(items, false);
  assert.equal(groupsHu.length, 4);

  // 1st group: Nov 2026
  assert.equal(groupsHu[0].key, '2026-11');
  assert.equal(groupsHu[0].items.length, 2);
  assert.equal(groupsHu[0].items[0].id, 'tx-1');
  assert.equal(groupsHu[0].items[1].id, 'tx-2');

  // 2nd group: Oct 2026
  assert.equal(groupsHu[1].key, '2026-10');
  assert.equal(groupsHu[1].items.length, 2);
  assert.equal(groupsHu[1].items[0].id, 'tx-3');
  assert.equal(groupsHu[1].items[1].id, 'tx-4');

  // 3rd group: Sep 2026
  assert.equal(groupsHu[2].key, '2026-09');
  assert.equal(groupsHu[2].items.length, 1);
  assert.equal(groupsHu[2].items[0].id, 'tx-5');

  // 4th group: undated
  assert.equal(groupsHu[3].key, 'other');
  assert.equal(groupsHu[3].items.length, 1);
  assert.equal(groupsHu[3].items[0].id, 'tx-6');
});

test('4. Empty and edge inputs return empty array safely', () => {
  assert.deepEqual(groupItemsByMonth([]), []);
  assert.deepEqual(groupItemsByMonth(null), []);
  assert.deepEqual(groupItemsByMonth(undefined), []);
});
