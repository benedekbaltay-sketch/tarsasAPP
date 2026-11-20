/**
 * Secure In-App Document Preview Utilities
 *
 * Allows viewing PDF, raster images (JPG/PNG/WEBP), Excel (.xlsx), and Word (.docx)
 * files directly inside the app without downloading to the user's computer.
 *
 * Security controls (Rule 4):
 * - Validates magic bytes before rendering PDFs in blob: iframes
 * - Uses isSafeImagePreview() to strictly reject SVG/HTML payloads
 * - Uses DOMParser('application/xml') + plain text extraction for DOCX (0% XSS)
 * - Enforces decompression byte ceiling (5 MB) on DOCX ZIP entries (ZIP-bomb guard)
 */
import readXlsxFile from 'read-excel-file/universal';
import { hasValidMagicBytes, isSafeDownloadUrl, isSafeImagePreview } from './fileSecurity.js';

const MAX_DOCX_XML_BYTES = 5 * 1024 * 1024; // 5 MB decompression cap
const MAX_XLSX_PREVIEW_ROWS = 500;
const MAX_XLSX_PREVIEW_COLS = 50;

/**
 * Decodes a Base64 Data URL (`data:...;base64,...`) into a Uint8Array.
 */
export function dataUrlToUint8Array(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx <= 0) return null;
  const header = dataUrl.slice(0, commaIdx).toLowerCase();
  if (!header.includes(';base64')) return null;

  const base64 = dataUrl.slice(commaIdx + 1).replace(/\s+/g, '');
  try {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Loads raw file bytes from either a Base64 Data URL or a safe Firebase Storage URL.
 */
export async function loadDocumentBytes(fileDataOrUrl) {
  if (!fileDataOrUrl || typeof fileDataOrUrl !== 'string') return null;
  if (!isSafeDownloadUrl(fileDataOrUrl)) return null;

  if (fileDataOrUrl.startsWith('data:')) {
    return dataUrlToUint8Array(fileDataOrUrl);
  }

  try {
    const resp = await fetch(fileDataOrUrl);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/**
 * Creates a strictly verified `blob:` URL for PDF iframe preview.
 * Returns null if magic bytes do not start with `%PDF-`.
 */
export function createSafePdfBlobUrl(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 5) return null;
  if (!hasValidMagicBytes(bytes, 'pdf')) return null;
  const blob = new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

/**
 * Formats a spreadsheet cell value safely into a display string.
 */
export function formatPreviewCellValue(cell) {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return '';
    return cell.toISOString().slice(0, 10);
  }
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE';
  return String(cell);
}

/**
 * Parses an `.xlsx` byte buffer into previewable sheet tables using `read-excel-file/universal`.
 */
export async function parseXlsxPreviewSheets(bytes) {
  if (!(bytes instanceof Uint8Array) || !hasValidMagicBytes(bytes, 'xlsx')) {
    return null;
  }
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const rawSheets = await readXlsxFile(blob);
  if (!Array.isArray(rawSheets) || rawSheets.length === 0) return [];

  return rawSheets.map((s, idx) => {
    const rawRows = Array.isArray(s.data) ? s.data : [];
    const truncatedRows = rawRows.length > MAX_XLSX_PREVIEW_ROWS;
    const slicedRows = rawRows.slice(0, MAX_XLSX_PREVIEW_ROWS);

    let maxCols = 0;
    const rows = slicedRows.map((row) => {
      const cells = Array.isArray(row) ? row.slice(0, MAX_XLSX_PREVIEW_COLS) : [];
      if (cells.length > maxCols) maxCols = cells.length;
      return cells.map(formatPreviewCellValue);
    });

    // Normalize row lengths for crisp grid alignment
    const normalizedRows = rows.map((r) => {
      if (r.length >= maxCols) return r;
      return [...r, ...Array(maxCols - r.length).fill('')];
    });

    return {
      name: s.sheet || `Sheet ${idx + 1}`,
      rows: normalizedRows,
      colCount: maxCols,
      truncatedRows,
      totalRowCount: rawRows.length,
    };
  });
}

/**
 * Inflates a raw-deflate byte slice using Web Streams DecompressionStream with a strict size cap.
 */
async function inflateRawWithLimit(compressedBytes, maxOutputBytes = MAX_DOCX_XML_BYTES) {
  if (typeof DecompressionStream === 'undefined') return null;
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressedBytes).catch(() => {});
  writer.close().catch(() => {});

  const reader = ds.readable.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxOutputBytes) {
      reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * Locates and extracts a single named file from a ZIP archive via its Central Directory.
 * Supports Stored (0) and Deflate (8) entries safely with an output byte cap.
 */
async function extractZipEntryBytes(zipBytes, targetName) {
  if (!(zipBytes instanceof Uint8Array) || zipBytes.length < 22) return null;
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);

  // Locate End of Central Directory (EOCD) signature: 0x06054b50
  const minEocdOffset = Math.max(0, zipBytes.length - 65557);
  let eocdOffset = -1;
  for (let i = zipBytes.length - 22; i >= minEocdOffset; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return null;

  const cdCount = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');

  let pos = cdOffset;
  for (let idx = 0; idx < cdCount && pos + 46 <= zipBytes.length; idx += 1) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;

    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const uncompressedSize = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const localHeaderOffset = view.getUint32(pos + 42, true);

    const entryName = decoder.decode(zipBytes.subarray(pos + 46, pos + 46 + nameLen));
    pos += 46 + nameLen + extraLen + commentLen;

    if (entryName !== targetName) continue;
    if (uncompressedSize > MAX_DOCX_XML_BYTES) return null;

    if (localHeaderOffset + 30 > zipBytes.length) return null;
    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) return null;

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zipBytes.length) return null;

    const payload = zipBytes.subarray(dataStart, dataEnd);
    if (method === 0) {
      return payload.byteLength <= MAX_DOCX_XML_BYTES ? payload : null;
    }
    if (method === 8) {
      return inflateRawWithLimit(payload, MAX_DOCX_XML_BYTES);
    }
    return null;
  }

  return null;
}

