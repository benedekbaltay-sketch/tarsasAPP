/**
 * Centralized File Upload & Download Security Module (H-4 Defense-in-Depth)
 *
 * Enforces:
 * 1. File size limits (2 MB for documents/attachments, 10 MB for bank statements)
 * 2. Strict extension allowlist (explicitly excluding SVG, HTML, JS, XML, executables)
 * 3. Browser MIME type validation
 * 4. Magic-byte signature inspection (prevents renamed HTML/SVG/JS polyglots)
 * 5. Safe download/preview URL allowlisting (blocks javascript:, data:text/html, data:image/svg+xml)
 */

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_BANK_STATEMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_ATTACHMENT_EXTENSIONS = Object.freeze([
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'xlsx',
  'xls',
  'docx',
  'doc',
]);

export const ALLOWED_ACCEPT_ATTR =
  '.pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc';

export const ALLOWED_ATTACHMENT_MIMES = Object.freeze({
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  xlsx: [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/octet-stream',
  ],
  xls: [
    'application/vnd.ms-excel',
    'application/octet-stream',
  ],
  docx: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/octet-stream',
  ],
  doc: [
    'application/msword',
    'application/octet-stream',
  ],
});

const SAFE_DOWNLOAD_DATA_PREFIXES = [
  'data:application/pdf;',
  'data:image/png;',
  'data:image/jpeg;',
  'data:image/jpg;',
  'data:image/webp;',
  'data:image/gif;',
  'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;',
  'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;',
  'data:application/vnd.ms-excel;',
  'data:application/msword;',
  'data:application/octet-stream;',
];

const SAFE_IMAGE_DATA_PREFIXES = [
  'data:image/png;',
  'data:image/jpeg;',
  'data:image/jpg;',
  'data:image/webp;',
  'data:image/gif;',
];

const SAFE_STORAGE_HOSTS = [
  'https://firebasestorage.googleapis.com/',
  'https://storage.googleapis.com/',
];

/**
 * Strips path traversal sequences, control characters, and unsafe symbols from filenames.
 */
export function sanitizeFileName(rawName, fallback = 'document') {
  const base = String(rawName || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/]+/g, '_')
    .replace(/\.\.+/g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '')
    .trim();
  if (!base) return fallback;
  return base.slice(0, 180);
}

/**
 * Formats byte size into human-readable KB / MB string.
 */
export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Checks leading bytes of a file against expected magic signatures and
 * strictly rejects HTML/SVG/XML/script payloads masquerading as benign files.
 *
 * @param {Uint8Array} bytes - At least first 16-64 bytes of the file
 * @param {string} ext - Lowercase file extension
 * @returns {boolean}
 */
