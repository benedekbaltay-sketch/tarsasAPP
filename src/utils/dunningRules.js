/**
 * Automated Dunning & Notification Rules Engine for TarsasApp.
 * Evaluates formula conditions, substitutes dynamic template variables,
 * and produces ready-to-dispatch or dry-run dunning communications.
 */

import { formatCurrency, getCurrentFee } from './finances.js';

export const MERGE_VARIABLES = [
  { key: 'tulajdonos_neve', alt: 'owner_name', labelHu: 'Tulajdonos neve', labelEn: 'Owner Name' },
  { key: 'lakas_szam', alt: 'flat_num', labelHu: 'Lakásszám', labelEn: 'Flat Number' },
  { key: 'tarsashaz_neve', alt: 'building_name', labelHu: 'Társasház hivatalos neve', labelEn: 'Condominium Name' },
  { key: 'tarsashaz_cime', alt: 'building_address', labelHu: 'Társasház címe', labelEn: 'Condominium Address' },
  { key: 'hatralek_osszeg', alt: 'arrears_amount', labelHu: 'Hátralék pontos összege', labelEn: 'Arrears Amount' },
  { key: 'hatralek_honapok', alt: 'arrears_months', labelHu: 'Elmaradás (hónapok száma)', labelEn: 'Arrears (Months)' },
  { key: 'albetet_havi_dij', alt: 'monthly_fee', labelHu: 'Albetét havi előírt díja', labelEn: 'Prescribed Monthly Fee' },
  { key: 'szamlaszam', alt: 'bank_account', labelHu: 'Ház bankszámlaszáma', labelEn: 'Bank Account Number' },
  { key: 'kozlemeny', alt: 'payment_reference', labelHu: 'Ajánlott banki közlemény', labelEn: 'Payment Reference' },
  { key: 'fizetesi_hatarido', alt: 'due_date', labelHu: 'Fizetési határidő (pl. 8 nap)', labelEn: 'Payment Due Date' },
  { key: 'kepviselo_neve', alt: 'manager_name', labelHu: 'Közös képviselő neve / cége', labelEn: 'Property Manager Name' },
  { key: 'kepviselo_email', alt: 'manager_email', labelHu: 'Közös képviselő e-mailje', labelEn: 'Manager Email' },
  { key: 'kepviselo_telefon', alt: 'manager_phone', labelHu: 'Közös képviselő telefonszáma', labelEn: 'Manager Phone' }
];

