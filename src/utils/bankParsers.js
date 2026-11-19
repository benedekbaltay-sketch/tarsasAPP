import { readSheet } from 'read-excel-file/universal';
import { MAX_BANK_STATEMENT_BYTES } from './fileSecurity.js';

/**
 * Deterministic 64-bit FNV-1a-style hex digest (pure JS, synchronous, browser + Node safe)
 * Used to produce idempotent fallback transaction IDs when a bank statement row omits bankTxId.
 */
function deterministicHashHex(input) {
  const str = String(input || '');
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * Builds a deterministic fallback ID for a bank transaction row without an explicit bankTxId.
 * An occurrence counter preserves two legitimately identical same-day transfers while guaranteeing
 * identical IDs on repeated imports of the same statement.
 */
export function buildDeterministicBankTxId(prefix, { date, amount, counterpartyAccount, counterpartyName, notice }, occurrenceMap) {
  const cleanAcc = String(counterpartyAccount || '').replace(/\D/g, '');
  const fingerprint = [
    date || '',
    String(Math.round((Number(amount) || 0) * 100)),
    cleanAcc,
    String(counterpartyName || '').trim().toLowerCase().replace(/\s+/g, ' '),
    String(notice || '').trim().toLowerCase().replace(/\s+/g, ' '),
  ].join('|');

  const count = (occurrenceMap.get(fingerprint) || 0) + 1;
  occurrenceMap.set(fingerprint, count);

  const hash = deterministicHashHex(`${fingerprint}#${count}`);
  return `${prefix}-${date}-${Math.abs(Math.round(Number(amount) || 0))}-${hash}`;
}

/**
 * Clean and normalize Hungarian/International formatted financial amounts.
 * Examples:
 *   "12 500,00" -> 12500
 *   "+12.500,00 HUF" -> 12500
 *   "-4 320,50 Ft" -> -4320.5
 *   "(1 200,00)" -> -1200
 */
export function cleanAmount(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;

  let str = String(raw).trim();
  if (!str) return 0;

  // Handle parenthesized negative: (100) -> -100
  const isParenNegative = /^\((.*)\)$/.test(str);
  if (isParenNegative) {
    str = '-' + str.slice(1, -1);
  }

  // Remove currency signs, letters, non-breaking spaces and regular spaces
  str = str
    .replace(/\b(?:HUF|Ft|EUR|USD)\b|[€$]/gi, '')
    .replace(/\u00A0/g, '') // non-breaking space
    .replace(/\s+/g, '')
    .trim();

  // If format is like 1.250,50 (Hungarian dot thousands, comma decimals)
  if (str.includes(',') && str.includes('.')) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

/**
 * Converts an Excel serial date number (1900 epoch with Excel leap-year offset) to YYYY-MM-DD.
 */
function excelSerialToIsoDate(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial) || serial < 1 || serial > 2958465) {
    return null;
  }
  const utcMs = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
  const dt = new Date(utcMs);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * Clean and normalize dates to ISO format YYYY-MM-DD.
 * Handles:
 *   "2026.11.18 10:20:15" -> "2026-11-18"
 *   "2026.11.18." -> "2026-11-18"
 *   "2026-11-18" -> "2026-11-18"
 *   "18/11/2026" -> "2026-11-18"
 *   Date instance (returned by read-excel-file)
 *   Excel serial number (e.g. 45614)
 */
export function cleanDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);

  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  if (typeof raw === 'number') {
    const iso = excelSerialToIsoDate(raw);
    if (iso) return iso;
  }

  const str = String(raw).trim();

  // Match YYYY.MM.DD or YYYY-MM-DD
  const ymdMatch = str.match(/(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(ymdMatch[2]).padStart(2, '0');
    const d = String(ymdMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Match DD.MM.YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

/**
 * RFC-4180 compliant CSV parser with automatic delimiter detection (;, , or tab).
 */
export function parseCsvToRows(text) {
  const cleanText = String(text || '').replace(/^\uFEFF/, '');
  if (!cleanText.trim()) return [];

  // Detect delimiter from first non-empty lines outside quotes
  const sampleLines = cleanText.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  const countDelim = (ch) =>
    sampleLines.reduce((sum, line) => sum + (line.split(ch).length - 1), 0);

  const semiCount = countDelim(';');
  const commaCount = countDelim(',');
  const tabCount = countDelim('\t');
  let delimiter = ';';
  if (tabCount > semiCount && tabCount > commaCount) delimiter = '\t';
  else if (commaCount > semiCount) delimiter = ',';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && cleanText[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse an OTP Bank HTML table export (.xls) into metadata and transaction rows.
 */
export function parseOtpHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  let accountNumber = '';
  let accountName = '';
  let period = '';

  const allText = doc.body.textContent || '';

  const accNumMatch =
    allText.match(/(?:számlaszám|számla|szamlaszam)[:\s]*(\d{8}-\d{8}(?:-\d{8})?)/i) ||
    allText.match(/\b(\d{8}-\d{8}(?:-\d{8})?)\b/);
  if (accNumMatch) {
    accountNumber = accNumMatch[1];
  }

  const accNameMatch = allText.match(/(?:számla elnevezése|számla megnevezése|számlanév|számla neve)[:\s]*([^\r\n<]+)/i);
  if (accNameMatch) {
    accountName = accNameMatch[1].trim();
  }

  const periodMatch = allText.match(/(?:lekérdezési időszak|időszak|idoszak)[:\s]*([^\r\n<]+)/i);
  if (periodMatch) {
    period = periodMatch[1].trim();
  }

  const tables = Array.from(doc.querySelectorAll('table'));
  let txTable = null;
  let headerRowIndex = -1;
  let colMap = {};

  const columnKeywords = {
    type: ['forgalom típusa', 'forgalom típus', 'típus', 'forgalomtipus', 'forgalom', 'jogcím'],
    date: ['tranzakció időpontja', 'tranzakció időpont', 'könyvelés napja', 'könyvelés dátuma', 'könyvelés', 'dátum', 'datum', 'tranzakció dátuma'],
    valueDate: ['értéknap', 'erteknap', 'érték nap'],
    amount: ['összeg', 'osszeg', 'összeg (huf)', 'összeg devizanemben', 'összeg huf'],
    counterpartyAccount: ['ellenoldali számlaszám', 'ellenoldali számla', 'partner számlaszáma', 'partner számlaszám', 'számlaszám'],
    counterpartyName: ['ellenoldali név', 'ellenoldali nev', 'partner neve', 'partner név', 'partner', 'megbízó neve', 'kedvezményezett neve'],
    notice: ['közlemény', 'kozlemeny', 'közlemény rovat', 'megjegyzés', 'leírás'],
    bankTxId: ['banki tranzakció azonosító', 'tranzakció azonosító', 'tranzakcióazonosító', 'azonosító', 'referencia', 'bizonylatszám', 'referenciaszám'],
  };

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));
    for (let r = 0; r < rows.length; r++) {
      const cells = Array.from(rows[r].querySelectorAll('th, td')).map((c) => (c.textContent || '').trim().toLowerCase());

      const foundCols = {};
      Object.keys(columnKeywords).forEach((key) => {
        const keywords = columnKeywords[key];
        const idx = cells.findIndex((text) => keywords.some((kw) => text.includes(kw)));
        if (idx !== -1) {
          foundCols[key] = idx;
        }
      });

      if (foundCols.amount !== undefined && (foundCols.date !== undefined || foundCols.notice !== undefined || foundCols.counterpartyName !== undefined)) {
        txTable = table;
        headerRowIndex = r;
        colMap = foundCols;
        break;
      }
    }
    if (txTable) break;
  }

  if (!txTable) {
    const candidate = tables.find((t) => t.querySelectorAll('tr').length > 1);
    if (candidate) {
      txTable = candidate;
      headerRowIndex = 0;
    }
  }

  const transactions = [];
  const occurrenceMap = new Map();

  if (txTable) {
    const rows = Array.from(txTable.querySelectorAll('tr'));
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].querySelectorAll('td, th')).map((c) => (c.textContent || '').trim());
      if (cells.length < 3) continue;

      const rawAmount = colMap.amount !== undefined ? cells[colMap.amount] : cells[3];
      const parsedAmount = cleanAmount(rawAmount);

      if (isNaN(parsedAmount) || parsedAmount === 0) continue;

      const rawDate = colMap.date !== undefined ? cells[colMap.date] : cells[1];
      const rawValueDate = colMap.valueDate !== undefined ? cells[colMap.valueDate] : rawDate;
      const rawType = colMap.type !== undefined ? cells[colMap.type] : (cells[0] || 'Bank Transfer');
      const rawCounterpartyAccount = colMap.counterpartyAccount !== undefined ? cells[colMap.counterpartyAccount] : (cells[4] || '');
      const rawCounterpartyName = colMap.counterpartyName !== undefined ? cells[colMap.counterpartyName] : (cells[5] || '');
      const rawNotice = colMap.notice !== undefined ? cells[colMap.notice] : (cells[6] || '');
      const rawTxId = colMap.bankTxId !== undefined ? cells[colMap.bankTxId] : (cells[7] || '');

      const txDate = cleanDate(rawDate);
      const valDate = cleanDate(rawValueDate);

      const fallbackId = buildDeterministicBankTxId(
        'otp',
        {
          date: txDate,
          amount: parsedAmount,
          counterpartyAccount: rawCounterpartyAccount,
          counterpartyName: rawCounterpartyName,
          notice: rawNotice,
        },
        occurrenceMap
      );
      const bankTxId = (rawTxId || '').trim() || fallbackId;

      transactions.push({
        id: `tx-import-${bankTxId}`,
        bankTxId,
        date: txDate,
        valueDate: valDate,
        amount: parsedAmount,
        type: rawType || (parsedAmount > 0 ? 'Befizetés' : 'Kiadás'),
        counterpartyAccount: rawCounterpartyAccount,
        counterpartyName: rawCounterpartyName,
        notice: rawNotice,
        accountName,
        accountNumber,
      });
    }
  }

  return {
    accountNumber,
    accountName,
    period,
    totalCount: transactions.length,
    transactions,
  };
}

