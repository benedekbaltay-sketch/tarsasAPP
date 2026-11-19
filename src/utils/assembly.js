import { isMatchingFlat } from './finances';

/**
 * Assembly (Közgyűlés) Accounting and Report Utilities
 * Implements official condominium balance statement calculations according to Hungarian Condominium Act (Tht.)
 */

/**
 * Returns an array of 'YYYY-MM' strings between startMonthStr and endMonthStr (inclusive)
 * @param {string} startMonthStr e.g. '2025-01'
 * @param {string} endMonthStr e.g. '2025-12'
 * @returns {string[]}
 */
export function getMonthsInRange(startMonthStr, endMonthStr) {
  if (!startMonthStr || !endMonthStr) return [];
  let [sY, sM] = startMonthStr.split('-').map(Number);
  let [eY, eM] = endMonthStr.split('-').map(Number);

  if (sY > eY || (sY === eY && sM > eM)) {
    [sY, eY] = [eY, sY];
    [sM, eM] = [eM, sM];
  }

  const months = [];
  let curr = new Date(sY, sM - 1, 1);
  const end = new Date(eY, eM - 1, 1);

  while (curr <= end) {
    const y = curr.getFullYear();
    const m = curr.getMonth() + 1;
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    curr.setMonth(curr.getMonth() + 1);
  }

  return months;
}

/**
 * Returns full date boundaries for a month range:
 * - startDateStr: YYYY-MM-01 (00:00)
 * - endDateStr: YYYY-MM-lastDay (23:59)
 * @param {string} startMonthStr e.g. '2025-01'
 * @param {string} endMonthStr e.g. '2025-12'
 * @returns {{ startDateStr: string, endDateStr: string, monthsCount: number, months: string[] }}
 */
