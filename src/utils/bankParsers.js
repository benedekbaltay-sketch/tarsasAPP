import * as XLSX from 'xlsx';

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
  str = str.replace(/[HUF|Ft|€|\$|EUR|USD]/gi, '')
           .replace(/\u00A0/g, '') // non-breaking space
           .replace(/\s+/g, '')
           .trim();

  // If format is like 1.250,50 (Hungarian dot thousands, comma decimals)
  if (str.includes(',') && str.includes('.')) {
    // Determine which is decimal: the last one
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Dot is thousand sep, comma is decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Comma is thousand sep, dot is decimal
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma: e.g. 1250,00 -> 1250.00
    str = str.replace(',', '.');
  }

  const val = parseFloat(str);
  return isNaN(val) ? 0 : val;
}

/**
 * Clean and normalize dates to ISO format YYYY-MM-DD.
 * Handles:
 *   "2026.11.18 10:20:15" -> "2026-11-18"
 *   "2026.11.18." -> "2026-11-18"
 *   "2026-11-18" -> "2026-11-18"
 *   "18/11/2026" -> "2026-11-18"
 *   Excel serial number (e.g. 45614)
 */
export function cleanDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  
  // Handle Excel numeric serial dates
  if (typeof raw === 'number') {
    try {
      const parsedDate = XLSX.SSF.parse_date_code(raw);
      if (parsedDate) {
        const y = String(parsedDate.y).padStart(4, '0');
        const m = String(parsedDate.m).padStart(2, '0');
        const d = String(parsedDate.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // fallback
    }
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

  // Date parsing fallback
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
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

  // 1. Extract metadata from document body text & tables
  const allText = doc.body.textContent || '';
  
  // Search for account number (standard Hungarian bank format: 8-8 or 8-8-8 digits)
  const accNumMatch = allText.match(/(?:számlaszám|számla|szamlaszam)[:\s]*(\d{8}-\d{8}(?:-\d{8})?)/i) ||
                      allText.match(/\b(\d{8}-\d{8}(?:-\d{8})?)\b/);
  if (accNumMatch) {
    accountNumber = accNumMatch[1];
  }

  // Search for account name (e.g. "Számla elnevezése: Batyu KK")
  const accNameMatch = allText.match(/(?:számla elnevezése|számla megnevezése|számlanév|számla neve)[:\s]*([^\r\n<]+)/i);
  if (accNameMatch) {
    accountName = accNameMatch[1].trim();
  }

  // Search for period (e.g. "Lekérdezési időszak: 2026.10.01 - 2026.10.31")
  const periodMatch = allText.match(/(?:lekérdezési időszak|időszak|idoszak)[:\s]*([^\r\n<]+)/i);
  if (periodMatch) {
    period = periodMatch[1].trim();
  }

  // 2. Locate transactions table
  const tables = Array.from(doc.querySelectorAll('table'));
  let txTable = null;
  let headerRowIndex = -1;
  let colMap = {};

  // Standard column keywords for OTP
  const columnKeywords = {
    type: ['forgalom típusa', 'forgalom típus', 'típus', 'forgalomtipus', 'forgalom', 'jogcím'],
    date: ['tranzakció időpontja', 'tranzakció időpont', 'könyvelés napja', 'könyvelés dátuma', 'könyvelés', 'dátum', 'datum', 'tranzakció dátuma'],
    valueDate: ['értéknap', 'erteknap', 'érték nap'],
    amount: ['összeg', 'osszeg', 'összeg (huf)', 'összeg devizanemben', 'összeg huf'],
    counterpartyAccount: ['ellenoldali számlaszám', 'ellenoldali számla', 'partner számlaszáma', 'partner számlaszám', 'számlaszám'],
    counterpartyName: ['ellenoldali név', 'ellenoldali nev', 'partner neve', 'partner név', 'partner', 'megbízó neve', 'kedvezményezett neve'],
    notice: ['közlemény', 'kozlemeny', 'közlemény rovat', 'megjegyzés', 'leírás'],
    bankTxId: ['banki tranzakció azonosító', 'tranzakció azonosító', 'tranzakcióazonosító', 'azonosító', 'referencia', 'bizonylatszám', 'referenciaszám']
  };

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));
    for (let r = 0; r < rows.length; r++) {
      const cells = Array.from(rows[r].querySelectorAll('th, td')).map(c => (c.textContent || '').trim().toLowerCase());
      
      const foundCols = {};
      Object.keys(columnKeywords).forEach(key => {
        const keywords = columnKeywords[key];
        const idx = cells.findIndex(text => keywords.some(kw => text.includes(kw)));
        if (idx !== -1) {
          foundCols[key] = idx;
        }
      });

      // Must at least find amount and either date or notice or counterpartyName
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
    // If no explicit table matched, fallback to the table with the most rows and columns
    const candidate = tables.find(t => t.querySelectorAll('tr').length > 1);
    if (candidate) {
      txTable = candidate;
      headerRowIndex = 0;
    }
  }

  const transactions = [];

  if (txTable) {
    const rows = Array.from(txTable.querySelectorAll('tr'));
    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const cells = Array.from(rows[r].querySelectorAll('td, th')).map(c => (c.textContent || '').trim());
      if (cells.length < 3) continue;

      // Extract raw cell values based on detected column mapping or fallbacks
      const rawAmount = colMap.amount !== undefined ? cells[colMap.amount] : cells[3];
      const parsedAmount = cleanAmount(rawAmount);

      // Skip row if amount is zero or non-numeric header/footer row
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

      // Unique hash for fallback ID
      const fallbackId = `otp-${txDate}-${Math.abs(parsedAmount)}-${(rawCounterpartyAccount || '').replace(/\D/g, '') || Math.random().toString(36).substr(2, 6)}`;
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
        accountNumber
      });
    }
  }

  return {
    accountNumber,
    accountName,
    period,
    totalCount: transactions.length,
    transactions
  };
}

