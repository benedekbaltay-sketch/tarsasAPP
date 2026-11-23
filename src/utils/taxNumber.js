/**
 * Tax Number Utility (Hungarian tax ID formatting and validation)
 * Format: XXXXXXXX-Y-ZZ (8 digits - 1 digit - 2 digits = 11 digits total)
 * Example: 12345678-1-42
 */

/**
 * Formats any string into the standard Hungarian tax number format (XXXXXXXX-Y-ZZ).
 * Clamps to 11 digits and automatically inserts natural dashes.
 * Handles typing smoothly.
 *
 * @param {string|number} val
 * @returns {string} Formatted tax number
 */
export function formatTaxNumber(val) {
  if (val === null || val === undefined) return '';
  const digits = String(val).replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 8) return digits;
  if (digits.length === 9) return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  return `${digits.slice(0, 8)}-${digits.slice(8, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Strips formatting dashes and non-digit characters from a tax number.
 *
 * @param {string|number} val
 * @returns {string} Digits only (max 11 chars)
 */
export function cleanTaxNumber(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\D/g, '').slice(0, 11);
}
