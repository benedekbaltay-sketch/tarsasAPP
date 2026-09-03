export const monthNamesHu = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
export const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function getLedgerMonths(startDateStr) {
  const months = [];
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const end = new Date(nowYear, nowMonth, 1);
  
  let start;
  if (startDateStr) {
    start = new Date(startDateStr);
  } else if (nowYear > 2026 || (nowYear === 2026 && nowMonth >= 8)) {
    start = new Date(2026, 8, 1);
  } else {
    start = new Date(nowYear, nowMonth, 1);
  }
  
  let curr = new Date(start.getFullYear(), start.getMonth(), 1);
  while (curr <= end) {
    const y = curr.getFullYear();
    const m = curr.getMonth();
    const padM = (m + 1).toString().padStart(2, '0');
    months.push({
      date: `${y}-${padM}-01`,
      monthIndex: m,
      year: y,
      nameHu: `${y} ${monthNamesHu[m]}`,
      nameEn: `${monthNamesEn[m]} ${y}`
    });
    curr.setMonth(curr.getMonth() + 1);
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

export function getCurrentFee(flat, type) {
  if (!flat) return 0;
  const today = new Date();
  let currentFee = type === 'KK'
    ? ((flat.monthlyFee !== undefined && flat.monthlyFee !== null) ? Number(flat.monthlyFee) : 0)
    : ((flat.renovationFee !== undefined && flat.renovationFee !== null) ? Number(flat.renovationFee) : 0);
  const changes = type === 'KK' ? flat.feeChangesKK : flat.feeChangesFA;
  
  if (changes && changes.length > 0) {
    const activeChanges = changes.filter(c => new Date(c.date) <= today);
    if (activeChanges.length > 0) {
      activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
      currentFee = (activeChanges[0].amount !== undefined && activeChanges[0].amount !== null) ? Number(activeChanges[0].amount) : 0;
    }
  }
  return currentFee;
}

export function getFlatLedgerTimeline(flatNum, targetAccount, state) {
  if (!state || !state.flats) return [];
  const flat = state.flats.find(f => f.flatNum === flatNum);
  if (!flat) return [];
  
  const timeline = [];
  const isEn = (state.currentLang === "en");
  
  // 1. Monthly recurring debits
  const months = getLedgerMonths(flat.startDate);
  months.forEach(m => {
    const cancelledKeys = [
      `${m.date}_${targetAccount}`,
      `${m.date}_${targetAccount === "Közös Költség" ? "KK" : "FA"}`,
      `${m.date}_${targetAccount === "Közös Költség" ? "Közös Költség" : "Felújítási Alap"}`
    ];
    if (flat.cancelledDebits && flat.cancelledDebits.some(k => cancelledKeys.includes(k))) {
      return;
    }
    
    let debitAmount = 0;
    const currentMonthDate = new Date(m.date);
    
    if (targetAccount === "Közös Költség" || targetAccount === "KK") {
      debitAmount = (flat.monthlyFee !== undefined && flat.monthlyFee !== null) ? Number(flat.monthlyFee) : 0;
      if (flat.feeChangesKK && flat.feeChangesKK.length > 0) {
        const activeChanges = flat.feeChangesKK.filter(c => new Date(c.date) <= currentMonthDate);
        if (activeChanges.length > 0) {
          activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
          debitAmount = (activeChanges[0].amount !== undefined && activeChanges[0].amount !== null) ? Number(activeChanges[0].amount) : 0;
        }
      }
    } else {
      debitAmount = (flat.renovationFee !== undefined && flat.renovationFee !== null) ? Number(flat.renovationFee) : 0;
      if (flat.feeChangesFA && flat.feeChangesFA.length > 0) {
        const activeChanges = flat.feeChangesFA.filter(c => new Date(c.date) <= currentMonthDate);
        if (activeChanges.length > 0) {
          activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
          debitAmount = (activeChanges[0].amount !== undefined && activeChanges[0].amount !== null) ? Number(activeChanges[0].amount) : 0;
        }
      }
    }
    
    const customComment = flat.debitComments && (
      flat.debitComments[`${m.date}_${targetAccount}`] ||
      flat.debitComments[`${m.date}_${targetAccount === "Közös Költség" ? "KK" : "FA"}`] ||
      flat.debitComments[`${m.date}_${targetAccount === "Közös Költség" ? "Közös Költség" : "Felújítási Alap"}`]
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

  // 2. Manual debits
  if (state.manualDebits) {
    const customDebits = state.manualDebits
      .filter(d => d.flatNum === flatNum && (d.targetAccount === targetAccount || (!d.targetAccount && targetAccount === "Közös Költség")))
      .map(d => ({
        id: d.id,
        flatNum: flatNum,
        date: d.date,
        type: "Debit",
        amount: -Math.abs(d.amount),
        account: targetAccount,
        targetAccount: targetAccount,
        comment: d.comment || (targetAccount === "Közös Költség" ? (isEn ? "Manual Debit (Common Fee)" : "Terhelés / Előírás (Közös Költség)") : (isEn ? "Manual Debit (Renovation Fund)" : "Terhelés / Előírás (Felújítási Alap)")),
        includeInBalance: d.includeInBalance !== false,
        attachments: d.attachments || (d.attachment ? [d.attachment] : [])
      }));
    timeline.push(...customDebits);
  }

  // 3. Verified transactions
  if (state.transactions) {
    const payments = state.transactions
      .filter(tx => tx.flatNum === flatNum && tx.status === "Verified" && (tx.targetAccount === targetAccount || (!tx.targetAccount && targetAccount === "Közös Költség")) && tx.type !== "Correction" && tx.method !== "Egyenleg korrekció")
      .map(tx => ({
        id: tx.id,
        flatNum: flatNum,
        date: tx.date,
        type: tx.type === "Debit" ? "Debit" : "Credit",
        amount: tx.type === "Debit" ? -Math.abs(tx.amount) : tx.amount,
        account: targetAccount,
        targetAccount: targetAccount,
        comment: tx.comment || (isEn ? `Payment (${translateMethod(tx.method, isEn)})` : `Befizetés (${translateMethod(tx.method, isEn)})`),
        includeInBalance: tx.includeInBalance !== false,
        attachments: tx.attachments || (tx.attachment ? [tx.attachment] : [])
      }));
    timeline.push(...payments);
  }
  
  timeline.sort((a, b) => {
    const diff = new Date(a.date) - new Date(b.date);
    if (diff !== 0) return diff;
    if (a.type !== b.type) return a.type === "Debit" ? -1 : 1;
    return (a.id || '').localeCompare(b.id || '');
  });
  
  const baseline = (targetAccount === "Közös Költség") ? (flat.initialBalance || 0) : (flat.initialRenovationBalance || 0);
  let currentBalance = baseline;
  timeline.forEach(item => {
    if (item.includeInBalance !== false) {
      currentBalance += item.amount;
    }
    item.runningBalance = currentBalance;
  });
  
  return timeline.reverse();
}

export function getCombinedFlatLedgerTimeline(flatNum, state) {
  const kk = getFlatLedgerTimeline(flatNum, "Közös Költség", state);
  const fa = getFlatLedgerTimeline(flatNum, "Felújítási Alap", state);
  
  const combined = [...kk, ...fa];
  combined.sort((a, b) => {
    const diff = new Date(b.date) - new Date(a.date);
    if (diff !== 0) return diff;
    return (b.id || '').localeCompare(a.id || '');
  });
  return combined;
}

export function recalculateFlatBalances(state) {
  if (!state || !state.flats) return;
  state.flats.forEach(flat => {
    // 1. Account A: Közös Költség
    const timelineA = getFlatLedgerTimeline(flat.flatNum, "Közös Költség", state);
    if (timelineA.length > 0) {
      flat.balance = timelineA[0].runningBalance;
      flat.totalRequired = timelineA
        .filter(item => item.type === "Debit")
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
        .filter(item => item.type === "Debit")
        .reduce((sum, item) => sum + Math.abs(item.amount), 0);
      flat.renovationTotalPaid = timelineB
        .filter(item => item.type === "Credit")
        .reduce((sum, item) => sum + item.amount, 0);
    } else {
      flat.renovationBalance = flat.initialRenovationBalance || 0;
      flat.renovationTotalRequired = 0;
      flat.renovationTotalPaid = 0;
    }
  });
}

export function getBuildingReserve(state) {
  if (!state) return 0;
  const totalPayments = (state.transactions || [])
    .filter(tx => tx.status === "Verified" && (tx.targetAccount === "Közös Költség" || (!tx.targetAccount && tx.targetAccount !== "Felújítási Alap")) && tx.includeInBalance !== false && tx.type !== "Correction")
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const totalExpenses = (state.expenses || [])
    .filter(exp => (exp.targetAccount === "Közös Költség" || (!exp.targetAccount && exp.provider !== "Felújítási Alap")) && exp.includeInBalance !== false)
    .reduce((sum, exp) => sum + exp.amount, 0);
      
  return (state.buildingInitialReserveCommon || 0) + totalPayments - totalExpenses;
}

export function getBuildingRenovationFund(state) {
  if (!state) return 0;
  const totalRenovationPayments = (state.transactions || [])
    .filter(tx => tx.status === "Verified" && tx.targetAccount === "Felújítási Alap" && tx.includeInBalance !== false && tx.type !== "Correction")
    .reduce((sum, tx) => sum + tx.amount, 0);
      
  const totalRenovationExpenses = (state.expenses || [])
    .filter(exp => (exp.targetAccount === "Felújítási Alap" || (!exp.targetAccount && exp.provider === "Felújítási Alap")) && exp.includeInBalance !== false)
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
  
  const inflow = (state.transactions || [])
    .filter(tx => tx.date && tx.date.startsWith(monthStr) && tx.type !== "Correction" && tx.status === "Verified" && tx.includeInBalance !== false)
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);
      
  const outflow = (state.expenses || [])
    .filter(exp => exp.date && exp.date.startsWith(monthStr) && exp.includeInBalance !== false)
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
  const cleaned = val.toString()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}

export function translateMethod(method, isEn) {
  if (method === "Bank Transfer") return isEn ? "Bank Transfer" : "Banki átutalás";
  if (method === "Cash Offset") return isEn ? "Cash Offset" : "Készpénz korrekció";
  return method;
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
