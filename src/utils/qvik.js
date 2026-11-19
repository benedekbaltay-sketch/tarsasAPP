/**
 * MNB / qvik Hungarian Instant Payment Standard Utilities
 * Standard Deep Link format:
 * https://azonnalifizetes.hu/HCT/3/1/{BIC}/{BENEFICIARY_NAME}/{ACCOUNT_HOLDER}/{IBAN}/HUF{AMOUNT}///{COMMENT}/{REF_ID}
 */

/**
 * Calculates and formats a standard 28-character Hungarian IBAN from a domestic account number.
 * Uses ISO 7064 MOD 97-10 check digit calculation.
 * 
 * @param {string} accountNumber - 16 or 24 digit domestic account number or existing IBAN
 * @returns {string} 28-character IBAN (e.g. HU42117000000000000000000000)
 */
export function formatHungarianIban(accountNumber) {
  if (!accountNumber) return '';
  const raw = String(accountNumber).replace(/[\s-]/g, '').toUpperCase();
  if (raw.startsWith('HU') && raw.length === 28) return raw;

  let bban = raw.replace(/\D/g, '');
  // 16-digit Hungarian account numbers (2 blocks of 8) are padded with 8 zeros at the end
  if (bban.length === 16) {
    bban += '00000000';
  }
  if (bban.length !== 24) {
    return raw;
  }

  // Check digit calculation: BBAN + 'HU00' (H=17, U=30 -> '173000')
  const numStr = bban + '173000';
  const mod = Number(BigInt(numStr) % 97n);
  const check = 98 - mod;
  return `HU${String(check).padStart(2, '0')}${bban}`;
}

/**
 * Resolves standard BIC / SWIFT code for Hungarian banks.
 * 
 * @param {object} bankObj - Bank configuration object { account, bank, bic, swift }
 * @param {string} [defaultBic='OTPVHUHBXXX']
 * @returns {string}
 */
export function getBankBic(bankObj, defaultBic = 'OTPVHUHBXXX') {
  if (bankObj?.bic) return String(bankObj.bic).trim();
  if (bankObj?.swift) return String(bankObj.swift).trim();

  const rawAcc = String(bankObj?.account || '').replace(/[\s-]/g, '');
  const bankCode = rawAcc.startsWith('HU') ? rawAcc.substring(4, 7) : rawAcc.substring(0, 3);
  const bankName = String(bankObj?.bank || '').toUpperCase();

  const codeMap = {
    '117': 'OTPVHUHBXXX', // OTP Bank
    '102': 'OKHBHUHBXXX', // K&H Bank
    '104': 'OKHBHUHBXXX', // K&H Bank
    '116': 'GIBAHUHBXXX', // Erste Bank
    '119': 'GIBAHUHBXXX', // Erste Bank
    '101': 'MKKBHUHBXXX', // MBH Bank
    '103': 'MKKBHUHBXXX', // MBH Bank
    '182': 'MKKBHUHBXXX', // MBH Bank
    '107': 'CIBHHUHBXXX', // CIB Bank
    '111': 'CIBHHUHBXXX', // CIB Bank
    '120': 'RZBCHUHBXXX', // Raiffeisen Bank
    '109': 'BACXHUHBXXX', // UniCredit Bank
    '162': 'HBWEHUHBXXX', // MagNet Bank
  };

  if (codeMap[bankCode]) {
    return codeMap[bankCode];
  }

  if (bankName.includes('OTP')) return 'OTPVHUHBXXX';
  if (bankName.includes('K&H')) return 'OKHBHUHBXXX';
  if (bankName.includes('ERSTE')) return 'GIBAHUHBXXX';
  if (bankName.includes('MBH')) return 'MKKBHUHBXXX';
  if (bankName.includes('CIB')) return 'CIBHHUHBXXX';
  if (bankName.includes('RAIFFEISEN')) return 'RZBCHUHBXXX';
  if (bankName.includes('UNICREDIT')) return 'BACXHUHBXXX';

  return defaultBic;
}

/**
 * Extracts a concise building code for payment comments (e.g. "Tarsashaz1")
 * 
 * @param {object} building
 * @returns {string}
 */
export function getBuildingPaymentCode(building) {
  if (building?.code) return String(building.code).trim();
  if (building?.shortName) return String(building.shortName).trim();

  if (building?.address) {
    const match = building.address.match(/^([A-Za-zÁ-ž]+)(?:\s+\w+)?\s+(\d+)/);
    if (match) return `${match[1]}${match[2]}`;
  }
  if (building?.name) {
    const match = building.name.match(/^([A-Za-zÁ-ž]+)(?:\s+\w+)?\s+(\d+)/);
    if (match) return `${match[1]}${match[2]}`;
  }
  return 'TH';
}