/**
 * Extracts metadata & normalized transactions from a 2D array of spreadsheet/CSV rows.
 */
export function extractTransactionsFromRows(rawRows) {
  let accountNumber = '';
  let accountName = '';
  let period = '';

  (rawRows || []).slice(0, 15).forEach((row) => {
    const text = (row || []).map((c) => String(c ?? '')).join(' ');
    if (!accountNumber) {
      const match =
        text.match(/(?:számlaszám|számla)[:\s]*(\d{8}-\d{8}(?:-\d{8})?)/i) ||
        text.match(/\b(\d{8}-\d{8}(?:-\d{8})?)\b/);
      if (match) accountNumber = match[1];
    }
    if (!accountName) {
      const match = text.match(/(?:számla elnevezése|számla megnevezése|számlanév)[:\s]*([^\r\n]+)/i);
      if (match) accountName = match[1].trim();
    }
    if (!period) {
      const match = text.match(/(?:lekérdezési időszak|időszak)[:\s]*([^\r\n]+)/i);
      if (match) period = match[1].trim();
    }
  });

  const columnKeywords = {
    type: ['forgalom típusa', 'forgalom típus', 'típus', 'forgalom', 'jogcím'],
    date: ['tranzakció időpontja', 'tranzakció időpont', 'könyvelés napja', 'könyvelés dátuma', 'könyvelés', 'dátum', 'datum'],
    valueDate: ['értéknap', 'erteknap'],
    amount: ['összeg', 'osszeg', 'összeg (huf)', 'összeg devizanemben'],
    counterpartyAccount: ['ellenoldali számlaszám', 'ellenoldali számla', 'partner számlaszáma', 'partner számlaszám'],
    counterpartyName: ['ellenoldali név', 'partner neve', 'partner név', 'partner', 'megbízó', 'kedvezményezett'],
    notice: ['közlemény', 'kozlemeny', 'megjegyzés', 'leírás'],
    bankTxId: ['banki tranzakció azonosító', 'tranzakció azonosító', 'azonosító', 'referencia', 'bizonylatszám'],
  };

  let headerRowIndex = -1;
  let colMap = {};

  for (let r = 0; r < Math.min((rawRows || []).length, 25); r++) {
    const row = (rawRows[r] || []).map((c) => String(c ?? '').trim().toLowerCase());
    const foundCols = {};
    Object.keys(columnKeywords).forEach((key) => {
      const keywords = columnKeywords[key];
      const idx = row.findIndex((text) => keywords.some((kw) => text.includes(kw)));
      if (idx !== -1) foundCols[key] = idx;
    });

    if (foundCols.amount !== undefined && (foundCols.date !== undefined || foundCols.notice !== undefined || foundCols.counterpartyName !== undefined)) {
      headerRowIndex = r;
      colMap = foundCols;
      break;
    }
  }

  const transactions = [];
  const occurrenceMap = new Map();

  if (headerRowIndex !== -1) {
    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const rawRow = rawRows[r] || [];
      const cells = rawRow.map((c) => (c instanceof Date ? c : String(c !== null && c !== undefined ? c : '').trim()));
      if (cells.length < 2) continue;

      const rawAmount = colMap.amount !== undefined ? rawRow[colMap.amount] : '';
      const parsedAmount = cleanAmount(rawAmount);
      if (isNaN(parsedAmount) || parsedAmount === 0) continue;

      const rawDate = colMap.date !== undefined ? rawRow[colMap.date] : '';
      const rawValueDate = colMap.valueDate !== undefined ? rawRow[colMap.valueDate] : rawDate;
      const rawType = colMap.type !== undefined ? String(cells[colMap.type] || '') : (parsedAmount > 0 ? 'Befizetés' : 'Kiadás');
      const rawCounterpartyAccount = colMap.counterpartyAccount !== undefined ? String(cells[colMap.counterpartyAccount] || '') : '';
      const rawCounterpartyName = colMap.counterpartyName !== undefined ? String(cells[colMap.counterpartyName] || '') : '';
      const rawNotice = colMap.notice !== undefined ? String(cells[colMap.notice] || '') : '';
      const rawTxId = colMap.bankTxId !== undefined ? String(cells[colMap.bankTxId] || '') : '';

      const txDate = cleanDate(rawDate);
      const valDate = cleanDate(rawValueDate);

      const fallbackId = buildDeterministicBankTxId(
        'bank',
        {
          date: txDate,
          amount: parsedAmount,
          counterpartyAccount: rawCounterpartyAccount,
          counterpartyName: rawCounterpartyName,
          notice: rawNotice,
        },
        occurrenceMap
      );
      const bankTxId = (rawTxId || '').trim() || fallbackId;

      transactions.push({
        id: `tx-import-${bankTxId}`,
        bankTxId,
        date: txDate,
        valueDate: valDate,
        amount: parsedAmount,
        type: rawType || (parsedAmount > 0 ? 'Befizetés' : 'Kiadás'),
        counterpartyAccount: rawCounterpartyAccount,
        counterpartyName: rawCounterpartyName,
        notice: rawNotice,
        accountName,
        accountNumber,
      });
    }
  }

  return {
    accountNumber,
    accountName,
    period,
    totalCount: transactions.length,
    transactions,
  };
}

