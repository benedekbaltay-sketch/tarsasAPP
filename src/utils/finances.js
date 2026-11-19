export const monthNamesHu = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
export const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function getLedgerMonths(startDateStr) {
  const months = [];
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  
  let startYear = 2026;
  let startMonth = 8; // September 2026 default baseline

  if (startDateStr) {
    const clean = startDateStr.replace(/\./g, '-').trim();
    const parts = clean.split('-').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      startYear = parts[0];
      startMonth = parts[1] - 1;
    }
  } else if (nowYear < 2026 || (nowYear === 2026 && nowMonth < 8)) {
    startYear = nowYear;
    startMonth = nowMonth;
  }
  
  let currYear = startYear;
  let currMonth = startMonth;

  while (currYear < nowYear || (currYear === nowYear && currMonth <= nowMonth)) {
    const padM = (currMonth + 1).toString().padStart(2, '0');
    months.push({
      date: `${currYear}-${padM}-01`,
      monthIndex: currMonth,
      year: currYear,
      nameHu: `${currYear} ${monthNamesHu[currMonth]}`,
      nameEn: `${monthNamesEn[currMonth]} ${currYear}`
    });
    
    currMonth++;
    if (currMonth > 11) {
      currMonth = 0;
      currYear++;
    }
  }
  
  if (months.length === 0) {
    const padM = (nowMonth + 1).toString().padStart(2, '0');
    months.push({
      date: `${nowYear}-${padM}-01`,
      monthIndex: nowMonth,
      year: nowYear,
      nameHu: `${nowYear} ${monthNamesHu[nowMonth]}`,
      nameEn: `${monthNamesEn[nowMonth]} ${nowYear}`
    });
  }
  
  return months;
}

export function getBuildingAccounts(building) {
  if (!building) return [];
  const baseAccounts = [
    {
      id: 'KK',
      key: 'KK',
      name: 'Közös Költség',
      shortName: building.bankKK?.shortName || 'KK',
      account: building.bankKK?.account || '',
      bank: building.bankKK?.bank || 'OTP',
      beneficiary: building.bankKK?.name || building.name || '',
      hasMonthlyFee: true,
      initialReserve: Number(building.buildingInitialReserveCommon) || 0,
      isBaseAccount: true,
      color: 'blue'
    },
    {
      id: 'FA',
      key: 'FA',
      name: 'Felújítási Alap',
      shortName: building.bankFA?.shortName || 'FA',
      account: building.bankFA?.account || '',
      bank: building.bankFA?.bank || 'OTP',
      beneficiary: building.bankFA?.name || building.name || '',
      hasMonthlyFee: true,
      initialReserve: Number(building.buildingInitialReserveRenovation) || 0,
      isBaseAccount: true,
      color: 'purple'
    }
  ];

  const customAccounts = (building.customBankAccounts || []).map((custom, idx) => {
    const palette = ['emerald', 'amber', 'sky', 'indigo', 'rose', 'teal'];
    const chosenColor = custom.color || palette[idx % palette.length];
    return {
      id: custom.id || `acc-${idx}`,
      key: custom.id || `acc-${idx}`,
      name: custom.name,
      shortName: custom.shortName || (custom.name?.length > 5 ? custom.name.slice(0, 4) : custom.name),
      account: custom.account || '',
      bank: custom.bank || 'OTP',
      beneficiary: custom.beneficiary || building.name || '',
      hasMonthlyFee: Boolean(custom.hasMonthlyFee),
      initialReserve: Number(custom.initialReserve) || 0,
      isBaseAccount: false,
      color: chosenColor
    };
  });

  return [...baseAccounts, ...customAccounts];
}

export function getCurrentFee(flat, type) {
  if (!flat) return 0;
  const today = new Date();
  if (type === 'KK' || type === 'Közös Költség') {
    let currentFee = (flat.monthlyFee !== undefined && flat.monthlyFee !== null) ? Number(flat.monthlyFee) : 0;
    const changes = flat.feeChangesKK;
    if (changes && changes.length > 0) {
      const activeChanges = changes.filter(c => new Date(c.date) <= today);
      if (activeChanges.length > 0) {
        activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
        currentFee = (activeChanges[0].amount !== undefined && activeChanges[0].amount !== null) ? Number(activeChanges[0].amount) : 0;
      }
    }
    return currentFee;
  }
  if (type === 'FA' || type === 'Felújítási Alap') {
    let currentFee = (flat.renovationFee !== undefined && flat.renovationFee !== null) ? Number(flat.renovationFee) : 0;
    const changes = flat.feeChangesFA;
    if (changes && changes.length > 0) {
      const activeChanges = changes.filter(c => new Date(c.date) <= today);
      if (activeChanges.length > 0) {
        activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
        currentFee = (activeChanges[0].amount !== undefined && activeChanges[0].amount !== null) ? Number(activeChanges[0].amount) : 0;
      }
    }
    return currentFee;
  }
  
  // Custom account
  const customFee = flat.customFees?.[type];
  let fee = (customFee !== undefined && customFee !== null) ? Number(customFee) : 0;
  const customChanges = flat.customFeeChanges?.[type];
  if (customChanges && customChanges.length > 0) {
    const activeChanges = customChanges.filter(c => new Date(c.date) <= today);
    if (activeChanges.length > 0) {
      activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
      fee = (activeChanges[0].amount !== undefined && activeChanges[0].amount !== null) ? Number(activeChanges[0].amount) : 0;
    }
  }
  return fee;
}