/**
 * Parse binary Excel (.xlsx, .xls) or CSV via SheetJS into metadata & transactions.
 */
export function parseXlsxOrCsv(dataBuffer) {
  const workbook = XLSX.read(dataBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to 2D array of rows
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let accountNumber = '';
  let accountName = '';
  let period = '';

  // Extract header metadata
  rawRows.slice(0, 15).forEach(row => {
    const text = row.map(c => String(c)).join(' ');
    if (!accountNumber) {
      const match = text.match(/(?:számlaszám|számla)[:\s]*(\d{8}-\d{8}(?:-\d{8})?)/i) || text.match(/\b(\d{8}-\d{8}(?:-\d{8})?)\b/);
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
    bankTxId: ['banki tranzakció azonosító', 'tranzakció azonosító', 'azonosító', 'referencia', 'bizonylatszám']
  };

  let headerRowIndex = -1;
  let colMap = {};

  for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
    const row = rawRows[r].map(c => String(c || '').trim().toLowerCase());
    const foundCols = {};
    Object.keys(columnKeywords).forEach(key => {
      const keywords = columnKeywords[key];
      const idx = row.findIndex(text => keywords.some(kw => text.includes(kw)));
      if (idx !== -1) foundCols[key] = idx;
    });

    if (foundCols.amount !== undefined && (foundCols.date !== undefined || foundCols.notice !== undefined || foundCols.counterpartyName !== undefined)) {
      headerRowIndex = r;
      colMap = foundCols;
      break;
    }
  }

  const transactions = [];

  if (headerRowIndex !== -1) {
    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const cells = rawRows[r].map(c => String(c !== null && c !== undefined ? c : '').trim());
      if (cells.length < 2) continue;

      const rawAmount = colMap.amount !== undefined ? cells[colMap.amount] : '';
      const parsedAmount = cleanAmount(rawAmount);
      if (isNaN(parsedAmount) || parsedAmount === 0) continue;

      const rawDate = colMap.date !== undefined ? cells[colMap.date] : '';
      const rawValueDate = colMap.valueDate !== undefined ? cells[colMap.valueDate] : rawDate;
      const rawType = colMap.type !== undefined ? cells[colMap.type] : (parsedAmount > 0 ? 'Befizetés' : 'Kiadás');
      const rawCounterpartyAccount = colMap.counterpartyAccount !== undefined ? cells[colMap.counterpartyAccount] : '';
      const rawCounterpartyName = colMap.counterpartyName !== undefined ? cells[colMap.counterpartyName] : '';
      const rawNotice = colMap.notice !== undefined ? cells[colMap.notice] : '';
      const rawTxId = colMap.bankTxId !== undefined ? cells[colMap.bankTxId] : '';

      const txDate = cleanDate(rawDate);
      const valDate = cleanDate(rawValueDate);

      const fallbackId = `bank-${txDate}-${Math.abs(parsedAmount)}-${(rawCounterpartyAccount || '').replace(/\D/g, '') || Math.random().toString(36).substr(2, 6)}`;
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
        accountNumber
      });
    }
  }

  return {
    accountNumber,
    accountName,
    period,
    totalCount: transactions.length,
    transactions
  };
}

