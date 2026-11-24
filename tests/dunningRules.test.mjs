import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  renderEmailTemplate, 
  evaluateFlatAgainstRule, 
  runDunningDryRun, 
  generateSampleFlatPreview,
  DEFAULT_DUNNING_RULES,
  MERGE_VARIABLES,
  resolveFlatOwnerName,
  getBudapestTimeParts,
  shouldRuleAutoDispatchToday,
  evaluateRulesForAutoDispatch
} from '../src/utils/dunningRules.js';
import { mergeStateWithCloud } from '../src/context/syncEngine.js';
import { createEmailActions } from '../src/context/emailActions.js';

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

test('7. Realistic sample flat preview generates filled email template for random or paid-up flat', () => {
  const rule = DEFAULT_DUNNING_RULES[1]; // Stage 1 notice (3 months debt)
  const buildings = [
    {
      id: 'bld-test',
      name: 'Teszt Ház',
      officialName: 'Teszt Társasház Kft.',
      address: '1011 Budapest, Vár u. 3.',
      bankKK: '12345678-00000000',
      flats: [
        { flatNum: '1', balance: 0, monthlyFee: 20000, owner: 'Kiss Béla', email: 'bela@test.hu' },
        { flatNum: '2', balance: 5000, monthlyFee: 25000, owner: 'Horváth Géza', email: 'geza@test.hu' }
      ]
    }
  ];

  // Both flats have 0 or positive balance (no actual arrears)
  // generateSampleFlatPreview must realistically simulate arrears based on rule (>= 3 months)
  const preview = generateSampleFlatPreview(rule, buildings, { seedIndex: 0 });

  assert.ok(preview);
  assert.equal(preview.flatNum, '1');
  assert.equal(preview.ownerName, 'Kiss Béla');
  assert.equal(preview.isSimulated, true);
  assert.ok(preview.arrearsMonths >= 3.0);
  assert.match(preview.renderedSubject, /Teszt Társasház.*1/);
  assert.match(preview.renderedBody, /Kiss Béla/);
  assert.match(preview.renderedBody, /12345678-00000000/);

  // Test cycling with seedIndex: 1 picks second flat
  const preview2 = generateSampleFlatPreview(rule, buildings, { seedIndex: 1 });
  assert.ok(preview2);
  assert.equal(preview2.flatNum, '2');
  assert.equal(preview2.ownerName, 'Horváth Géza');

  // Test fallback when zero buildings exist
  const emptyPreview = generateSampleFlatPreview(rule, []);
  assert.ok(emptyPreview);
  assert.ok(emptyPreview.renderedSubject);
  assert.ok(emptyPreview.renderedBody);
});

test('8. Range conditions (monthThreshold and maxMonthThreshold) isolate delinquency bands', () => {
  const band1Rule = {
    id: 'rule-band-1',
    conditionType: 'months',
    monthThreshold: 1.0,
    maxMonthThreshold: 2.0, // Band: [1.0, 2.0)
    templateSubject: 'Band 1',
    templateBody: 'Band 1'
  };

  const band2Rule = {
    id: 'rule-band-2',
    conditionType: 'months',
    monthThreshold: 2.0,
    maxMonthThreshold: 3.0, // Band: [2.0, 3.0)
    templateSubject: 'Band 2',
    templateBody: 'Band 2'
  };

  const flat15Mo = { flatNum: '10', balance: -15000, monthlyFee: 10000 }; // 1.5 months
  const flat20Mo = { flatNum: '20', balance: -20000, monthlyFee: 10000 }; // exactly 2.0 months
  const flat25Mo = { flatNum: '30', balance: -25000, monthlyFee: 10000 }; // 2.5 months
  const flat35Mo = { flatNum: '40', balance: -35000, monthlyFee: 10000 }; // 3.5 months

  // flat15Mo matches Band 1, but NOT Band 2
  assert.ok(evaluateFlatAgainstRule(band1Rule, flat15Mo));
  assert.equal(evaluateFlatAgainstRule(band2Rule, flat15Mo), null);

  // flat20Mo (2.0 months) matches Band 2, but NOT Band 1 (excluded by maxMonthThreshold: 2.0)
  assert.equal(evaluateFlatAgainstRule(band1Rule, flat20Mo), null);
  assert.ok(evaluateFlatAgainstRule(band2Rule, flat20Mo));

  // flat25Mo matches Band 2, but NOT Band 1
  assert.equal(evaluateFlatAgainstRule(band1Rule, flat25Mo), null);
  assert.ok(evaluateFlatAgainstRule(band2Rule, flat25Mo));

  // flat35Mo matches neither (exceeds Band 2 upper threshold 3.0)
  assert.equal(evaluateFlatAgainstRule(band1Rule, flat35Mo), null);
  assert.equal(evaluateFlatAgainstRule(band2Rule, flat35Mo), null);
});