export function getLatestFee(flat, type) {
  if (!flat) return 0;
  if (type === 'KK' || type === 'Közös Költség') {
    const changes = flat.feeChangesKK;
    if (changes && changes.length > 0) {
      const sorted = [...changes].sort((a, b) => new Date(b.date) - new Date(a.date));
      if (sorted[0] && sorted[0].amount !== undefined && sorted[0].amount !== null) {
        return Number(sorted[0].amount);
      }
    }
    return (flat.monthlyFee !== undefined && flat.monthlyFee !== null) ? Number(flat.monthlyFee) : 0;
  }
  if (type === 'FA' || type === 'Felújítási Alap') {
    const changes = flat.feeChangesFA;
    if (changes && changes.length > 0) {
      const sorted = [...changes].sort((a, b) => new Date(b.date) - new Date(a.date));
      if (sorted[0] && sorted[0].amount !== undefined && sorted[0].amount !== null) {
        return Number(sorted[0].amount);
      }
    }
    return (flat.renovationFee !== undefined && flat.renovationFee !== null) ? Number(flat.renovationFee) : 0;
  }
  const customChanges = flat.customFeeChanges?.[type];
  if (customChanges && customChanges.length > 0) {
    const sorted = [...customChanges].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sorted[0] && sorted[0].amount !== undefined && sorted[0].amount !== null) {
      return Number(sorted[0].amount);
    }
  }
  return (flat.customFees?.[type] !== undefined && flat.customFees?.[type] !== null) ? Number(flat.customFees[type]) : 0;
}

export function hasUpcomingFeeChange(flat, type) {
  if (!flat) return false;
  const today = new Date();
  const changes = type === 'KK' ? flat.feeChangesKK : (type === 'FA' ? flat.feeChangesFA : flat.customFeeChanges?.[type]);
  if (!changes || changes.length === 0) return false;
  const cur = getCurrentFee(flat, type);
  return changes.some(c => new Date(c.date) > today && Number(c.amount) !== cur);
}

export function isMatchingFlat(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const strA = String(a).trim().toLowerCase();
  const strB = String(b).trim().toLowerCase();
  if (strA === strB) return true;
  
  // Clean prefixes like "fsz", "fszt", "emelet", "em", "i", "ii", "iii", "iv", and trailing dots
  const cleanA = strA.replace(/^(fsz|fszt|emelet|em|i|ii|iii|iv)\s*\.?\s*/i, '').replace(/\.\s*$/, '').trim();
  const cleanB = strB.replace(/^(fsz|fszt|emelet|em|i|ii|iii|iv)\s*\.?\s*/i, '').replace(/\.\s*$/, '').trim();
  if (cleanA && cleanB && cleanA === cleanB) return true;
  
  // Handle reversed ranges like "7-8" vs "8-7"
  if (cleanA.includes('-') && cleanB.includes('-')) {
    const partsA = cleanA.split('-').map(s => s.trim()).sort().join('-');
    const partsB = cleanB.split('-').map(s => s.trim()).sort().join('-');
    if (partsA === partsB) return true;
  }
  return false;
}

export function getItemTimestamp(item) {
  if (!item) return 0;
  if (item.createdAt && !isNaN(Number(item.createdAt))) return Number(item.createdAt);
  if (item.lastUpdated && !isNaN(Number(item.lastUpdated))) return Number(item.lastUpdated);
  if (item.id && typeof item.id === 'string') {
    const match = item.id.match(/(\d{10,14})/);
    if (match) return Number(match[1]);
  }
  return 0;
}