export const DEFAULT_DUNNING_RULES = [
  {
    id: 'rule-preset-friendly-reminder',
    name: '1 havi barátságos egyenleg-emlékeztető',
    nameEn: '1-Month Friendly Balance Reminder',
    description: 'Figyelmeztetés 1 havi díjnak megfelelő vagy minimum 5.000 Ft elmaradás esetén.',
    descriptionEn: 'Gentle reminder when debt reaches 1 month of prescribed fees or min. 5,000 Ft.',
    enabled: true,
    buildingId: 'all', // 'all' or specific building ID
    targetAccount: 'total', // 'total' | 'KK' | 'FA'
    conditionType: 'months', // 'months' | 'amount' | 'combined'
    monthThreshold: 1.0,
    minAmountHuf: 5000,
    operator: 'OR', // 'OR' | 'AND'
    checkDayOfMonth: 15,
    cooldownDays: 25,
    templateSubject: 'Egyenleg-értesítő: {{tarsashaz_neve}}, {{lakas_szam}}. lakás',
    templateSubjectEn: 'Balance Notice: {{tarsashaz_neve}}, Flat #{{lakas_szam}}',
    templateBody: `Kedves {{tulajdonos_neve}}!

Ezúton szeretnénk tájékoztatni, hogy a társasház könyvelése szerint a(z) {{tarsashaz_neve}} alatti {{lakas_szam}}. lakás egyenlegén jelenleg {{hatralek_osszeg}} elmaradás mutatkozik (amely megközelítőleg {{hatralek_honapok}} havi előírásnak felel meg).

Kérjük, szíveskedjen ellenőrizni korábbi utalásait, és az elmaradt összeget átutalni az alábbi bankszámlára:
• Kedvezményezett társasház: {{tarsashaz_neve}}
• Bankszámlaszám: {{szamlaszam}}
• Közlemény: {{kozlemeny}}
• Fizetési határidő: {{fizetesi_hatarido}}

Amennyiben az összeget a közelmúltban már kiegyenlítette, kérjük, tekintse levelünket tárgytalannak.

Üdvözlettel:
{{kepviselo_neve}}
Közös Képviselet
E-mail: {{kepviselo_email}} | Tel: {{kepviselo_telefon}}`,
    templateBodyEn: `Dear {{tulajdonos_neve}},

According to the building ledger for {{tarsashaz_neve}}, Flat #{{lakas_szam}} currently has an outstanding balance of {{hatralek_osszeg}} (equivalent to approximately {{hatralek_honapok}} months of prescribed fees).

Please review your payment records and settle the outstanding amount to the following bank account:
• Condominium: {{tarsashaz_neve}}
• Bank Account: {{szamlaszam}}
• Reference: {{kozlemeny}}
• Payment Due: {{fizetesi_hatarido}}

If you have already settled this balance recently, please disregard this notice.

Kind regards,
{{kepviselo_neve}}
Property Management
Email: {{kepviselo_email}} | Phone: {{kepviselo_telefon}}`
  },
  {
    id: 'rule-preset-formal-notice',
    name: 'Fizetési felszólítás (I. fokozat – 3 havi hátralék)',
    nameEn: 'Formal Overdue Notice (Stage 1 – 3 Months Debt)',
    description: 'Hivatalos felszólítás 3 havi elmaradás vagy legalább 30.000 Ft tartozás esetén.',
    descriptionEn: 'Formal payment demand when unpaid arrears reach 3 months or min. 30,000 Ft.',
    enabled: true,
    buildingId: 'all',
    targetAccount: 'total',
    conditionType: 'months',
    monthThreshold: 3.0,
    minAmountHuf: 30000,
    operator: 'OR',
    checkDayOfMonth: 16,
    cooldownDays: 25,
    templateSubject: 'FIZETÉSI FELSZÓLÍTÁS: {{tarsashaz_neve}} – {{lakas_szam}}. lakás',
    templateSubjectEn: 'OVERDUE PAYMENT DEMAND: {{tarsashaz_neve}} – Flat #{{lakas_szam}}',
    templateBody: `Tisztelt {{tulajdonos_neve}}!

Hivatalosan értesítjük, hogy a(z) {{tarsashaz_neve}} társasházban található {{lakas_szam}}. számú albetét tekintetében a mai napig nyilvántartott hátraléka:
{{hatralek_osszeg}}
amely {{hatralek_honapok}} havi előírás elmaradásának felel meg.

A Társasházakról szóló 2003. évi CXXXIII. törvény és a Szervezeti-Működési Szabályzat (SZMSZ) értelmében felszólítjuk, hogy a fenti összeget a kézhezvételtől számított {{fizetesi_hatarido}} banki átutalással fizesse meg:

• Bankszámlaszám: {{szamlaszam}}
• Közlemény (kötelező): {{kozlemeny}}

Tájékoztatjuk, hogy a határidő eredménytelen elteltét követően a társasház kénytelen lesz megtenni a szükséges jogi lépéseket (fizetési meghagyásos eljárás, jelzálogjog bejegyzése).

Kérjük, működjön együtt a tartozás mielőbbi rendezésében!

Tisztelettel:
{{kepviselo_neve}}
Közös Képviselet
E-mail: {{kepviselo_email}} | Tel: {{kepviselo_telefon}}`,
    templateBodyEn: `Dear {{tulajdonos_neve}},

You are formally notified that Flat #{{lakas_szam}} in {{tarsashaz_neve}} has accumulated an unpaid overdue balance of:
{{hatralek_osszeg}}
(equivalent to {{hatralek_honapok}} months of common charges).

In accordance with Act CXXXIII of 2003 on Condominiums and the House Bylaws (SZMSZ), you are hereby requested to settle this amount within {{fizetesi_hatarido}} via bank transfer:

• Bank Account: {{szamlaszam}}
• Reference (Required): {{kozlemeny}}

Please note that failure to pay within this timeframe will result in immediate legal enforcement (order for payment procedure, statutory mortgage recording).

Respectfully,
{{kepviselo_neve}}
Property Management
Email: {{kepviselo_email}} | Phone: {{kepviselo_telefon}}`
  },
  {
    id: 'rule-preset-legal-warning',
    name: 'Jogi eljárás előtti utolsó figyelmeztetés (6+ havi vagy >100.000 Ft)',
    nameEn: 'Final Demand Before Legal Action (6+ Months or >100,000 Ft)',
    description: 'Szigorú végső figyelmeztetés fizetési meghagyás (FMH) kibocsátása előtt.',
    descriptionEn: 'Strict final notice prior to initiating formal civil court / notary payment order (FMH).',
    enabled: false,
    buildingId: 'all',
    targetAccount: 'total',
    conditionType: 'combined',
    monthThreshold: 6.0,
    minAmountHuf: 100000,
    operator: 'OR',
    checkDayOfMonth: 20,
    cooldownDays: 30,
    templateSubject: 'VÉGSŐ FIGYELMEZTETÉS JOGI ELJÁRÁS ELŐTT – {{tarsashaz_neve}}, {{lakas_szam}}. lakás',
    templateSubjectEn: 'FINAL WARNING BEFORE LEGAL PROCEEDINGS – {{tarsashaz_neve}}, Flat #{{lakas_szam}}',
    templateBody: `Tisztelt {{tulajdonos_neve}}!

A(z) {{tarsashaz_neve}} közös képviselete ezúton küldi az UTOLSÓ FELSZÓLÍTÁST a(z) {{lakas_szam}}. lakás kapcsán felhalmozott {{hatralek_osszeg}} összegű tartozás azonnali rendezésére (elmaradás: {{hatralek_honapok}} hó).

Amennyiben az összeg legkésőbb {{fizetesi_hatarido}} nem érkezik meg a társasház alábbi számlájára:
• Bankszámlaszám: {{szamlaszam}}
• Közlemény: {{kozlemeny}}

A társasház ügyvédje útján fizetési meghagyásos (FMH) eljárást indít a Magyar Országos Közjegyzői Kamara (MOKK) rendszerén keresztül, és a társasházi törvény alapján jelzálogjogot jegyeztet be az ingatlan tulajdoni lapjára. Az eljárási és perköltségek, valamint a végrehajtási díjak teljes egészében a tulajdonost terhelik.

Kérjük, azonnal vegye fel a kapcsolatot a képviselettel!

{{kepviselo_neve}}
Közös Képviselet
E-mail: {{kepviselo_email}} | Telefon: {{kepviselo_telefon}}`,
    templateBodyEn: `Dear {{tulajdonos_neve}},

The property management of {{tarsashaz_neve}} issues this FINAL NOTICE regarding the outstanding debt of {{hatralek_osszeg}} on Flat #{{lakas_szam}} (delinquency: {{hatralek_honapok}} months).

Unless the full balance is credited by {{fizetesi_hatarido}} to:
• Bank Account: {{szamlaszam}}
• Reference: {{kozlemeny}}

The condominium will initiate formal court enforcement (FMH order for payment) through legal counsel and record a statutory lien on the property title deed. All court, legal, and enforcement costs will be borne by the owner.

Please contact the management immediately.

{{kepviselo_neve}}
Property Management
Email: {{kepviselo_email}} | Phone: {{kepviselo_telefon}}`
  }
];

