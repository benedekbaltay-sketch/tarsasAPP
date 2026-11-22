import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  renderEmailTemplate, 
  evaluateFlatAgainstRule, 
  runDunningDryRun, 
  DEFAULT_DUNNING_RULES,
  MERGE_VARIABLES 
} from '../src/utils/dunningRules.js';

test('1. Template variable substitution works for Hungarian and English tags', () => {
  const tpl = 'Tisztelt {{tulajdonos_neve}}! A(z) {{lakas_szam}}. lakás tartozása {{hatralek_osszeg}} ({{hatralek_honapok}} hó). Ház: {{tarsashaz_neve}}, számla: {{szamlaszam}}.';
  const ctx = {
    tulajdonos_neve: 'Kovács János',
    lakas_szam: '4/A',
    hatralek_osszeg: '-45 000 Ft',
    hatralek_honapok: '3',
    tarsashaz_neve: 'Minta Társasház',
    szamlaszam: '11700000-22222222'
  };

  const rendered = renderEmailTemplate(tpl, ctx);
  assert.equal(rendered, 'Tisztelt Kovács János! A(z) 4/A. lakás tartozása -45 000 Ft (3 hó). Ház: Minta Társasház, számla: 11700000-22222222.');

  // Test English tags
  const tplEn = 'Dear {{owner_name}}! Flat #{{flat_num}} debt is {{arrears_amount}}.';
  const renderedEn = renderEmailTemplate(tplEn, ctx);
  assert.equal(renderedEn, 'Dear Kovács János! Flat #4/A debt is -45 000 Ft.');
});

test('2. Positive or zero balance flats are never dunned', () => {
  const rule = DEFAULT_DUNNING_RULES[0];
  const paidFlat = { flatNum: '1', balance: 0, monthlyFee: 15000 };
  const overpaidFlat = { flatNum: '2', balance: 5000, monthlyFee: 15000 };

  assert.equal(evaluateFlatAgainstRule(rule, paidFlat), null);
  assert.equal(evaluateFlatAgainstRule(rule, overpaidFlat), null);
});

test('3. Month-threshold condition accurately evaluates debt-to-monthly-fee ratio', () => {
  const rule = {
    id: 'test-rule-3mo',
    targetAccount: 'total',
    conditionType: 'months',
    monthThreshold: 3.0,
    minAmountHuf: 0,
    templateSubject: 'Felszólítás {{lakas_szam}}',
    templateBody: 'Tartozás: {{hatralek_osszeg}}'
  };

  const flat1MonthDebt = { flatNum: '10', balance: -15000, monthlyFee: 15000 };
  const flat3MonthsDebt = { flatNum: '11', balance: -45000, monthlyFee: 15000 };
  const flat4MonthsDebt = { flatNum: '12', balance: -60000, monthlyFee: 15000 };

  // Flat with only 1 month debt should NOT match rule requiring 3 months
  assert.equal(evaluateFlatAgainstRule(rule, flat1MonthDebt), null);

  // Flat with exactly 3 months debt should match
  const match3 = evaluateFlatAgainstRule(rule, flat3MonthsDebt);
  assert.ok(match3);
  assert.equal(match3.arrearsMonths, 3);
  assert.equal(match3.arrearsHuf, 45000);

  // Flat with 4 months debt should match
  const match4 = evaluateFlatAgainstRule(rule, flat4MonthsDebt);
  assert.ok(match4);
  assert.equal(match4.arrearsMonths, 4);
});

test('4. Combined condition evaluates OR and AND logic properly', () => {
  const ruleOr = {
    id: 'test-or',
    conditionType: 'combined',
    operator: 'OR',
    monthThreshold: 3.0,
    minAmountHuf: 50000,
    templateSubject: 'Test',
    templateBody: 'Test'
  };

  // Has 4 months debt but only 40,000 Ft (<50k) -> matches OR
  const flatA = { flatNum: '1', balance: -40000, monthlyFee: 10000 };
  assert.ok(evaluateFlatAgainstRule(ruleOr, flatA));

  // Has 1 month debt but 60,000 Ft (>50k) -> matches OR
  const flatB = { flatNum: '2', balance: -60000, monthlyFee: 60000 };
  assert.ok(evaluateFlatAgainstRule(ruleOr, flatB));

  const ruleAnd = { ...ruleOr, operator: 'AND' };
  // flatA does not have >= 50k, fails AND
  assert.equal(evaluateFlatAgainstRule(ruleAnd, flatA), null);

  // flatC has 4 months AND 80k Ft -> matches AND
  const flatC = { flatNum: '3', balance: -80000, monthlyFee: 20000 };
  assert.ok(evaluateFlatAgainstRule(ruleAnd, flatC));
});

test('5. Cooldown deduplication prevents re-sending within cycle window', () => {
  const rule = {
    id: 'rule-cooldown-test',
    conditionType: 'months',
    monthThreshold: 1.0,
    cooldownDays: 30,
    templateSubject: 'Subj',
    templateBody: 'Body'
  };

  const flat = { flatNum: '5', balance: -30000, monthlyFee: 15000 };
  const building = { id: 'bld-1', name: 'Test Ház' };

  // Case 1: No prior sent history -> matches
  const match1 = evaluateFlatAgainstRule(rule, flat, building, {
    currentDate: '2026-11-20T12:00:00Z',
    history: []
  });
  assert.ok(match1);

  // Case 2: Prior notification sent 10 days ago (< 30 days cooldown) -> blocked by cooldown
  const matchBlocked = evaluateFlatAgainstRule(rule, flat, building, {
    currentDate: '2026-11-20T12:00:00Z',
    history: [
      { ruleId: 'rule-cooldown-test', flatNum: '5', sentAt: '2026-11-10T12:00:00Z' }
    ]
  });
  assert.equal(matchBlocked, null);

  // Case 3: Prior notification was 40 days ago (> 30 days cooldown) -> permitted
  const matchAllowed = evaluateFlatAgainstRule(rule, flat, building, {
    currentDate: '2026-11-20T12:00:00Z',
    history: [
      { ruleId: 'rule-cooldown-test', flatNum: '5', sentAt: '2026-10-01T12:00:00Z' }
    ]
  });
  assert.ok(matchAllowed);
});

test('6. Dry-run multi-building scanner returns detailed match list with rendered previews', () => {
  const rule = DEFAULT_DUNNING_RULES[0]; // 1-month friendly reminder
  const buildings = [
    { id: 'b1', name: 'Ház 1', bankKK: '111-222' },
    { id: 'b2', name: 'Ház 2', bankKK: '333-444' }
  ];
  const flatsByBuilding = {
    b1: [
      { flatNum: '1', balance: 0, monthlyFee: 10000 },
      { flatNum: '2', balance: -20000, monthlyFee: 10000, owner: 'Nagy Anna' }
    ],
    b2: [
      { flatNum: '10', balance: -50000, monthlyFee: 25000, owner: 'Szabó Péter' }
    ]
  };

  const results = runDunningDryRun(rule, buildings, flatsByBuilding, {
    currentDate: '2026-11-20'
  });

  assert.equal(results.length, 2);
  assert.equal(results[0].flatNum, '2');
  assert.equal(results[0].ownerName, 'Nagy Anna');
  assert.match(results[0].renderedSubject, /Ház 1.*2/);
  assert.match(results[0].renderedBody, /20.*000/);

  assert.equal(results[1].flatNum, '10');
  assert.equal(results[1].ownerName, 'Szabó Péter');
  assert.match(results[1].renderedSubject, /Ház 2.*10/);
});
