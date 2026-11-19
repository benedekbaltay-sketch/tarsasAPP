/**
 * Utility functions for handling annex items (garages and storages)
 * Supports both alphanumeric identifiers (numbers/letters like 'G-01', '11 sz.', 'T-01')
 * and area in square meters ('15.3', '4.2').
 */

/**
 * Parse a string or number into { number: string, area: string }
 * @param {string|number|object} str 
 * @param {boolean} isStorage 
 * @returns {{ number: string, area: string }}
 */
export function parseAnnexString(str, isStorage = false) {
  if (typeof str === 'number') {
    return isStorage ? { number: String(str), area: '' } : { number: '', area: String(str) };
  }
  if (!str || typeof str !== 'string') return { number: '', area: '' };
  const s = str.trim();
  if (!s) return { number: '', area: '' };

  // If already a JSON-serialized object
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const obj = JSON.parse(s);
      return { number: String(obj.number || '').trim(), area: String(obj.area || '').trim() };
    } catch (e) {
      // ignore
    }
  }

  // Parenthesized format e.g. 'G-01 (15.3 m²)' or '1 sz. (4.2 m²)'
  const parenMatch = s.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    const numPart = parenMatch[1].trim();
    const areaPart = parenMatch[2].replace(/m[²2]/gi, '').trim().replace(',', '.');
    return { number: numPart, area: areaPart };
  }

  // Suffix format with explicit m2/m² e.g. '11 sz. 15,3 m2' or '15.3 m²'
  const m2Match = s.match(/^(.*?)\s*(\d+(?:[.,]\d+)?)\s*m[²2]$/i);
  if (m2Match) {
    return { number: m2Match[1].trim(), area: m2Match[2].replace(',', '.') };
  }

  // Pure numeric value e.g. '16.9' or '21,8'
  if (/^\d+(?:[.,]\d+)?$/.test(s)) {
    if (isStorage) {
      return { number: s, area: '' };
    } else {
      return { number: '', area: s.replace(',', '.') };
    }
  }

  // Identifier with explicit 'sz.' suffix followed by number e.g. '11 sz. 15.3'
  const szMatch = s.match(/^(\d+\s*sz\.?)\s*(?:,\s*|\s+)(\d+(?:[.,]\d+)?)$/i);
  if (szMatch) {
    return { number: szMatch[1].trim(), area: szMatch[2].replace(',', '.') };
  }

  // Two tokens separated by space or comma where the second token is numeric e.g. 'G-02 18.5'
  const twoPartMatch = s.match(/^([A-Za-z0-9_.\-]+(?:\s+sz\.?)?)\s*(?:,\s*|\s+)(\d+(?:[.,]\d+)?)$/);
  if (twoPartMatch) {
    return { number: twoPartMatch[1].trim(), area: twoPartMatch[2].replace(',', '.') };
  }

  // Default: treat as pure identifier
  return { number: s, area: '' };
}

/**
 * Normalizes any annex item (object, string, or number) into { number: string, area: string }
 * @param {any} item 
 * @param {boolean} isStorage 
 * @returns {{ number: string, area: string }}
 */
export function normalizeAnnexItem(item, isStorage = false) {
  if (!item) return { number: '', area: '' };
  if (typeof item === 'object') {
    return {
      number: String(item.number || '').trim(),
      area: String(item.area || '').trim()
    };
  }
  return parseAnnexString(String(item), isStorage);
}

/**
 * Formats an annex item into a readable string
 * e.g. '11 sz. (15.3 m²)' or '1 sz.' or '16.9 m²'
 * @param {any} item 
 * @param {string} unit Default 'm²'
 * @returns {string}
 */
export function formatAnnexItem(item, unit = 'm²') {
  if (!item) return '';
  const norm = normalizeAnnexItem(item);
  const num = (norm.number || '').trim();
  let area = (norm.area || '').toString().trim();
  if (area) {
    area = area.replace(/\s*m[²2]$/i, '').trim();
  }

  if (num && area) {
    return `${num} (${area} ${unit})`;
  }
  if (num) return num;
  if (area) return `${area} ${unit}`;
  return '';
}

/**
 * Normalizes a flat's annex items list from garages/storages array and fallback legacy string
 * @param {Array|string} items 
 * @param {boolean} isStorage 
 * @param {string} fallbackStr 
 * @returns {Array<{ number: string, area: string }>}
 */
export function getNormalizedAnnexList(items, isStorage = false, fallbackStr = '') {
  let list = [];
  if (Array.isArray(items) && items.length > 0) {
    list = items;
  } else if (items && !Array.isArray(items)) {
    list = [items];
  } else if (fallbackStr) {
    const parts = fallbackStr.split(/[;,]/).map(s => s.trim()).filter(Boolean);
    list = parts.length > 0 ? parts : [fallbackStr];
  }

  const normalized = list
    .map(item => normalizeAnnexItem(item, isStorage))
    .filter(item => Boolean(item.number || item.area));

  // If normalized has 1 item that has area but missing number, and fallbackStr has number:
  if (normalized.length === 1 && !normalized[0].number && fallbackStr) {
    const fromFallback = normalizeAnnexItem(fallbackStr, isStorage);
    if (fromFallback.number) {
      normalized[0].number = fromFallback.number;
    }
  }

  return normalized;
}