export function getPeriodBoundaries(startMonthStr, endMonthStr) {
  const months = getMonthsInRange(startMonthStr, endMonthStr);
  if (months.length === 0) {
    const now = new Date();
    const curY = now.getFullYear();
    const defaultM = `${curY - 1}-01`;
    const defaultEndM = `${curY - 1}-12`;
    return getPeriodBoundaries(defaultM, defaultEndM);
  }

  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];

  const [sY, sM] = firstMonth.split('-').map(Number);
  const [eY, eM] = lastMonth.split('-').map(Number);

  const startDateStr = `${sY}-${String(sM).padStart(2, '0')}-01`;
  const lastDay = new Date(eY, eM, 0).getDate();
  const endDateStr = `${eY}-${String(eM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return {
    startDateStr,
    endDateStr,
    monthsCount: months.length,
    months
  };
}

/**
 * Calculates the complete Owner Balances Statement (Tulajdonosi egyenlegek elszámolása)
 * for all property units (flats/garages/storages) in the active condominium.
 * 
 * Strict Tht. Formula:
 * Záró egyenleg = Nyitó egyenleg - Időszaki előírás + Időszaki befizetés
 * 
 * @param {string} startMonthStr e.g. '2025-01'
 * @param {string} endMonthStr e.g. '2025-12'
 * @param {object} state AppContext state
 * @param {string} buildingId Optional specific building ID
 * @returns {object} Full report structure with rows and totals
 */
export function calculateOwnerBalancesReport(startMonthStr, endMonthStr, state, buildingId) {
  const { startDateStr, endDateStr, monthsCount, months } = getPeriodBoundaries(startMonthStr, endMonthStr);

  const currentBuildingId = buildingId || state?.currentBuildingId;
  const building = (state?.buildings || []).find(b => b.id === currentBuildingId) || state?.buildings?.[0] || {
    name: "Társasház",
    address: ""
  };

  const flats = building.flats || state?.flats || [];

  // Sort flats in natural order (e.g. Fsz 1, Fsz 2, I 4, II 7-8...)
  const sortedFlats = [...flats].sort((a, b) => {
    return (a.flatNum || '').localeCompare(b.flatNum || '', undefined, { numeric: true, sensitivity: 'base' });
  });

  const rows = sortedFlats.map(flat => {
    // 1. Albetét megnevezése és tulajdonos(ok)
    let flatLabel = (flat.flatNum || '').trim();
    flatLabel = flatLabel.replace(/\s*lakás\.?$/i, '').replace(/\s*lakas\.?$/i, '').trim();
    if (flatLabel && !flatLabel.endsWith('.')) {
      flatLabel += '.';
    }

    let ownerName = '-';
    if (Array.isArray(flat.owners) && flat.owners.length > 0) {
      ownerName = flat.owners.map(o => o.name).filter(Boolean).join(', ');
    } else if (flat.ownerName) {
      ownerName = flat.ownerName;
    }

    // 2. Időszaki előírások (KK és FA) a megadott hónapokra
    let eloirasKK = 0;
    let eloirasFA = 0;

    months.forEach(m => {
      const monthFirstDay = `${m}-01`;

      // Közös Költség (KK) havi díj az adott hónapban
      let monthlyFeeKK = Number(flat.monthlyFee) || 0;
      if (Array.isArray(flat.feeChangesKK) && flat.feeChangesKK.length > 0) {
        const activeChanges = flat.feeChangesKK.filter(c => c.date <= monthFirstDay);
        if (activeChanges.length > 0) {
          activeChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
          monthlyFeeKK = Number(activeChanges[0].amount) || 0;
        }
      }
      const isCancelledKK = Array.isArray(flat.cancelledDebits) && (
        flat.cancelledDebits.includes(`${monthFirstDay}_KK`) ||
        flat.cancelledDebits.includes(`${monthFirstDay}_Közös Költség`)
      );
      if (isCancelledKK) monthlyFeeKK = 0;

      // Egyedi manuális terhelések KK
      const manualKK = (state?.manualDebits || [])
        .filter(d => isMatchingFlat(d.flatNum, flat.flatNum) && (d.targetAccount === 'Közös Költség' || !d.targetAccount) && d.date && d.date.startsWith(m) && d.includeInFlatBalance !== false)
        .reduce((sum, d) => sum + Math.abs(Number(d.amount) || 0), 0);

      eloirasKK += (monthlyFeeKK + manualKK);

      // Felújítási Alap (FA) havi díj az adott hónapban
      let monthlyFeeFA = Number(flat.renovationFee) || 0;
      if (Array.isArray(flat.feeChangesFA) && flat.feeChangesFA.length > 0) {
        const activeChangesFA = flat.feeChangesFA.filter(c => c.date <= monthFirstDay);
        if (activeChangesFA.length > 0) {
          activeChangesFA.sort((a, b) => new Date(b.date) - new Date(a.date));
          monthlyFeeFA = Number(activeChangesFA[0].amount) || 0;
        }
      }
      const isCancelledFA = Array.isArray(flat.cancelledDebits) && (
        flat.cancelledDebits.includes(`${monthFirstDay}_FA`) ||
        flat.cancelledDebits.includes(`${monthFirstDay}_Felújítási Alap`)
      );
      if (isCancelledFA) monthlyFeeFA = 0;

      // Egyedi manuális terhelések FA
      const manualFA = (state?.manualDebits || [])
        .filter(d => isMatchingFlat(d.flatNum, flat.flatNum) && d.targetAccount === 'Felújítási Alap' && d.date && d.date.startsWith(m) && d.includeInFlatBalance !== false)
        .reduce((sum, d) => sum + Math.abs(Number(d.amount) || 0), 0);

      eloirasFA += (monthlyFeeFA + manualFA);
    });

    const eloirasTotal = eloirasKK + eloirasFA;

    // 3. Időszaki befizetések a megadott intervallumban (startDateStr <= tx.date <= endDateStr)
    const periodTxs = (state?.transactions || []).filter(tx => 
      isMatchingFlat(tx.flatNum, flat.flatNum) &&
      tx.status === 'Verified' &&
      tx.type !== 'Correction' &&
      tx.includeInFlatBalance !== false &&
      tx.date &&
      tx.date >= startDateStr &&
      tx.date <= endDateStr
    );

    const befizetesKK = periodTxs
      .filter(tx => tx.targetAccount === 'Közös Költség' || !tx.targetAccount)
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const befizetesFA = periodTxs
      .filter(tx => tx.targetAccount === 'Felújítási Alap')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const befizetesTotal = befizetesKK + befizetesFA;

    // 4. Nyitó egyenleg (az időszak kezdőnapját megelőző állapot)
    // SZIGORÚ IDŐZÍTÉSI SZABÁLY:
    // A Nyitó egyenleg szigorúan a kiválasztott kezdő hónap 1. napját megelőző másodperc (pl. 2025.01.01 esetén a 2024.12.31. 23:59:59) záró egyenlege!
    // A kezdő hónap 1-jén generálódó új havi előírás NEM a nyitó egyenleg része, az már az Időszaki előírások oszlopba számítandó bele, elkerülve a kettős levonást.

    // Megelőző befizetések (szigorúan tx.date < startDateStr)
    const priorTxs = (state?.transactions || []).filter(tx =>
      isMatchingFlat(tx.flatNum, flat.flatNum) &&
      tx.status === 'Verified' &&
      tx.type !== 'Correction' &&
      tx.includeInFlatBalance !== false &&
      tx.date &&
      tx.date < startDateStr
    );

    const priorPayKK = priorTxs
      .filter(tx => tx.targetAccount === 'Közös Költség' || !tx.targetAccount)
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const priorPayFA = priorTxs
      .filter(tx => tx.targetAccount === 'Felújítási Alap')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Megelőző egyedi manuális terhelések (szigorúan d.date < startDateStr)
    const priorManualKK = (state?.manualDebits || [])
      .filter(d => isMatchingFlat(d.flatNum, flat.flatNum) &&
                   (d.targetAccount === 'Közös Költség' || !d.targetAccount) &&
                   d.includeInFlatBalance !== false &&
                   d.date && d.date < startDateStr)
      .reduce((sum, d) => sum + Math.abs(Number(d.amount) || 0), 0);

    const priorManualFA = (state?.manualDebits || [])
      .filter(d => isMatchingFlat(d.flatNum, flat.flatNum) &&
                   d.targetAccount === 'Felújítási Alap' &&
                   d.includeInFlatBalance !== false &&
                   d.date && d.date < startDateStr)
      .reduce((sum, d) => sum + Math.abs(Number(d.amount) || 0), 0);

    // Megelőző havi rendszeres előírások (szigorúan a kezdő hónap előtti hónapok: pm < startM)
    let priorRecurringKK = 0;
    let priorRecurringFA = 0;

    const startM = startDateStr.slice(0, 7);
    if (flat.startDate) {
      const flatStartM = flat.startDate.slice(0, 7);
      if (flatStartM < startM) {
        const priorMonths = getMonthsInRange(flatStartM, getPreviousMonthStr(startM));
        priorMonths.forEach(pm => {
          const pmDate = `${pm}-01`;
          let feeKK = Number(flat.monthlyFee) || 0;
          if (Array.isArray(flat.feeChangesKK)) {
            const act = flat.feeChangesKK.filter(c => c.date <= pmDate);
            if (act.length > 0) {
              act.sort((a, b) => new Date(b.date) - new Date(a.date));
              feeKK = Number(act[0].amount) || 0;
            }
          }
          if (Array.isArray(flat.cancelledDebits) && (flat.cancelledDebits.includes(`${pmDate}_KK`) || flat.cancelledDebits.includes(`${pmDate}_Közös Költség`))) {
            feeKK = 0;
          }
          priorRecurringKK += feeKK;

          let feeFA = Number(flat.renovationFee) || 0;
          if (Array.isArray(flat.feeChangesFA)) {
            const actFA = flat.feeChangesFA.filter(c => c.date <= pmDate);
            if (actFA.length > 0) {
              actFA.sort((a, b) => new Date(b.date) - new Date(a.date));
              feeFA = Number(actFA[0].amount) || 0;
            }
          }
          if (Array.isArray(flat.cancelledDebits) && (flat.cancelledDebits.includes(`${pmDate}_FA`) || flat.cancelledDebits.includes(`${pmDate}_Felújítási Alap`))) {
            feeFA = 0;
          }
          priorRecurringFA += feeFA;
        });
      }
    }

    const nyitoKK = (Number(flat.initialBalance) || 0) + priorPayKK - (priorRecurringKK + priorManualKK);
    const nyitoFA = (Number(flat.initialRenovationBalance) || 0) + priorPayFA - (priorRecurringFA + priorManualFA);
    const nyitoTotal = nyitoKK + nyitoFA;

    // 5. Záró egyenlegek (Tht. szerinti kötelező képlet):
    // Záró = Nyitó - Előírás + Befizetés
    const zaroKK = nyitoKK - eloirasKK + befizetesKK;
    const zaroFA = nyitoFA - eloirasFA + befizetesFA;
    const zaroTotal = nyitoTotal - eloirasTotal + befizetesTotal;

    return {
      flatNum: flat.flatNum,
      flatLabel,
      ownerName,
      nyitoKK,
      nyitoFA,
      nyitoTotal,
      eloirasKK,
      eloirasFA,
      eloirasTotal,
      befizetesKK,
      befizetesFA,
      befizetesTotal,
      zaroKK,
      zaroFA,
      zaroTotal
    };
  });

  // Calculate Összesen row
  const totals = rows.reduce((acc, r) => ({
    nyitoKK: acc.nyitoKK + r.nyitoKK,
    nyitoFA: acc.nyitoFA + r.nyitoFA,
    nyitoTotal: acc.nyitoTotal + r.nyitoTotal,
    eloirasKK: acc.eloirasKK + r.eloirasKK,
    eloirasFA: acc.eloirasFA + r.eloirasFA,
    eloirasTotal: acc.eloirasTotal + r.eloirasTotal,
    befizetesKK: acc.befizetesKK + r.befizetesKK,
    befizetesFA: acc.befizetesFA + r.befizetesFA,
    befizetesTotal: acc.befizetesTotal + r.befizetesTotal,
    zaroKK: acc.zaroKK + r.zaroKK,
    zaroFA: acc.zaroFA + r.zaroFA,
    zaroTotal: acc.zaroTotal + r.zaroTotal
  }), {
    nyitoKK: 0,
    nyitoFA: 0,
    nyitoTotal: 0,
    eloirasKK: 0,
    eloirasFA: 0,
    eloirasTotal: 0,
    befizetesKK: 0,
    befizetesFA: 0,
    befizetesTotal: 0,
    zaroKK: 0,
    zaroFA: 0,
    zaroTotal: 0
  });

  return {
    building,
    startMonthStr,
    endMonthStr,
    startDateStr,
    endDateStr,
    monthsCount,
    rows,
    totals
  };
}

function getPreviousMonthStr(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