test('9. Cross-rule cooldown prevents duplicate notices across consecutive execution days', () => {
  const ruleStage2 = {
    id: 'rule-stage-2',
    conditionType: 'months',
    monthThreshold: 2.0,
    cooldownDays: 25,
    crossRuleCooldown: true, // Prevents notice if ANY rule sent a notice recently
    templateSubject: 'Stage 2',
    templateBody: 'Stage 2'
  };

  const flat = { flatNum: '10', balance: -40000, monthlyFee: 20000 }; // 2 months
  const building = { id: 'bld-1', name: 'Minta Ház' };

  // Flat received a notice yesterday from a DIFFERENT rule ('rule-stage-1')
  const history = [
    {
      ruleId: 'rule-stage-1',
      flatNum: '10',
      sentAt: '2026-11-24T10:00:00Z'
    }
  ];

  // Running Stage 2 rule on 2026-11-25 (next day): should be BLOCKED because of crossRuleCooldown!
  const matchBlocked = evaluateFlatAgainstRule(ruleStage2, flat, building, {
    currentDate: '2026-11-25T10:00:00Z',
    history
  });
  assert.equal(matchBlocked, null, 'Should suppress notice due to recent notification from another rule');

  // If crossRuleCooldown is explicitly disabled (false), ruleStage2 would ignore ruleStage1's log
  const ruleNoCross = { ...ruleStage2, crossRuleCooldown: false };
  const matchAllowed = evaluateFlatAgainstRule(ruleNoCross, flat, building, {
    currentDate: '2026-11-25T10:00:00Z',
    history
  });
  assert.ok(matchAllowed, 'Should match when cross-rule cooldown is explicitly disabled');
});

test('10. Per-account target evaluation isolates KK and FA debts independently', () => {
  const rulePerAccount = {
    id: 'rule-per-acc',
    targetAccount: 'per_account',
    conditionType: 'months',
    monthThreshold: 2.0,
    templateSubject: 'Subj',
    templateBody: 'Body'
  };

  // Flat has huge surplus on FA (+50,000 Ft), but 2 months debt on KK (-20,000 Ft, fee: 10,000 Ft)
  // In 'total' mode, net balance is +30,000 Ft -> would NEVER be dunned!
  // In 'per_account' mode, the KK debt stands on its own and triggers the notice!
  const flat = {
    flatNum: '7',
    balance: -20000,
    monthlyFee: 10000,
    renovationBalance: 50000,
    renovationFee: 5000
  };
  const building = { id: 'bld-1', name: 'Ház', bankKK: '111-222', bankFA: '333-444' };

  const match = evaluateFlatAgainstRule(rulePerAccount, flat, building);
  assert.ok(match, 'Per-account rule must detect KK arrears despite FA surplus');
  assert.equal(match.arrearsMonths, 2);
  assert.equal(match.arrearsHuf, 20000);
});

