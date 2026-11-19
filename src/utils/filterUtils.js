export const initialFilterState = {
  dateFrom: '',
  dateTo: '',
  account: 'all', // 'all' | 'KK' | 'FA'
  type: 'all', // 'all' | 'income' (payments) | 'expense' (charges/expenses)
  minAmount: '',
  maxAmount: '',
  quickDate: 'all' // 'all' | 'thisMonth' | 'last30Days' | 'last3Months' | 'thisYear' | 'custom'
};

export function getActiveFilterCount(filters) {
  if (!filters) return 0;
  let count = 0;
  if (filters.dateFrom || filters.dateTo || (filters.quickDate && filters.quickDate !== 'all')) count++;
  if (filters.account && filters.account !== 'all') count++;
  if (filters.type && filters.type !== 'all') count++;
  if ((filters.minAmount !== '' && filters.minAmount !== null && filters.minAmount !== undefined) ||
      (filters.maxAmount !== '' && filters.maxAmount !== null && filters.maxAmount !== undefined)) {
    count++;
  }
  return count;
}

export function computeQuickDateRange(type) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n) => n.toString().padStart(2, '0');

  if (type === 'thisMonth') {
    const from = `${y}-${pad(m + 1)}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
    return { dateFrom: from, dateTo: to };
  } else if (type === 'last30Days') {
    const past = new Date();
    past.setDate(past.getDate() - 30);
    const from = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(past.getDate())}`;
    const to = `${y}-${pad(m + 1)}-${pad(now.getDate())}`;
    return { dateFrom: from, dateTo: to };
  } else if (type === 'last3Months') {
    const past = new Date(y, m - 2, 1);
    const from = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
    return { dateFrom: from, dateTo: to };
  } else if (type === 'thisYear') {
    return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
  }
  return { dateFrom: '', dateTo: '' };
}

export function getActiveFilterPills(filters, isEn = false, mode = 'global') {
  if (!filters) return [];
  const pills = [];

  // 1. Type
  if (filters.type && filters.type !== 'all') {
    if (filters.type === 'income') {
      pills.push({
        id: 'type',
        field: 'type',
        label: mode === 'flat' 
          ? (isEn ? "Only Payments" : "Csak befizetések") 
          : (isEn ? "Only Income" : "Csak bevételek"),
        color: 'emerald'
      });
    } else if (filters.type === 'expense') {
      pills.push({
        id: 'type',
        field: 'type',
        label: mode === 'flat' 
          ? (isEn ? "Only Charges" : "Csak előírások") 
          : (isEn ? "Only Expenses" : "Csak kiadások"),
        color: 'rose'
      });
    }
  }

  // 2. Account
  if (filters.account && filters.account !== 'all') {
    if (filters.account === 'KK') {
      pills.push({
        id: 'account',
        field: 'account',
        label: isEn ? "Common Cost (KK)" : "Közös Költség (KK)",
        color: 'blue'
      });
    } else if (filters.account === 'FA') {
      pills.push({
        id: 'account',
        field: 'account',
        label: isEn ? "Renovation Fund (FA)" : "Felújítási Alap (FA)",
        color: 'purple'
      });
    }
  }

  // 3. Date
  if (filters.quickDate && filters.quickDate !== 'all' && filters.quickDate !== 'custom') {
    const labels = {
      thisMonth: isEn ? "This Month" : "Ez a hónap",
      last30Days: isEn ? "Last 30 Days" : "Elmúlt 30 nap",
      last3Months: isEn ? "Last 3 Months" : "Elmúlt 3 hó",
      thisYear: isEn ? "This Year" : "Idei év"
    };
    pills.push({
      id: 'date',
      field: 'date',
      label: labels[filters.quickDate] || filters.quickDate,
      color: 'indigo'
    });
  } else if (filters.dateFrom || filters.dateTo) {
    pills.push({
      id: 'date',
      field: 'date',
      label: `${filters.dateFrom || '...'} – ${filters.dateTo || '...'}`,
      color: 'indigo'
    });
  }

  // 4. Amount
  const hasMin = filters.minAmount !== '' && filters.minAmount !== null && filters.minAmount !== undefined;
  const hasMax = filters.maxAmount !== '' && filters.maxAmount !== null && filters.maxAmount !== undefined;
  if (hasMin && hasMax) {
    pills.push({
      id: 'amount',
      field: 'amount',
      label: `${Number(filters.minAmount).toLocaleString('hu-HU')} Ft – ${Number(filters.maxAmount).toLocaleString('hu-HU')} Ft`,
      color: 'amber'
    });
  } else if (hasMin) {
    pills.push({
      id: 'amount',
      field: 'amount',
      label: `≥ ${Number(filters.minAmount).toLocaleString('hu-HU')} Ft`,
      color: 'amber'
    });
  } else if (hasMax) {
    pills.push({
      id: 'amount',
      field: 'amount',
      label: `≤ ${Number(filters.maxAmount).toLocaleString('hu-HU')} Ft`,
      color: 'amber'
    });
  }

  return pills;
}

export function applyTransactionFilters(items, filters) {
  if (!items || !Array.isArray(items)) return [];
  if (!filters) return items;

  const { dateFrom, dateTo, account, type, minAmount, maxAmount } = filters;

  const parseItemDate = (d) => {
    if (!d) return '';
    return d.toString().trim().replace(/\.$/, '').replace(/\./g, '-');
  };

  return items.filter(item => {
    // 1. Date From filter
    if (dateFrom) {
      const itemD = parseItemDate(item.date);
      const fromD = parseItemDate(dateFrom);
      if (itemD && itemD < fromD) return false;
    }

    // 2. Date To filter
    if (dateTo) {
      const itemD = parseItemDate(item.date);
      const toD = parseItemDate(dateTo);
      if (itemD && itemD > toD) return false;
    }

    // 3. Account / Fund filter (KK vs FA)
    if (account && account !== 'all') {
      const target = item.targetAccount || item.account || (item.isExpense ? item.provider : '');
      const isFA = target === 'Felújítási Alap' || target === 'FA';
      const isKK = target === 'Közös Költség' || target === 'KK' || (!target && !isFA);

      if (account === 'KK' && !isKK) return false;
      if (account === 'FA' && !isFA) return false;
    }

    // 4. Type filter (income/payment vs expense/charge)
    if (type && type !== 'all') {
      const isExpense = Boolean(
        item.isExpense || 
        item.itemType === 'Expense' || 
        item.type === 'Charge' || 
        (item.type !== 'Payment' && item.type !== 'Opening' && Number(item.amount) < 0)
      );

      if (type === 'income') {
        if (isExpense) return false;
      } else if (type === 'expense') {
        if (!isExpense) return false;
      }
    }

    // 5. Amount Min / Max filter (on absolute value of transaction)
    const absVal = Math.abs(Number(item.amount) || 0);
    if (minAmount !== '' && minAmount !== null && minAmount !== undefined && !isNaN(Number(minAmount))) {
      if (absVal < Number(minAmount)) return false;
    }
    if (maxAmount !== '' && maxAmount !== null && maxAmount !== undefined && !isNaN(Number(maxAmount))) {
      if (absVal > Number(maxAmount)) return false;
    }

    return true;
  });
}
