/**
 * Automated Dunning & Notification Rules Engine for TarsasApp.
 * Evaluates formula conditions, substitutes dynamic template variables,
 * and produces ready-to-dispatch or dry-run dunning communications.
 */

import { formatCurrency, getCurrentFee } from './finances.js';
import { getServerNow, getBudapestNowParts } from './serverClock.js';

export const MERGE_VARIABLES = [
  { key: 'lakas_tulajdonosa', alt: 'flat_owner', labelHu: 'A lakás tulajdonosa (vagy megszólított tulajdonos)', labelEn: 'Flat Owner (or Addressed Owner)' },
  { key: 'tulajdonos_neve', alt: 'owner_name', labelHu: 'Tulajdonos neve', labelEn: 'Owner Name' },
  { key: 'osszes_tulajdonos', alt: 'all_owners', labelHu: 'Összes tulajdonos neve (társtulajdonosok is)', labelEn: 'All Owners (Including Co-owners)' },
  { key: 'lakas_szam', alt: 'flat_num', labelHu: 'Lakásszám', labelEn: 'Flat Number' },
  { key: 'tarsashaz_neve', alt: 'building_name', labelHu: 'Társasház hivatalos neve', labelEn: 'Condominium Name' },
  { key: 'tarsashaz_cime', alt: 'building_address', labelHu: 'Társasház címe', labelEn: 'Condominium Address' },
  { key: 'hatralek_osszeg', alt: 'arrears_amount', labelHu: 'Hátralék pontos összege', labelEn: 'Arrears Amount' },
  { key: 'hatralek_honapok', alt: 'arrears_months', labelHu: 'Elmaradás (hónapok száma)', labelEn: 'Arrears (Months)' },
  { key: 'albetet_havi_dij', alt: 'monthly_fee', labelHu: 'Albetét havi előírt díja', labelEn: 'Prescribed Monthly Fee' },
  { key: 'fizetesi_adatok', alt: 'payment_details', labelHu: 'Fizetési adatok számlánként (bankszámlák, közlemény, összegek)', labelEn: 'Payment Details by Account (Bank accounts, References, Amounts)' },
  { key: 'fizetesi_hatarido', alt: 'due_date', labelHu: 'Fizetési határidő (pl. 8 nap)', labelEn: 'Payment Due Date' },
  { key: 'szamlaszam', alt: 'bank_account', labelHu: 'Ház elsődleges bankszámlája', labelEn: 'Primary Bank Account' },
  { key: 'kozlemeny', alt: 'payment_reference', labelHu: 'Ajánlott banki közlemény', labelEn: 'Payment Reference' },
  { key: 'kepviselo_neve', alt: 'manager_name', labelHu: 'Közös képviselő neve (személy)', labelEn: 'Property Manager Personal Name' },
  { key: 'ceg_neve', alt: 'company_name', labelHu: 'Cégnév / Vállalkozás neve', labelEn: 'Company / Business Name' },
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
    enabled: false,
    buildingId: 'all', // 'all' or specific building ID
    targetAccount: 'per_account', // 'per_account' | 'total' | 'KK' | 'FA'
    conditionType: 'months', // 'months' | 'amount' | 'combined'
    monthThreshold: 1.0,
    maxMonthThreshold: null, // Optional upper bound (e.g. 2.0 for range 1.0 - 2.0)
    minAmountHuf: 5000,
    operator: 'OR', // 'OR' | 'AND'
    checkDayOfMonth: 24,
    dispatchTime: '08:00',
    cooldownDays: 25,
    crossRuleCooldown: true, // Prevents duplicate notice if another dunning rule triggered within cooldown
    sendEmail: true,
    sendInApp: true,
    templateSubject: 'Egyenleg-értesítő: {{tarsashaz_neve}}, {{lakas_szam}}. lakás',
    templateSubjectEn: 'Balance Notice: {{tarsashaz_neve}}, Flat #{{lakas_szam}}',
    templateBody: `Kedves {{lakas_tulajdonosa}}!

Ezúton szeretnénk tájékoztatni, hogy a társasház könyvelése szerint a(z) {{tarsashaz_neve}} alatti {{lakas_szam}}. lakás egyenlegén jelenleg {{hatralek_osszeg}} elmaradás mutatkozik (amely megközelítőleg {{hatralek_honapok}} havi előírásnak felel meg).

Kérjük, szíveskedjen ellenőrizni korábbi utalásait, és az elmaradt összeget átutalni az alábbi adatok szerint:

{{fizetesi_adatok}}
• Fizetési határidő: {{fizetesi_hatarido}}

Amennyiben az összeget a közelmúltban már kiegyenlítette, kérjük, tekintse levelünket tárgytalannak.

Üdvözlettel:
{{kepviselo_neve}}
{{ceg_neve}}
E-mail: {{kepviselo_email}} | Tel: {{kepviselo_telefon}}`,
    templateBodyEn: `Dear {{flat_owner}},

According to the building ledger for {{tarsashaz_neve}}, Flat #{{lakas_szam}} currently has an outstanding balance of {{hatralek_osszeg}} (equivalent to approximately {{hatralek_honapok}} months of prescribed fees).

Please review your payment records and settle the outstanding amount according to the details below:

{{payment_details}}
• Payment Due Date: {{due_date}}

If you have already settled this balance recently, please disregard this notice.

Kind regards,
{{kepviselo_neve}}
{{company_name}}
Email: {{kepviselo_email}} | Phone: {{kepviselo_telefon}}`
  },
  {
    id: 'rule-preset-formal-notice',
    name: 'Fizetési felszólítás (I. fokozat – 3 havi hátralék)',
    nameEn: 'Formal Overdue Notice (Stage 1 – 3 Months Debt)',
    description: 'Hivatalos felszólítás 3 havi elmaradás vagy legalább 30.000 Ft tartozás esetén.',
    descriptionEn: 'Formal payment demand when unpaid arrears reach 3 months or min. 30,000 Ft.',
    enabled: false,
    buildingId: 'all',
    targetAccount: 'per_account',
    conditionType: 'months',
    monthThreshold: 3.0,
    maxMonthThreshold: null,
    minAmountHuf: 30000,
    operator: 'OR',
    checkDayOfMonth: 25,
    dispatchTime: '08:00',
    cooldownDays: 25,
    crossRuleCooldown: true,
    sendEmail: true,
    sendInApp: true,
    templateSubject: 'FIZETÉSI FELSZÓLÍTÁS: {{tarsashaz_neve}} – {{lakas_szam}}. lakás',
    templateSubjectEn: 'OVERDUE PAYMENT DEMAND: {{tarsashaz_neve}} – Flat #{{lakas_szam}}',
    templateBody: `Tisztelt {{lakas_tulajdonosa}}!

Hivatalosan értesítjük, hogy a(z) {{tarsashaz_neve}} társasházban található {{lakas_szam}}. számú albetét tekintetében a mai napig nyilvántartott hátraléka:
{{hatralek_osszeg}}
amely {{hatralek_honapok}} havi előírás elmaradásának felel meg.

A Társasházakról szóló 2003. évi CXXXIII. törvény és a Szervezeti-Működési Szabályzat (SZMSZ) értelmében felszólítjuk, hogy a fenti összeget a kézhezvételtől számított póthatáridőn belül ({{fizetesi_hatarido}}) banki átutalással fizesse meg:

{{fizetesi_adatok}}

Tájékoztatjuk, hogy a határidő eredménytelen elteltét követően a társasház kénytelen lesz megtenni a szükséges jogi lépéseket (fizetési meghagyásos eljárás, jelzálogjog bejegyzése).

Kérjük, működjön együtt a tartozás mielőbbi rendezésében!

Tisztelettel:
{{kepviselo_neve}}
{{ceg_neve}}
E-mail: {{kepviselo_email}} | Tel: {{kepviselo_telefon}}`,
    templateBodyEn: `Dear {{flat_owner}},

You are formally notified that Flat #{{lakas_szam}} in {{tarsashaz_neve}} has accumulated an unpaid overdue balance of:
{{hatralek_osszeg}}
(equivalent to {{hatralek_honapok}} months of common charges).

In accordance with Act CXXXIII of 2003 on Condominiums and the House Bylaws (SZMSZ), you are hereby requested to settle this amount by {{due_date}} via bank transfer:

{{payment_details}}

Please note that failure to pay within this timeframe will result in immediate legal enforcement (order for payment procedure, statutory mortgage recording).

Respectfully,
{{kepviselo_neve}}
{{company_name}}
Email: {{kepviselo_email}} | Phone: {{kepviselo_telefon}}`
  },
  {
    id: 'rule-preset-legal-warning',
    name: 'Jogi eljárás előtti utolsó figyelmeztetés (3+ havi vagy >50.000 Ft)',
    nameEn: 'Final Demand Before Legal Action (3+ Months or >50,000 Ft)',
    description: 'Szigorú végső figyelmeztetés fizetési meghagyás (FMH) és jelzálogjog bejegyzése előtt.',
    descriptionEn: 'Strict final notice prior to initiating formal civil court / notary payment order (FMH).',
    enabled: false,
    buildingId: 'all',
    targetAccount: 'per_account',
    conditionType: 'combined',
    monthThreshold: 3.0,
    maxMonthThreshold: null,
    minAmountHuf: 50000,
    operator: 'OR',
    checkDayOfMonth: 25,
    dispatchTime: '08:00',
    cooldownDays: 30,
    crossRuleCooldown: true,
    sendEmail: true,
    sendInApp: true,
    templateSubject: 'VÉGSŐ FIGYELMEZTETÉS JOGI ELJÁRÁS ELŐTT – {{tarsashaz_neve}}, {{lakas_szam}}. lakás',
    templateSubjectEn: 'FINAL WARNING BEFORE LEGAL PROCEEDINGS – {{tarsashaz_neve}}, Flat #{{lakas_szam}}',
    templateBody: `Tisztelt {{lakas_tulajdonosa}}!

A(z) {{tarsashaz_neve}} közös képviselete ezúton küldi az UTOLSÓ FELSZÓLÍTÁST a(z) {{lakas_szam}}. lakás kapcsán felhalmozott {{hatralek_osszeg}} összegű tartozás azonnali rendezésére (elmaradás: {{hatralek_honapok}} hó).

Amennyiben az összeg legkésőbb {{fizetesi_hatarido}} nem érkezik meg a társasház bankszámlájára az alábbi adatok szerint:

{{fizetesi_adatok}}

A társasház ügyvédje útján fizetési meghagyásos (FMH) eljárást indít a Magyar Országos Közjegyzői Kamara (MOKK) rendszerén keresztül, és a társasházi törvény alapján jelzálogjogot jegyeztet be az ingatlan tulajdoni lapjára. Az eljárási és perköltségek, valamint a végrehajtási díjak teljes egészében a tulajdonost terhelik.

Kérjük, azonnal vegye fel a kapcsolatot a képviselettel!

{{kepviselo_neve}}
{{ceg_neve}}
E-mail: {{kepviselo_email}} | Telefon: {{kepviselo_telefon}}`,
    templateBodyEn: `Dear {{flat_owner}},

The property management of {{tarsashaz_neve}} issues this FINAL NOTICE regarding the outstanding debt of {{hatralek_osszeg}} on Flat #{{lakas_szam}} (delinquency: {{hatralek_honapok}} months).

Unless the full balance is credited by {{due_date}} according to the transfer instructions below:

{{payment_details}}

The condominium will initiate formal court enforcement (FMH order for payment) through legal counsel and record a statutory lien on the property title deed. All court, legal, and enforcement costs will be borne by the owner.

Please contact the management immediately.

{{kepviselo_neve}}
{{company_name}}
Email: {{kepviselo_email}} | Phone: {{kepviselo_telefon}}`
  }
];