export function getFlatLedgerTimeline(flatNum, targetAccount, state) {
  if (!state || !state.flats) return [];
  const flat = state.flats.find(f => isMatchingFlat(f.flatNum, flatNum));
  if (!flat) return [];
  
  const timeline = [];
  const isEn = (state.currentLang === "en");
  
  const isKK = (targetAccount === "Közös Költség" || targetAccount === "KK");
  const isFA = (targetAccount === "Felújítási Alap" || targetAccount === "FA");

  const currentBuilding = (state.buildings || []).find(b => b.id === state.currentBuildingId) || state.buildings?.[0];
  const allAccounts = getBuildingAccounts(currentBuilding);
  const accountMeta = allAccounts.find(a => a.name === targetAccount || a.id === targetAccount || (isKK && a.id === 'KK') || (isFA && a.id === 'FA'));
  const hasMonthlyFee = accountMeta ? accountMeta.hasMonthlyFee : (isKK || isFA);

  // 1. Monthly recurring debits (only if account has monthly fee)
  if (hasMonthlyFee) {
    const accountStartDate = isFA
      ? (flat.startDateFA || "2026-06-01")
      : (isKK
          ? (flat.startDateKK || (flat.startDate === "2026-06-01" ? (flat.flatNum === "Fsz 2" ? "2026-07-01" : undefined) : flat.startDate))
          : (flat.customStartDates?.[targetAccount] || flat.startDate || "2026-09-01"));
    const months = getLedgerMonths(accountStartDate);
    months.forEach(m => {
      const cancelledKeys = [
        `${m.date}_${targetAccount}`,
        `${m.date}_${isKK ? "KK" : (isFA ? "FA" : targetAccount)}`,
        `${m.date}_${isKK ? "Közös Költség" : (isFA ? "Felújítási Alap" : targetAccount)}`
      ];
      if (flat.cancelledDebits && flat.cancelledDebits.some(k => cancelledKeys.includes(k))) {
        return;
      }
      
      let debitAmount = 0;
      const currentMonthDate = new Date(m.date);
      
      if (isKK) {
        debitAmount = (flat.monthlyFee !== undefined && flat.monthlyFee !== null) ? Number(flat.monthlyFee) : 0;
        if (flat.feeChangesKK && flat.feeChangesKK.length > 0) {
          const activeChanges = flat.feeChangesKK.filter(c => new Date(c.date) <= currentMonthDate);
          if (activeChanges.length > 0) {
            activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
            debitAmount = (activeChanges[0].amount !== undefined && activeChanges[0].amount !== null) ? Number(activeChanges[0].amount) : 0;
          }
        }
      } else if (isFA) {
        debitAmount = (flat.renovationFee !== undefined && flat.renovationFee !== null) ? Number(flat.renovationFee) : 0;
        if (flat.feeChangesFA && flat.feeChangesFA.length > 0) {
          const activeChanges = flat.feeChangesFA.filter(c => new Date(c.date) <= currentMonthDate);
          if (activeChanges.length > 0) {
            activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
            debitAmount = (activeChanges[0].amount !== undefined && activeChanges[0].amount !== null) ? Number(activeChanges[0].amount) : 0;
          }
        }
      } else {
        const customFee = flat.customFees?.[targetAccount] || (accountMeta ? flat.customFees?.[accountMeta.id] : 0);
        debitAmount = (customFee !== undefined && customFee !== null) ? Number(customFee) : 0;
        const customChanges = flat.customFeeChanges?.[targetAccount] || (accountMeta ? flat.customFeeChanges?.[accountMeta.id] : null);
        if (customChanges && customChanges.length > 0) {
          const activeChanges = customChanges.filter(c => new Date(c.date) <= currentMonthDate);
          if (activeChanges.length > 0) {
            activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
            debitAmount = (activeChanges[0].amount !== undefined && activeChanges[0].amount !== null) ? Number(activeChanges[0].amount) : 0;
          }
        }
      }
      
      const customComment = flat.debitComments && (
        flat.debitComments[`${m.date}_${targetAccount}`] ||
        flat.debitComments[`${m.date}_${isKK ? "KK" : (isFA ? "FA" : targetAccount)}`] ||
        flat.debitComments[`${m.date}_${accountMeta?.shortName}`]
      );
      const defaultComment = isEn ? `Monthly Fee - ${m.nameEn}` : `Havi előírás - ${m.nameHu}`;
      
      timeline.push({
        id: `d-${flatNum}-${targetAccount}-${m.date}`,
        flatNum: flatNum,
        date: m.date,
        type: "Debit",
        amount: -Math.abs(debitAmount),
        account: targetAccount,
        targetAccount: targetAccount,
        comment: customComment || defaultComment,
        includeInBalance: true
      });
    });
  }

  // 1b. Loan installment debits (only for 'financed' participants under Felújítási Alap)
  if (isFA && state.loans && Array.isArray(state.loans)) {
    state.loans.forEach(loan => {
      if (loan.status !== 'draft') {
        const participant = (loan.participants || []).find(p => isMatchingFlat(p.apartmentId, flatNum));
        if (participant && participant.paymentMethod === 'financed' && (Number(participant.monthlyContribution) || 0) > 0) {
          const installment = Number(participant.monthlyContribution);
          const loanMonths = getLedgerMonths(loan.startDate || "2024-01-01");
          const endLimit = loan.endDate ? new Date(loan.endDate) : null;

          loanMonths.forEach(m => {
            const mDate = new Date(m.date);
            if (endLimit && mDate > endLimit) return;
            const cancelledKey = `${m.date}_loan_${loan.id}`;
            if (flat.cancelledDebits && flat.cancelledDebits.includes(cancelledKey)) return;

            timeline.push({
              id: `d-loan-${loan.id}-${flatNum}-${m.date}`,
              flatNum: flatNum,
              date: m.date,
              type: "Debit",
              amount: -Math.abs(installment),
              account: targetAccount,
              targetAccount: targetAccount,
              comment: isEn 
                ? `${loan.title || 'Loan'} - Monthly Installment` 
                : `${loan.title || 'Hitel'} - Havi törlesztőrészlet`,
              includeInBalance: true,
              isLoanDebit: true,
              loanId: loan.id
            });
          });
        }
      }
    });
  }

  // 2. Manual debits
  if (state.manualDebits) {
    const rawDebits = state.manualDebits || [];
    const customDebits = rawDebits
      .filter(d => isMatchingFlat(d.flatNum, flatNum) && (
        d.targetAccount === targetAccount ||
        (isKK && (!d.targetAccount || d.targetAccount === "KK" || d.targetAccount === "Közös Költség")) ||
        (isFA && (d.targetAccount === "FA" || d.targetAccount === "Felújítási Alap")) ||
        (accountMeta && (d.targetAccount === accountMeta.id || d.targetAccount === accountMeta.name))
      ))
      .map(d => ({
        id: d.id,
        flatNum: flatNum,
        date: d.date,
        type: "Debit",
        amount: -Math.abs(d.amount),
        account: targetAccount,
        targetAccount: targetAccount,
        comment: d.comment || (isKK 
          ? (isEn ? "Manual Debit (Common Fee)" : "Terhelés / Előírás (Közös Költség)") 
          : (isFA ? (isEn ? "Manual Debit (Renovation Fund)" : "Terhelés / Előírás (Felújítási Alap)") : `Terhelés / Előírás (${targetAccount})`)),
        includeInBalance: true,
        includeInFlatBalance: d.includeInFlatBalance !== false,
        affectsBankBalance: d.affectsBankBalance !== false && d.includeInBalance !== false,
        attachments: d.attachments || (d.attachment ? [d.attachment] : []),
        createdAt: d.createdAt,
        lastUpdated: d.lastUpdated,
        rawIndex: rawDebits.indexOf(d)
      }));
    timeline.push(...customDebits);
  }

  // 2b. Expenses assigned to this flat (e.g. deductions, individual expenses, inter-account transfers)
  if (state.expenses) {
    const rawExpenses = state.expenses || [];
    const flatExpenses = rawExpenses
      .filter(e => isMatchingFlat(e.flatNum, flatNum) && (
        e.targetAccount === targetAccount ||
        (isKK && (!e.targetAccount || e.targetAccount === "KK" || e.targetAccount === "Közös Költség")) ||
        (isFA && (e.targetAccount === "FA" || e.targetAccount === "Felújítási Alap")) ||
        (accountMeta && (e.targetAccount === accountMeta.id || e.targetAccount === accountMeta.name))
      ))
      .map(e => ({
        id: e.id,
        flatNum: flatNum,
        date: e.date,
        type: "Expense",
        amount: -Math.abs(e.amount),
        account: targetAccount,
        targetAccount: targetAccount,
        comment: e.comment || e.title || (isEn ? "Expense / Deduction" : "Kiadás / Levonás"),
        includeInBalance: true,
        includeInFlatBalance: e.includeInFlatBalance !== false,
        affectsBankBalance: e.affectsBankBalance !== false && e.includeInBalance !== false,
        attachments: e.attachments || (e.attachment ? [e.attachment] : []),
        createdAt: e.createdAt,
        lastUpdated: e.lastUpdated,
        rawIndex: rawExpenses.indexOf(e)
      }));
    timeline.push(...flatExpenses);
  }

  // 3. Verified transactions (payments, refunds, corrections, inter-account transfers)
  if (state.transactions) {
    const rawTxList = state.transactions || [];
    const payments = rawTxList
      .filter(tx => isMatchingFlat(tx.flatNum, flatNum) && tx.status === "Verified" && (
        tx.targetAccount === targetAccount ||
        (isKK && (!tx.targetAccount || tx.targetAccount === "KK" || tx.targetAccount === "Közös Költség")) ||
        (isFA && (tx.targetAccount === "FA" || tx.targetAccount === "Felújítási Alap")) ||
        (accountMeta && (tx.targetAccount === accountMeta.id || tx.targetAccount === accountMeta.name))
      ))
      .map(tx => {
        const isNegative = tx.type === "Debit" || Number(tx.amount) < 0;
        return {
          id: tx.id,
          flatNum: flatNum,
          date: tx.date,
          type: isNegative ? "Debit" : "Credit",
          amount: isNegative ? -Math.abs(tx.amount) : Number(tx.amount),
          account: targetAccount,
          targetAccount: targetAccount,
          comment: tx.comment || (isEn ? `Payment (${translateMethod(tx.method, isEn)})` : `Befizetés (${translateMethod(tx.method, isEn)})`),
          includeInBalance: true,
          includeInFlatBalance: tx.includeInFlatBalance !== false,
          affectsBankBalance: tx.affectsBankBalance !== false && tx.includeInBalance !== false,
          attachments: tx.attachments || (tx.attachment ? [tx.attachment] : []),
          createdAt: tx.createdAt,
          lastUpdated: tx.lastUpdated,
          rawIndex: rawTxList.indexOf(tx)
        };
      });
    timeline.push(...payments);
  }
  
  timeline.sort((a, b) => {
    // 1. Date ascending (oldest date first)
    const diff = new Date(a.date) - new Date(b.date);
    if (diff !== 0) return diff;

    // 2. Debits and Expenses before Credits on the same date (monthly fee applies before payments)
    const isADebit = a.type === "Debit" || a.type === "Expense";
    const isBDebit = b.type === "Debit" || b.type === "Expense";
    if (isADebit !== isBDebit) return isADebit ? -1 : 1;

    // 3. Chronological creation order on same date (older created item first)
    const timeA = getItemTimestamp(a);
    const timeB = getItemTimestamp(b);
    if (timeA !== timeB) return timeA - timeB;

    // 4. Fallback to raw collection index (items prepended into arrays: higher rawIndex = created earlier)
    if (a.rawIndex !== undefined && b.rawIndex !== undefined && a.rawIndex !== b.rawIndex) {
      return b.rawIndex - a.rawIndex;
    }

    return (a.id || '').localeCompare(b.id || '');
  });
  
  let baseline = 0;
  if (isKK) {
    baseline = flat.initialBalance || 0;
  } else if (isFA) {
    baseline = flat.initialRenovationBalance || 0;
  } else {
    baseline = flat.customInitialBalances?.[targetAccount] || (accountMeta ? flat.customInitialBalances?.[accountMeta.id] : 0) || 0;
  }

  let currentBalance = baseline;
  timeline.forEach((item, index) => {
    // Items assigned to a flat always affect the flat's running balance,
    // even if they were marked not to affect the bank account total (affectsBankBalance === false).
    if (item.includeInFlatBalance !== false) {
      currentBalance += item.amount;
    }
    item.runningBalance = currentBalance;
    item._chronologicalOrder = index;
  });
  
  return timeline.reverse();
}