/**
 * Extracts plain text paragraphs safely from `word/document.xml` XML string.
 * Uses DOMParser in browsers and a safe regex fallback in Node test environments.
 */
export function extractParagraphsFromWordXml(xmlText) {
  if (typeof xmlText !== 'string' || !xmlText.trim()) return [];

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
    if (xmlDoc.querySelector('parsererror')) return [];
    const pNodes = Array.from(xmlDoc.getElementsByTagName('*')).filter(
      (el) => el.localName === 'p'
    );
    const paragraphs = [];
    for (const p of pNodes) {
      const tNodes = Array.from(p.getElementsByTagName('*')).filter(
        (el) => el.localName === 't' || el.localName === 'tab' || el.localName === 'br'
      );
      let text = '';
      for (const node of tNodes) {
        if (node.localName === 'tab') text += '    ';
        else if (node.localName === 'br') text += '\n';
        else text += node.textContent || '';
      }
      const cleaned = text.replace(/\r/g, '');
      if (cleaned.trim()) paragraphs.push(cleaned);
    }
    return paragraphs;
  }

  // Fallback for Node unit tests (no DOMParser)
  const paragraphs = [];
  const pMatches = xmlText.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || [];
  for (const pBlock of pMatches) {
    const texts = [];
    const tRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let m;
    while ((m = tRegex.exec(pBlock)) !== null) {
      texts.push(
        m[1]
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
      );
    }
    const combined = texts.join('');
    if (combined.trim()) paragraphs.push(combined);
  }
  return paragraphs;
}

/**
 * Safely extracts text paragraphs from a `.docx` file for zero-download in-app preview.
 */
export async function extractDocxParagraphs(bytes) {
  if (!(bytes instanceof Uint8Array) || !hasValidMagicBytes(bytes, 'docx')) {
    return null;
  }
  const xmlBytes = await extractZipEntryBytes(bytes, 'word/document.xml');
  if (!xmlBytes) return null;
  const xmlText = new TextDecoder('utf-8').decode(xmlBytes);
  return extractParagraphsFromWordXml(xmlText);
}

/**
 * Checks whether a document extension can be previewed as a safe raster image.
 */
export function isPreviewableImageExt(fileType) {
  const ext = String(fileType || '').toLowerCase().trim();
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
}

/**
 * Validates that an image URL/Data URL is safe to render inside an <img> tag.
 */
export function isSafePreviewImageSource(fileDataOrUrl, fileName = '') {
  return isSafeImagePreview({ fileData: fileDataOrUrl, fileName });
}

/**
 * Converts 0-based Excel column index to column letters (0 -> A, 25 -> Z, 26 -> AA).
 */
export function getExcelColumnLetter(idx) {
  let n = idx;
  let result = '';
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}