/**
 * Replaces merge tags like {{tulajdonos_neve}} or {{owner_name}} with real context values.
 */
export function renderEmailTemplate(templateStr = '', context = {}) {
  if (!templateStr || typeof templateStr !== 'string') return '';

  let rendered = templateStr;

  MERGE_VARIABLES.forEach(({ key, alt }) => {
    const val = context[key] !== undefined ? context[key] : (context[alt] !== undefined ? context[alt] : '');
    const regex1 = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    const regex2 = new RegExp(`\\{\\{\\s*${alt}\\s*\\}\\}`, 'gi');
    rendered = rendered.replace(regex1, String(val)).replace(regex2, String(val));
  });

  return rendered;
}

/**
 * Evaluates a single flat against a dunning rule.
 * 
 * @param {Object} rule - The rule configuration
 * @param {Object} flat - The unit/flat data
 * @param {Object} building - The building data (bank accounts, address, name)
 * @param {Object} options - Additional context (repProfile, currentDate, history)
 * @returns {Object|null} Matching report with rendered templates if matched; null otherwise.
 */
export function evaluateFlatAgainstRule(rule, flat, building = {}, options = {}) {
  if (!rule || !flat) return null;

  const targetAccount = rule.targetAccount || 'total';
  let balance = 0;
  let monthlyFee = 0;

  const kkFee = getCurrentFee(flat, 'KK') > 0 ? getCurrentFee(flat, 'KK') : (Number(flat.monthlyFee) || 0);
  const faFee = getCurrentFee(flat, 'FA') > 0 ? getCurrentFee(flat, 'FA') : (Number(flat.renovationFee) || 0);

  if (targetAccount === 'KK') {
    balance = Number(flat.balance) || 0;
    monthlyFee = kkFee;
  } else if (targetAccount === 'FA') {
    balance = Number(flat.renovationBalance) || 0;
    monthlyFee = faFee;
  } else {
    // Total arrears (KK + FA + custom accounts)
    const customSum = (flat.customAccounts || []).reduce((acc, c) => acc + (Number(c.balance) || 0), 0);
    balance = (Number(flat.balance) || 0) + (Number(flat.renovationBalance) || 0) + customSum;
    monthlyFee = kkFee + faFee;
  }

  // If balance >= 0, flat has zero arrears -> never dunn
  if (balance >= 0) return null;

  const arrearsHuf = Math.abs(balance);
  const arrearsMonths = monthlyFee > 0 ? Number((arrearsHuf / monthlyFee).toFixed(1)) : 0;

  const monthThreshold = Number(rule.monthThreshold) || 1.0;
  const minAmountHuf = Number(rule.minAmountHuf) || 0;
  const conditionType = rule.conditionType || 'months'; // 'months' | 'amount' | 'combined'
  const operator = rule.operator || 'OR';

  let matches = false;

  const matchesMonths = arrearsMonths >= monthThreshold;
  const matchesAmount = arrearsHuf >= minAmountHuf;

  if (conditionType === 'months') {
    matches = matchesMonths;
  } else if (conditionType === 'amount') {
    matches = matchesAmount;
  } else if (conditionType === 'combined') {
    matches = operator === 'AND' ? (matchesMonths && matchesAmount) : (matchesMonths || matchesAmount);
  }

  if (!matches) return null;

  // Check cooldown if history is provided
  const now = options.currentDate ? new Date(options.currentDate) : new Date();
  const cooldownDays = Number(rule.cooldownDays) || 0;

  if (cooldownDays > 0 && Array.isArray(options.history)) {
    const cutoffTime = now.getTime() - (cooldownDays * 24 * 60 * 60 * 1000);
    const recentSent = options.history.some(log => {
      if (log.ruleId !== rule.id) return false;
      if (log.flatNum !== flat.flatNum && log.unitId !== flat.id) return false;
      const logTime = new Date(log.sentAt || log.createdAt).getTime();
      return logTime >= cutoffTime;
    });
    if (recentSent) return null;
  }

  // Resolve building bank account based on target account
  let bankAccount = building.bankKK || building.bankAccount || '';
  if (targetAccount === 'FA' && building.bankFA) {
    bankAccount = building.bankFA;
  }

  // Primary owner contact
  const ownerName = flat.owner || flat.name || (options.isEn ? `Owner of Flat ${flat.flatNum}` : `${flat.flatNum}. lakás tulajdonosa`);
  const ownerEmail = flat.email || (Array.isArray(flat.owners) ? flat.owners.find(o => o.email)?.email : '') || '';
  const buildingName = building.officialName || building.name || (options.isEn ? 'Condominium' : 'Társasház');
  const buildingAddress = building.address || '';

  const repProfile = options.repProfile || {};
  const managerName = repProfile.companyName || repProfile.name || (options.isEn ? 'Property Management' : 'Közös Képviselet');
  const managerEmail = repProfile.email || 'info@tarsasapp.hu';
  const managerPhone = repProfile.phone || '';

  // Payment reference
  const paymentRef = `${flat.flatNum}. ${targetAccount === 'FA' ? 'felújítási alap' : 'közös költség'}`;

  // Default payment due date: 8 days from now
  const dueDate = new Date(now.getTime() + (8 * 24 * 60 * 60 * 1000));
  const dueDateFormatted = options.isEn
    ? dueDate.toLocaleDateString('en-GB')
    : `${dueDate.getFullYear()}. ${String(dueDate.getMonth() + 1).padStart(2, '0')}. ${String(dueDate.getDate()).padStart(2, '0')}.`;

  const context = {
    tulajdonos_neve: ownerName,
    owner_name: ownerName,
    lakas_szam: flat.flatNum,
    flat_num: flat.flatNum,
    tarsashaz_neve: buildingName,
    building_name: buildingName,
    tarsashaz_cime: buildingAddress,
    building_address: buildingAddress,
    hatralek_osszeg: formatCurrency(-arrearsHuf),
    arrears_amount: formatCurrency(-arrearsHuf),
    hatralek_honapok: arrearsMonths.toString(),
    arrears_months: arrearsMonths.toString(),
    albetet_havi_dij: formatCurrency(monthlyFee),
    monthly_fee: formatCurrency(monthlyFee),
    szamlaszam: bankAccount || (options.isEn ? 'Not specified' : 'Nincs megadva'),
    bank_account: bankAccount || (options.isEn ? 'Not specified' : 'Nincs megadva'),
    kozlemeny: paymentRef,
    payment_reference: paymentRef,
    fizetesi_hatarido: dueDateFormatted,
    due_date: dueDateFormatted,
    kepviselo_neve: managerName,
    manager_name: managerName,
    kepviselo_email: managerEmail,
    manager_email: managerEmail,
    kepviselo_telefon: managerPhone,
    manager_phone: managerPhone
  };

  const isEn = Boolean(options.isEn);
  const subjectTemplate = isEn && rule.templateSubjectEn ? rule.templateSubjectEn : rule.templateSubject;
  const bodyTemplate = isEn && rule.templateBodyEn ? rule.templateBodyEn : rule.templateBody;

  return {
    flatNum: flat.flatNum,
    unitId: flat.id,
    buildingId: building.id,
    buildingName,
    ownerName,
    ownerEmail,
    balance,
    arrearsHuf,
    arrearsMonths,
    monthlyFee,
    targetAccount,
    context,
    renderedSubject: renderEmailTemplate(subjectTemplate, context),
    renderedBody: renderEmailTemplate(bodyTemplate, context)
  };
}

