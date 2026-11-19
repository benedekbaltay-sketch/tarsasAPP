/**
 * Hungarian & International Phone Number Formatter
 */

export function cleanPhoneNumber(val) {
  if (!val) return '';
  const formatted = formatPhoneNumber(val);
  if (formatted.startsWith('+')) {
    return formatted.replace(/\s+/g, '');
  }
  return String(val).replace(/\s+/g, '');
}

export function formatPhoneNumber(val) {
  if (!val) return '';
  let str = String(val).trim();
  if (!str) return '';

  const hasLeadingPlus = str.startsWith('+');
  let digits = str.replace(/\D/g, '');

  if (!digits) return hasLeadingPlus ? '+' : '';

  // Hungarian normalization:
  // 1. If starts with 06 (domestic format), replace 06 with 36
  if (digits.startsWith('06') && !hasLeadingPlus) {
    digits = '36' + digits.slice(2);
  } else if (!hasLeadingPlus && (digits.startsWith('20') || digits.startsWith('30') || digits.startsWith('70') || digits.startsWith('50')) && digits.length >= 8) {
    // Missing country code, e.g. 203971253 -> 36203971253
    digits = '36' + digits;
  } else if (!hasLeadingPlus && digits.length === 8 && digits.startsWith('1')) {
    // Missing country code for Budapest, e.g. 13666666 -> 3613666666
    digits = '36' + digits;
  }

  // If Hungarian number (starts with 36)
  if (digits.startsWith('36')) {
    const rest = digits.slice(2);
    
    // Budapest landline: area code is '1' (1 digit)
    if (rest.startsWith('1')) {
      const area = rest.slice(0, 1);
      const part1 = rest.slice(1, 4);
      const part2 = rest.slice(4, 8);
      let res = '+36 ' + area;
      if (part1) res += ' ' + part1;
      if (part2) res += ' ' + part2;
      return res;
    }

    // Mobile (20, 30, 70, 50) or 2-digit countryside landlines (e.g. 22-99)
    const area = rest.slice(0, 2);
    const isMobile = ['20', '30', '70', '50'].includes(area);

    if (isMobile) {
      // Format: +36 XX XXX XXXX
      const part1 = rest.slice(2, 5);
      const part2 = rest.slice(5, 9);
      let res = '+36';
      if (area) res += ' ' + area;
      if (part1) res += ' ' + part1;
      if (part2) res += ' ' + part2;
      return res;
    } else {
      // Countryside landline: +36 XX XXX XXX
      const part1 = rest.slice(2, 5);
      const part2 = rest.slice(5, 8);
      let res = '+36';
      if (area) res += ' ' + area;
      if (part1) res += ' ' + part1;
      if (part2) res += ' ' + part2;
      return res;
    }
  }

  // International or other generic formatting
  const prefix = hasLeadingPlus ? '+' : '';
  if (digits.length <= 4) return prefix + digits;
  if (digits.length <= 7) return prefix + digits.slice(0, 3) + ' ' + digits.slice(3);
  if (digits.length <= 10) return prefix + digits.slice(0, 2) + ' ' + digits.slice(2, 5) + ' ' + digits.slice(5);
  return prefix + digits.slice(0, 2) + ' ' + digits.slice(2, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
}