/**
 * Safely extracts a clean bank account number string whether the input is a string,
 * a legacy string, or an object structured like { account, bank, name, ... }.
 */
export function extractBankAccountNumber(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    if (typeof val.account === 'string') return val.account.trim();
    if (typeof val.number === 'string') return val.number.trim();
    if (typeof val.iban === 'string') return val.iban.trim();
    if (typeof val.bankAccount === 'string') return val.bankAccount.trim();
  }
  return String(val || '').trim();
}

/**
 * Safely resolves the true owner name of a flat across flat.ownerName, flat.owner, flat.name,
 * and the flat.owners co-owners array.
 */
export function resolveFlatOwnerName(flat = {}, isEn = false) {
  if (!flat) return '';
  // 1. flat.ownerName is standard in TarsasApp
  if (flat.ownerName && typeof flat.ownerName === 'string' && flat.ownerName.trim()) {
    return flat.ownerName.trim();
  }
  // 2. flat.owner or flat.name
  if (flat.owner && typeof flat.owner === 'string' && flat.owner.trim()) {
    return flat.owner.trim();
  }
  if (flat.name && typeof flat.name === 'string' && flat.name.trim()) {
    return flat.name.trim();
  }
  // 3. flat.owners array
  if (Array.isArray(flat.owners) && flat.owners.length > 0) {
    const names = flat.owners.map(o => (o?.name || '').trim()).filter(Boolean);
    if (names.length > 0) {
      return names.join(', ');
    }
  }
  // 4. Clean fallback
  return isEn ? `Owner of Flat ${flat.flatNum || ''}` : `${flat.flatNum || ''}. lakás tulajdonosa`;
}