/**
 * Runs a Dry Run evaluation of a rule across all or specified buildings/flats.
 */
export function runDunningDryRun(rule, buildings = [], flatsByBuilding = {}, options = {}) {
  if (!rule) return [];

  const targetBuildings = (rule.buildingId && rule.buildingId !== 'all')
    ? buildings.filter(b => b.id === rule.buildingId)
    : buildings;

  const matches = [];

  for (const b of targetBuildings) {
    const flats = flatsByBuilding[b.id] || b.flats || [];
    for (const f of flats) {
      const match = evaluateFlatAgainstRule(rule, f, b, options);
      if (match) {
        matches.push(match);
      }
    }
  }

  return matches;
}

/**
 * Generates a realistic sample email preview for a single flat (either chosen, matched, or random).
 * If the selected flat does not currently have matching arrears, realistically simulates arrears
 * according to the rule's threshold so that all merge tags ({{hatralek_osszeg}}, {{hatralek_honapok}}, etc.)
 * are rendered cleanly and visibly.
 * 
 * @param {Object} rule - The dunning rule configuration
 * @param {Array} buildings - Array of buildings from state
 * @param {Object} options - Options: { buildingId, flatNum, unitId, seedIndex, isEn, repProfile }
 * @returns {Object} Preview data with renderedSubject, renderedBody, flat, building, isSimulated, allUnits
 */