export function getCombinedFlatLedgerTimeline(flatNum, state) {
  const currentBuilding = (state?.buildings || []).find(b => b.id === state?.currentBuildingId) || state?.buildings?.[0];
  const accounts = getBuildingAccounts(currentBuilding);
  
  let combined = [];
  accounts.forEach(acc => {
    const tl = getFlatLedgerTimeline(flatNum, acc.name, state);
    combined.push(...tl);
  });
  
  combined.sort((a, b) => {
    // 1. Date descending (newest date first)
    const diff = new Date(b.date) - new Date(a.date);
    if (diff !== 0) return diff;

    // 2. For items from the same account: strictly preserve the chronological accumulation order!
    // An item calculated later in time (higher _chronologicalOrder) must be displayed above (earlier in list)
    if ((a.account === b.account || a.targetAccount === b.targetAccount) &&
        a._chronologicalOrder !== undefined && b._chronologicalOrder !== undefined) {
      return b._chronologicalOrder - a._chronologicalOrder;
    }

    // 3. On the same date across accounts: Credits on top, Debits on bottom (since display is newest first)
    const isADebit = a.type === "Debit" || a.type === "Expense";
    const isBDebit = b.type === "Debit" || b.type === "Expense";
    if (isADebit !== isBDebit) return isADebit ? 1 : -1;

    // 4. Newer timestamp on top
    const timeA = getItemTimestamp(a);
    const timeB = getItemTimestamp(b);
    if (timeA !== timeB) return timeB - timeA;

    return (b.id || '').localeCompare(a.id || '');
  });
  return combined;
}