export function hasValidMagicBytes(bytes, ext) {
  if (!bytes || bytes.length < 4) return false;

  // Reject HTML / SVG / XML / Script payloads regardless of extension
  const asciiHead = String.fromCharCode(...bytes.slice(0, Math.min(bytes.length, 64)))
    .trimStart()
    .toLowerCase();
  if (
    asciiHead.startsWith('<html') ||
    asciiHead.startsWith('<!doctype') ||
    asciiHead.startsWith('<svg') ||
    asciiHead.startsWith('<?xml') ||
    asciiHead.startsWith('<script') ||
    asciiHead.includes('<script') ||
    asciiHead.includes('<svg')
  ) {
    return false;
  }

  switch (ext) {
    case 'pdf':
      // %PDF-
      return (
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46
      );
    case 'png':
      // 89 50 4E 47 0D 0A 1A 0A
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case 'jpg':
    case 'jpeg':
      // FF D8 FF
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'webp':
      // RIFF....WEBP
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    case 'xlsx':
    case 'docx':
      // PK\x03\x04 (ZIP / Office Open XML)
      return (
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b &&
        (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
        (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
      );
    case 'xls':
    case 'doc':
      // OLE2 Compound Document (D0 CF 11 E0 A1 B1 1A E1)
      return (
        bytes.length >= 8 &&
        bytes[0] === 0xd0 &&
        bytes[1] === 0xcf &&
        bytes[2] === 0x11 &&
        bytes[3] === 0xe0 &&
        bytes[4] === 0xa1 &&
        bytes[5] === 0xb1 &&
        bytes[6] === 0x1a &&
        bytes[7] === 0xe1
      );
    default:
      return false;
  }
}

/**
 * Validates a browser File/Blob before reading or uploading.
 * Checks size, extension allowlist, MIME allowlist, and magic bytes.
 *
 * @param {File} file
 * @param {object} [options]
 * @param {number} [options.maxBytes=MAX_ATTACHMENT_BYTES]
 * @param {string[]} [options.allowedExtensions=ALLOWED_ATTACHMENT_EXTENSIONS]
 * @returns {Promise<{ ok: boolean, reason?: string, ext?: string, sanitizedName?: string, sizeFormatted?: string }>}
 */
export async function validateUploadFile(file, options = {}) {
  const maxBytes = options.maxBytes ?? MAX_ATTACHMENT_BYTES;
  const allowedExtensions = options.allowedExtensions ?? ALLOWED_ATTACHMENT_EXTENSIONS;

  if (!file || typeof file.name !== 'string') {
    return { ok: false, reason: 'unsupported_type' };
  }

  if (file.size <= 0) {
    return { ok: false, reason: 'invalid_content' };
  }

  if (file.size > maxBytes) {
    return { ok: false, reason: 'too_large' };
  }

  const sanitizedName = sanitizeFileName(file.name);
  const dotIdx = sanitizedName.lastIndexOf('.');
  const ext = dotIdx > 0 ? sanitizedName.slice(dotIdx + 1).toLowerCase() : '';

  if (!ext || !allowedExtensions.includes(ext)) {
    return { ok: false, reason: 'unsupported_type' };
  }

  const mime = String(file.type || '').toLowerCase().trim();
  const allowedMimes = ALLOWED_ATTACHMENT_MIMES[ext];
  if (mime && allowedMimes && !allowedMimes.includes(mime)) {
    return { ok: false, reason: 'unsupported_type' };
  }

  // Magic-byte inspection
  try {
    const headerBuf = await file.slice(0, 64).arrayBuffer();
    const bytes = new Uint8Array(headerBuf);
    if (!hasValidMagicBytes(bytes, ext)) {
      return { ok: false, reason: 'invalid_content' };
    }
  } catch {
    return { ok: false, reason: 'invalid_content' };
  }

  return {
    ok: true,
    ext,
    sanitizedName,
    sizeFormatted: formatFileSize(file.size),
  };
}

/**
 * Reads a validated File as a Base64 Data URL.
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validates that a URL/data URI is safe to use as a download href.
 * Strictly blocks javascript:, vbscript:, data:text/html, data:image/svg+xml, etc.
 */
export function isSafeDownloadUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('blob:')) return true;
  if (SAFE_STORAGE_HOSTS.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }
  if (SAFE_DOWNLOAD_DATA_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }
  return false;
}

/**
 * Validates that an attachment or URL is a safe raster image for inline <img> preview.
 * Explicitly blocks SVG (data:image/svg+xml and .svg) to prevent Stored XSS.
 */
export function isSafeImagePreview(attOrUrl) {
  if (!attOrUrl) return false;
  const url =
    typeof attOrUrl === 'string'
      ? attOrUrl
      : attOrUrl.data || attOrUrl.fileData || attOrUrl.url || '';
  const name =
    typeof attOrUrl === 'string'
      ? ''
      : String(attOrUrl.fileName || attOrUrl.name || '').toLowerCase();

  if (name.endsWith('.svg') || name.endsWith('.html') || name.endsWith('.htm')) {
    return false;
  }

  if (typeof url !== 'string' || !url.trim()) return false;
  const lower = url.trim().toLowerCase();

  if (lower.startsWith('data:image/svg')) return false;
  if (SAFE_IMAGE_DATA_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }
  if (
    SAFE_STORAGE_HOSTS.some((prefix) => lower.startsWith(prefix)) &&
    /\.(jpg|jpeg|png|webp|gif)(?:\?|$)/i.test(lower)
  ) {
    return true;
  }
  return false;
}

/**
 * Triggers a safe browser download after verifying the URL protocol/MIME allowlist.
 * Returns true if download was initiated, false if blocked.
 */
export function triggerSafeDownload(url, fileName) {
  if (!isSafeDownloadUrl(url)) {
    return false;
  }
  const safeName = sanitizeFileName(fileName, 'document');
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

/**
 * Returns a localized error toast message for validateUploadFile failure reasons.
 */
export function getFileValidationErrorMessage(reason, t = {}, isEn = false) {
  if (reason === 'too_large') {
    return (
      t.file_too_large ||
      (isEn
        ? 'The uploaded file is too large! Maximum allowed size is 2 MB.'
        : 'A feltöltött fájl mérete túl nagy! A megengedett maximális méret 2 MB.')
    );
  }
  if (reason === 'invalid_content') {
    return (
      t.file_content_invalid ||
      (isEn
        ? 'File content does not match its extension or is blocked for security reasons.'
        : 'A fájl tartalma nem egyezik a kiterjesztésével, vagy biztonsági okból tiltott.')
    );
  }
  return (
    t.file_type_unsupported ||
    (isEn
      ? 'Unsupported file format! Only PDF, JPG, PNG, WEBP, DOCX or XLSX files are allowed.'
      : 'Nem támogatott fájlformátum! Kizárólag PDF, JPG, PNG, WEBP, DOCX vagy XLSX tölthető fel.')
  );
}