test('11. buildPaymentDetailsBlock accurately formats multi-account transfer info', () => {
  const flatMultiDebt = {
    flatNum: '15',
    balance: -25000,
    monthlyFee: 20000,
    renovationBalance: -10000,
    renovationFee: 10000
  };

  // Sub-case A: Separate bank accounts for KK and FA
  const buildingSeparateBanks = {
    name: 'Napfény Ház',
    bankKK: '11705008-11111111',
    bankFA: '11605008-22222222'
  };

  const paymentBlockA = evaluateFlatAgainstRule({
    id: 'r1',
    targetAccount: 'per_account',
    monthThreshold: 0.5,
    templateSubject: 'S',
    templateBody: '{{fizetesi_adatok}}'
  }, flatMultiDebt, buildingSeparateBanks);

  assert.ok(paymentBlockA);
  assert.match(paymentBlockA.renderedBody, /11705008-11111111/);
  assert.match(paymentBlockA.renderedBody, /11605008-22222222/);
  assert.match(paymentBlockA.renderedBody, /15\. lakás közös költség/);
  assert.match(paymentBlockA.renderedBody, /15\. lakás felújítási alap/);
  // Verify empty line between multiple accounts
  assert.match(paymentBlockA.renderedBody, /15\. lakás közös költség\n\n• Felújítási alap/);

  // Sub-case B: Single bank account for both
  const buildingSingleBank = {
    name: 'Napfény Ház',
    bankKK: '11705008-11111111',
    bankFA: '11705008-11111111'
  };

  const paymentBlockB = evaluateFlatAgainstRule({
    id: 'r2',
    targetAccount: 'per_account',
    monthThreshold: 0.5,
    templateSubject: 'S',
    templateBody: '{{fizetesi_adatok}}'
  }, flatMultiDebt, buildingSingleBank);

  assert.ok(paymentBlockB);
  assert.match(paymentBlockB.renderedBody, /11705008-11111111/);
  assert.match(paymentBlockB.renderedBody, /Napfény Ház/);
});

test('12. Zero monthly fee safety guard prevents division by zero without error', () => {
  const rule = {
    id: 'rule-zero-guard',
    conditionType: 'months',
    monthThreshold: 1.0,
    templateSubject: 'S',
    templateBody: 'B'
  };

  // Storage / parking unit with 0 Ft fee but has negative balance
  const zeroFeeFlat = { flatNum: 'T1', balance: -10000, monthlyFee: 0 };
  const match = evaluateFlatAgainstRule(rule, zeroFeeFlat);
  assert.equal(match, null, 'Cannot evaluate months when fee is 0');
});

test('13. Structured bank account objects ({ account, bank, name }) do not crash and extract IBAN', () => {
  const buildingWithObjBanks = {
    name: 'Tölgyfa Társasház',
    bankKK: {
      account: '11705008-20456789-00000000',
      bank: 'OTP Bank',
      name: 'Tölgyfa Társasház'
    },
    bankFA: {
      account: '11605008-20456789-00000000',
      bank: 'Erste Bank',
      name: 'Tölgyfa FA'
    }
  };

  const flat = { flatNum: '4', balance: -20000, monthlyFee: 10000 };
  const rule = {
    id: 'r-obj-bank',
    targetAccount: 'per_account',
    monthThreshold: 1.0,
    templateSubject: 'Subj',
    templateBody: '{{fizetesi_adatok}} {{szamlaszam}}'
  };

  const match = evaluateFlatAgainstRule(rule, flat, buildingWithObjBanks);
  assert.ok(match);
  assert.match(match.renderedBody, /11705008-20456789-00000000/);
});

test('14. Representative personal name and company name are cleanly separated in tags', () => {
  const flat = { flatNum: '1', balance: -20000, monthlyFee: 10000 };
  const building = { id: 'bld-1', name: 'Minta Ház' };
  const rule = {
    id: 'r-rep-sep',
    monthThreshold: 1.0,
    templateSubject: 'Subj',
    templateBody: 'Képviselő: {{kepviselo_neve}} | Cég: {{ceg_neve}}'
  };

  const repProfile = {
    name: 'Kovács Béla',
    companyName: 'Napfény Társasházkezelő Kft.'
  };

  const match = evaluateFlatAgainstRule(rule, flat, building, { repProfile });
  assert.ok(match);
  assert.equal(match.context.kepviselo_neve, 'Kovács Béla');
  assert.equal(match.context.ceg_neve, 'Napfény Társasházkezelő Kft.');
  assert.equal(match.renderedBody, 'Képviselő: Kovács Béla | Cég: Napfény Társasházkezelő Kft.');

  // Test camelCase tags alias replacement: {kepviseloNeve} and {cegNeve}
  const renderedAliases = renderEmailTemplate('Üdv, {kepviseloNeve} ({cegNeve})', match.context);
  assert.equal(renderedAliases, 'Üdv, Kovács Béla (Napfény Társasházkezelő Kft.)');
});