export function recalculateFlatBalances(state) {
  if (!state || !state.flats) return;
  const currentBuilding = (state.buildings || []).find(b => b.id === state.currentBuildingId) || state.buildings?.[0];
  const customAccounts = currentBuilding?.customBankAccounts || [];

  state.flats.forEach(flat => {
    // 1. Account A: Közös Költség
    const timelineA = getFlatLedgerTimeline(flat.flatNum, "Közös Költség", state);
    if (timelineA.length > 0) {
      flat.balance = timelineA[0].runningBalance;
      flat.totalRequired = timelineA
        .filter(item => item.type === "Debit" || item.type === "Expense")
        .reduce((sum, item) => sum + Math.abs(item.amount), 0);
      flat.totalPaid = timelineA
        .filter(item => item.type === "Credit")
        .reduce((sum, item) => sum + item.amount, 0);
    } else {
      flat.balance = flat.initialBalance || 0;
      flat.totalRequired = 0;
      flat.totalPaid = 0;
    }
    
    // 2. Account B: Felújítási Alap
    const timelineB = getFlatLedgerTimeline(flat.flatNum, "Felújítási Alap", state);
    if (timelineB.length > 0) {
      flat.renovationBalance = timelineB[0].runningBalance;
      flat.renovationTotalRequired = timelineB
        .filter(item => item.type === "Debit" || item.type === "Expense")
        .reduce((sum, item) => sum + Math.abs(item.amount), 0);
      flat.renovationTotalPaid = timelineB
        .filter(item => item.type === "Credit")
        .reduce((sum, item) => sum + item.amount, 0);
    } else {
      flat.renovationBalance = flat.initialRenovationBalance || 0;
      flat.renovationTotalRequired = 0;
      flat.renovationTotalPaid = 0;
    }

    // 3. Custom accounts
    if (!flat.customBalances) flat.customBalances = {};
    customAccounts.forEach(acc => {
      const tl = getFlatLedgerTimeline(flat.flatNum, acc.name, state);
      if (tl.length > 0) {
        flat.customBalances[acc.id] = tl[0].runningBalance;
      } else {
        flat.customBalances[acc.id] = flat.customInitialBalances?.[acc.id] || flat.customInitialBalances?.[acc.name] || 0;
      }
    });
  });
}