/**
 * Parse binary Excel (.xlsx) via read-excel-file or CSV text into metadata & transactions.
 */
export async function parseXlsxOrCsv(dataBuffer) {
  const bytes = dataBuffer instanceof Uint8Array ? dataBuffer : new Uint8Array(dataBuffer);

  // Detect ZIP magic header (PK\x03\x04) -> modern .xlsx OpenXML workbook
  const isZipXlsx =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08);

  if (isZipXlsx) {
    const rawRows = await readSheet(bytes);
    return extractTransactionsFromRows(rawRows);
  }

  // Detect legacy binary BIFF8 .xls (OLE2 compound file)
  const isLegacyBiffXls =
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;

  if (isLegacyBiffXls) {
    throw new Error(
      'A régi bináris Excel 97-2003 (.xls) formátum biztonsági okból nem támogatott. Kérjük, mentse el .xlsx vagy .csv formátumban (az OTP HTML .xls export továbbra is működik). / Legacy binary .xls format is not supported; please save as .xlsx or .csv.'
    );
  }

  // Otherwise decode as CSV text (UTF-8 with Windows-1250 fallback for Hungarian accents)
  let csvText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (csvText.includes('\uFFFD')) {
    try {
      csvText = new TextDecoder('windows-1250').decode(bytes);
    } catch {
      // keep utf-8 decoded text
    }
  }

  const rawRows = parseCsvToRows(csvText);
  return extractTransactionsFromRows(rawRows);
}

