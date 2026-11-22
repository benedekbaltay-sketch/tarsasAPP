/**
 * Date grouping utilities for sticky monthly transaction and ledger lists.
 */

/**
 * Safely parse a date string or timestamp into a valid Date object.
 * Supports Hungarian dot notation ('2026.11.20.', '2026. 11. 20.', '2026.11.20'),
 * ISO ('2026-11-20'), and numeric timestamps.
 * 
 * @param {string|number|Date} dateVal 
 * @returns {Date|null}
 */
export function parseItemDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }
  if (typeof dateVal === 'number') {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateVal === 'string') {
    // Strip trailing dots, normalize dots to dashes, remove extra spaces
    const cleaned = dateVal.trim().replace(/\./g, '-').replace(/\s+/g, '').replace(/-+$/, '');
    const d = new Date(cleaned);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Format a Date object into an uppercase month header label.
 * Hungarian: "2026. NOV."
 * English: "NOV 2026"
 * 
 * @param {Date|null} dateObj 
 * @param {boolean} isEn 
 * @returns {string}
 */
export function formatMonthGroupHeader(dateObj, isEn = false) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return isEn ? 'OTHER' : 'EGYÉB';
  }
  const label = dateObj.toLocaleString(isEn ? 'en-US' : 'hu-HU', {
    month: 'short',
    year: 'numeric'
  });
  return label.toUpperCase();
}

/**
 * Group an array of items (having a `date` or `dateVal` property) into sequential monthly groups.
 * Preserves the order of items within and across months.
 * 
 * @param {Array<Object>} items 
 * @param {boolean} isEn 
 * @returns {Array<{key: string, monthKey: string, year: number|null, month: number|null, items: Array<Object>}>}
 */
export function groupItemsByMonth(items = [], isEn = false) {
  if (!Array.isArray(items) || items.length === 0) return [];
  
  const groups = [];
  let currentGroup = null;

  for (const item of items) {
    const d = parseItemDate(item.date || item.dateVal);
    const groupKey = d 
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` 
      : 'other';
    const monthLabel = d ? formatMonthGroupHeader(d, isEn) : (isEn ? 'OTHER' : 'EGYÉB');

    if (!currentGroup || currentGroup.key !== groupKey) {
      currentGroup = {
        key: groupKey,
        monthKey: monthLabel,
        year: d ? d.getFullYear() : null,
        month: d ? d.getMonth() + 1 : null,
        items: [item]
      };
      groups.push(currentGroup);
    } else {
      currentGroup.items.push(item);
    }
  }

  return groups;
}