test('15. resolveFlatOwnerName resolves ownerName, flat.owners array and lakas_tulajdonosa tag', () => {
  // Case A: flat.ownerName
  const flatA = { flatNum: '10', ownerName: 'Nagy Anna', balance: -20000, monthlyFee: 10000 };
  assert.equal(resolveFlatOwnerName(flatA), 'Nagy Anna');

  // Case B: flat.owners array
  const flatB = { flatNum: '11', owners: [{ name: 'Kiss Péter' }, { name: 'Kiss Éva' }], balance: -20000, monthlyFee: 10000 };
  assert.equal(resolveFlatOwnerName(flatB), 'Kiss Péter, Kiss Éva');

  // Case C: Fallback
  const flatC = { flatNum: '12', balance: -20000, monthlyFee: 10000 };
  assert.equal(resolveFlatOwnerName(flatC), '12. lakás tulajdonosa');
  assert.equal(resolveFlatOwnerName(flatC, true), 'Owner of Flat 12');

  // Evaluate against rule using lakas_tulajdonosa tag
  const rule = {
    id: 'r-owner-tag',
    monthThreshold: 1.0,
    templateSubject: 'Felszólítás: {{lakas_tulajdonosa}}',
    templateBody: 'Kedves {{lakas_tulajdonosa}}! ({lakasTulajdonosa})'
  };

  const matchA = evaluateFlatAgainstRule(rule, flatA, { name: 'Minta Ház' });
  assert.ok(matchA);
  assert.equal(matchA.context.lakas_tulajdonosa, 'Nagy Anna');
  assert.equal(matchA.context.lakasTulajdonosa, 'Nagy Anna');
  assert.equal(matchA.renderedSubject, 'Felszólítás: Nagy Anna');
  assert.equal(matchA.renderedBody, 'Kedves Nagy Anna! (Nagy Anna)');

  // Backward compatibility with {{tulajdonos_neve}}
  const legacyRule = {
    id: 'r-legacy-tag',
    monthThreshold: 1.0,
    templateSubject: 'Subj',
    templateBody: 'Kedves {{tulajdonos_neve}}! ({tulajdonosNeve})'
  };
  const matchB = evaluateFlatAgainstRule(legacyRule, flatB, { name: 'Minta Ház' });
  assert.ok(matchB);
  assert.equal(matchB.renderedBody, 'Kedves Kiss Péter, Kiss Éva! (Kiss Péter, Kiss Éva)');
});

test('16. DEFAULT_DUNNING_RULES presets are all disabled (enabled: false) by default', () => {
  assert.ok(DEFAULT_DUNNING_RULES.length >= 3, 'Should provide at least 3 default dunning rules');
  DEFAULT_DUNNING_RULES.forEach((rule) => {
    assert.equal(rule.enabled, false, `Preset rule ${rule.id} must be disabled by default so users can opt-in`);
  });
});

test('17. deleteEmailRule updates vault.deletedIds and mergeStateWithCloud prevents resurrecting deleted rules', () => {
  let state = {
    currentUser: { id: 'u-owner', email: 'owner@test.hu', role: 'admin' },
    emailRules: [
      { id: 'rule-keep', name: 'Megtartandó szabály', enabled: false },
      { id: 'rule-delete', name: 'Törlendő szabály', enabled: false }
    ],
    revision: 5
  };

  const persistState = (updater) => {
    state = typeof updater === 'function' ? updater(state) : updater;
  };

  const { deleteEmailRule } = createEmailActions({
    state,
    persistState
  });

  // Delete the rule
  const deleted = deleteEmailRule('rule-delete');
  assert.equal(deleted, true);
  assert.equal(state.emailRules.length, 1);
  assert.equal(state.emailRules[0].id, 'rule-keep');
  assert.ok(state.vault.deletedIds.includes('rule-delete'), 'vault.deletedIds must contain the deleted ruleId');

  // Simulate another browser session (local) that still has the deleted rule in cache
  const staleLocalSession = {
    revision: 3,
    lastUpdated: 1000,
    currentUser: { id: 'u-staff', email: 'staff@test.hu', role: 'admin' },
    buildings: [{ id: 'b1', name: 'Ház 1' }],
    emailRules: [
      { id: 'rule-keep', name: 'Megtartandó szabály', enabled: false },
      { id: 'rule-delete', name: 'Törlendő szabály', enabled: false } // Stale copy in another session
    ]
  };

  // Authoritative cloud received owner deletion
  const authoritativeCloud = {
    revision: 6,
    lastUpdated: '2026-11-23T20:30:00Z',
    buildings: [{ id: 'b1', name: 'Ház 1' }],
    emailRules: [
      { id: 'rule-keep', name: 'Megtartandó szabály', enabled: false }
    ],
    vault: {
      deletedIds: ['rule-delete']
    }
  };

  const merged = mergeStateWithCloud(staleLocalSession, authoritativeCloud);
  assert.equal(merged.emailRules.length, 1, 'Merged rules must have only 1 rule');
  assert.equal(merged.emailRules[0].id, 'rule-keep');
  assert.equal(merged.emailRules.some(r => r.id === 'rule-delete'), false, 'Deleted rule must NOT be resurrected by stale local cache');
});