export function getBuildingAccountReserve(accountNameOrId, state) {
  if (!state) return 0;
  const currentBuilding = (state.buildings || []).find(b => b.id === state.currentBuildingId) || state.buildings?.[0];
  const acc = (currentBuilding?.customBankAccounts || []).find(a => a.name === accountNameOrId || a.id === accountNameOrId);
  if (!acc) return 0;

  const isBankTx = tx => tx.affectsBankBalance !== false && tx.method !== "Készpénz" && tx.method !== "Cash" && tx.method !== "Cash Offset";

  const totalPayments = (state.transactions || [])
    .filter(tx => tx.status === "Verified" && (tx.targetAccount === acc.name || tx.targetAccount === acc.id) && tx.includeInBalance !== false && tx.type !== "Correction" && isBankTx(tx))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = (state.expenses || [])
    .filter(exp => (exp.targetAccount === acc.name || exp.targetAccount === acc.id) && exp.includeInBalance !== false && isBankTx(exp))
    .reduce((sum, exp) => sum + exp.amount, 0);

  return (Number(acc.initialReserve) || 0) + totalPayments - totalExpenses;
}

export function getBuildingReserve(state) {
  if (!state) return 0;
  const isBankTx = tx => tx.affectsBankBalance !== false && tx.method !== "Készpénz" && tx.method !== "Cash" && tx.method !== "Cash Offset";
  const totalPayments = (state.transactions || [])
    .filter(tx => tx.status === "Verified" && (tx.targetAccount === "Közös Költség" || (!tx.targetAccount && tx.targetAccount !== "Felújítási Alap")) && tx.includeInBalance !== false && tx.type !== "Correction" && isBankTx(tx))
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const totalExpenses = (state.expenses || [])
    .filter(exp => (exp.targetAccount === "Közös Költség" || (!exp.targetAccount && exp.provider !== "Felújítási Alap")) && exp.includeInBalance !== false && isBankTx(exp))
    .reduce((sum, exp) => sum + exp.amount, 0);
      
  return (state.buildingInitialReserveCommon || 0) + totalPayments - totalExpenses;
}

export function getBuildingRenovationFund(state) {
  if (!state) return 0;
  const isBankTx = tx => tx.affectsBankBalance !== false && tx.method !== "Készpénz" && tx.method !== "Cash" && tx.method !== "Cash Offset";
  const totalRenovationPayments = (state.transactions || [])
    .filter(tx => tx.status === "Verified" && tx.targetAccount === "Felújítási Alap" && tx.includeInBalance !== false && tx.type !== "Correction" && isBankTx(tx))
    .reduce((sum, tx) => sum + tx.amount, 0);
      
  const totalRenovationExpenses = (state.expenses || [])
    .filter(exp => (exp.targetAccount === "Felújítási Alap" || (!exp.targetAccount && exp.provider === "Felújítási Alap")) && exp.includeInBalance !== false && isBankTx(exp))
    .reduce((sum, exp) => sum + exp.amount, 0);
      
  return (state.buildingInitialReserveRenovation || 0) + totalRenovationPayments - totalRenovationExpenses;
}

