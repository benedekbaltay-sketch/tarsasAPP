/**
 * Utilities and calculation helpers for the Condominium Loans & Renovation Module
 */

/**
 * Calculates the expected loan end date given a start date and term in months.
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {number|string} termMonths - Number of months
 * @returns {string} - YYYY-MM-DD
 */
export function calculateLoanEndDate(startDateStr, termMonths) {
  if (!startDateStr || !termMonths || isNaN(Number(termMonths))) return '';
  const parts = String(startDateStr).split('-');
  if (parts.length < 3) return '';
  
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = parseInt(parts[2], 10);

  const targetDate = new Date(year, month + Number(termMonths), day);
  if (isNaN(targetDate.getTime())) return '';

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates aggregate stats for all loans in the active building.
 * @param {Array} loans 
 * @returns {Object}
 */
export function calculateLoanStats(loans = []) {
  const activeLoans = (loans || []).filter(l => l && l.status === 'active');
  
  const totalRemainingDebt = activeLoans.reduce((sum, l) => sum + (Number(l.currentBalance) || 0), 0);
  const totalMonthlyInstallment = activeLoans.reduce((sum, l) => sum + (Number(l.monthlyInstallment) || 0), 0);
  const totalLumpSumCollected = (loans || []).reduce((sum, l) => sum + (Number(l.lumpSumTotalCollected) || 0), 0);
  const activeLoansCount = activeLoans.length;
  const paidOffLoansCount = (loans || []).filter(l => l && l.status === 'paid_off').length;

  return {
    totalRemainingDebt,
    totalMonthlyInstallment,
    totalLumpSumCollected,
    activeLoansCount,
    paidOffLoansCount
  };
}

/**
 * Calculates repayment progress percentage for a loan.
 * @param {Object} loan 
 * @returns {number} 0 - 100
 */
export function calculateLoanProgress(loan) {
  if (!loan) return 0;
  const principal = Number(loan.principalAmount) || 0;
  const current = Number(loan.currentBalance) || 0;
  if (principal <= 0) return 0;
  const paid = Math.max(0, principal - current);
  return Math.min(100, Math.max(0, Math.round((paid / principal) * 100)));
}

/**
 * Calculates totals from a loan's payment history.
 * @param {Array} payments 
 * @returns {Object}
 */
export function calculatePaymentTotals(payments = []) {
  return (payments || []).reduce((acc, p) => {
    acc.totalPaid += Number(p.totalPaid) || 0;
    acc.principalPaid += Number(p.principalPaid) || 0;
    acc.interestPaid += Number(p.interestPaid) || 0;
    acc.bankFee += Number(p.bankFee) || 0;
    return acc;
  }, { totalPaid: 0, principalPaid: 0, interestPaid: 0, bankFee: 0 });
}

/**
 * Automatically allocates the monthly installment among financed participants
 * based on the specified allocationType ('ownership_ratio' | 'equal' | 'fixed_amount').
 * 
 * @param {number} monthlyInstallment - Total monthly installment to distribute
 * @param {Array} participants - List of participant objects
 * @param {string} allocationType - 'ownership_ratio' | 'equal' | 'fixed_amount'
 * @param {Array} flats - List of building flats for area/ownership data lookup
 * @returns {Array} Updated participants array with recalculated monthlyContribution
 */
export function allocateInstallment(monthlyInstallment, participants = [], allocationType = 'ownership_ratio', flats = []) {
  const totalInstallment = Number(monthlyInstallment) || 0;
  if (totalInstallment <= 0 || !Array.isArray(participants) || participants.length === 0) {
    return participants.map(p => ({
      ...p,
      monthlyContribution: p.paymentMethod === 'financed' ? (Number(p.monthlyContribution) || 0) : 0
    }));
  }

  // Find financed participants
  const financedIndices = [];
  participants.forEach((p, idx) => {
    if (p.paymentMethod === 'financed') financedIndices.push(idx);
  });

  if (financedIndices.length === 0) {
    return participants.map(p => ({ ...p, monthlyContribution: 0 }));
  }

  const result = participants.map(p => ({ ...p }));

  if (allocationType === 'fixed_amount') {
    // Preserve manually entered monthlyContribution for financed flats, 0 for lump sum
    return result.map(p => ({
      ...p,
      monthlyContribution: p.paymentMethod === 'financed' ? (Number(p.monthlyContribution) || 0) : 0
    }));
  }

  if (allocationType === 'equal') {
    const count = financedIndices.length;
    const baseShare = Math.floor(totalInstallment / count);
    let remainder = totalInstallment - (baseShare * count);

    financedIndices.forEach((idx, i) => {
      // distribute remainder 1 Ft at a time to first participants
      const add = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder--;
      result[idx].monthlyContribution = baseShare + add;
    });

    // Zero out lump sum participants
    participants.forEach((p, idx) => {
      if (p.paymentMethod !== 'financed') result[idx].monthlyContribution = 0;
    });

    return result;
  }

  // Default: 'ownership_ratio'
  // Look up area for each financed flat
  const flatAreaMap = new Map();
  (flats || []).forEach(f => {
    if (f && f.flatNum) {
      const area = Number(f.area) || 0;
      flatAreaMap.set(String(f.flatNum).trim(), area);
    }
  });

  let totalFinancedArea = 0;
  financedIndices.forEach(idx => {
    const p = result[idx];
    const flatArea = flatAreaMap.get(String(p.apartmentId).trim()) || Number(p.area) || 1;
    totalFinancedArea += flatArea;
  });

  if (totalFinancedArea <= 0) totalFinancedArea = financedIndices.length;

  let allocatedSum = 0;
  financedIndices.forEach((idx, i) => {
    const p = result[idx];
    const flatArea = flatAreaMap.get(String(p.apartmentId).trim()) || Number(p.area) || 1;
    const share = flatArea / totalFinancedArea;
    
    // For all except the last financed flat, round to nearest Ft
    if (i < financedIndices.length - 1) {
      const val = Math.round(totalInstallment * share);
      result[idx].monthlyContribution = val;
      allocatedSum += val;
    } else {
      // Last financed flat absorbs the rounding difference so the sum equals exact installment
      result[idx].monthlyContribution = Math.max(0, totalInstallment - allocatedSum);
    }
  });

  // Zero out lump sum participants
  participants.forEach((p, idx) => {
    if (p.paymentMethod !== 'financed') result[idx].monthlyContribution = 0;
  });

  return result;
}
