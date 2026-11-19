import { getPermanentVault, savePermanentVault } from './syncEngine';

export function createLoanActions({ state, persistState, showToast, t }) {
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
  const addLoan = (loanData) => {
    if (!requireAdmin()) return Promise.resolve(null);
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
  const updateLoan = (loanId, updatedData) => {
    if (!requireAdmin()) return Promise.resolve();
    const isEn = state.currentLang === 'en';
    const now = Date.now();

    return persistState(s => {
      const curLoans = Array.isArray(s.loans) ? s.loans : [];
      const updatedLoans = curLoans.map(loan => {
        if (loan.id !== loanId) return loan;

        const merged = {
          ...loan,
          ...updatedData,
          lastUpdated: now
        };

        // Recalculate lump sum collected from participants if participants are updated
        if (Array.isArray(updatedData.participants)) {
          merged.lumpSumTotalCollected = updatedData.participants.reduce((sum, p) => {
            return sum + (p.paymentMethod === 'lump_sum' ? (Number(p.lumpSumAmountPaid) || 0) : 0);
          }, 0);
        }

        // Check if balance reached 0 to auto switch status to 'paid_off'
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
  const deleteLoan = (loanId) => {
    if (!requireAdmin()) return Promise.resolve();
    const isEn = state.currentLang === 'en';
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
  const recordLoanPayment = (loanId, paymentData) => {
    if (!requireAdmin()) return Promise.resolve();
    const isEn = state.currentLang === 'en';
    const now = Date.now();

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
        // Sort payments by date descending
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
  const deleteLoanPayment = (loanId, paymentId) => {
    if (!requireAdmin()) return Promise.resolve();
    const isEn = state.currentLang === 'en';
    const now = Date.now();

    return persistState(s => {
      const curLoans = Array.isArray(s.loans) ? s.loans : [];
      const updatedLoans = curLoans.map(loan => {
        if (loan.id !== loanId) return loan;

        const filteredPayments = (loan.payments || []).filter(p => p.id !== paymentId);
        
        // Recalculate remaining balance from initial principal minus all remaining payments
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