test('18. getBudapestTimeParts extracts accurate Europe/Budapest hour, day, and date string', () => {
  // Test with UTC 06:00 on November 24th -> Budapest (UTC+1 winter time) is 07:00
  const utc7 = new Date('2026-11-24T06:30:00Z');
  const parts7 = getBudapestTimeParts(utc7);
  assert.equal(parts7.day, 24);
  assert.equal(parts7.hour, 7);
  assert.equal(parts7.dateStr, '2026-11-24');

  // Test with UTC 07:00 on November 24th -> Budapest is 08:00
  const utc8 = new Date('2026-11-24T07:00:00Z');
  const parts8 = getBudapestTimeParts(utc8);
  assert.equal(parts8.day, 24);
  assert.equal(parts8.hour, 8);
  assert.equal(parts8.dateStr, '2026-11-24');
});

test('19. shouldRuleAutoDispatchToday blocks execution before 08:00 AM, matches on 08:00+ on target day, and prevents duplicate dispatch on same day', () => {
  const sampleRule = {
    id: 'rule-24',
    name: '24-i emlékeztető',
    enabled: true,
    checkDayOfMonth: 24,
    lastAutoDispatchedDate: null
  };

  // 1. Before 08:00 (e.g. 07:30 Budapest time) -> must NOT run
  const time730 = new Date('2026-11-24T06:30:00Z'); // 07:30 Budapest
  assert.equal(shouldRuleAutoDispatchToday(sampleRule, { currentDate: time730 }), false);

  // 2. Disabled rule at 08:00 -> must NOT run
  const disabledRule = { ...sampleRule, enabled: false };
  const time800 = new Date('2026-11-24T07:00:00Z'); // 08:00 Budapest
  assert.equal(shouldRuleAutoDispatchToday(disabledRule, { currentDate: time800 }), false);

  // 3. Different check day (e.g. rule is for 25th, but today is 24th) -> must NOT run
  const rule25 = { ...sampleRule, checkDayOfMonth: 25 };
  assert.equal(shouldRuleAutoDispatchToday(rule25, { currentDate: time800 }), false);

  // 4. Enabled rule on 24th at 08:00 Budapest time -> MUST run!
  assert.equal(shouldRuleAutoDispatchToday(sampleRule, { currentDate: time800 }), true);

  // 5. Later in the day on the 24th (e.g. 10:15 Budapest time) if not yet run -> MUST run!
  const time1015 = new Date('2026-11-24T09:15:00Z'); // 10:15 Budapest
  assert.equal(shouldRuleAutoDispatchToday(sampleRule, { currentDate: time1015 }), true);

  // 6. Already dispatched today -> must NOT run again (prevents duplicate dispatching)
  const alreadyRanRule = { ...sampleRule, lastAutoDispatchedDate: '2026-11-24' };
  assert.equal(shouldRuleAutoDispatchToday(alreadyRanRule, { currentDate: time800 }), false);
  assert.equal(shouldRuleAutoDispatchToday(alreadyRanRule, { currentDate: time1015 }), false);

  // 7. Custom dispatchTime (e.g. 14:30)
  const ruleAfternoon = { ...sampleRule, dispatchTime: '14:30' };
  // At 10:15 Budapest -> must NOT run yet (too early)
  assert.equal(shouldRuleAutoDispatchToday(ruleAfternoon, { currentDate: time1015 }), false);
  // At 14:30 Budapest (13:30 UTC) -> MUST run!
  const time1430 = new Date('2026-11-24T13:30:00Z');
  assert.equal(shouldRuleAutoDispatchToday(ruleAfternoon, { currentDate: time1430 }), true);
  // At 16:00 Budapest -> MUST run if not yet dispatched
  const time1600 = new Date('2026-11-24T15:00:00Z');
  assert.equal(shouldRuleAutoDispatchToday(ruleAfternoon, { currentDate: time1600 }), true);

  // 8. Day 1 rule tested on Day 24 -> must NEVER run on Day 24
  const ruleDay1 = { ...sampleRule, checkDayOfMonth: 1, dispatchTime: '08:00' };
  assert.equal(shouldRuleAutoDispatchToday(ruleDay1, { currentDate: time800 }), false);
  assert.equal(shouldRuleAutoDispatchToday(ruleDay1, { currentDate: time1430 }), false);
  assert.equal(shouldRuleAutoDispatchToday(ruleDay1, { currentDate: time1600 }), false);
});