export function generateSampleFlatPreview(rule, buildings = [], options = {}) {
  if (!rule) return null;

  const targetBuildings = (rule.buildingId && rule.buildingId !== 'all')
    ? buildings.filter(b => b.id === rule.buildingId)
    : (options.buildingId && options.buildingId !== 'all')
      ? buildings.filter(b => b.id === options.buildingId)
      : buildings;

  const effectiveBuildings = targetBuildings.length > 0 ? targetBuildings : buildings;

  // Flatten all available units
  const allUnits = [];
  for (const b of effectiveBuildings) {
    for (const f of (b.flats || [])) {
      allUnits.push({ flat: f, building: b });
    }
  }

  let selectedUnit = null;

  // 1. If options specify flatNum and/or buildingId
  if (options.flatNum !== undefined && options.flatNum !== null) {
    selectedUnit = allUnits.find(u => 
      String(u.flat.flatNum) === String(options.flatNum) &&
      (!options.buildingId || options.buildingId === 'all' || u.building.id === options.buildingId)
    );
  }

  // 2. If options specify seedIndex
  if (!selectedUnit && typeof options.seedIndex === 'number' && allUnits.length > 0) {
    const safeIdx = Math.abs(options.seedIndex) % allUnits.length;
    selectedUnit = allUnits[safeIdx];
  }

  // 3. Fallback to first unit, or dummy unit if no buildings/flats exist
  if (!selectedUnit && allUnits.length > 0) {
    selectedUnit = allUnits[0];
  }

  const isEn = Boolean(options.isEn);

  if (!selectedUnit) {
    // Demo fallback when codebase has 0 buildings or flats
    selectedUnit = {
      building: {
        id: 'demo-building',
        name: isEn ? 'Sunflower Condominium' : 'Napfény Társasház',
        officialName: isEn ? 'Sunflower Condominium' : 'Napfény Társasház',
        address: isEn ? '1052 Budapest, Main Street 12.' : '1052 Budapest, Fő utca 12.',
        bankKK: '11705008-20456789-00000000',
        bankAccount: '11705008-20456789-00000000'
      },
      flat: {
        id: 'demo-flat-1',
        flatNum: 12,
        owner: isEn ? 'John Smith' : 'Kovács István',
        email: 'kovacs.istvan@pelda.hu',
        monthlyFee: 24500,
        renovationFee: 6500,
        balance: 0,
        renovationBalance: 0
      }
    };
  }

  const { flat, building } = selectedUnit;

  // Check if flat already naturally matches the rule
  const naturalMatch = evaluateFlatAgainstRule(rule, flat, building, {
    ...options,
    cooldownDays: 0 // bypass cooldown for preview
  });

  const allUnitsList = allUnits.map(u => ({
    buildingId: u.building.id,
    buildingName: u.building.officialName || u.building.name,
    flatNum: u.flat.flatNum,
    ownerName: u.flat.owner || u.flat.name || (isEn ? `Flat ${u.flat.flatNum}` : `${u.flat.flatNum}. lakás`)
  }));

  if (naturalMatch) {
    return {
      ...naturalMatch,
      isSimulated: false,
      allUnits: allUnitsList
    };
  }

  // If flat does not naturally match, simulate realistic arrears according to the formula
  const kkFee = getCurrentFee(flat, 'KK') > 0 ? getCurrentFee(flat, 'KK') : (Number(flat.monthlyFee) || 22000);
  const faFee = getCurrentFee(flat, 'FA') > 0 ? getCurrentFee(flat, 'FA') : (Number(flat.renovationFee) || 6000);
  const baseMonthly = rule.targetAccount === 'FA' ? faFee : (rule.targetAccount === 'KK' ? kkFee : (kkFee + faFee));
  const effectiveMonthly = baseMonthly > 0 ? baseMonthly : 25000;

  const thresholdMonths = Number(rule.monthThreshold) || 1.0;
  const minAmount = Number(rule.minAmountHuf) || 0;

  // Realistic sample: threshold + 0.2-0.5 months
  const simMonths = Number((thresholdMonths > 0 ? thresholdMonths + 0.2 : 2.5).toFixed(1));
  const calculatedArrears = Math.round(simMonths * effectiveMonthly);
  const simArrears = Math.max(calculatedArrears, minAmount > 0 ? minAmount + 5000 : 35000);

  const simulatedFlat = {
    ...flat,
    balance: rule.targetAccount === 'FA' ? (flat.balance || 0) : -simArrears,
    renovationBalance: rule.targetAccount === 'FA' ? -simArrears : (flat.renovationBalance || 0)
  };

  const simResult = evaluateFlatAgainstRule(rule, simulatedFlat, building, {
    ...options,
    cooldownDays: 0
  });

  return {
    ...(simResult || {}),
    isSimulated: true,
    allUnits: allUnitsList
  };
}
