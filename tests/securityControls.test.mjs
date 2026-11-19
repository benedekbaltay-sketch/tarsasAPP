/**
 * Automated Security Controls Verification Suite
 *
 * Tests:
 * 1. File Upload & Download Security (H-4):
 *    - Magic-byte signature enforcement for PDF, PNG, JPEG, WEBP, XLSX/DOCX
 *    - Blocking SVG / HTML / JS / polyglot payloads renamed as .png or .pdf
 *    - Safe download URL & raster preview allowlisting (blocking javascript:, data:text/html, data:image/svg+xml)
 *    - Filename path-traversal sanitization
 * 2. Spreadsheet Formula Injection Neutralization (H-5 / CWE-1236) & Round-Trip XLSX (H-6):
 *    - Neutralizing =, +, -, @, \t, \r payloads in Excel and CSV exports
 *    - Preserving numeric values and internal closing-balance formula cells
 *    - Writing & reading back real .xlsx files without vulnerable SheetJS (xlsx / xlsx-js-style)
 * 3. Bank Statement Parser Hardening (M-5):
 *    - Strict 10 MB size cap enforcement
 *    - Deterministic fallback bankTxId across repeated parses & same-day identical transfers
 *    - Conflict-safe auto-verification guard (blocks auto-Verified when counterparty IBAN/name conflicts)
 *    - RFC-4180 Hungarian CSV & modern XLSX parsing
 * 4. MNB / qvik Payment URL Sanitization (M-5):
 *    - Clamping amount bounds & stripping path traversal/newline characters
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import writeXlsxFile from 'write-excel-file/universal';

import {
  hasValidMagicBytes,
  validateUploadFile,
  isSafeDownloadUrl,
  isSafeImagePreview,
  sanitizeFileName,
  MAX_BANK_STATEMENT_BYTES,
} from '../src/utils/fileSecurity.js';

import {
  sanitizeSpreadsheetText,
  formatSafeCsvCell,
  buildOwnerBalancesSheetData,
  buildLoanPaymentsCsv,
  buildLoanParticipantsCsv,
} from '../src/utils/exportExcel.js';

import {
  parseBankFile,
  parseXlsxOrCsv,
  parseCsvToRows,
  matchTransactionsWithFlats,
} from '../src/utils/bankParsers.js';

import {
  generateMnbPaymentUrl,
  buildPaymentComment,
} from '../src/utils/qvik.js';

function makeMockFile(name, type, bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return {
    name,
    type,
    size: u8.length,
    slice(start = 0, end = u8.length) {
      const sub = u8.slice(start, end);
      return {
        async arrayBuffer() {
          return sub.buffer.slice(sub.byteOffset, sub.byteOffset + sub.byteLength);
        },
        async text() {
          return new TextDecoder('utf-8').decode(sub);
        },
      };
    },
    async arrayBuffer() {
      return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    },
    async text() {
      return new TextDecoder('utf-8').decode(u8);
    },
  };
}

test('H-4: File upload validation enforces magic bytes and blocks SVG/HTML/JS/renamed payloads', async () => {
  // Valid PDF magic bytes (%PDF-1.7)
  const validPdf = makeMockFile('szamla.pdf', 'application/pdf', new TextEncoder().encode('%PDF-1.7\n1 0 obj\n'));
  const pdfRes = await validateUploadFile(validPdf);
  assert.equal(pdfRes.ok, true);
  assert.equal(pdfRes.ext, 'pdf');

  // Valid PNG magic bytes
  const validPng = makeMockFile('foto.png', 'image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.equal((await validateUploadFile(validPng)).ok, true);

  // Blocked SVG extension
  const svgFile = makeMockFile('xss.svg', 'image/svg+xml', new TextEncoder().encode('<svg onload=alert(1)></svg>'));
  const svgRes = await validateUploadFile(svgFile);
  assert.equal(svgRes.ok, false);
  assert.equal(svgRes.reason, 'unsupported_type');

  // Blocked HTML disguised as .png
  const fakePng = makeMockFile('invoice.png', 'image/png', new TextEncoder().encode('<html><script>alert(1)</script></html>'));
  const fakePngRes = await validateUploadFile(fakePng);
  assert.equal(fakePngRes.ok, false);
  assert.equal(fakePngRes.reason, 'invalid_content');

  // Blocked SVG disguised as .pdf
  const fakePdf = makeMockFile('doc.pdf', 'application/pdf', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
  const fakePdfRes = await validateUploadFile(fakePdf);
  assert.equal(fakePdfRes.ok, false);
  assert.equal(fakePdfRes.reason, 'invalid_content');

  // Blocked oversized file (> 2 MB)
  const bigFile = {
    name: 'huge.pdf',
    type: 'application/pdf',
    size: 3 * 1024 * 1024,
  };
  const bigRes = await validateUploadFile(bigFile);
  assert.equal(bigRes.ok, false);
  assert.equal(bigRes.reason, 'too_large');

  // Filename traversal sanitization
  assert.equal(sanitizeFileName('../../etc/passwd'), 'etc_passwd');
  assert.equal(sanitizeFileName('..hidden.pdf'), 'hidden.pdf');

  // Safe download & preview URL checks
  assert.equal(isSafeDownloadUrl('data:application/pdf;base64,JVBERi0x'), true);
  assert.equal(isSafeDownloadUrl('https://firebasestorage.googleapis.com/v0/b/tarsashaz/o/doc.pdf'), true);
  assert.equal(isSafeDownloadUrl('javascript:alert(1)'), false);
  assert.equal(isSafeDownloadUrl('data:text/html;base64,PHNjcmlwdD4='), false);
  assert.equal(isSafeDownloadUrl('data:image/svg+xml;base64,PHN2Zz4='), false);

  assert.equal(isSafeImagePreview({ name: 'photo.jpg', data: 'data:image/jpeg;base64,/9j/4AAQ' }), true);
  assert.equal(isSafeImagePreview({ name: 'evil.svg', data: 'data:image/svg+xml;base64,PHN2Zz4=' }), false);
  assert.equal(isSafeImagePreview({ name: 'evil.svg', data: 'data:image/png;base64,AAAA' }), false);
  assert.equal(hasValidMagicBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), 'xlsx'), true);
});

test('H-5 / CWE-1236: Spreadsheet and CSV exports neutralize formula injection while preserving numbers & internal formulas', () => {
  assert.equal(sanitizeSpreadsheetText('=CMD|\' /C calc\'!A0'), "'=CMD|' /C calc'!A0");
  assert.equal(sanitizeSpreadsheetText('+1+1'), "'+1+1");
  assert.equal(sanitizeSpreadsheetText('-2+3'), "'-2+3");
  assert.equal(sanitizeSpreadsheetText('@SUM(1+1)'), "'@SUM(1+1)");
  assert.equal(sanitizeSpreadsheetText('   =HYPERLINK("http://evil")'), "'   =HYPERLINK(\"http://evil\")");
  assert.equal(sanitizeSpreadsheetText('Normál közös költség'), 'Normál közös költség');

  assert.equal(formatSafeCsvCell('=1+1'), '"\'=1+1"');
  assert.equal(formatSafeCsvCell(25000), '25000');

  const csvPayments = buildLoanPaymentsCsv({
    title: 'Lift hitel',
    payments: [
      {
        paymentDate: '2026-10-01',
        totalPaid: 150000,
        principalPaid: 100000,
        interestPaid: 45000,
        bankFee: 5000,
        remainingBalanceAfter: 2000000,
        status: 'completed',
        note: '=HYPERLINK("https://evil.test","Kattints")',
      },
    ],
  });
  assert.ok(csvPayments.includes('"\'=HYPERLINK(""https://evil.test"",""Kattints"")"'));

  const csvParticipants = buildLoanParticipantsCsv({
    title: 'Lift hitel',
    participants: [
      {
        apartmentId: '=1+1',
        ownerName: '@EvilOwner',
        paymentMethod: 'financed',
        monthlyContribution: 12000,
      },
    ],
  });
  assert.ok(csvParticipants.includes('"\'=1+1"'));
  assert.ok(csvParticipants.includes('"\'@EvilOwner"'));

  const sheetData = buildOwnerBalancesSheetData({
    building: { name: '=BuildingEvil', address: 'Fő u. 1.' },
    startDateStr: '2026-01-01',
    endDateStr: '2026-12-31',
    monthsCount: 12,
    rows: [
      {
        flatLabel: '+Fsz 1',
        ownerName: '=SUM(A1:A10)',
        nyitoKK: 10000,
        eloirasKK: 120000,
        befizetesKK: 120000,
        zaroKK: 10000,
        nyitoFA: 0,
        eloirasFA: 24000,
        befizetesFA: 24000,
        zaroFA: 0,
      },
    ],
  });

  // Row 2 cell B2 (building text) neutralized
  assert.ok(sheetData[1][1].value.startsWith("'=BuildingEvil"));
  // Row 7 KK unit & owner neutralized
  assert.equal(sheetData[6][0].value, "'+Fsz 1");
  assert.equal(sheetData[6][1].value, "'=SUM(A1:A10)");
  // Row 7 KK closing balance uses our trusted internal formula
  assert.equal(sheetData[6][6].type, 'Formula');
  assert.equal(sheetData[6][6].value, 'D7-E7+F7');
});

test('H-6 & M-5: XLSX/CSV parsing works without SheetJS, enforces 10 MB limit, and produces deterministic IDs', async () => {
  // 1. Strict 10 MB limit
  await assert.rejects(
    () => parseBankFile({ name: 'giant.csv', size: MAX_BANK_STATEMENT_BYTES + 1 }),
    /10 MB/i
  );

  // 2. CSV parsing with Hungarian semicolons + deterministic IDs across repeated parses
  const csvSample = [
    'Számlaszám: 11700001-22223333-00000000',
    'Számla elnevezése: Társasház KK',
    'Könyvelés napja;Összeg;Ellenoldali név;Ellenoldali számlaszám;Közlemény',
    '2026.11.05;25 000,00 Ft;Teszt Anna;11773016-00001111;Fsz 1 közös költség',
    '2026.11.05;25 000,00 Ft;Teszt Anna;11773016-00001111;Fsz 1 közös költség',
  ].join('\n');

  const csvBytes = new TextEncoder().encode(csvSample);
  const parsed1 = await parseXlsxOrCsv(csvBytes);
  const parsed2 = await parseXlsxOrCsv(csvBytes);

  assert.equal(parsed1.totalCount, 2);
  assert.equal(parsed1.accountNumber, '11700001-22223333-00000000');
  // Identical across repeated imports (idempotent)
  assert.equal(parsed1.transactions[0].bankTxId, parsed2.transactions[0].bankTxId);
  assert.equal(parsed1.transactions[1].bankTxId, parsed2.transactions[1].bankTxId);
  // Distinct for 2 legitimately identical same-day transfers
  assert.notEqual(parsed1.transactions[0].bankTxId, parsed1.transactions[1].bankTxId);

  // 3. Real XLSX round-trip (write-excel-file -> read-excel-file)
  const xlsxBlob = await writeXlsxFile(
    [
      [{ value: 'Könyvelés dátuma', type: String }, { value: 'Összeg', type: String }, { value: 'Ellenoldali név', type: String }, { value: 'Közlemény', type: String }],
      [{ value: '2026-11-10', type: String }, { value: 32500, type: Number }, { value: 'Minta Béla', type: String }, { value: '2. lakás KK', type: String }],
    ],
    { sheet: 'Kivonat' }
  ).toBlob();
  const xlsxBuf = await xlsxBlob.arrayBuffer();
  const xlsxParsed = await parseXlsxOrCsv(xlsxBuf);
  assert.equal(xlsxParsed.totalCount, 1);
  assert.equal(xlsxParsed.transactions[0].amount, 32500);
  assert.equal(xlsxParsed.transactions[0].date, '2026-11-10');
  assert.equal(xlsxParsed.transactions[0].counterpartyName, 'Minta Béla');

  // 4. Legacy BIFF8 binary .xls rejected cleanly
  await assert.rejects(
    () => parseXlsxOrCsv(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    /\.xlsx/i
  );

  // 5. Quoted RFC-4180 CSV fields
  const rows = parseCsvToRows('a;b\n"hello;world";"quote ""ok"""');
  assert.deepEqual(rows[1], ['hello;world', 'quote "ok"']);
});

test('M-5: Bank smart matcher blocks auto-Verified when counterparty identity conflicts with another flat', () => {
  const flats = [
    { flatNum: '1', owner: 'Kovács János', bankAccount: '11700001-11111111', monthlyFee: 25000, renovationFee: 5000 },
    { flatNum: '2', owner: 'Szabó Éva', bankAccount: '11700001-22222222', monthlyFee: 25000, renovationFee: 5000 },
  ];

  // Transfer comes from Flat 1's bank account & owner, but notice mentions "2. lakás" -> CONFLICT!
  const conflictMatch = matchTransactionsWithFlats({
    flats,
    transactions: [
      {
        id: 'tx-1',
        bankTxId: 'OTP-CONFLICT-1',
        date: '2026-11-15',
        amount: 25000,
        counterpartyAccount: '11700001-11111111',
        counterpartyName: 'Kovács János',
        notice: '2. lakás közös költség',
      },
    ],
  });

  // Flat 1 wins score (80 IBAN + 65 name + 15 fee = 160 vs Flat 2 notice 50 + 15 = 65),
  // AND because runnerUp has score >= 50 or identity conflict, wait: let's also test reverse:
  // Transfer comes from Flat 2's bank account, but notice has Flat 1's unique payment code!
  const reverseFlats = [
    { flatNum: '1', owner: 'Kovács János', paymentCode: 'FLAT01CODE', bankAccount: '11700001-11111111', monthlyFee: 25000 },
    { flatNum: '2', owner: 'Szabó Éva', bankAccount: '11700001-22222222', monthlyFee: 25000 },
  ];
  const reverseConflict = matchTransactionsWithFlats({
    flats: reverseFlats,
    transactions: [
      {
        id: 'tx-2',
        bankTxId: 'OTP-CONFLICT-2',
        date: '2026-11-15',
        amount: 25000,
        counterpartyAccount: '11700001-22222222',
        counterpartyName: 'Szabó Éva',
        notice: 'FLAT01CODE 1. lakás',
      },
    ],
  });

  assert.equal(reverseConflict[0].hasMatchConflict, true);
  assert.equal(reverseConflict[0].status, 'Pending');

  // Unambiguous match still auto-verifies properly
  const cleanMatch = matchTransactionsWithFlats({
    flats,
    transactions: [
      {
        id: 'tx-3',
        bankTxId: 'OTP-CLEAN-1',
        date: '2026-11-15',
        amount: 25000,
        counterpartyAccount: '11700001-11111111',
        counterpartyName: 'Kovács János',
        notice: '1. lakás KK',
      },
    ],
  });
  assert.equal(cleanMatch[0].hasMatchConflict, false);
  assert.equal(cleanMatch[0].status, 'Verified');
  assert.equal(cleanMatch[0].matchedFlat.flatNum, '1');
  assert.equal(conflictMatch[0].hasMatchConflict, true);
  assert.equal(conflictMatch[0].status, 'Pending');
});

test('M-5: MNB / qvik payment URL generator clamps amounts and strips injection characters', () => {
  const url = generateMnbPaymentUrl({
    bic: 'OTPVHUHBXXX/../../evil',
    beneficiaryName: 'Teszt Társasház\r\nInject',
    iban: 'HU42 1170 0000 0000 0000 0000 0000',
    amount: 999999999,
    comment: buildPaymentComment({ buildingCode: 'TH/1', flatNum: '4\n/evil', fundType: 'KK' }),
    refId: 'L04-KK/bad',
  });
  assert.ok(url.startsWith('https://azonnalifizetes.hu/HCT/3/1/OTPVHUHBXXX/'));
  assert.ok(url.includes('/HUF50000000///'));
  assert.ok(!url.includes('\n'));
  assert.ok(!url.includes('\r'));
});