test('20. evaluateRulesForAutoDispatch and executeAutomatedDunningDailyCheck automatically process due rules, mark lastAutoDispatchedDate, and log to outbox', async () => {
  const activeRule = {
    id: 'rule-auto-24',
    name: '1 havi tartozás 24-én',
    enabled: true,
    checkDayOfMonth: 24,
    monthThreshold: 1.0,
    minAmountHuf: 5000,
    operator: 'OR',
    templateSubject: 'Fizetési emlékeztető: {{tarsashaz_neve}}, {{lakas_szam}}.',
    templateBody: 'Kedves {{lakas_tulajdonosa}}! Tartozás: {{hatralek_osszeg}}.'
  };

  const sampleBuilding = {
    id: 'b-auto',
    name: 'Teszt Ház',
    officialName: 'Teszt Társasház Kft.',
    bankKK: '11700000-11111111',
    flats: [
      {
        id: 'f-1',
        flatNum: '101',
        ownerName: 'Nagy Anna',
        email: 'anna@teszt.hu',
        monthlyFee: 20000,
        balance: -25000 // 1.25 months debt -> matches rule
      },
      {
        id: 'f-2',
        flatNum: '102',
        ownerName: 'Kiss Béla',
        email: 'bela@teszt.hu',
        monthlyFee: 20000,
        balance: 5000 // In surplus -> never dunned
      }
    ]
  };

  let state = {
    currentUser: { id: 'admin-1', email: 'admin@tarsasapp.hu', role: 'admin' },
    buildings: [sampleBuilding],
    emailRules: [activeRule],
    emailOutbox: [],
    notifications: [],
    organizations: [{ id: 'org-1', ownerUid: 'admin-1' }],
    repProfile: { name: 'Közös Képviselő Kft.' }
  };

  const persistState = (updater) => {
    state = typeof updater === 'function' ? updater(state) : updater;
  };

  const emailActions = createEmailActions({
    state,
    getState: () => state,
    persistState
  });

  // 1. Run at 07:45 Budapest time -> should NOT run yet
  const resBefore8 = await emailActions.executeAutomatedDunningDailyCheck({
    testDate: new Date('2026-11-24T06:45:00Z'), // 07:45 Budapest
    dryRunOnly: true
  });
  assert.equal(resBefore8.ran, false);
  assert.equal(resBefore8.reason, 'before-8am');

  // 2. Run at 08:00 Budapest time -> MUST execute and process flat 101!
  const resAt8 = await emailActions.executeAutomatedDunningDailyCheck({
    testDate: new Date('2026-11-24T07:00:00Z'), // 08:00 Budapest
    dryRunOnly: true
  });
  assert.equal(resAt8.ran, true);
  assert.equal(resAt8.processedRulesCount, 1);
  assert.equal(resAt8.outboxEntriesCount, 1);

  // Check state mutations
  const updatedRule = state.emailRules.find(r => r.id === 'rule-auto-24');
  assert.equal(updatedRule.lastAutoDispatchedDate, '2026-11-24');
  assert.ok(updatedRule.lastAutoDispatchedAt);

  // Outbox entries
  assert.equal(state.emailOutbox.length, 1);
  const outboxEntry = state.emailOutbox[0];
  assert.equal(outboxEntry.flatNum, '101');
  assert.equal(outboxEntry.recipientName, 'Nagy Anna');
  assert.equal(outboxEntry.autoDispatched, true);
  assert.ok(outboxEntry.subject.includes('101'));

  // 3. Second run immediately after -> MUST be skipped because already dispatched today!
  const resDuplicate = await emailActions.executeAutomatedDunningDailyCheck({
    testDate: new Date('2026-11-24T07:05:00Z'),
    dryRunOnly: true
  });
  assert.equal(resDuplicate.ran, false);
  assert.equal(resDuplicate.reason, 'no-due-rules');
  assert.equal(state.emailOutbox.length, 1, 'Outbox must NOT have duplicates on the same day');
});