/**
 * Safely resolves the primary contact email for a flat.
 */
export function resolveFlatOwnerEmail(flat = {}) {
  if (!flat) return '';
  if (flat.email && typeof flat.email === 'string' && flat.email.trim()) {
    return flat.email.trim();
  }
  if (Array.isArray(flat.owners) && flat.owners.length > 0) {
    const primaryWithEmail = flat.owners.find(o => o?.isPrimaryContact && o?.email && String(o.email).trim());
    if (primaryWithEmail) return String(primaryWithEmail.email).trim();
    const firstWithEmail = flat.owners.find(o => o?.email && String(o.email).trim());
    if (firstWithEmail) return String(firstWithEmail.email).trim();
  }
  return '';
}

/**
 * Resolves all distinct owner recipients for a flat.
 * When a flat has multiple owners (in flat.owners), each owner with their name and email
 * is returned so every co-owner receives communications addressed to the flat.
 * If multiple owners share the exact same email address, their names are merged
 * (e.g. "Kiss János és Kiss Éva") so that their shared inbox receives one combined notice.
 * If flat.owners is missing or empty, falls back to legacy flat.ownerName / flat.owner / flat.email.
 *
 * @param {Object} flat - The flat data object
 * @param {Object} options - Options: { isEn, onlyEmailable }
 * @returns {Array<Object>} List of recipient objects: { name, email, share, role, isPrimary, sendEmailNotification }
 */
