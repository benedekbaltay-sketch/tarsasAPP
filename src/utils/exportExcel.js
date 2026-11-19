import writeXlsxFile from 'write-excel-file/universal';

/**
 * Formula Injection Neutralization (CWE-1236)
 * Neutralizes spreadsheet formula triggers (=, +, -, @, tab, CR) on all user/bank-controlled text cells.
 */
const FORMULA_TRIGGER_RE = /^[\u0000-\u0020]*[=+\-@\t\r]/;

export function sanitizeSpreadsheetText(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (!str) return '';
  if (FORMULA_TRIGGER_RE.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Escapes and formula-neutralizes a single CSV cell value.
 */
export function formatSafeCsvCell(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  const safeStr = sanitizeSpreadsheetText(value).replace(/"/g, '""');
  return `"${safeStr}"`;
}

/**
 * Safe browser Blob download helper with automatic ObjectURL revocation (fixes L-3 memory leak).
 */
function triggerBlobDownload(blob, filename) {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.setAttribute('rel', 'noopener noreferrer');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore cleanup error
    }
  }, 1500);
}

async function writeAndDownloadXlsx(sheetData, sheetOptions, filename) {
  const result = writeXlsxFile(sheetData, sheetOptions);
  const blob = await result.toBlob();
  triggerBlobDownload(blob, filename);
  return blob;
}

function buildSimpleTableSheet(headers, rows) {
  const headerRow = headers.map((h) => ({
    value: sanitizeSpreadsheetText(h),
    type: String,
    fontFamily: 'Calibri',
    fontSize: 11,
    fontWeight: 'bold',
    textColor: '#FFFFFF',
    backgroundColor: '#1E3A8A',
    alignVertical: 'center',
    height: 24,
  }));

  const dataRows = rows.map((row) =>
    row.map((cell) => {
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        return {
          value: cell,
          type: Number,
          format: '#,##0',
          fontFamily: 'Calibri',
          fontSize: 10,
          align: 'right',
          alignVertical: 'center',
        };
      }
      return {
        value: sanitizeSpreadsheetText(cell),
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        align: 'left',
        alignVertical: 'center',
      };
    })
  );

  return [headerRow, ...dataRows];
}