test('21. Channel selection: respect sendEmail and sendInApp toggles independently', async () => {
  const sampleBuilding = {
    id: 'b-chan',
    name: 'Csatorna Ház',
    officialName: 'Csatorna Társasház',
    bankKK: '11700000-11111111',
    flats: [
      {
        id: 'f-c1',
        flatNum: '201',
        ownerName: 'Varga Péter',
        email: 'peter@varga.hu',
        monthlyFee: 15000,
        balance: -30000 // 2 months debt
      }
    ]
  };

  // Case A: in-app only rule (sendEmail: false, sendInApp: true)
  const inAppOnlyRule = {
    id: 'rule-inapp-only',
    name: 'Csak app értesítés',
    enabled: true,
    checkDayOfMonth: 24,
    monthThreshold: 1.0,
    sendEmail: false,
    sendInApp: true,
    templateSubject: 'Belső értesítő: {{lakas_szam}}.',
    templateBody: 'Tartozás: {{hatralek_osszeg}}.'
  };

  let stateA = {
    currentUser: { id: 'admin-1', email: 'admin@tarsasapp.hu', role: 'admin' },
    buildings: [sampleBuilding],
    emailRules: [inAppOnlyRule],
    emailOutbox: [],
    notifications: [],
    organizations: [{ id: 'org-1', ownerUid: 'admin-1' }],
    repProfile: { name: 'Közös Képviselő Kft.' }
  };

  const actionsA = createEmailActions({
    state: stateA,
    getState: () => stateA,
    persistState: (u) => { stateA = typeof u === 'function' ? u(stateA) : u; }
  });

  const resA = await actionsA.executeAutomatedDunningDailyCheck({
    testDate: new Date('2026-11-24T07:00:00Z'), // 08:00 Budapest
    dryRunOnly: false
  });

  assert.equal(resA.ran, true);
  assert.equal(stateA.notifications.length, 1, 'In-app notification must be created');
  assert.equal(stateA.emailOutbox.length, 1);
  assert.equal(stateA.emailOutbox[0].status, 'in-app-only');
  assert.equal(stateA.emailOutbox[0].sendEmail, false);
  assert.equal(stateA.emailOutbox[0].sendInApp, true);

  // Case B: email only rule (sendEmail: true, sendInApp: false)
  const emailOnlyRule = {
    id: 'rule-email-only',
    name: 'Csak e-mail',
    enabled: true,
    checkDayOfMonth: 24,
    monthThreshold: 1.0,
    sendEmail: true,
    sendInApp: false,
    templateSubject: 'E-mail fizetési felszólítás: {{lakas_szam}}.',
    templateBody: 'Tartozás: {{hatralek_osszeg}}.'
  };

  let stateB = {
    currentUser: { id: 'admin-1', email: 'admin@tarsasapp.hu', role: 'admin' },
    buildings: [sampleBuilding],
    emailRules: [emailOnlyRule],
    emailOutbox: [],
    notifications: [],
    organizations: [{ id: 'org-1', ownerUid: 'admin-1' }],
    repProfile: { name: 'Közös Képviselő Kft.' }
  };

  const actionsB = createEmailActions({
    state: stateB,
    getState: () => stateB,
    persistState: (u) => { stateB = typeof u === 'function' ? u(stateB) : u; }
  });

  const resB = await actionsB.executeAutomatedDunningDailyCheck({
    testDate: new Date('2026-11-24T07:00:00Z'),
    dryRunOnly: true
  });

  assert.equal(resB.ran, true);
  assert.equal(stateB.notifications.length, 0, 'In-app notification must NOT be created when sendInApp is false');
  assert.equal(stateB.emailOutbox.length, 1);
  assert.equal(stateB.emailOutbox[0].sendEmail, true);
  assert.equal(stateB.emailOutbox[0].sendInApp, false);
});




