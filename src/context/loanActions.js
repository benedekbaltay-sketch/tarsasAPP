import { getPermanentVault, savePermanentVault } from './syncEngine';
import { IS_FIRESTORE_MODE } from '../constants/firebaseConfig';
import { callMutateLoan } from '../services/firestoreService';

export function createLoanActions({ state, persistState, showToast, t, reloadCurrentBuilding }) {
  const requireAdmin = () => {
    if (state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'superadmin')) {
      return true;
    }
    showToast(
      t.error_unauthorized || (state.currentLang === 'en' ? "Unauthorized action." : "Nincs jogosultságod ehhez a művelethez."),
      "error"
    );
    return false;
  };

  // Add new Loan
  const addLoan = async (loanData) => {
    if (!requireAdmin()) return null;
    const isEn = state.currentLang === 'en';
    const now = Date.now();
    const newLoan = {
      id: loanData.id || `loan-${now}-${Math.random().toString(36).substring(2, 6)}`,
      title: (loanData.title || '').trim(),
      bankName: (loanData.bankName || '').trim(),
      contractNumber: (loanData.contractNumber || '').trim(),
      totalProjectCost: Number(loanData.totalProjectCost) || 0,
      lumpSumTotalCollected: Number(loanData.lumpSumTotalCollected) || 0,
      principalAmount: Number(loanData.principalAmount) || 0,
      currentBalance: Number(loanData.currentBalance !== undefined ? loanData.currentBalance : loanData.principalAmount) || 0,
      termMonths: Number(loanData.termMonths) || 12,
      startDate: loanData.startDate || new Date().toISOString().slice(0, 10),
      endDate: loanData.endDate || '',
      monthlyInstallment: Number(loanData.monthlyInstallment) || 0,
      interestRatePercent: Number(loanData.interestRatePercent) || 0,
      allocationType: loanData.allocationType || 'ownership_ratio',
      status: loanData.status || 'active',
      participants: Array.isArray(loanData.participants) ? loanData.participants : [],
      payments: Array.isArray(loanData.payments) ? loanData.payments : [],
      createdAt: now,
      lastUpdated: now
    };

    // Auto-calculate lump sum total if not provided
    if (!newLoan.lumpSumTotalCollected && newLoan.participants.length > 0) {
      newLoan.lumpSumTotalCollected = newLoan.participants.reduce((sum, p) => {
        return sum + (p.paymentMethod === 'lump_sum' ? (Number(p.lumpSumAmountPaid) || 0) : 0);
      }, 0);
    }

    if (!newLoan.principalAmount) {
      newLoan.principalAmount = Math.max(0, newLoan.totalProjectCost - newLoan.lumpSumTotalCollected);
    }
    if (newLoan.currentBalance === undefined || newLoan.currentBalance === null) {
      newLoan.currentBalance = newLoan.principalAmount;
    }

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return null;
      try {
        await callMutateLoan({ action: 'create', buildingId, loanId: newLoan.id, payload: newLoan });
        if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        showToast(isEn ? "Loan added successfully!" : "Hitel sikeresen rögzítve!");
        return newLoan;
      } catch (err) {
        console.warn("Firestore addLoan error:", err.message);
        showToast(isEn ? "Failed to save loan." : "Nem sikerült rögzíteni a hitelt.", "error");
        return null;
      }
    }

    return persistState(s => {
      const curLoans = Array.isArray(s.loans) ? s.loans : [];
      return {
        ...s,
        loans: [newLoan, ...curLoans]
      };
    }, true).then(() => {
      showToast(isEn ? "Loan added successfully!" : "Hitel sikeresen rögzítve!");
      return newLoan;
    });
  };

  // Update existing Loan
  const updateLoan = async (loanId, updatedData) => {
    if (!requireAdmin()) return;
    const isEn = state.currentLang === 'en';
    const now = Date.now();

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return;
      try {
        await callMutateLoan({ action: 'update', buildingId, loanId, payload: updatedData });
        if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        showToast(isEn ? "Loan updated successfully!" : "Hitel adatai sikeresen frissítve!");
      } catch (err) {
        console.warn("Firestore updateLoan error:", err.message);
        showToast(isEn ? "Failed to update loan." : "Nem sikerült frissíteni a hitelt.", "error");
      }
      return;
    }

    return persistState(s => {
      const curLoans = Array.isArray(s.loans) ? s.loans : [];
      const updatedLoans = curLoans.map(loan => {
        if (loan.id !== loanId) return loan;

        const merged = {
          ...loan,
          ...updatedData,
          lastUpdated: now
        };

        if (Array.isArray(updatedData.participants)) {
          merged.lumpSumTotalCollected = updatedData.participants.reduce((sum, p) => {
            return sum + (p.paymentMethod === 'lump_sum' ? (Number(p.lumpSumAmountPaid) || 0) : 0);
          }, 0);
        }

        if (Number(merged.currentBalance) <= 0 && merged.status === 'active') {
          merged.status = 'paid_off';
        }

        return merged;
      });

      return {
        ...s,
        loans: updatedLoans
      };
    }, true).then(() => {
      showToast(isEn ? "Loan updated successfully!" : "Hitel adatai sikeresen frissítve!");
    });
  };

  // Delete Loan
  const deleteLoan = async (loanId) => {
    if (!requireAdmin()) return;
    const isEn = state.currentLang === 'en';

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return;
      try {
        await callMutateLoan({ action: 'delete', buildingId, loanId });
        if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        showToast(isEn ? "Loan deleted!" : "Hitel törölve!", "info");
      } catch (err) {
        console.warn("Firestore deleteLoan error:", err.message);
        showToast(isEn ? "Failed to delete loan." : "Nem sikerült törölni a hitelt.", "error");
      }
      return;
    }

    const vault = getPermanentVault();
    vault.deletedIds = vault.deletedIds || [];
    if (!vault.deletedIds.includes(loanId)) {
      vault.deletedIds.push(loanId);
    }
    savePermanentVault(vault);

    return persistState(s => {
      const curLoans = Array.isArray(s.loans) ? s.loans : [];
      return {
        ...s,
        loans: curLoans.filter(l => l.id !== loanId)
      };
    }, true).then(() => {
      showToast(isEn ? "Loan deleted!" : "Hitel törölve!", "info");
    });
  };

  // Record a payment towards a Loan
  const recordLoanPayment = async (loanId, paymentData) => {
    if (!requireAdmin()) return;
    const isEn = state.currentLang === 'en';
    const now = Date.now();

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return;
      try {
        await callMutateLoan({ action: 'recordPayment', buildingId, loanId, paymentData });
        if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        showToast(isEn ? "Payment recorded successfully!" : "Törlesztés sikeresen rögzítve!");
      } catch (err) {
        console.warn("Firestore recordLoanPayment error:", err.message);
        showToast(isEn ? "Failed to record payment." : "Nem sikerült rögzíteni a törlesztést.", "error");
      }
      return;
    }

    return persistState(s => {
      const curLoans = Array.isArray(s.loans) ? s.loans : [];
      const updatedLoans = curLoans.map(loan => {
        if (loan.id !== loanId) return loan;

        const principalPaid = Number(paymentData.principalPaid) || 0;
        const interestPaid = Number(paymentData.interestPaid) || 0;
        const bankFee = Number(paymentData.bankFee) || 0;
        const totalPaid = Number(paymentData.totalPaid) || (principalPaid + interestPaid + bankFee);

        const currentBal = Number(loan.currentBalance) || 0;
        const remainingBalanceAfter = Math.max(0, currentBal - principalPaid);

        const newPayment = {
          id: paymentData.id || `lp-${now}-${Math.random().toString(36).substring(2, 6)}`,
          paymentDate: paymentData.paymentDate || new Date().toISOString().slice(0, 10),
          totalPaid,
          principalPaid,
          interestPaid,
          bankFee,
          remainingBalanceAfter,
          status: paymentData.status || 'completed',
          note: (paymentData.note || '').trim()
        };

        const updatedPayments = [newPayment, ...(loan.payments || [])];
        updatedPayments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

        const isFullyPaidOff = remainingBalanceAfter <= 0;

        return {
          ...loan,
          currentBalance: remainingBalanceAfter,
          status: isFullyPaidOff ? 'paid_off' : loan.status,
          payments: updatedPayments,
          lastUpdated: now
        };
      });

      return {
        ...s,
        loans: updatedLoans
      };
    }, true).then(() => {
      showToast(isEn ? "Payment recorded successfully!" : "Törlesztés sikeresen rögzítve!");
    });
  };

  // Delete a recorded payment from Loan history
  const deleteLoanPayment = async (loanId, paymentId) => {
    if (!requireAdmin()) return;
    const isEn = state.currentLang === 'en';
    const now = Date.now();

    if (IS_FIRESTORE_MODE) {
      const buildingId = state.currentBuildingId || state.buildings?.[0]?.id;
      if (!buildingId) return;
      try {
        await callMutateLoan({ action: 'deletePayment', buildingId, loanId, paymentId });
        if (typeof reloadCurrentBuilding === 'function') await reloadCurrentBuilding(buildingId);
        showToast(isEn ? "Payment removed!" : "Törlesztési tétel törölve!", "info");
      } catch (err) {
        console.warn("Firestore deleteLoanPayment error:", err.message);
        showToast(isEn ? "Failed to delete payment." : "Nem sikerült törölni a törlesztési tételt.", "error");
      }
      return;
    }

    return persistState(s => {
      const curLoans = Array.isArray(s.loans) ? s.loans : [];
      const updatedLoans = curLoans.map(loan => {
        if (loan.id !== loanId) return loan;

        const filteredPayments = (loan.payments || []).filter(p => p.id !== paymentId);
        
        const totalPrincipalPaid = filteredPayments.reduce((sum, p) => sum + (Number(p.principalPaid) || 0), 0);
        const newBalance = Math.max(0, (Number(loan.principalAmount) || 0) - totalPrincipalPaid);

        return {
          ...loan,
          currentBalance: newBalance,
          status: newBalance <= 0 ? 'paid_off' : (loan.status === 'paid_off' ? 'active' : loan.status),
          payments: filteredPayments,
          lastUpdated: now
        };
      });

      return {
        ...s,
        loans: updatedLoans
      };
    }, true).then(() => {
      showToast(isEn ? "Payment removed!" : "Törlesztési tétel törölve!", "info");
    });
  };

  return {
    addLoan,
    updateLoan,
    deleteLoan,
    recordLoanPayment,
    deleteLoanPayment
  };
}