/**
 * High-level reader that enforces strict 10 MB file size cap and detects
 * OTP HTML (.xls), modern Excel (.xlsx), or CSV statements.
 */
export async function parseBankFile(file) {
  if (!file) {
    throw new Error('Nem választott ki fájlt. / No file selected.');
  }
  if (typeof file.size === 'number' && file.size > MAX_BANK_STATEMENT_BYTES) {
    throw new Error(
      'A banki kivonat fájl mérete meghaladja a megengedett 10 MB-os korlátot. / Bank statement file exceeds the 10 MB security limit.'
    );
  }

  // Read first 2KB as text to sniff HTML
  const headSlice = file.slice(0, 2048);
  const headText = await headSlice.text();

  const isHtml = /<html|<table|<!DOCTYPE/i.test(headText);

  if (isHtml) {
    const fullText = await file.text();
    return parseOtpHtml(fullText);
  }

  const arrayBuffer = await file.arrayBuffer();
  return parseXlsxOrCsv(arrayBuffer);
}

/**
 * Normalize string for fuzzy Hungarian name matching (remove accents, lowercase, trim)
 */
function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:dr|dr\.|ifj|ifj\.|ozv|ozv\.|id|id\.)\b/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Intelligent Smart Matching Engine with Conflict-Safe Auto-Verification Guard (M-5).
 * Matches parsed transactions against condominium flats, accounts, and existing ledger items.
 */