export function getBuildingReserveAsOf(cutoffDateStr, state) {
  if (!state) return 0;
  const cleanCutoff = (cutoffDateStr || '').replace(/\./g, '-').trim();
  const cleanDate = (d) => (d || '').replace(/\./g, '-').trim();
  const isBankTx = tx => tx.affectsBankBalance !== false && tx.method !== "Készpénz" && tx.method !== "Cash" && tx.method !== "Cash Offset";

  const totalPayments = (state.transactions || [])
    .filter(tx => tx.date && cleanDate(tx.date) <= cleanCutoff && tx.status === "Verified" && (tx.targetAccount === "Közös Költség" || (!tx.targetAccount && tx.targetAccount !== "Felújítási Alap")) && tx.includeInBalance !== false && tx.type !== "Correction" && isBankTx(tx))
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const totalExpenses = (state.expenses || [])
    .filter(exp => exp.date && cleanDate(exp.date) <= cleanCutoff && (exp.targetAccount === "Közös Költség" || (!exp.targetAccount && exp.provider !== "Felújítási Alap")) && exp.includeInBalance !== false && isBankTx(exp))
    .reduce((sum, exp) => sum + exp.amount, 0);
      
  return (state.buildingInitialReserveCommon || 0) + totalPayments - totalExpenses;
}

export function getBuildingRenovationFundAsOf(cutoffDateStr, state) {
  if (!state) return 0;
  const cleanCutoff = (cutoffDateStr || '').replace(/\./g, '-').trim();
  const cleanDate = (d) => (d || '').replace(/\./g, '-').trim();
  const isBankTx = tx => tx.affectsBankBalance !== false && tx.method !== "Készpénz" && tx.method !== "Cash" && tx.method !== "Cash Offset";

  const totalRenovationPayments = (state.transactions || [])
    .filter(tx => tx.date && cleanDate(tx.date) <= cleanCutoff && tx.status === "Verified" && tx.targetAccount === "Felújítási Alap" && tx.includeInBalance !== false && tx.type !== "Correction" && isBankTx(tx))
    .reduce((sum, tx) => sum + tx.amount, 0);
      
  const totalRenovationExpenses = (state.expenses || [])
    .filter(exp => exp.date && cleanDate(exp.date) <= cleanCutoff && (exp.targetAccount === "Felújítási Alap" || (!exp.targetAccount && exp.provider === "Felújítási Alap")) && exp.includeInBalance !== false && isBankTx(exp))
    .reduce((sum, exp) => sum + exp.amount, 0);
      
  return (state.buildingInitialReserveRenovation || 0) + totalRenovationPayments - totalRenovationExpenses;
}

export function getMonthlyStats(year, month, state) {
  if (!state) return { inflow: 0, outflow: 0, margin: 0, year: 0, month: 0 };
  const now = new Date();
  const curYear = year || now.getFullYear();
  const curMonth = month || (now.getMonth() + 1);
  const pad = (n) => n.toString().padStart(2, '0');
  const monthStr = `${curYear}-${pad(curMonth)}`;
  
  const isBankTx = tx => tx && tx.affectsBankBalance !== false && tx.method !== "Készpénz" && tx.method !== "Cash" && tx.method !== "Cash Offset";

  const inflow = (state.transactions || [])
    .filter(tx => tx.date && tx.date.startsWith(monthStr) && tx.type !== "Correction" && tx.status === "Verified" && tx.includeInBalance !== false && isBankTx(tx))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
      
  const outflow = (state.expenses || [])
    .filter(exp => exp.date && exp.date.startsWith(monthStr) && exp.includeInBalance !== false && isBankTx(exp))
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      
  return { inflow, outflow, margin: inflow - outflow, year: curYear, month: curMonth };
}