/**
 * Builds the strict, standardized comment string for MNB/qvik payment.
 * Rule: Must NEVER contain fixed dates/months.
 * Format: [TÁRSASHÁZ_AZONOSÍTÓ] [LAKÁS_SZÁMA]. lakas [ALAP_TÍPUS]
 * Example: "Pelda1 4. lakas KK" or "Pelda1 4. lakas FA"
 * 
 * @param {object} params
 * @param {string} params.buildingCode
 * @param {string|number} params.flatNum
 * @param {'KK'|'FA'} params.fundType
 * @returns {string}
 */
export function buildPaymentComment({ buildingCode, flatNum, fundType }) {
  const cleanCode = String(buildingCode || 'TH').replace(/[\r\n/\\<>]/g, '').trim().slice(0, 32);
  const cleanFlat = String(flatNum || '').replace(/[\r\n/\\<>]/g, '').trim().replace(/\.+$/, '').slice(0, 24);
  const type = fundType === 'FA' ? 'FA' : 'KK';
  return `${cleanCode} ${cleanFlat}. lakas ${type}`;
}

/**
 * Builds a standardized reference ID for the payment:
 * Format: L{flatNum}-{type} (e.g. L04-KK, L04-FA)
 * 
 * @param {object} params
 * @param {string|number} params.flatNum
 * @param {'KK'|'FA'} params.fundType
 * @returns {string}
 */
export function buildPaymentRefId({ flatNum, fundType }) {
  const type = fundType === 'FA' ? 'FA' : 'KK';
  const digitsMatch = String(flatNum || '').match(/\d+/);
  const numPart = digitsMatch 
    ? digitsMatch[0].padStart(2, '0') 
    : String(flatNum || '01').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12);
  return `L${numPart}-${type}`;
}

/**
 * Generates an MNB / qvik standard instant payment Deeplink URL:
 * https://azonnalifizetes.hu/HCT/3/1/{BIC}/{BENEFICIARY_NAME}/{ACCOUNT_HOLDER}/{IBAN}/HUF{AMOUNT}///{COMMENT}/{REF_ID}
 * 
 * @param {object} params
 * @param {string} params.bic - Bank BIC/SWIFT code
 * @param {string} params.beneficiaryName - Official name of condominium
 * @param {string} [params.accountHolder] - Name of account holder (defaults to beneficiaryName)
 * @param {string} params.iban - Condominium sub-account in IBAN format (HU...)
 * @param {number} params.amount - Debt amount rounded to whole integer HUF
 * @param {string} params.comment - Standard payment comment
 * @param {string} params.refId - Structured reference ID (e.g. L04-KK)
 * @returns {string} MNB deeplink URL
 */
export function generateMnbPaymentUrl({
  bic,
  beneficiaryName,
  accountHolder,
  iban,
  amount,
  comment,
  refId
}) {
  const cleanBic = (bic || 'OTPVHUHBXXX').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 11) || 'OTPVHUHBXXX';
  const cleanBeneficiary = encodeURIComponent(String(beneficiaryName || '').replace(/[\r\n]/g, ' ').trim().slice(0, 70));
  const cleanHolder = encodeURIComponent(String(accountHolder || beneficiaryName || '').replace(/[\r\n]/g, ' ').trim().slice(0, 70));
  const cleanIban = (iban || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 34);
  const rawAmt = Number(amount);
  const cleanAmount = Number.isFinite(rawAmt) ? Math.min(50_000_000, Math.max(0, Math.round(rawAmt))) : 0;
  const cleanComment = encodeURIComponent(String(comment || '').replace(/[\r\n]/g, ' ').trim().slice(0, 140));
  const cleanRefId = encodeURIComponent(String(refId || '').replace(/[^A-Za-z0-9_-]/g, '').trim().slice(0, 35));

  return `https://azonnalifizetes.hu/HCT/3/1/${cleanBic}/${cleanBeneficiary}/${cleanHolder}/${cleanIban}/HUF${cleanAmount}///${cleanComment}/${cleanRefId}`;
}

/**
 * Formats full bank transfer details for quick one-click clipboard copying.
 * 
 * @param {object} params
 * @param {string} params.beneficiaryName
 * @param {string} params.iban
 * @param {number} params.amount
 * @param {string} params.comment
 * @param {boolean} [params.isEn=false]
 * @returns {string}
 */
export function formatBankTransferPackage({ beneficiaryName, iban, amount, comment, isEn = false }) {
  const formattedAmount = `${Math.round(amount || 0).toLocaleString('hu-HU')} Ft`;
  if (isEn) {
    return [
      `Beneficiary: ${beneficiaryName}`,
      `Account (IBAN): ${iban}`,
      `Amount: ${formattedAmount}`,
      `Reference: ${comment}`
    ].join('\n');
  }
  return [
    `Kedvezményezett: ${beneficiaryName}`,
    `Bankszámla (IBAN): ${iban}`,
    `Összeg: ${formattedAmount}`,
    `Közlemény: ${comment}`
  ].join('\n');
}