export function resolveFlatOwnerRecipients(flat = {}, options = {}) {
  if (!flat) return [];
  const isEn = Boolean(options.isEn);
  const onlyEmailable = Boolean(options.onlyEmailable);

  if (Array.isArray(flat.owners) && flat.owners.length > 0) {
    // 1. Clean valid owners
    const validOwners = flat.owners
      .map(o => ({
        name: (o?.name || '').trim(),
        email: (o?.email || '').trim(),
        share: (o?.share || '').trim(),
        role: o?.role || 'owner',
        isPrimary: Boolean(o?.isPrimaryContact),
        sendEmailNotification: o?.sendEmailNotification !== false
      }))
      .filter(o => Boolean(o.name));

    if (validOwners.length > 0) {
      // If any owner has an empty email, but flat.email is defined and only one owner exists, inherit flat.email
      if (validOwners.length === 1 && !validOwners[0].email && flat.email) {
        validOwners[0].email = String(flat.email).trim();
      }

      // Group owners who share the exact same non-empty email address:
      const emailMap = new Map();
      const recipients = [];

      for (const owner of validOwners) {
        if (onlyEmailable && (!owner.email || !owner.sendEmailNotification)) {
          continue;
        }

        if (owner.email) {
          const lowerEmail = owner.email.toLowerCase();
          if (emailMap.has(lowerEmail)) {
            // Merge with existing recipient with same email
            const existing = emailMap.get(lowerEmail);
            const conjunction = isEn ? ' and ' : ' és ';
            if (!existing.name.toLowerCase().includes(owner.name.toLowerCase())) {
              existing.name = `${existing.name}${conjunction}${owner.name}`;
            }
            if (owner.share && existing.share) {
              existing.share = `${existing.share}, ${owner.share}`;
            }
            if (owner.isPrimary) existing.isPrimary = true;
          } else {
            const entry = { ...owner };
            emailMap.set(lowerEmail, entry);
            recipients.push(entry);
          }
        } else {
          // Owner without email
          recipients.push({ ...owner });
        }
      }

      if (recipients.length > 0) {
        return recipients;
      }
    }
  }

  // Fallback to legacy fields on flat
  const fallbackName = resolveFlatOwnerName(flat, isEn);
  const fallbackEmail = (flat.email || '').trim();

  if (onlyEmailable && !fallbackEmail) {
    return [];
  }

  return [{
    name: fallbackName,
    email: fallbackEmail,
    share: flat.ownershipShare ? `${flat.ownershipShare}%` : '',
    role: 'owner',
    isPrimary: true,
    sendEmailNotification: true
  }];
}

/**
 * Returns an array of all distinct, non-empty email addresses for owners of this flat.
 */
export function resolveFlatOwnerEmails(flat = {}) {
  const recipients = resolveFlatOwnerRecipients(flat, { onlyEmailable: true });
  return Array.from(new Set(recipients.map(r => r.email).filter(Boolean)));
}

/**
 * Builds a clear, multi-account payment details block tailored to the flat's exact delinquent accounts.
 * If the condominium has separate accounts (e.g. KK vs FA), it lists each separately with the correct bank account and reference.
 * If accounts share the same bank number, it formats a clean combined summary.
 */