export function matchTransactionsWithFlats({
  transactions = [],
  flats = [],
  building = {},
  existingTransactions = [],
  existingExpenses = [],
}) {
  const existingTxMap = new Set();
  const existingHashKeys = new Set();

  [...existingTransactions, ...existingExpenses].forEach((tx) => {
    if (tx.bankTxId) existingTxMap.add(String(tx.bankTxId).trim());
    const amountVal = tx.amount !== undefined ? Math.abs(Number(tx.amount)) : 0;
    const isExp = existingExpenses.includes(tx);
    const key = `${tx.date}_${isExp ? -amountVal : amountVal}_${tx.flatNum || ''}_${tx.targetAccount || ''}`;
    existingHashKeys.add(key);
  });

  const normalizedFlats = flats.map((flat) => {
    const names = [];
    if (flat.owner) names.push(normalizeName(flat.owner));
    if (flat.tenantName) names.push(normalizeName(flat.tenantName));
    if (Array.isArray(flat.owners)) {
      flat.owners.forEach((o) => {
        if (o.name) names.push(normalizeName(o.name));
      });
    }
    if (Array.isArray(flat.tenants)) {
      flat.tenants.forEach((t) => {
        if (t.name) names.push(normalizeName(t.name));
      });
    }

    const bankAccounts = [];
    if (flat.bankAccount) bankAccounts.push(String(flat.bankAccount).replace(/\D/g, ''));
    if (Array.isArray(flat.owners)) {
      flat.owners.forEach((o) => {
        if (o.bankAccount) bankAccounts.push(String(o.bankAccount).replace(/\D/g, ''));
      });
    }
    if (Array.isArray(flat.tenants)) {
      flat.tenants.forEach((t) => {
        if (t.bankAccount) bankAccounts.push(String(t.bankAccount).replace(/\D/g, ''));
      });
    }

    const paymentCodes = [];
    if (flat.paymentCode) paymentCodes.push(String(flat.paymentCode).trim().toLowerCase());
    if (Array.isArray(flat.paymentCodes)) {
      flat.paymentCodes.forEach((c) => {
        if (c) paymentCodes.push(String(c).trim().toLowerCase());
      });
    }

    const flatNumStr = String(flat.flatNum || '').trim();
    const digitsOnly = flatNumStr.replace(/\D/g, '');

    return {
      flat,
      flatNum: flatNumStr,
      digitsOnly,
      names: [...new Set(names.filter(Boolean))],
      bankAccounts: [...new Set(bankAccounts.filter(Boolean))],
      paymentCodes: [...new Set(paymentCodes.filter(Boolean))],
      monthlyFee: Number(flat.monthlyFee) || 0,
      renovationFee: Number(flat.renovationFee) || 0,
    };
  });

  return transactions.map((tx) => {
    const isIncome = tx.amount > 0;
    const absAmount = Math.abs(tx.amount);

    // 1. Primary Duplicate check (by bankTxId)
    let isDuplicate = false;
    let duplicateReason = '';

    if (tx.bankTxId && existingTxMap.has(String(tx.bankTxId).trim())) {
      isDuplicate = true;
      duplicateReason = `Már rögzítve azonosító alapján: ${tx.bankTxId}`;
    }

    // 2. Target Sub-Account detection (KK vs FA vs Custom)
    let targetAccount = 'Közös Költség';
    const headerAccount = (tx.accountName || '').toLowerCase();
    const noticeLower = (tx.notice || '').toLowerCase();

    if (headerAccount.includes('felújítás') || headerAccount.includes('fa') || headerAccount.includes('felujitas')) {
      targetAccount = 'Felújítási Alap';
    } else if (headerAccount.includes('közös') || headerAccount.includes('kk') || headerAccount.includes('kozos')) {
      targetAccount = 'Közös Költség';
    }

    if (noticeLower.includes('felújítás') || noticeLower.includes('felujitas') || /\bfa\b/.test(noticeLower)) {
      targetAccount = 'Felújítási Alap';
    } else if (noticeLower.includes('közös költség') || noticeLower.includes('kozos koltseg') || /\bkk\b/.test(noticeLower)) {
      targetAccount = 'Közös Költség';
    }

    // 3. Flat Matching Algorithm (collect ALL candidates to detect conflicts)
    const candidates = [];
    const normalizedCounterparty = normalizeName(tx.counterpartyName);
    const cleanCounterpartyAcc = (tx.counterpartyAccount || '').replace(/\D/g, '');

    for (const nf of normalizedFlats) {
      let score = 0;
      const reasons = [];
      let matchedByStrongIdentity = false; // IBAN or verified owner/tenant name
      let matchedByExplicitNotice = false; // Explicit payment code or flat number in notice

      // 0) Unique Payment Code match in Notice
      if (tx.notice && nf.paymentCodes && nf.paymentCodes.length > 0) {
        const rawNoticeLower = tx.notice.toLowerCase();
        for (const code of nf.paymentCodes) {
          if (code && code.length >= 2 && rawNoticeLower.includes(code)) {
            score += 85;
            matchedByExplicitNotice = true;
            reasons.push(`Egyedi utaláskód egyezés: ${code.toUpperCase()}`);
            break;
          }
        }
      }

      // A) Counterparty Bank Account match (direct proof)
      if (cleanCounterpartyAcc && nf.bankAccounts.some((acc) => acc.length >= 8 && cleanCounterpartyAcc.includes(acc))) {
        score += 80;
        matchedByStrongIdentity = true;
        reasons.push('Bankszámlaszám egyezés');
      }

      // B) Owner or Tenant Name match
      if (normalizedCounterparty) {
        for (const name of nf.names) {
          if (!name) continue;
          const nameParts = name.split(' ').filter((p) => p.length >= 3);
          if (normalizedCounterparty.includes(name) || name.includes(normalizedCounterparty)) {
            score += 65;
            matchedByStrongIdentity = true;
            reasons.push(`Név egyezés: ${name}`);
            break;
          } else if (nameParts.length >= 2 && nameParts.every((part) => normalizedCounterparty.includes(part))) {
            score += 60;
            matchedByStrongIdentity = true;
            reasons.push(`Név egyezés: ${name}`);
            break;
          }
        }
      }

      // C) Flat number in Notice (Közlemény)
      if (tx.notice) {
        const rawNotice = tx.notice;
        const escapedFlat = nf.flatNum.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const exactRegex = new RegExp(`(?:^|\\b|\\s)${escapedFlat}(?:\\b|\\s|\\.|$)`, 'i');

        if (exactRegex.test(rawNotice)) {
          score += 55;
          matchedByExplicitNotice = true;
          reasons.push(`Lakásszám egyezés (${nf.flatNum})`);
        } else if (nf.digitsOnly) {
          const digit = nf.digitsOnly;
          const patterns = [
            new RegExp(`\\b(?:lakás|lakas|lak|ajtó|ajto|aj|albetét|albetet)\\.?\\s*${digit}\\b`, 'i'),
            new RegExp(`\\b${digit}\\.?\\s*(?:lakás|lakas|lak|ajtó|ajto|aj|albetét|albetet)\\b`, 'i'),
            new RegExp(`\\b(?:fsz|fszt|fsz\\.|fszt\\.)\\s*${digit}\\b`, 'i'),
            new RegExp(`\\b${digit}\\s*\\/\\s*\\d+\\b`, 'i'),
          ];

          if (patterns.some((p) => p.test(rawNotice))) {
            score += 50;
            matchedByExplicitNotice = true;
            reasons.push(`Lakásszám minta: ${nf.flatNum}`);
          } else if (rawNotice.trim() === digit || new RegExp(`(?:^|\\s)${digit}(?:\\s|$)`).test(rawNotice)) {
            score += 30;
            reasons.push(`Önálló lakásszám (${nf.digitsOnly})`);
          }
        }
      }

      // D) Exact Monthly / Renovation Fee Match
      if (isIncome && absAmount > 0) {
        if (targetAccount === 'Felújítási Alap' && nf.renovationFee > 0 && absAmount === nf.renovationFee) {
          score += 15;
          reasons.push(`Pontos havi előírás összeg (${absAmount} Ft)`);
        } else if (nf.monthlyFee > 0 && absAmount === nf.monthlyFee) {
          score += 15;
          reasons.push(`Pontos havi előírás összeg (${absAmount} Ft)`);
        }
      }

      if (score > 0) {
        candidates.push({
          flat: nf.flat,
          flatNum: nf.flatNum,
          score,
          reasons,
          matchedByStrongIdentity,
          matchedByExplicitNotice,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0] || null;
    const runnerUp = candidates[1] || null;

    const bestMatch = top ? top.flat : null;
    const highestScore = top ? top.score : 0;
    const matchReasons = top ? [...top.reasons] : [];

    // Conflict Guard (M-5): block auto-verification if a DIFFERENT flat matches by strong identity (IBAN / name),
    // OR if another flat is explicitly named in the transfer notice/payment code,
    // OR if another flat has an equally high / ambiguous score (>= 50 and within 15 pts of winner)
    let hasMatchConflict = false;
    if (top && runnerUp) {
      const otherStrongIdentity = candidates
        .slice(1)
        .find((c) => c.matchedByStrongIdentity);
      const otherExplicitNotice = candidates
        .slice(1)
        .find((c) => c.matchedByExplicitNotice);
      if (otherStrongIdentity) {
        hasMatchConflict = true;
        matchReasons.push(
          `Ütközés: a feladó neve/számlaszáma másik lakáshoz is illeszkedik (${otherStrongIdentity.flatNum}. lakás) — kézi jóváhagyás szükséges`
        );
      } else if (otherExplicitNotice) {
        hasMatchConflict = true;
        matchReasons.push(
          `Ütközés: a közlemény másik lakásra hivatkozik (${otherExplicitNotice.flatNum}. lakás) — kézi jóváhagyás szükséges`
        );
      } else if (runnerUp.score >= 50 && top.score - runnerUp.score < 15) {
        hasMatchConflict = true;
        matchReasons.push(
          `Kétértelmű párosítás (${top.flatNum}. vs ${runnerUp.flatNum}. lakás) — kézi jóváhagyás szükséges`
        );
      }
    }

    // 4. Secondary duplicate check (after flat is identified)
    if (!isDuplicate && bestMatch) {
      const compoundKey = `${tx.date}_${isIncome ? absAmount : -absAmount}_${bestMatch.flatNum}_${targetAccount}`;
      if (existingHashKeys.has(compoundKey)) {
        isDuplicate = true;
        duplicateReason = `Már létezik azonos tétel a könyvelésben ezen a napon (${tx.date}, ${absAmount} Ft, ${bestMatch.flatNum}. lakás)`;
      }
    }

    // 5. Determine Confidence & Status
    let matchConfidence = 'low';
    if (highestScore >= 50 && !hasMatchConflict) {
      matchConfidence = 'high';
    } else if (highestScore >= 25) {
      matchConfidence = 'medium';
    }

    // Auto-verify ONLY if positive income, high confidence, not duplicate, and NO identity conflict
    const isAutoVerified = isIncome && matchConfidence === 'high' && !isDuplicate && !hasMatchConflict;
    const suggestedType = isIncome ? 'payment' : 'expense';

    return {
      ...tx,
      matchedFlat: bestMatch,
      matchScore: highestScore,
      matchConfidence,
      matchReasons,
      hasMatchConflict,
      targetAccount,
      suggestedType,
      isDuplicate,
      duplicateReason,
      status: isAutoVerified ? 'Verified' : 'Pending',
      selectedForImport: !isDuplicate,
    };
  });
}