/**
 * Generates an intelligent in-app mobile payment assistant URL.
 * Scanned by standard phone camera (iOS/Android), opens the smart bank chooser and assistant view.
 * 
 * @param {object} params
 * @param {string} [params.origin] - Base origin (e.g. window.location.origin or production domain)
 * @param {string} params.buildingId
 * @param {string|number} params.flatNum
 * @param {'KK'|'FA'} params.fundType
 * @param {number} params.amount
 * @returns {string}
 */
export function generateSmartPayUrl({ origin, buildingId, flatNum, fundType, amount }) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://tarsashaz-cfe5d.web.app');
  const cleanFlat = encodeURIComponent(String(flatNum || '').trim());
  const cleanFund = fundType === 'FA' ? 'FA' : 'KK';
  const cleanAmount = Math.max(0, Math.round(Number(amount) || 0));
  const bId = encodeURIComponent(String(buildingId || '').trim());

  return `${base}/?pay=1&flat=${cleanFlat}&fund=${cleanFund}&amt=${cleanAmount}${bId ? `&b=${bId}` : ''}`;
}

/**
 * Popular Hungarian banking apps for quick access and direct assistance
 */
export const POPULAR_HUNGARIAN_BANKS = [
  {
    id: 'otp',
    name: 'OTP MobilBank',
    shortName: 'OTP',
    brandColor: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500',
    accentColor: '#10B981',
    scheme: 'otpbank://',
    fallbackSchemes: ['otpbank://'],
    appStoreUrl: 'https://apps.apple.com/hu/app/otp-mobilbank/id1506544026',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=hu.otpbank.mobile'
  },
  {
    id: 'george',
    name: 'Erste George',
    shortName: 'George',
    brandColor: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500',
    accentColor: '#2563EB',
    scheme: 'hu.erstebank.george://',
    fallbackSchemes: [
      'george-hu://',
      'hu.erstebank.mobilebank://',
      'https://george.erstebank.hu/?crossPlatform=true'
    ],
    appStoreUrl: 'https://apps.apple.com/hu/app/george-magyarorsz%C3%A1g/id1534444535',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=at.erstegroup.george.hu'
  },
  {
    id: 'revolut',
    name: 'Revolut',
    shortName: 'Revolut',
    brandColor: 'bg-gray-900 hover:bg-black text-white border-gray-800',
    accentColor: '#111827',
    scheme: 'revolut://',
    fallbackSchemes: ['revolut://app', 'https://revolut.me'],
    appStoreUrl: 'https://apps.apple.com/hu/app/revolut/id932493382',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.revolut.revolut'
  },
  {
    id: 'wise',
    name: 'Wise',
    shortName: 'Wise',
    brandColor: 'bg-[#163300] hover:bg-[#204900] text-[#9FE870] border-[#9FE870]/30',
    accentColor: '#9FE870',
    scheme: 'wise://',
    fallbackSchemes: ['transferwise://', 'https://wise.com'],
    appStoreUrl: 'https://apps.apple.com/hu/app/wise-kor%C3%A1bban-transferwise/id612261027',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.transferwise.android'
  },
  {
    id: 'kh',
    name: 'K&H Mobilbank',
    shortName: 'K&H',
    brandColor: 'bg-sky-600 hover:bg-sky-700 text-white border-sky-500',
    accentColor: '#0284C7',
    scheme: 'khmobilbank://',
    fallbackSchemes: ['khmobilbank://'],
    appStoreUrl: 'https://apps.apple.com/hu/app/k-h-mobilbank/id521998394',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=hu.khb.mobilbank'
  },
  {
    id: 'mbh',
    name: 'MBH Bank App',
    shortName: 'MBH',
    brandColor: 'bg-purple-700 hover:bg-purple-800 text-white border-purple-600',
    accentColor: '#7E22CE',
    scheme: 'mbhbank://',
    fallbackSchemes: ['mbhbank://'],
    appStoreUrl: 'https://apps.apple.com/hu/app/mbh-bank-app/id1661601614',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=hu.mbhbank.mobile'
  },
  {
    id: 'raiffeisen',
    name: 'Raiffeisen myRaiffeisen',
    shortName: 'Raiffeisen',
    brandColor: 'bg-amber-500 hover:bg-amber-600 text-gray-950 border-amber-400',
    accentColor: '#F59E0B',
    scheme: 'myraiffeisen://',
    fallbackSchemes: ['myraiffeisen://'],
    appStoreUrl: 'https://apps.apple.com/hu/app/myraiffeisen/id1453282496',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=hu.raiffeisen.mobile'
  },
  {
    id: 'unicredit',
    name: 'UniCredit mBanking',
    shortName: 'UniCredit',
    brandColor: 'bg-rose-700 hover:bg-rose-800 text-white border-rose-600',
    accentColor: '#BE123C',
    scheme: 'unicredit://',
    fallbackSchemes: ['unicredit://'],
    appStoreUrl: 'https://apps.apple.com/hu/app/unicredit-mbanking/id503889154',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=eu.unicreditgroup.mbanking'
  }
];