/**
 * High-level reader that detects whether file is OTP HTML or standard Excel/CSV.
 */
export async function parseBankFile(file) {
  // Read first 2KB as text to sniff HTML
  const headSlice = file.slice(0, 2048);
  const headText = await headSlice.text();

  const isHtml = /<html|<table|<!DOCTYPE/i.test(headText);

  if (isHtml) {
    const fullText = await file.text();
    return parseOtpHtml(fullText);
  } else {
    const arrayBuffer = await file.arrayBuffer();
    return parseXlsxOrCsv(arrayBuffer);
  }
}

/**
 * Normalize string for fuzzy Hungarian name matching (remove accents, lowercase, trim)
 */
function normalizeName(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/\b(?:dr|dr\.|ifj|ifj\.|ozv|ozv\.|id|id\.)\b/g, '') // remove titles
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Intelligent Smart Matching Engine.
 * Matches parsed transactions against condominium flats, accounts, and existing ledger items.
 */
export function matchTransactionsWithFlats({
  transactions = [],
  flats = [],
  building = {},
  existingTransactions = [],
  existingExpenses = []
}) {
  const buildingDefaultAccount = building?.bankKK?.name || 'Közös Költség';
  
  // Pre-index existing ledger items to catch duplicates
  const existingTxMap = new Map();
  const existingHashKeys = new Set();

  (existingTransactions || []).forEach(tx => {
    if (!tx) return;
    if (tx.bankTxId) existingTxMap.set(String(tx.bankTxId).trim(), tx);
    // Compound key: date + amount + flatNum + targetAccount
    const key = `${tx.date}_${Number(tx.amount)}_${tx.flatNum}_${tx.targetAccount}`;
    existingHashKeys.add(key);
  });

  (existingExpenses || []).forEach(exp => {
    if (!exp) return;
    if (exp.bankTxId) existingTxMap.set(String(exp.bankTxId).trim(), exp);
    const key = `${exp.date}_${-Math.abs(Number(exp.amount))}_expense_${exp.targetAccount}`;
    existingHashKeys.add(key);
  });

  // Prepare normalized flats index
  const normalizedFlats = (flats || []).map(f => {
    const flatNum = String(f.flatNum || '').trim();
    // Clean flatNum: "Fsz 1" -> digits "1", prefix "fsz"
    const digitsOnly = flatNum.replace(/\D/g, '');
    const isGroundFloor = /fsz/i.test(flatNum);
    
    // Extract unique recognition codes (utalaskod / paymentCode)
    const paymentCodes = [];
    if (f.paymentCode) paymentCodes.push(String(f.paymentCode).trim().toLowerCase());
    if (f.utalaskod && !paymentCodes.includes(String(f.utalaskod).trim().toLowerCase())) {
      paymentCodes.push(String(f.utalaskod).trim().toLowerCase());
    }

    // Extract owners/tenants names (including active tenants and payer names)
    const names = [];
    if (f.ownerName) names.push(normalizeName(f.ownerName));
    if (Array.isArray(f.owners)) {
      f.owners.forEach(o => {
        if (o?.name) names.push(normalizeName(o.name));
      });
    }
    // Active tenants ONLY (exclude inactive / moved-out tenants)
    if (Array.isArray(f.tenants)) {
      f.tenants.forEach(t => {
        if (t?.isActive !== false) {
          if (t.name) names.push(normalizeName(t.name));
          if (t.payerName) names.push(normalizeName(t.payerName));
        }
      });
    } else if (f.tenantName) {
      names.push(normalizeName(f.tenantName));
      if (f.tenantPayerName) names.push(normalizeName(f.tenantPayerName));
    }

    // Clean bank accounts (owners + active tenants)
    const bankAccounts = [];
    if (f.bankAccount) {
      const clean = f.bankAccount.replace(/\D/g, '');
      if (clean.length >= 8) bankAccounts.push(clean);
    }
    if (Array.isArray(f.owners)) {
      f.owners.forEach(o => {
        if (Array.isArray(o.bankAccounts)) {
          o.bankAccounts.forEach(acc => {
            const clean = String(acc || '').replace(/\D/g, '');
            if (clean.length >= 8 && !bankAccounts.includes(clean)) bankAccounts.push(clean);
          });
        } else if (o?.bankAccount) {
          const clean = String(o.bankAccount).replace(/\D/g, '');
          if (clean.length >= 8 && !bankAccounts.includes(clean)) bankAccounts.push(clean);
        }
      });
    }
    // Active tenants bank accounts ONLY
    if (Array.isArray(f.tenants)) {
      f.tenants.forEach(t => {
        if (t?.isActive !== false) {
          if (Array.isArray(t.bankAccounts)) {
            t.bankAccounts.forEach(acc => {
              const clean = String(acc || '').replace(/\D/g, '');
              if (clean.length >= 8 && !bankAccounts.includes(clean)) bankAccounts.push(clean);
            });
          } else if (t?.bankAccount) {
            const clean = String(t.bankAccount).replace(/\D/g, '');
            if (clean.length >= 8 && !bankAccounts.includes(clean)) bankAccounts.push(clean);
          }
        }
      });
    } else if (f.tenantBankAccount) {
      const clean = String(f.tenantBankAccount).replace(/\D/g, '');
      if (clean.length >= 8 && !bankAccounts.includes(clean)) bankAccounts.push(clean);
    }

    return {
      flat: f,
      flatNum,
      digitsOnly,
      isGroundFloor,
      paymentCodes,
      names,
      bankAccounts,
      monthlyFee: Number(f.monthlyFee) || 0,
      renovationFee: Number(f.renovationFee) || 0
    };
  });

  return transactions.map(tx => {
    const isIncome = tx.amount > 0;
    const absAmount = Math.abs(tx.amount);
    
    // 1. Deduplication check
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

    // Notice can refine or override account
    if (noticeLower.includes('felújítás') || noticeLower.includes('felujitas') || /\bfa\b/.test(noticeLower)) {
      targetAccount = 'Felújítási Alap';
    } else if (noticeLower.includes('közös költség') || noticeLower.includes('kozos koltseg') || /\bkk\b/.test(noticeLower)) {
      targetAccount = 'Közös Költség';
    }

    // 3. Flat Matching Algorithm
    let bestMatch = null;
    let highestScore = 0;
    let matchReasons = [];
    const normalizedCounterparty = normalizeName(tx.counterpartyName);
    const normalizedNotice = normalizeName(tx.notice);
    const cleanCounterpartyAcc = (tx.counterpartyAccount || '').replace(/\D/g, '');

    for (const nf of normalizedFlats) {
      let score = 0;
      let reasons = [];

      // 0) Unique Payment Code match in Notice (Direct identification)
      if (tx.notice && nf.paymentCodes && nf.paymentCodes.length > 0) {
        const rawNoticeLower = tx.notice.toLowerCase();
        for (const code of nf.paymentCodes) {
          if (code && code.length >= 2 && rawNoticeLower.includes(code)) {
            score += 85;
            reasons.push(`Egyedi utaláskód egyezés: ${code.toUpperCase()}`);
            break;
          }
        }
      }

      // A) Counterparty Bank Account match (direct proof)
      if (cleanCounterpartyAcc && nf.bankAccounts.some(acc => acc.length >= 8 && cleanCounterpartyAcc.includes(acc))) {
        score += 80;
        reasons.push('Bankszámlaszám egyezés');
      }

      // B) Owner or Tenant Name match
      if (normalizedCounterparty) {
        for (const name of nf.names) {
          if (!name) continue;
          const nameParts = name.split(' ').filter(p => p.length >= 3);
          if (normalizedCounterparty.includes(name) || name.includes(normalizedCounterparty)) {
            score += 65;
            reasons.push(`Név egyezés: ${name}`);
            break;
          } else if (nameParts.length >= 2 && nameParts.every(part => normalizedCounterparty.includes(part))) {
            score += 60;
            reasons.push(`Név egyezés: ${name}`);
            break;
          }
        }
      }

      // C) Flat number in Notice (Közlemény)
      if (tx.notice) {
        const rawNotice = tx.notice;

        // Exact match with full flat string (e.g. "Fsz 1", "Fsz. 2", "I/4")
        const escapedFlat = nf.flatNum.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const exactRegex = new RegExp(`(?:^|\\b|\\s)${escapedFlat}(?:\\b|\\s|\\.|$)`, 'i');

        if (exactRegex.test(rawNotice)) {
          score += 55;
          reasons.push(`Lakásszám egyezés (${nf.flatNum})`);
        } else if (nf.digitsOnly) {
          // Look for digit patterns: e.g. "2. lakás", "lakás 2", "fsz 2", "ajtó 2"
          const digit = nf.digitsOnly;
          const patterns = [
            new RegExp(`\\b(?:lakás|lakas|lak|ajtó|ajto|aj|albetét|albetet)\\.?\\s*${digit}\\b`, 'i'),
            new RegExp(`\\b${digit}\\.?\\s*(?:lakás|lakas|lak|ajtó|ajto|aj|albetét|albetet)\\b`, 'i'),
            new RegExp(`\\b(?:fsz|fszt|fsz\\.|fszt\\.)\\s*${digit}\\b`, 'i'),
            new RegExp(`\\b${digit}\\s*\\/\\s*\\d+\\b`, 'i') // e.g. "2/A" or "2/1"
          ];

          if (patterns.some(p => p.test(rawNotice))) {
            score += 50;
            reasons.push(`Lakásszám minta: ${nf.flatNum}`);
          } else if (rawNotice.trim() === digit || new RegExp(`(?:^|\\s)${digit}(?:\\s|$)`).test(rawNotice)) {
            // Lone digit in notice
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

      if (score > highestScore) {
        highestScore = score;
        bestMatch = nf.flat;
        matchReasons = reasons;
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
    let matchConfidence = 'low'; // 'high' | 'medium' | 'low'
    if (highestScore >= 50) {
      matchConfidence = 'high';
    } else if (highestScore >= 25) {
      matchConfidence = 'medium';
    }

    // If positive income and high confidence match: auto-verify!
    const isAutoVerified = isIncome && matchConfidence === 'high' && !isDuplicate;
    const suggestedType = isIncome ? 'payment' : 'expense';

    return {
      ...tx,
      matchedFlat: bestMatch,
      matchScore: highestScore,
      matchConfidence,
      matchReasons,
      targetAccount,
      suggestedType,
      isDuplicate,
      duplicateReason,
      status: isAutoVerified ? 'Verified' : 'Pending',
      selectedForImport: !isDuplicate
    };
  });
}