export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return "0 Ft";
  const formatted = Math.abs(Math.round(amount)).toLocaleString('hu-HU');
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatted} Ft`;
}

export function parseCleanNumber(val) {
  if (val === undefined || val === null) return 0;
  const str = val.toString().trim();
  const isNegative = str.startsWith('-') || str.includes(' -');
  const digitsOnly = str.replace(/[^0-9]/g, '');
  if (!digitsOnly) return 0;
  const num = parseInt(digitsOnly, 10);
  return isNaN(num) ? 0 : (isNegative ? -num : num);
}

export function translateCategory(category, isEn = false) {
  if (!category) return "-";
  switch (category) {
    case "Utility":
    case "cat-exp-utility":
    case "Közüzemi díj (Víz, Gáz, Áram)":
      return isEn ? "Utilities (Water, Gas, Electricity)" : "Közüzemi díj (Víz, Gáz, Áram)";
    case "Insurance":
    case "cat-exp-insurance":
    case "Épületbiztosítás":
      return isEn ? "Building Insurance" : "Épületbiztosítás";
    case "Maintenance":
    case "cat-exp-maintenance":
    case "Karbantartás & Kisjavítás":
    case "Karbantartás / Javítás":
      return isEn ? "Maintenance & Repairs" : "Karbantartás & Kisjavítás";
    case "Bank Fee":
    case "cat-exp-bank":
    case "Bankköltség & Számlavezetés":
    case "Banki költség":
      return isEn ? "Bank Fees & Account Charges" : "Bankköltség & Számlavezetés";
    case "cat-exp-garbage":
    case "Szemétszállítás":
      return isEn ? "Waste Management" : "Szemétszállítás";
    case "cat-exp-cleaning":
    case "Takarítás & Kertgondozás":
    case "Cleaning":
    case "Takarítás":
      return isEn ? "Cleaning & Gardening" : "Takarítás & Kertgondozás";
    case "cat-exp-renovation":
    case "Felújítási munkálatok":
      return isEn ? "Renovation Works" : "Felújítási munkálatok";
    case "cat-exp-rep":
    case "Közös képviseleti díj":
    case "Administrative":
      return isEn ? "Management Fee" : "Közös képviseleti díj";
    case "cat-exp-elevator":
    case "Lift üzemeltetés & Karbantartás":
      return isEn ? "Elevator Service & Maintenance" : "Lift üzemeltetés & Karbantartás";
    case "cat-exp-chimney":
    case "Kéményseprés & Érintésvédelem":
      return isEn ? "Chimney Sweeping & Safety Inspection" : "Kéményseprés & Érintésvédelem";
    case "cat-exp-legal":
    case "Jogi & Könyvelési költség":
      return isEn ? "Legal & Accounting Fees" : "Jogi & Könyvelési költség";
    case "Other":
    case "cat-exp-other":
    case "Egyéb kiadás":
    case "Egyéb":
      return isEn ? "Other Expense" : "Egyéb kiadás";
    case "cat-inc-kk":
    case "Közös Költség befizetés":
      return isEn ? "Common Cost Payment" : "Közös Költség befizetés";
    case "cat-inc-fa":
    case "Felújítási Alap befizetés":
      return isEn ? "Renovation Fund Payment" : "Felújítási Alap befizetés";
    case "cat-inc-extra":
    case "Rendkívüli célbefizetés":
      return isEn ? "Special Assessment" : "Rendkívüli célbefizetés";
    case "cat-inc-rent":
    case "Helyiségbérlet / Reklámbevétel":
      return isEn ? "Rental / Advertising Income" : "Helyiségbérlet / Reklámbevétel";
    case "cat-inc-interest":
    case "Kamatbevétel":
      return isEn ? "Interest Income" : "Kamatbevétel";
    case "cat-inc-refund":
    case "Kártérítés / Visszatérítés":
      return isEn ? "Refund / Insurance Claim" : "Kártérítés / Visszatérítés";
    case "cat-inc-other":
    case "Egyéb jóváírás":
      return isEn ? "Other Income" : "Egyéb jóváírás";
    case "Assessment":
    case "Havi előírás":
      return isEn ? "Monthly Assessment" : "Havi előírás";
    case "Cash":
    case "Cash (Register)":
    case "Készpénz":
    case "Készpénz (Pénztár)":
    case "Cash Offset":
      return isEn ? "Cash (Register)" : "Készpénz (Pénztár)";
    case "Bank Transfer":
    case "Átutalás":
    case "Banki átutalás":
      return isEn ? "Bank Transfer" : "Banki átutalás";
    default:
      return category;
  }
}

export function translateMethod(method, isEn) {
  return translateCategory(method, isEn);
}

export function getBalanceBadge(balance, isEn) {
  if (balance < 0) {
    return {
      text: isEn ? "Arrears" : "Hátralék",
      bgClass: "bg-red-100 text-red-600 border border-red-200",
      type: "arrears"
    };
  }
  if (balance > 0) {
    return {
      text: isEn ? "Overpaid" : "Túlfizetés",
      bgClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      type: "overpaid"
    };
  }
  return {
    text: isEn ? "Settled" : "Rendezett",
    bgClass: "bg-blue-50 text-blue-700 border border-blue-200",
    type: "settled"
  };
}

export function getPreviousMonthClosingDate(refDate = new Date()) {
  const d = new Date(refDate.getFullYear(), refDate.getMonth(), 0);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const pad = n => n.toString().padStart(2, '0');
  return {
    year,
    month,
    day,
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
    monthNameHu: monthNamesHu[d.getMonth()],
    monthNameEn: monthNamesEn[d.getMonth()]
  };
}

export function getFlatBalanceAsOf(flatNum, targetAccount, cutoffDateStr, state) {
  const flat = (state?.flats || []).find(f => isMatchingFlat(f.flatNum, flatNum));
  if (!flat) return 0;
  
  const timeline = getFlatLedgerTimeline(flatNum, targetAccount, state);
  const itemAtCutoff = timeline.find(item => item.date <= cutoffDateStr);
  if (itemAtCutoff) {
    return itemAtCutoff.runningBalance;
  }
  return targetAccount === "Közös Költség" ? (flat.initialBalance || 0) : (flat.initialRenovationBalance || 0);
}

export function getFlatClosingState(flatNum, cutoffDateStr, state) {
  const kk = getFlatBalanceAsOf(flatNum, "Közös Költség", cutoffDateStr, state);
  const fa = getFlatBalanceAsOf(flatNum, "Felújítási Alap", cutoffDateStr, state);
  const total = kk + fa;
  return {
    kk,
    fa,
    total,
    isDebtor: total < 0
  };
}