export function buildPaymentDetailsBlock(flat = {}, building = {}, options = {}) {
  const isEn = Boolean(options.isEn);
  const targetAccount = options.targetAccount || 'total';

  const kkBalance = Number(flat?.balance) || 0;
  const faBalance = Number(flat?.renovationBalance) || 0;
  const customAccounts = Array.isArray(flat?.customAccounts) ? flat.customAccounts : [];

  const buildingName = building?.officialName || building?.name || (isEn ? 'Condominium' : 'Társasház');
  const bankKK = extractBankAccountNumber(building?.bankKK || building?.bankAccount);
  const bankFA = extractBankAccountNumber(building?.bankFA) || bankKK;

  const flatNum = flat?.flatNum || '';

  const debts = [];

  // KK debt check
  if (targetAccount === 'total' || targetAccount === 'KK' || targetAccount === 'per_account') {
    if (kkBalance < 0) {
      debts.push({
        type: 'KK',
        title: isEn ? 'Common Cost (Operating)' : 'Közös költség',
        amount: Math.abs(kkBalance),
        bankAccount: bankKK,
        reference: isEn ? `Flat #${flatNum} Common Cost` : `${flatNum}. lakás közös költség`
      });
    }
  }

  // FA debt check
  if (targetAccount === 'total' || targetAccount === 'FA' || targetAccount === 'per_account') {
    if (faBalance < 0) {
      debts.push({
        type: 'FA',
        title: isEn ? 'Renovation Fund' : 'Felújítási alap',
        amount: Math.abs(faBalance),
        bankAccount: bankFA,
        reference: isEn ? `Flat #${flatNum} Renovation Fund` : `${flatNum}. lakás felújítási alap`
      });
    }
  }

  // Custom accounts debt check
  if (targetAccount === 'total' || targetAccount === 'per_account') {
    customAccounts.forEach(c => {
      const cBal = Number(c.balance) || 0;
      if (cBal < 0) {
        debts.push({
          type: 'CUSTOM',
          title: c.name || (isEn ? 'Custom Account' : 'Egyedi számla'),
          amount: Math.abs(cBal),
          bankAccount: extractBankAccountNumber(c.bankAccount || c.account || bankKK),
          reference: isEn ? `Flat #${flatNum} ${c.name || 'Custom'}` : `${flatNum}. lakás ${c.name || 'egyedi'}`
        });
      }
    });
  }

  // If debts found, format debt items
  if (debts.length > 0) {
    const uniqueBanks = Array.from(new Set(debts.map(d => d.bankAccount).filter(Boolean)));
    const singleBankForAll = uniqueBanks.length <= 1;

    const lines = [];
    lines.push(isEn ? 'Bank Transfer Details for Settlement:' : 'Átutalási adatok az elmaradás rendezéséhez:');

    if (singleBankForAll && debts.length === 1) {
      const commonBank = uniqueBanks[0] || bankKK || (isEn ? 'Not specified' : 'Nincs megadva');
      const d = debts[0];
      lines.push(`• ${d.title}: ${formatCurrency(d.amount)}`);
      lines.push(`  ${isEn ? 'Beneficiary' : 'Kedvezményezett'}: ${buildingName}`);
      lines.push(`  ${isEn ? 'Bank Account' : 'Bankszámlaszám'}: ${commonBank}`);
      lines.push(`  ${isEn ? 'Reference' : 'Közlemény'}: ${d.reference}`);
    } else {
      debts.forEach((d, idx) => {
        if (idx > 0) {
          lines.push(''); // Empty line between accounts
        }
        lines.push(`• ${d.title} (${isEn ? 'Arrears' : 'Elmaradás'}: ${formatCurrency(d.amount)}):`);
        lines.push(`  ${isEn ? 'Beneficiary' : 'Kedvezményezett'}: ${buildingName}`);
        lines.push(`  ${isEn ? 'Bank Account' : 'Bankszámlaszám'}: ${d.bankAccount || (isEn ? 'Not specified' : 'Nincs megadva')}`);
        lines.push(`  ${isEn ? 'Reference' : 'Közlemény'}: ${d.reference}`);
      });
    }

    return lines.join('\n');
  }

  // Fallback when no debt (sample preview or general notice)
  const lines = [];
  lines.push(isEn ? 'Bank Account Details:' : 'Bankszámla adatok:');
  lines.push(`• ${isEn ? 'Beneficiary' : 'Kedvezményezett'}: ${buildingName}`);
  if (bankKK === bankFA || !bankFA) {
    lines.push(`• ${isEn ? 'Bank Account' : 'Bankszámlaszám'}: ${bankKK || (isEn ? 'Not specified' : 'Nincs megadva')}`);
    lines.push(`• ${isEn ? 'Reference' : 'Közlemény'}: ${isEn ? `Flat #${flatNum}` : `${flatNum}. lakás`}`);
  } else {
    lines.push(`• ${isEn ? 'Common Cost Account' : 'Közös költség számla'}: ${bankKK}`);
    lines.push(`  ${isEn ? 'Reference' : 'Közlemény'}: ${isEn ? `Flat #${flatNum} Common Cost` : `${flatNum}. lakás közös költség`}`);
    lines.push(''); // Empty line between accounts
    lines.push(`• ${isEn ? 'Renovation Fund Account' : 'Felújítási alap számla'}: ${bankFA}`);
    lines.push(`  ${isEn ? 'Reference' : 'Közlemény'}: ${isEn ? `Flat #${flatNum} Renovation Fund` : `${flatNum}. lakás felújítási alap`}`);
  }
  return lines.join('\n');
}

/**
 * Replaces merge tags like {{tulajdonos_neve}} or {{owner_name}} or {tulajdonosNeve} with real context values.
 */
export function renderEmailTemplate(templateStr = '', context = {}) {
  if (!templateStr || typeof templateStr !== 'string') return '';

  let rendered = templateStr;

  MERGE_VARIABLES.forEach(({ key, alt }) => {
    const val = context[key] !== undefined ? context[key] : (context[alt] !== undefined ? context[alt] : '');
    // Support {{key}}, {{alt}}, {key}, {alt}
    const regexDouble1 = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    const regexDouble2 = new RegExp(`\\{\\{\\s*${alt}\\s*\\}\\}`, 'gi');
    const regexSingle1 = new RegExp(`\\{\\s*${key}\\s*\\}`, 'gi');
    const regexSingle2 = new RegExp(`\\{\\s*${alt}\\s*\\}`, 'gi');
    rendered = rendered
      .replace(regexDouble1, String(val))
      .replace(regexDouble2, String(val))
      .replace(regexSingle1, String(val))
      .replace(regexSingle2, String(val));
  });

  // Direct alias replacements for camelCase UI tags
  const aliasMap = {
    lakasTulajdonosa: context.lakas_tulajdonosa || context.flat_owner || context.tulajdonos_neve || context.owner_name || '',
    lakas_tulajdonosa: context.lakas_tulajdonosa || context.flat_owner || context.tulajdonos_neve || context.owner_name || '',
    flatOwner: context.lakas_tulajdonosa || context.flat_owner || context.tulajdonos_neve || context.owner_name || '',
    flat_owner: context.lakas_tulajdonosa || context.flat_owner || context.tulajdonos_neve || context.owner_name || '',
    tulajdonosNeve: context.lakas_tulajdonosa || context.tulajdonos_neve || context.owner_name || '',
    ownerName: context.lakas_tulajdonosa || context.tulajdonos_neve || context.owner_name || '',
    lakasszam: context.lakas_szam || context.flat_num || '',
    flatNum: context.lakas_szam || context.flat_num || '',
    tarsashazNeve: context.tarsashaz_neve || context.building_name || '',
    buildingName: context.tarsashaz_neve || context.building_name || '',
    egyenleg: context.hatralek_osszeg || context.arrears_amount || '',
    aktualisEgyenleg: context.hatralek_osszeg || context.arrears_amount || '',
    balance: context.hatralek_osszeg || context.arrears_amount || '',
    fizetesiAdatok: context.fizetesi_adatok || context.payment_details || '',
    paymentDetails: context.fizetesi_adatok || context.payment_details || '',
    fizetesiHatarido: context.fizetesi_hatarido || context.due_date || '',
    dueDate: context.fizetesi_hatarido || context.due_date || '',
    kepviseloNeve: context.kepviselo_neve || context.manager_name || '',
    managerName: context.kepviselo_neve || context.manager_name || '',
    cegNeve: context.ceg_neve || context.company_name || '',
    companyName: context.ceg_neve || context.company_name || '',
    ceg_neve: context.ceg_neve || context.company_name || '',
    company_name: context.ceg_neve || context.company_name || ''
  };

  Object.entries(aliasMap).forEach(([tag, val]) => {
    const regDouble = new RegExp(`\\{\\{\\s*${tag}\\s*\\}\\}`, 'g');
    const regSingle = new RegExp(`\\{\\s*${tag}\\s*\\}`, 'g');
    rendered = rendered.replace(regDouble, String(val)).replace(regSingle, String(val));
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

  let arrearsMonths = 0;

  if (targetAccount === 'KK') {
    balance = Number(flat.balance) || 0;
    monthlyFee = kkFee;
    if (balance < 0) {
      arrearsMonths = monthlyFee > 0 ? Number((Math.abs(balance) / monthlyFee).toFixed(1)) : 0;
    }
  } else if (targetAccount === 'FA') {
    balance = Number(flat.renovationBalance) || 0;
    monthlyFee = faFee;
    if (balance < 0) {
      arrearsMonths = monthlyFee > 0 ? Number((Math.abs(balance) / monthlyFee).toFixed(1)) : 0;
    }
  } else if (targetAccount === 'per_account') {
    // Per-account evaluation: checks KK, FA and custom sub-accounts separately
    // Surplus on one account (e.g. FA) does NOT wipe out debt on another (e.g. KK)
    const kkBal = Number(flat.balance) || 0;
    const faBal = Number(flat.renovationBalance) || 0;
    const customAccounts = Array.isArray(flat.customAccounts) ? flat.customAccounts : [];

    const kkDebt = kkBal < 0 ? Math.abs(kkBal) : 0;
    const faDebt = faBal < 0 ? Math.abs(faBal) : 0;
    const customDebt = customAccounts.reduce((sum, c) => sum + ((Number(c.balance) || 0) < 0 ? Math.abs(Number(c.balance)) : 0), 0);

    const totalArrears = kkDebt + faDebt + customDebt;
    balance = -totalArrears;
    monthlyFee = kkFee + faFee;

    const kkMonths = (kkDebt > 0 && kkFee > 0) ? (kkDebt / kkFee) : 0;
    const faMonths = (faDebt > 0 && faFee > 0) ? (faDebt / faFee) : 0;
    arrearsMonths = Number(Math.max(kkMonths, faMonths).toFixed(1));
  } else {
    // Total arrears (KK + FA + custom accounts net sum)
    const customSum = (flat.customAccounts || []).reduce((acc, c) => acc + (Number(c.balance) || 0), 0);
    balance = (Number(flat.balance) || 0) + (Number(flat.renovationBalance) || 0) + customSum;
    monthlyFee = kkFee + faFee;
    if (balance < 0) {
      arrearsMonths = monthlyFee > 0 ? Number((Math.abs(balance) / monthlyFee).toFixed(1)) : 0;
    }
  }

  // If balance >= 0, flat has zero arrears -> never dunn
  if (balance >= 0) return null;

  const arrearsHuf = Math.abs(balance);

  const monthThreshold = Number(rule.monthThreshold) || 1.0;
  const maxMonthThreshold = (rule.maxMonthThreshold !== undefined && rule.maxMonthThreshold !== null && rule.maxMonthThreshold !== '' && !isNaN(Number(rule.maxMonthThreshold)))
    ? Number(rule.maxMonthThreshold)
    : null;

  const minAmountHuf = Number(rule.minAmountHuf) || 0;
  const conditionType = rule.conditionType || 'months'; // 'months' | 'amount' | 'combined'
  const operator = rule.operator || 'OR';

  let matches = false;

  // Zero-fee division guard: if monthly fee is 0, months cannot be evaluated
  const matchesMinMonths = (monthlyFee > 0) ? (arrearsMonths >= monthThreshold) : false;
  const matchesMaxMonths = (maxMonthThreshold !== null && monthlyFee > 0) ? (arrearsMonths < maxMonthThreshold) : true;
  const matchesMonths = matchesMinMonths && matchesMaxMonths;

  const matchesAmount = arrearsHuf >= minAmountHuf;

  if (conditionType === 'months') {
    // If flat has 0 Ft monthly fee but user asked for months, fall back to matching if minAmountHuf > 0 and satisfied
    if (monthlyFee <= 0 && minAmountHuf > 0) {
      matches = matchesAmount;
    } else {
      matches = matchesMonths;
    }
  } else if (conditionType === 'amount') {
    matches = matchesAmount;
  } else if (conditionType === 'combined') {
    matches = operator === 'AND' ? (matchesMonths && matchesAmount) : (matchesMonths || matchesAmount);
  }

  if (!matches) return null;

  // Check cooldown & deduplication if history is provided
  const now = options.currentDate ? new Date(options.currentDate) : new Date();
  const cooldownDays = Number(rule.cooldownDays) || 0;
  const crossRuleCooldown = rule.crossRuleCooldown !== false;

  if (cooldownDays > 0 && Array.isArray(options.history)) {
    const cutoffTime = now.getTime() - (cooldownDays * 24 * 60 * 60 * 1000);
    const recentSent = options.history.some(log => {
      const isSameBuilding = !log.buildingId || !building.id || String(log.buildingId) === String(building.id);
      if (!isSameBuilding) return false;

      const isTargetFlat = (String(log.flatNum) === String(flat.flatNum)) || (log.unitId && log.unitId === flat.id);
      if (!isTargetFlat) return false;

      // If cross-rule cooldown is active, any dunning notice to this flat within cooldown suppresses sending
      if (!crossRuleCooldown && log.ruleId !== rule.id) return false;

      const logTime = new Date(log.sentAt || log.createdAt || log.queuedAt).getTime();
      return logTime >= cutoffTime;
    });
    if (recentSent) return null;
  }

  // Resolve building bank account based on target account
  let rawBank = building.bankKK || building.bankAccount || '';
  if (targetAccount === 'FA' && building.bankFA) {
    rawBank = building.bankFA;
  }
  const bankAccount = extractBankAccountNumber(rawBank);

  // Primary owner contact (safely extracted from flat.ownerName, flat.owner, flat.owners)
  const ownerName = resolveFlatOwnerName(flat, options.isEn);
  const ownerEmail = resolveFlatOwnerEmail(flat);
  const ownerRecipients = resolveFlatOwnerRecipients(flat, { isEn: options.isEn });
  const ownerEmails = resolveFlatOwnerEmails(flat);
  const buildingName = building.officialName || building.name || (options.isEn ? 'Condominium' : 'Társasház');
  const buildingAddress = building.address || '';

  const repProfile = options.repProfile || {};

  // Prioritize the representative person's personal name for kepviselo_neve:
  const managerPersonalName = 
    building.managerContact?.name ||
    building.repName ||
    repProfile.name ||
    repProfile.companyRepName ||
    options.senderUser?.name ||
    (options.isEn ? 'Property Manager' : 'Közös Képviselő');

  // Company / Organization business name for ceg_neve:
  const companyName = 
    repProfile.companyName || 
    options.organization?.name || 
    (options.isEn ? 'Property Management' : 'Közös Képviselet');

  const managerEmail = 
    building.managerContact?.email || 
    building.email || 
    repProfile.email || 
    options.senderUser?.email || 
    'info@tarsasapp.hu';

  const managerPhone = 
    building.managerContact?.phone || 
    building.phone || 
    repProfile.phone || 
    '';

  // Payment reference
  const paymentRef = `${flat.flatNum}. ${targetAccount === 'FA' ? 'felújítási alap' : 'közös költség'}`;

  // Default payment due date: 8 days from now
  const dueDate = new Date(now.getTime() + (8 * 24 * 60 * 60 * 1000));
  const dueDateFormatted = options.isEn
    ? dueDate.toLocaleDateString('en-GB')
    : `${dueDate.getFullYear()}. ${String(dueDate.getMonth() + 1).padStart(2, '0')}. ${String(dueDate.getDate()).padStart(2, '0')}.`;

  const paymentDetailsBlock = buildPaymentDetailsBlock(flat, building, {
    isEn: options.isEn,
    targetAccount
  });

  const context = {
    lakas_tulajdonosa: ownerName,
    lakasTulajdonosa: ownerName,
    flat_owner: ownerName,
    flatOwner: ownerName,
    tulajdonos_neve: ownerName,
    owner_name: ownerName,
    tulajdonosNeve: ownerName,
    ownerName: ownerName,
    osszes_tulajdonos: ownerName,
    all_owners: ownerName,
    osszesTulajdonos: ownerName,
    allOwners: ownerName,
    lakas_szam: flat.flatNum,
    flat_num: flat.flatNum,
    lakasszam: flat.flatNum,
    tarsashaz_neve: buildingName,
    building_name: buildingName,
    tarsashazNeve: buildingName,
    tarsashaz_cime: buildingAddress,
    building_address: buildingAddress,
    hatralek_osszeg: formatCurrency(-arrearsHuf),
    arrears_amount: formatCurrency(-arrearsHuf),
    egyenleg: formatCurrency(-arrearsHuf),
    hatralek_honapok: arrearsMonths.toString(),
    arrears_months: arrearsMonths.toString(),
    albetet_havi_dij: formatCurrency(monthlyFee),
    monthly_fee: formatCurrency(monthlyFee),
    fizetesi_adatok: paymentDetailsBlock,
    payment_details: paymentDetailsBlock,
    fizetesiAdatok: paymentDetailsBlock,
    szamlaszam: bankAccount || (options.isEn ? 'Not specified' : 'Nincs megadva'),
    bank_account: bankAccount || (options.isEn ? 'Not specified' : 'Nincs megadva'),
    kozlemeny: paymentRef,
    payment_reference: paymentRef,
    fizetesi_hatarido: dueDateFormatted,
    due_date: dueDateFormatted,
    fizetesiHatarido: dueDateFormatted,
    kepviselo_neve: managerPersonalName,
    manager_name: managerPersonalName,
    kepviseloNeve: managerPersonalName,
    managerName: managerPersonalName,
    ceg_neve: companyName,
    company_name: companyName,
    cegNeve: companyName,
    companyName: companyName,
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
    ownerEmails,
    ownerRecipients,
    balance,
    arrearsHuf,
    arrearsMonths,
    monthlyFee,
    targetAccount,
    context,
    subjectTemplate,
    bodyTemplate,
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
    ownerName: resolveFlatOwnerName(u.flat, isEn)
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
  const simKkDebt = rule.targetAccount === 'FA' ? 0 : Math.max(minAmount, Math.round(simMonths * (kkFee > 0 ? kkFee : effectiveMonthly)));
  const simFaDebt = (rule.targetAccount === 'FA' || (rule.targetAccount === 'per_account' && faFee > 0)) 
    ? Math.max(minAmount, Math.round(simMonths * (faFee > 0 ? faFee : 5000))) 
    : 0;

  const simulatedFlat = {
    ...flat,
    balance: -simKkDebt,
    renovationBalance: -simFaDebt
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

/**
 * Extracts year, month, day, hour, minute for Europe/Budapest timezone.
 * Defaults to the Firebase-synced invisible server clock (`getServerNow()`).
 */
export function getBudapestTimeParts(date = null) {
  const { year, month, day, hour, minute, dateStr } = getBudapestNowParts(date);
  return { year, month, day, hour, minute, dateStr };
}

/**
 * Parses and normalizes rule dispatch time string ('HH:mm') into hour, minute and clean string.
 * Defaults to '08:00' if omitted or invalid.
 */
export function parseDispatchTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return { hour: 8, minute: 0, timeStr: '08:00' };
  const parts = timeStr.trim().split(':');
  const h = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
  const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return { hour: h, minute: m, timeStr: formatted };
}

/**
 * Determines whether a dunning rule should automatically dispatch today at or after its scheduled time in Europe/Budapest.
 * Defaults to 08:00 if dispatchTime is omitted.
 */
export function shouldRuleAutoDispatchToday(rule, options = {}) {
  if (!rule || !rule.enabled) return false;
  const now = options.currentDate ? new Date(options.currentDate) : getServerNow();
  const { day, hour, minute, dateStr } = getBudapestTimeParts(now);

  const targetDay = Number(rule.checkDayOfMonth) || 15;
  if (targetDay !== day) return false;

  const targetTime = parseDispatchTime(rule.dispatchTime);
  const currentTotalMinutes = hour * 60 + minute;
  const targetTotalMinutes = targetTime.hour * 60 + targetTime.minute;

  // Must be at or after the scheduled time today
  if (currentTotalMinutes < targetTotalMinutes) return false;

  // Prevent multiple runs on the same calendar day
  if (rule.lastAutoDispatchedDate === dateStr) return false;

  return true;
}

/**
 * Evaluates active dunning rules and returns all due rules and matching delinquent flats for scheduled dispatch.
 */
export function evaluateRulesForAutoDispatch(rules = [], buildings = [], options = {}) {
  const now = options.currentDate ? new Date(options.currentDate) : getServerNow();
  const timeParts = getBudapestTimeParts(now);
  const { hour, minute, day, dateStr } = timeParts;

  const activeRules = Array.isArray(rules) ? rules : [];
  const dueRules = activeRules.filter(r => shouldRuleAutoDispatchToday(r, { currentDate: now }));

  if (dueRules.length === 0) {
    const isEarlyMorning = hour < 8;
    const reason = isEarlyMorning ? 'before-8am' : 'no-due-rules';
    return { shouldRun: false, reason, hour, minute, day, dateStr, dueRules: [], resultsByRule: [] };
  }

  const resultsByRule = [];

  for (const rule of dueRules) {
    const matches = runDunningDryRun(rule, buildings, {}, {
      isEn: options.isEn,
      repProfile: options.repProfile,
      currentDate: now,
      history: options.history || []
    });

    resultsByRule.push({
      rule,
      dateStr,
      matches
    });
  }

  return {
    shouldRun: true,
    hour,
    day,
    dateStr,
    dueRules,
    resultsByRule
  };
}