export async function exportTransactionsToExcel(transactions, expenses, isEn = false) {
  const combined = [
    ...(transactions || []).map((t) => ({
      date: t.date || '',
      flat: t.flatNum || '-',
      account: t.targetAccount || '',
      type: isEn ? 'Payment' : 'Befizetés',
      amount: Number(t.amount) || 0,
      method: t.method || '-',
      comment: t.comment || '',
    })),
    ...(expenses || []).map((e) => ({
      date: e.date || '',
      flat: '-',
      account: e.targetAccount || '',
      type: isEn ? 'Expense' : 'Kiadás',
      amount: -Math.abs(Number(e.amount) || 0),
      method: e.category || '-',
      comment: e.comment || '',
    })),
  ];

  combined.sort((a, b) => new Date(b.date) - new Date(a.date));

  const headers = isEn
    ? ['Date', 'Flat', 'Account', 'Type', 'Amount (HUF)', 'Method', 'Comment']
    : ['Dátum', 'Lakás', 'Számla', 'Típus', 'Összeg (Ft)', 'Módszer', 'Megjegyzés'];

  const sheetData = buildSimpleTableSheet(
    headers,
    combined.map((r) => [r.date, r.flat, r.account, r.type, r.amount, r.method, r.comment])
  );

  return writeAndDownloadXlsx(
    sheetData,
    {
      sheet: isEn ? 'Transactions' : 'Tranzakciók',
      columns: [
        { width: 14 },
        { width: 12 },
        { width: 20 },
        { width: 14 },
        { width: 16 },
        { width: 18 },
        { width: 38 },
      ],
    },
    `tranzakciok_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export async function exportTimelineToExcel(timeline, flatNum, isEn = false) {
  const headers = isEn
    ? ['Date', 'Account', 'Type', 'Amount (HUF)', 'Balance (HUF)', 'Comment']
    : ['Dátum', 'Számla', 'Típus', 'Összeg (Ft)', 'Egyenleg (Ft)', 'Megjegyzés'];

  const rows = (timeline || []).map((item) => [
    item.date || '',
    item.account || item.targetAccount || '',
    item.type === 'Debit' ? (isEn ? 'Debit' : 'Előírás') : (isEn ? 'Payment' : 'Befizetés'),
    Number(item.amount) || 0,
    item.runningBalance !== undefined && item.runningBalance !== '' && Number.isFinite(Number(item.runningBalance))
      ? Number(item.runningBalance)
      : '',
    item.comment || '',
  ]);

  const sheetData = buildSimpleTableSheet(headers, rows);
  const safeFlat = String(flatNum || 'flat').replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_');

  return writeAndDownloadXlsx(
    sheetData,
    {
      sheet: (isEn ? `Flat_${safeFlat}` : `Lakas_${safeFlat}`).slice(0, 31),
      columns: [
        { width: 14 },
        { width: 20 },
        { width: 14 },
        { width: 16 },
        { width: 16 },
        { width: 38 },
      ],
    },
    `folyoszamla_${safeFlat}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

/**
 * Builds the sheet data for General Assembly Owner Balances Statement
 * (Tulajdonosi egyenlegek elszámolása) with exact styling, borders, typography,
 * formula-injection protection, and live Excel closing-balance formulas.
 */
export function buildOwnerBalancesSheetData(reportData, isEn = false) {
  const startFormatted = reportData.startDateStr.replace(/-/g, '.');
  const endFormatted = reportData.endDateStr.replace(/-/g, '.');
  const numFmt = '#,##0';

  const bldgText = `${reportData.building?.name || 'Társasház'}${reportData.building?.address ? ` (${reportData.building.address})` : ''}${reportData.building?.taxNumber ? ` • Adószám: ${reportData.building.taxNumber}` : ''}`;

  const sheetData = [
    // Row 1: Title
    [
      {
        value: isEn ? 'CONDOMINIUM OWNER BALANCES STATEMENT' : 'TULAJDONOSI EGYENLEGEK ELSZÁMOLÁSA',
        type: String,
        fontFamily: 'Calibri',
        fontSize: 14,
        fontWeight: 'bold',
        textColor: '#1E3A8A',
        alignVertical: 'center',
        height: 26,
      },
    ],
    // Row 2: Building name & address
    [
      {
        value: isEn ? 'Condominium:' : 'Társasház:',
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        fontWeight: 'bold',
        textColor: '#4B5563',
        alignVertical: 'center',
        height: 18,
      },
      {
        value: sanitizeSpreadsheetText(bldgText),
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: '#111827',
        alignVertical: 'center',
      },
    ],
    // Row 3: Period
    [
      {
        value: isEn ? 'Period:' : 'Elszámolási időszak:',
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        fontWeight: 'bold',
        textColor: '#4B5563',
        alignVertical: 'center',
        height: 18,
      },
      {
        value: sanitizeSpreadsheetText(`${startFormatted} – ${endFormatted} (${reportData.monthsCount} ${isEn ? 'months' : 'hónap'})`),
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: '#111827',
        alignVertical: 'center',
      },
    ],
    // Row 4: Accounting rule
    [
      {
        value: isEn ? 'Accounting rule:' : 'Számviteli szabály:',
        type: String,
        fontFamily: 'Calibri',
        fontSize: 9,
        fontStyle: 'italic',
        textColor: '#6B7280',
        alignVertical: 'center',
        height: 18,
      },
      {
        value: isEn
          ? 'Closing Balance = Opening Balance - Period Prescriptions + Period Payments'
          : 'Záró egyenleg = Nyitó egyenleg - Időszaki előírás + Időszaki befizetés',
        type: String,
        fontFamily: 'Calibri',
        fontSize: 9,
        fontStyle: 'italic',
        textColor: '#6B7280',
        alignVertical: 'center',
      },
    ],
    // Row 5: Blank separator
    [{ value: '', type: String, height: 10 }],
  ];

  // Row 6: Exact 7 Table Headers
  const headers = [
    isEn ? 'Unit' : 'Albetét',
    isEn ? 'Owner(s)' : 'Tulajdonos(ok)',
    isEn ? 'Fund' : 'Alap',
    isEn ? 'Opening' : 'Nyitó',
    isEn ? 'Debit' : 'Előírás',
    isEn ? 'Payment' : 'Befizetés',
    isEn ? 'Closing' : 'Záró',
  ];

  sheetData.push(
    headers.map((h, idx) => ({
      value: h,
      type: String,
      fontFamily: 'Calibri',
      fontSize: 11,
      fontWeight: 'bold',
      textColor: '#FFFFFF',
      backgroundColor: '#1E3A8A',
      align: idx >= 3 ? 'right' : 'left',
      alignVertical: 'center',
      height: 26,
      topBorderStyle: 'medium',
      topBorderColor: '#1E3A8A',
      bottomBorderStyle: 'medium',
      bottomBorderColor: '#1E3A8A',
      leftBorderStyle: 'thin',
      leftBorderColor: '#2563EB',
      rightBorderStyle: 'thin',
      rightBorderColor: '#2563EB',
    }))
  );

  const kkLabel = isEn ? 'Common Fee (KK)' : 'Közös Költség (KK)';
  const faLabel = isEn ? 'Renovation Fund (FA)' : 'Felújítási Alap (FA)';

  const kkBorder = {
    topBorderStyle: 'thin',
    topBorderColor: '#E5E7EB',
    bottomBorderStyle: 'thin',
    bottomBorderColor: '#F3F4F6',
    leftBorderStyle: 'thin',
    leftBorderColor: '#E5E7EB',
    rightBorderStyle: 'thin',
    rightBorderColor: '#E5E7EB',
  };

  const faBorder = {
    topBorderStyle: 'thin',
    topBorderColor: '#F3F4F6',
    bottomBorderStyle: 'medium',
    bottomBorderColor: '#94A3B8',
    leftBorderStyle: 'thin',
    leftBorderColor: '#E5E7EB',
    rightBorderStyle: 'thin',
    rightBorderColor: '#E5E7EB',
  };

  let r = 7; // 1-indexed Excel row number

  reportData.rows.forEach((flat) => {
    const safeLabel = sanitizeSpreadsheetText(flat.flatLabel);
    const safeOwner = sanitizeSpreadsheetText(flat.ownerName);

    // 1. Közös Költség (KK) Row
    const rKK = r;
    sheetData.push([
      {
        value: safeLabel,
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        fontWeight: 'bold',
        textColor: '#111827',
        align: 'left',
        alignVertical: 'center',
        height: 20,
        ...kkBorder,
      },
      {
        value: safeOwner,
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: '#374151',
        align: 'left',
        alignVertical: 'center',
        ...kkBorder,
      },
      {
        value: kkLabel,
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        fontWeight: 'bold',
        textColor: '#1E40AF',
        backgroundColor: '#EFF6FF',
        align: 'left',
        alignVertical: 'center',
        ...kkBorder,
      },
      {
        value: Number(flat.nyitoKK) || 0,
        type: Number,
        format: numFmt,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: Number(flat.nyitoKK) < 0 ? '#DC2626' : '#111827',
        align: 'right',
        alignVertical: 'center',
        ...kkBorder,
      },
      {
        value: Number(flat.eloirasKK) || 0,
        type: Number,
        format: numFmt,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: '#111827',
        align: 'right',
        alignVertical: 'center',
        ...kkBorder,
      },
      {
        value: Number(flat.befizetesKK) || 0,
        type: Number,
        format: numFmt,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: '#047857',
        align: 'right',
        alignVertical: 'center',
        ...kkBorder,
      },
      {
        value: `D${rKK}-E${rKK}+F${rKK}`,
        type: 'Formula',
        format: numFmt,
        fontFamily: 'Calibri',
        fontSize: 10,
        fontWeight: 'bold',
        textColor: Number(flat.zaroKK) < 0 ? '#DC2626' : '#1E3A8A',
        backgroundColor: '#F0F7FF',
        align: 'right',
        alignVertical: 'center',
        topBorderStyle: 'thin',
        topBorderColor: '#E5E7EB',
        bottomBorderStyle: 'thin',
        bottomBorderColor: '#F3F4F6',
        leftBorderStyle: 'thin',
        leftBorderColor: '#DBEAFE',
        rightBorderStyle: 'thin',
        rightBorderColor: '#DBEAFE',
      },
    ]);
    r++;

    // 2. Felújítási Alap (FA) Row
    const rFA = r;
    sheetData.push([
      {
        value: safeLabel,
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: '#6B7280',
        backgroundColor: '#F9FAFB',
        align: 'left',
        alignVertical: 'center',
        height: 20,
        ...faBorder,
      },
      {
        value: safeOwner,
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: '#6B7280',
        backgroundColor: '#F9FAFB',
        align: 'left',
        alignVertical: 'center',
        ...faBorder,
      },
      {
        value: faLabel,
        type: String,
        fontFamily: 'Calibri',
        fontSize: 10,
        fontWeight: 'bold',
        textColor: '#B45309',
        backgroundColor: '#FFFBEB',
        align: 'left',
        alignVertical: 'center',
        ...faBorder,
      },
      {
        value: Number(flat.nyitoFA) || 0,
        type: Number,
        format: numFmt,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: Number(flat.nyitoFA) < 0 ? '#DC2626' : '#374151',
        backgroundColor: '#F9FAFB',
        align: 'right',
        alignVertical: 'center',
        ...faBorder,
      },
      {
        value: Number(flat.eloirasFA) || 0,
        type: Number,
        format: numFmt,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: '#374151',
        backgroundColor: '#F9FAFB',
        align: 'right',
        alignVertical: 'center',
        ...faBorder,
      },
      {
        value: Number(flat.befizetesFA) || 0,
        type: Number,
        format: numFmt,
        fontFamily: 'Calibri',
        fontSize: 10,
        textColor: '#047857',
        backgroundColor: '#F9FAFB',
        align: 'right',
        alignVertical: 'center',
        ...faBorder,
      },
      {
        value: `D${rFA}-E${rFA}+F${rFA}`,
        type: 'Formula',
        format: numFmt,
        fontFamily: 'Calibri',
        fontSize: 10,
        fontWeight: 'bold',
        textColor: Number(flat.zaroFA) < 0 ? '#DC2626' : '#B45309',
        backgroundColor: '#FEF3C7',
        align: 'right',
        alignVertical: 'center',
        topBorderStyle: 'thin',
        topBorderColor: '#F3F4F6',
        bottomBorderStyle: 'medium',
        bottomBorderColor: '#94A3B8',
        leftBorderStyle: 'thin',
        leftBorderColor: '#FDE68A',
        rightBorderStyle: 'thin',
        rightBorderColor: '#FDE68A',
      },
    ]);
    r++;
  });

  return sheetData;
}

/**
 * Exports the General Assembly Owner Balances Statement (Tulajdonosi egyenlegek elszámolása)
 * to a styled Excel (.xlsx) file with cell borders, typography, live formulas, and exact headers.
 */
export async function exportOwnerBalancesToExcel(reportData, isEn = false) {
  if (!reportData || !reportData.rows) return;

  const startFormatted = reportData.startDateStr.replace(/-/g, '.');
  const endFormatted = reportData.endDateStr.replace(/-/g, '.');
  const filename = `Tulajdonosi_egyenlegek_${startFormatted}_${endFormatted}.xlsx`;
  const sheetData = buildOwnerBalancesSheetData(reportData, isEn);

  return writeAndDownloadXlsx(
    sheetData,
    {
      sheet: isEn ? 'Owner Balances' : 'Tulajdonosi elszámolás',
      columns: [
        { width: 14 },
        { width: 28 },
        { width: 24 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 18 },
      ],
    },
    filename
  );
}

/**
 * Export loan payment history to Excel (.xlsx)
 */
export async function exportLoanPaymentsToExcel(loan, isEn = false) {
  if (!loan) return;
  const headers = isEn
    ? ['Payment Date', 'Total Paid (HUF)', 'Principal (HUF)', 'Interest (HUF)', 'Bank Fee (HUF)', 'Remaining Principal (HUF)', 'Status', 'Note']
    : ['Dátum', 'Teljes befizetés (Ft)', 'Tőke (Ft)', 'Kamat (Ft)', 'Banki díj (Ft)', 'Fennmaradó tőke (Ft)', 'Státusz', 'Megjegyzés'];

  const rows = (loan.payments || []).map((p) => [
    p.paymentDate || '-',
    Number(p.totalPaid) || 0,
    Number(p.principalPaid) || 0,
    Number(p.interestPaid) || 0,
    Number(p.bankFee) || 0,
    Number(p.remainingBalanceAfter) || 0,
    p.status === 'completed' ? (isEn ? 'Completed' : 'Teljesítve') : (isEn ? 'Pending' : 'Folyamatban'),
    p.note || '',
  ]);

  const sheetData = buildSimpleTableSheet(headers, rows);
  const cleanTitle = (loan.title || 'hitel').replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);

  return writeAndDownloadXlsx(
    sheetData,
    {
      sheet: isEn ? 'Loan Payments' : 'Törlesztések',
      columns: [
        { width: 14 },
        { width: 18 },
        { width: 16 },
        { width: 16 },
        { width: 16 },
        { width: 20 },
        { width: 14 },
        { width: 32 },
      ],
    },
    `hitel_torlesztes_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

/**
 * Export loan participants breakdown to Excel (.xlsx)
 */
export async function exportLoanParticipantsToExcel(loan, isEn = false) {
  if (!loan) return;
  const headers = isEn
    ? ['Apartment', 'Owner', 'Payment Method', 'Lump Sum Paid (HUF)', 'Monthly Contribution (HUF/mo)']
    : ['Lakás', 'Tulajdonos', 'Fizetési mód', 'Befizetett önrész (Ft)', 'Havi törlesztőrészlet (Ft/hó)'];

  const rows = (loan.participants || []).map((p) => [
    p.apartmentId || '-',
    p.ownerName || '-',
    p.paymentMethod === 'lump_sum'
      ? (isEn ? 'Lump Sum (Exempt)' : 'Egyösszegű (Zsebből)')
      : (isEn ? 'Financed' : 'Hitelből törlesztő'),
    p.paymentMethod === 'lump_sum' ? (Number(p.lumpSumAmountPaid) || 0) : 0,
    p.paymentMethod === 'financed' ? (Number(p.monthlyContribution) || 0) : 0,
  ]);

  const sheetData = buildSimpleTableSheet(headers, rows);
  const cleanTitle = (loan.title || 'hitel').replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);

  return writeAndDownloadXlsx(
    sheetData,
    {
      sheet: isEn ? 'Participants' : 'Résztvevők',
      columns: [
        { width: 14 },
        { width: 28 },
        { width: 22 },
        { width: 20 },
        { width: 24 },
      ],
    },
    `hitel_resztvevok_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

/**
 * Helper to download raw CSV string safely (with ObjectURL cleanup)
 */
function downloadCSV(csvContent, filename) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, filename);
}

/**
 * Builds formula-safe CSV string for loan payments (exported for unit testing)
 */
export function buildLoanPaymentsCsv(loan, isEn = false) {
  const headers = isEn
    ? ['Payment Date', 'Total Paid (HUF)', 'Principal (HUF)', 'Interest (HUF)', 'Bank Fee (HUF)', 'Remaining Principal (HUF)', 'Status', 'Note']
    : ['Dátum', 'Teljes befizetés (Ft)', 'Tőke (Ft)', 'Kamat (Ft)', 'Banki díj (Ft)', 'Fennmaradó tőke (Ft)', 'Státusz', 'Megjegyzés'];

  const rows = (loan.payments || []).map((p) => [
    formatSafeCsvCell(p.paymentDate || ''),
    Number(p.totalPaid) || 0,
    Number(p.principalPaid) || 0,
    Number(p.interestPaid) || 0,
    Number(p.bankFee) || 0,
    Number(p.remainingBalanceAfter) || 0,
    formatSafeCsvCell(p.status === 'completed' ? (isEn ? 'Completed' : 'Teljesítve') : (isEn ? 'Pending' : 'Folyamatban')),
    formatSafeCsvCell(p.note || ''),
  ]);

  return [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
}

/**
 * Export loan payments to CSV
 */
export function exportLoanPaymentsToCSV(loan, isEn = false) {
  if (!loan) return;
  const csvContent = buildLoanPaymentsCsv(loan, isEn);
  const cleanTitle = (loan.title || 'hitel').replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);
  downloadCSV(csvContent, `hitel_torlesztes_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Builds formula-safe CSV string for loan participants (exported for unit testing)
 */
export function buildLoanParticipantsCsv(loan, isEn = false) {
  const headers = isEn
    ? ['Apartment', 'Owner', 'Payment Method', 'Lump Sum Paid (HUF)', 'Monthly Contribution (HUF/mo)']
    : ['Lakás', 'Tulajdonos', 'Fizetési mód', 'Befizetett önrész (Ft)', 'Havi törlesztőrészlet (Ft/hó)'];

  const rows = (loan.participants || []).map((p) => [
    formatSafeCsvCell(p.apartmentId || ''),
    formatSafeCsvCell(p.ownerName || ''),
    formatSafeCsvCell(
      p.paymentMethod === 'lump_sum'
        ? (isEn ? 'Lump Sum (Exempt)' : 'Egyösszegű (Zsebből)')
        : (isEn ? 'Financed' : 'Hitelből törlesztő')
    ),
    p.paymentMethod === 'lump_sum' ? (Number(p.lumpSumAmountPaid) || 0) : 0,
    p.paymentMethod === 'financed' ? (Number(p.monthlyContribution) || 0) : 0,
  ]);

  return [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
}

/**
 * Export loan participants to CSV
 */
export function exportLoanParticipantsToCSV(loan, isEn = false) {
  if (!loan) return;
  const csvContent = buildLoanParticipantsCsv(loan, isEn);
  const cleanTitle = (loan.title || 'hitel').replace(/[^a-zA-Z0-9_\u00C0-\u017F]/g, '_').substring(0, 30);
  downloadCSV(csvContent, `hitel_resztvevok_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
}
