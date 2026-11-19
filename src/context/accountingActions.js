import { getPermanentVault, savePermanentVault } from './syncEngine';
import { getFlatLedgerTimeline } from '../utils/finances';

export function createAccountingActions({ state, persistState, showToast, t, copiedTx, setCopiedTx, ensureFirebaseAuth }) {
  const isAdmin = () => Boolean(
    state.currentUser && (state.currentUser.role === 'admin' || state.currentUser.role === 'superadmin')
  );

  const requireAdmin = () => {
    if (isAdmin()) return true;
    showToast(
      t.error_unauthorized || (state.currentLang === 'en' ? "Unauthorized action." : "Nincs jogosultságod ehhez a művelethez."),
      "error"
    );
    return false;
  };

  // Add Transaction
  const addTransaction = (newTx) => {
    if (!requireAdmin()) return;
    const txId = newTx.id;
    newTx.lastUpdated = newTx.lastUpdated || Date.now();
    persistState(s => ({
      ...s,
      transactions: [newTx, ...(s.transactions || []).filter(t => t.id !== txId)]
    }), true);
    const handleUndo = () => {
      persistState(s => ({
        ...s,
        transactions: (s.transactions || []).filter(t => t.id !== txId)
      }), true);
      showToast(state.currentLang === 'en' ? "Recording undone!" : "Rögzítés visszavonva!", "info");
    };
    showToast(state.currentLang === 'en' ? "Payment saved!" : "Befizetés mentve!", 'success', handleUndo);
  };

  // Add Expense
  const addExpense = (newExpense) => {
    if (!requireAdmin()) return;
    const expId = newExpense.id;
    newExpense.lastUpdated = newExpense.lastUpdated || Date.now();
    persistState(s => ({
      ...s,
      expenses: [newExpense, ...(s.expenses || []).filter(e => e.id !== expId)]
    }), true);
    const handleUndo = () => {
      persistState(s => ({
        ...s,
        expenses: (s.expenses || []).filter(e => e.id !== expId)
      }), true);
      showToast(state.currentLang === 'en' ? "Recording undone!" : "Kiadás mentve!", "info");
    };
    showToast(state.currentLang === 'en' ? "Expense saved!" : "Kiadás mentve!", 'success', handleUndo);
  };

  // Add Manual Debit
  const addManualDebit = (newDebit) => {
    if (!requireAdmin()) return;
    const debId = newDebit.id;
    newDebit.lastUpdated = newDebit.lastUpdated || Date.now();
    persistState(s => ({
      ...s,
      manualDebits: [newDebit, ...(s.manualDebits || []).filter(d => d.id !== debId)]
    }), true);
    const handleUndo = () => {
      persistState(s => ({
        ...s,
        manualDebits: (s.manualDebits || []).filter(d => d.id !== debId)
      }), true);
      showToast(state.currentLang === 'en' ? "Recording undone!" : "Rögzítés visszavonva!", "info");
    };
    showToast(state.currentLang === 'en' ? "Debit item saved!" : "Terhelés rögzítve!", 'success', handleUndo);
  };

  // Add Multiple Items (Batch / Universal)
  const addMultipleItems = ({ transactions = [], expenses = [], debits = [] }) => {
    if (!requireAdmin()) return;
    const now = Date.now();
    transactions.forEach(t => { if (t) t.lastUpdated = t.lastUpdated || now; });
    expenses.forEach(e => { if (e) e.lastUpdated = e.lastUpdated || now; });
    debits.forEach(d => { if (d) d.lastUpdated = d.lastUpdated || now; });

    const txIds = transactions.map(t => t?.id).filter(Boolean);
    const expIds = expenses.map(e => e?.id).filter(Boolean);
    const debIds = debits.map(d => d?.id).filter(Boolean);

    persistState(s => {
      const existingTxIds = new Set((s.transactions || []).map(t => t.id));
      const existingExpIds = new Set((s.expenses || []).map(e => e.id));
      const existingDebIds = new Set((s.manualDebits || []).map(d => d.id));

      const newTxs = transactions.filter(t => !existingTxIds.has(t.id));
      const newExps = expenses.filter(e => !existingExpIds.has(e.id));
      const newDebs = debits.filter(d => !existingDebIds.has(d.id));

      return {
        ...s,
        transactions: [...newTxs, ...(s.transactions || [])],
        expenses: [...newExps, ...(s.expenses || [])],
        manualDebits: [...newDebs, ...(s.manualDebits || [])]
      };
    }, true);
    const totalCount = transactions.length + expenses.length + debits.length;
    const msg = state.currentLang === 'en' 
      ? (totalCount > 1 ? `${totalCount} items saved successfully!` : "Item saved successfully!") 
      : (totalCount > 1 ? `${totalCount} tétel sikeresen rögzítve!` : "Tétel sikeresen rögzítve!");

    const handleUndo = () => {
      persistState(s => ({
        ...s,
        transactions: (s.transactions || []).filter(t => !txIds.includes(t.id)),
        expenses: (s.expenses || []).filter(e => !expIds.includes(e.id)),
        manualDebits: (s.manualDebits || []).filter(d => !debIds.includes(d.id))
      }), true);
      showToast(state.currentLang === 'en' ? "Recording undone!" : "Rögzítés visszavonva!", "info");
    };

    showToast(msg, 'success', handleUndo);
  };

  // Copy transaction to in-app & system clipboard
  const copyTransaction = (item) => {
    if (!item) return;
    setCopiedTx(item);

    const isEn = state.currentLang === 'en';
    const amountStr = `${Math.abs(Math.round(item.amount || 0)).toLocaleString('hu-HU')} Ft`;
    const label = item.title || item.comment || (item.flatNum && item.flatNum !== 'Global' ? `${item.flatNum}. ${isEn ? 'Flat' : 'lakás'}` : (isEn ? 'Item' : 'Tétel'));

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(`${label} - ${amountStr}`);
      } catch (e) {}
    }

    const msg = isEn 
      ? `Item copied to clipboard: ${label} (${amountStr}). Press Ctrl+V to paste!`
      : `Tétel kimásolva: ${label} (${amountStr}). Beillesztéshez nyomj Ctrl+V-t!`;

    showToast(msg, 'info');
  };

  // Paste transaction from clipboard (duplicate item with undo)
  const pasteTransaction = (targetFlatNum = null) => {
    if (!requireAdmin()) return null;
    const isEn = state.currentLang === 'en';
    if (!copiedTx) {
      showToast(isEn ? "No copied item on clipboard! Select an item and press Ctrl+C." : "Nincs kimásolt tétel a vágólapon! Válassz ki egy tételt és nyomj Ctrl+C-t.", "info");
      return null;
    }

    const today = new Date().toISOString().slice(0, 10);
    const rawDate = copiedTx.date || today;
    const formattedDate = (rawDate && rawDate.length === 7) ? `${rawDate}-01` : rawDate;
    const isExpense = copiedTx.isExpense || copiedTx.type === 'Expense';
    const isDebit = copiedTx.type === 'Debit' || (!isExpense && (copiedTx.id?.startsWith('d-') || (copiedTx.amount && Number(copiedTx.amount) < 0)));

    if (isExpense) {
      const newExpId = `exp-${Date.now()}`;
      const baseTitle = copiedTx.title || copiedTx.provider || (isEn ? 'Expense' : 'Kiadás');
      const newTitle = `${baseTitle} (${isEn ? 'copy' : 'másolat'})`;
      const baseComment = copiedTx.comment || '';
      const newComment = baseComment ? `${baseComment} (${isEn ? 'copy' : 'másolat'})` : newTitle;

      const now = Date.now();
      const newExpense = {
        id: newExpId,
        date: formattedDate,
        amount: Math.abs(Number(copiedTx.amount) || 0),
        title: newTitle,
        provider: copiedTx.provider || baseTitle,
        category: copiedTx.category || 'Utility',
        targetAccount: copiedTx.targetAccount || (copiedTx.account === 'Felújítási Alap' ? 'Felújítási Alap' : 'Közös Költség'),
        account: copiedTx.account || copiedTx.targetAccount || 'Közös Költség',
        comment: newComment,
        status: copiedTx.status || 'Paid',
        flatNum: copiedTx.flatNum || '-',
        includeInBalance: copiedTx.includeInBalance !== false,
        affectsBankBalance: copiedTx.affectsBankBalance !== false,
        includeInFlatBalance: true,
        attachments: copiedTx.attachments || [],
        createdAt: now,
        lastUpdated: now
      };

      addExpense(newExpense);
      return newExpense;
    } else if (isDebit) {
      const now = Date.now();
      const destFlat = targetFlatNum || copiedTx.flatNum || 'Fsz 1';
      const newDebId = `deb-${now}`;
      const baseTitle = copiedTx.title || (isEn ? 'Debit' : 'Előírás');
      const newTitle = `${baseTitle} (${isEn ? 'copy' : 'másolat'})`;
      const baseComment = copiedTx.comment || '';
      const newComment = baseComment ? `${baseComment} (${isEn ? 'copy' : 'másolat'})` : newTitle;

      const newDebit = {
        id: newDebId,
        flatNum: destFlat,
        date: formattedDate,
        amount: Math.abs(Number(copiedTx.amount) || 0),
        title: newTitle,
        category: copiedTx.category || 'Other',
        targetAccount: copiedTx.targetAccount || 'Közös Költség',
        account: copiedTx.account || copiedTx.targetAccount || 'Közös Költség',
        comment: newComment,
        type: 'Debit',
        includeInBalance: copiedTx.includeInBalance !== false,
        affectsBankBalance: copiedTx.affectsBankBalance !== false,
        includeInFlatBalance: true,
        attachments: copiedTx.attachments || [],
        createdAt: now,
        lastUpdated: now
      };

      addManualDebit(newDebit);
      return newDebit;
    } else {
      // Payment / Transaction
      const now = Date.now();
      const destFlat = targetFlatNum || (copiedTx.flatNum && copiedTx.flatNum !== 'Global' ? copiedTx.flatNum : 'Fsz 1');
      const newTxId = `tx-${now}`;
      const baseComment = copiedTx.comment || (copiedTx.title || (isEn ? 'Payment' : 'Befizetés'));
      const newComment = `${baseComment} (${isEn ? 'copy' : 'másolat'})`;
      const newTitle = copiedTx.title ? `${copiedTx.title} (${isEn ? 'copy' : 'másolat'})` : undefined;

      const newTx = {
        id: newTxId,
        flatNum: destFlat,
        date: formattedDate,
        amount: Math.abs(Number(copiedTx.amount) || 0),
        targetAccount: copiedTx.targetAccount || (copiedTx.account === 'Felújítási Alap' ? 'Felújítási Alap' : 'Közös Költség'),
        account: copiedTx.account || copiedTx.targetAccount || 'Közös Költség',
        method: copiedTx.method || copiedTx.category || 'Bank Transfer',
        category: copiedTx.category || copiedTx.method || 'Bank Transfer',
        comment: newComment,
        ...(newTitle ? { title: newTitle } : {}),
        status: copiedTx.status || 'Verified',
        type: copiedTx.type || 'Payment',
        includeInBalance: copiedTx.includeInBalance !== false,
        affectsBankBalance: copiedTx.affectsBankBalance !== false,
        includeInFlatBalance: true,
        attachments: copiedTx.attachments || [],
        createdAt: now,
        lastUpdated: now
      };

      addTransaction(newTx);
      return newTx;
    }
  };

  // Edit Transaction / Expense / ManualDebit / Recurring Prescription
  const editItem = (id, type, updatedFields, flatNumHint = null) => {
    if (!requireAdmin()) return;
    persistState(s => {
      let updatedTransactions = s.transactions || [];
      let updatedExpenses = s.expenses || [];
      let updatedDebits = s.manualDebits || [];
      let updatedFlats = s.flats || [];

      // Check if it's a recurring prescription (starts with "d-")
      if (id && typeof id === 'string' && id.startsWith('d-') && !updatedDebits.some(d => d.id === id)) {
        let targetFlat = null;
        if (flatNumHint) {
          targetFlat = updatedFlats.find(f => f.flatNum === flatNumHint);
        }
        if (!targetFlat) {
          targetFlat = updatedFlats.find(f => id.startsWith(`d-${f.flatNum}-`));
        }

        if (targetFlat) {
          const matchedFlatNum = targetFlat.flatNum;
          const prefix = `d-${matchedFlatNum}-`;
          const remainder = id.substring(prefix.length);
          const dateMatch = remainder.match(/(\d{4}-\d{2}(-\d{2})?)$/);
          const origDate = dateMatch ? dateMatch[1] : (updatedFields.date ? updatedFields.date.substring(0, 7) : '');
          const origAccount = dateMatch ? remainder.substring(0, remainder.length - origDate.length - 1) : (updatedFields.targetAccount || 'Közös Költség');

          const cancelledKeys = [
            `${origDate}_${origAccount}`,
            `${origDate}_${origAccount === 'Közös Költség' ? 'KK' : 'FA'}`,
            `${origDate}_${origAccount === 'KK' ? 'Közös Költség' : 'Felújítási Alap'}`
          ];

          updatedFlats = updatedFlats.map(f => {
            if (f.flatNum === matchedFlatNum) {
              const currentCancelled = f.cancelledDebits || [];
              const toAdd = cancelledKeys.filter(k => !currentCancelled.includes(k));
              return {
                ...f,
                cancelledDebits: [...currentCancelled, ...toAdd]
              };
            }
            return f;
          });

          const now = Date.now();
          const newManualDebit = {
            id: `deb-${now}-${Math.random().toString(36).substr(2, 5)}`,
            flatNum: matchedFlatNum,
            date: updatedFields.date || origDate,
            amount: Math.abs(Number(updatedFields.amount) || 0),
            targetAccount: updatedFields.targetAccount || origAccount,
            account: updatedFields.targetAccount || origAccount,
            comment: updatedFields.comment?.trim() || (updatedFields.targetAccount === 'Felújítási Alap' ? 'Havi előírás (Felújítási Alap)' : 'Havi előírás (Közös Költség)'),
            category: updatedFields.category || 'Other',
            includeInBalance: true,
            affectsBankBalance: updatedFields.affectsBankBalance !== undefined ? Boolean(updatedFields.affectsBankBalance) : Boolean(updatedFields.includeInBalance),
            includeInFlatBalance: updatedFields.includeInFlatBalance !== false,
            attachments: updatedFields.attachments || [],
            lastUpdated: now
          };

          updatedDebits = [newManualDebit, ...updatedDebits];
        }
      } else {
        const now = Date.now();
        const inExp = updatedExpenses.find(e => e.id === id);
        const inDeb = updatedDebits.find(d => d.id === id);
        const inTx = updatedTransactions.find(t => t.id === id);
        const currentItem = inExp || inDeb || inTx;

        const currentType = inExp ? 'Expense' : (inDeb ? 'Debit' : 'Payment');
        const targetType = type || currentType;

        const cleanAmount = Number(updatedFields.amount !== undefined ? updatedFields.amount : (currentItem?.amount || 0));

        // If targetType is the same as current collection: update in place
        if (targetType === currentType && currentItem) {
          if (currentType === 'Expense') {
            updatedExpenses = updatedExpenses.map(e => e.id === id ? {
              ...e,
              ...updatedFields,
              amount: Math.abs(cleanAmount),
              provider: updatedFields.title || updatedFields.provider || updatedFields.comment || e.provider || e.targetAccount,
              lastUpdated: now
            } : e);
          } else if (currentType === 'Debit') {
            updatedDebits = updatedDebits.map(d => d.id === id ? {
              ...d,
              ...updatedFields,
              amount: Math.abs(cleanAmount),
              lastUpdated: now
            } : d);
          } else {
            updatedTransactions = updatedTransactions.map(t => t.id === id ? {
              ...t,
              ...updatedFields,
              amount: cleanAmount,
              lastUpdated: now
            } : t);
          }
        } else {
          // Type is changing: remove from old collection and insert into new collection
          updatedExpenses = updatedExpenses.filter(e => e.id !== id);
          updatedDebits = updatedDebits.filter(d => d.id !== id);
          updatedTransactions = updatedTransactions.filter(t => t.id !== id);

          const baseMerged = { ...(currentItem || {}), ...updatedFields, lastUpdated: now };

          if (targetType === 'Expense') {
            const newExp = {
              id: id || `e-${now}`,
              date: baseMerged.date || new Date().toISOString().slice(0, 10),
              flatNum: baseMerged.flatNum || null,
              title: baseMerged.title || baseMerged.comment || 'Kiadás',
              provider: baseMerged.provider || baseMerged.title || baseMerged.comment || baseMerged.targetAccount || 'Közös Költség',
              targetAccount: baseMerged.targetAccount || 'Közös Költség',
              amount: Math.abs(cleanAmount),
              category: baseMerged.category || 'Utility',
              comment: baseMerged.comment || '',
              includeInBalance: baseMerged.includeInBalance !== false,
              affectsBankBalance: baseMerged.affectsBankBalance !== undefined ? Boolean(baseMerged.affectsBankBalance) : Boolean(baseMerged.includeInBalance),
              includeInFlatBalance: baseMerged.includeInFlatBalance !== false,
              attachments: baseMerged.attachments || [],
              lastUpdated: now
            };
            updatedExpenses = [newExp, ...updatedExpenses];
          } else if (targetType === 'Debit') {
            const newDebit = {
              id: id || `deb-${now}`,
              flatNum: baseMerged.flatNum || flatNumHint || 'Fsz 1',
              date: baseMerged.date || new Date().toISOString().slice(0, 10),
              targetAccount: baseMerged.targetAccount || 'Közös Költség',
              amount: Math.abs(cleanAmount),
              category: baseMerged.category || 'Assessment',
              title: baseMerged.title || baseMerged.comment || 'Előírás / Terhelés',
              comment: baseMerged.comment || 'Előírás / Terhelés',
              includeInBalance: true,
              affectsBankBalance: baseMerged.affectsBankBalance !== undefined ? Boolean(baseMerged.affectsBankBalance) : Boolean(baseMerged.includeInBalance),
              includeInFlatBalance: baseMerged.includeInFlatBalance !== false,
              attachments: baseMerged.attachments || [],
              lastUpdated: now
            };
            updatedDebits = [newDebit, ...updatedDebits];
          } else {
            // targetType === 'Payment'
            const newTx = {
              id: id || `t-${now}`,
              date: baseMerged.date || new Date().toISOString().slice(0, 10),
              flatNum: baseMerged.flatNum || flatNumHint || 'Fsz 1',
              targetAccount: baseMerged.targetAccount || 'Közös Költség',
              amount: cleanAmount,
              status: 'Verified',
              method: baseMerged.method || baseMerged.category || 'Bank Transfer',
              comment: baseMerged.comment || 'Befizetés',
              includeInBalance: baseMerged.includeInBalance !== false,
              affectsBankBalance: baseMerged.affectsBankBalance !== undefined ? Boolean(baseMerged.affectsBankBalance) : Boolean(baseMerged.includeInBalance),
              includeInFlatBalance: baseMerged.includeInFlatBalance !== false,
              attachments: baseMerged.attachments || [],
              lastUpdated: now
            };
            updatedTransactions = [newTx, ...updatedTransactions];
          }
        }
      }

      return {
        ...s,
        transactions: updatedTransactions,
        expenses: updatedExpenses,
        manualDebits: updatedDebits,
        flats: updatedFlats
      };
    }, true);
    showToast(state.currentLang === 'en' ? "Item updated!" : "Tétel módosítva!");
  };

  // Delete Item (Payment, Expense, or ManualDebit / Recurring Prescription)
  const deleteItem = (id, type, flatNum = null, date = null, account = null) => {
    if (!requireAdmin()) return;
    const deletedTx = (state.transactions || []).find(t => t.id === id);
    const deletedExp = (state.expenses || []).find(e => e.id === id);
    const deletedDebit = (state.manualDebits || []).find(d => d.id === id);

    let affectedFlatNum = null;
    let addedCancelledKeys = [];

    const vault = getPermanentVault();
    if (id) {
      vault.deletedIds = vault.deletedIds || [];
      if (!vault.deletedIds.includes(id)) {
        vault.deletedIds.push(id);
        savePermanentVault(vault);
      }
    }

    persistState(s => {
      let updatedFlats = s.flats || [];

      // Check if it's a recurring prescription (starts with "d-")
      if (id && typeof id === 'string' && id.startsWith('d-') && !(s.manualDebits || []).some(d => d.id === id)) {
        let targetFlat = null;
        if (flatNum) {
          targetFlat = updatedFlats.find(f => f.flatNum === flatNum);
        }
        if (!targetFlat) {
          targetFlat = updatedFlats.find(f => id.startsWith(`d-${f.flatNum}-`));
        }

        if (targetFlat) {
          const matchedFlatNum = targetFlat.flatNum;
          affectedFlatNum = matchedFlatNum;
          const prefix = `d-${matchedFlatNum}-`;
          const remainder = id.substring(prefix.length);
          const dateMatch = remainder.match(/(\d{4}-\d{2}(-\d{2})?)$/);
          const origDate = dateMatch ? dateMatch[1] : (date || '');
          const origAccount = dateMatch ? remainder.substring(0, remainder.length - origDate.length - 1) : (account || 'Közös Költség');

          const cancelledKeys = [
            `${origDate}_${origAccount}`,
            `${origDate}_${origAccount === 'Közös Költség' ? 'KK' : 'FA'}`,
            `${origDate}_${origAccount === 'KK' ? 'Közös Költség' : 'Felújítási Alap'}`
          ];

          updatedFlats = updatedFlats.map(f => {
            if (f.flatNum === matchedFlatNum) {
              const currentCancelled = f.cancelledDebits || [];
              const toAdd = cancelledKeys.filter(k => !currentCancelled.includes(k));
              addedCancelledKeys = toAdd;
              return {
                ...f,
                cancelledDebits: [...currentCancelled, ...toAdd]
              };
            }
            return f;
          });
        }
      } else if (type === "Debit" && !id && flatNum && date && account) {
        affectedFlatNum = flatNum;
        const key = `${date}_${account}`;
        addedCancelledKeys = [key];
        updatedFlats = updatedFlats.map(f => {
          if (f.flatNum === flatNum) {
            const cancelled = f.cancelledDebits || [];
            return {
              ...f,
              cancelledDebits: cancelled.includes(key) ? cancelled : [...cancelled, key]
            };
          }
          return f;
        });
      }

      return {
        ...s,
        transactions: (s.transactions || []).filter(t => t.id !== id),
        expenses: (s.expenses || []).filter(e => e.id !== id),
        manualDebits: (s.manualDebits || []).filter(d => d.id !== id),
        flats: updatedFlats
      };
    });

    const handleUndo = () => {
      if (id) {
        const currentVault = getPermanentVault();
        if (currentVault.deletedIds && currentVault.deletedIds.includes(id)) {
          currentVault.deletedIds = currentVault.deletedIds.filter(x => x !== id);
          savePermanentVault(currentVault);
        }
      }

      persistState(s => {
        let restoredFlats = s.flats || [];
        if (affectedFlatNum && addedCancelledKeys.length > 0) {
          restoredFlats = restoredFlats.map(f => {
            if (f.flatNum === affectedFlatNum) {
              const currentCancelled = f.cancelledDebits || [];
              return {
                ...f,
                cancelledDebits: currentCancelled.filter(k => !addedCancelledKeys.includes(k))
              };
            }
            return f;
          });
        }

        return {
          ...s,
          transactions: deletedTx && !(s.transactions || []).some(t => t.id === deletedTx.id)
            ? [deletedTx, ...(s.transactions || [])]
            : (s.transactions || []),
          expenses: deletedExp && !(s.expenses || []).some(e => e.id === deletedExp.id)
            ? [deletedExp, ...(s.expenses || [])]
            : (s.expenses || []),
          manualDebits: deletedDebit && !(s.manualDebits || []).some(d => d.id === deletedDebit.id)
            ? [deletedDebit, ...(s.manualDebits || [])]
            : (s.manualDebits || []),
          flats: restoredFlats
        };
      }, true);

      showToast(state.currentLang === 'en' ? "Deletion undone!" : "Törlés visszavonva!", "info");
    };

    const isEn = state.currentLang === 'en';
    showToast(isEn ? "Item deleted successfully!" : "Tétel sikeresen törölve!", 'success', handleUndo);
  };

  // Set Global Balances (supports KK, FA, and dynamic custom accounts)
  const setGlobalBalances = async (currentCommon, currentRenovation, customBalances = {}, customBankAccountsList = null) => {
    if (!requireAdmin()) return null;
    if (ensureFirebaseAuth) await ensureFirebaseAuth();
    const updatedState = await persistState(s => {
      const isBankTx = tx => tx.affectsBankBalance !== false && tx.method !== "Készpénz" && tx.method !== "Cash" && tx.method !== "Cash Offset";

      const totalPaymentsKK = (s.transactions || [])
        .filter(t => t.status === "Verified" && (t.targetAccount === "Közös Költség" || (!t.targetAccount && t.targetAccount !== "Felújítási Alap")) && t.includeInBalance !== false && t.type !== "Correction" && isBankTx(t))
        .reduce((acc, t) => acc + t.amount, 0);
      const totalExpensesKK = (s.expenses || [])
        .filter(e => (e.targetAccount === "Közös Költség" || (!e.targetAccount && e.provider !== "Felújítási Alap")) && e.includeInBalance !== false && isBankTx(e))
        .reduce((acc, e) => acc + e.amount, 0);

      const totalPaymentsFA = (s.transactions || [])
        .filter(t => t.status === "Verified" && t.targetAccount === "Felújítási Alap" && t.includeInBalance !== false && t.type !== "Correction" && isBankTx(t))
        .reduce((acc, t) => acc + t.amount, 0);
      const totalExpensesFA = (s.expenses || [])
        .filter(e => (e.targetAccount === "Felújítási Alap" || (!e.targetAccount && e.provider === "Felújítási Alap")) && e.includeInBalance !== false && isBankTx(e))
        .reduce((acc, e) => acc + e.amount, 0);

      const numCommon = Number(currentCommon) || 0;
      const numRenov = Number(currentRenovation) || 0;

      const newInitKK = Math.round(numCommon - totalPaymentsKK + totalExpensesKK);
      const newInitFA = Math.round(numRenov - totalPaymentsFA + totalExpensesFA);

      const now = Date.now();
      const targetBuildingId = s.currentBuildingId || (s.buildings && s.buildings[0] && s.buildings[0].id);

      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.id === targetBuildingId) {
          const rawCustomList = customBankAccountsList !== null ? customBankAccountsList : (b.customBankAccounts || []);
          const updatedCustom = rawCustomList.map(acc => {
            if (customBalances && customBalances[acc.id] !== undefined) {
              const numVal = Number(customBalances[acc.id]) || 0;
              const totalPaymentsAcc = (s.transactions || [])
                .filter(t => t.status === "Verified" && (t.targetAccount === acc.name || t.targetAccount === acc.id) && t.includeInBalance !== false && t.type !== "Correction" && isBankTx(t))
                .reduce((accP, t) => accP + t.amount, 0);
              const totalExpensesAcc = (s.expenses || [])
                .filter(e => (e.targetAccount === acc.name || e.targetAccount === acc.id) && e.includeInBalance !== false && isBankTx(e))
                .reduce((accE, e) => accE + e.amount, 0);
              const newInit = Math.round(numVal - totalPaymentsAcc + totalExpensesAcc);
              return { ...acc, initialReserve: newInit };
            }
            return acc;
          });

          return {
            ...b,
            buildingInitialReserveCommon: newInitKK,
            buildingInitialReserveRenovation: newInitFA,
            customBankAccounts: updatedCustom,
            lastUpdated: now
          };
        }
        return b;
      });

      return {
        ...s,
        buildings: updatedBuildings,
        buildingInitialReserveCommon: newInitKK,
        buildingInitialReserveRenovation: newInitFA,
        lastUpdated: now
      };
    }, true);
    showToast(t.balances_updated || (state.currentLang === 'en' ? "Account balances successfully updated!" : "Számlafőösszegek sikeresen beállítva!"));
    return updatedState;
  };

  // Update Flat Fee, Balances and FeeChanges
  const updateFlatFees = (flatNum, newMonthlyFee, newRenovationFee, newBalance = null, newRenovationBalance = null, customFees = {}, customBalances = {}) => {
    if (!requireAdmin()) return;
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentMonthStr = `${curYear}-${curMonth}-01`;

    persistState(s => {
      const updatedFlats = (s.flats || []).map(flat => {
        if (flat.flatNum !== flatNum) return flat;

        const updated = { ...flat };

        if (newMonthlyFee !== undefined && newMonthlyFee !== null && newMonthlyFee !== '' && !isNaN(Number(newMonthlyFee))) {
          const numFee = Math.round(Number(newMonthlyFee));
          let changesKK = [...(updated.feeChangesKK || [])];
          let foundCurrent = false;
          changesKK = changesKK.map(c => {
            if (c.date >= currentMonthStr) {
              if (c.date === currentMonthStr) foundCurrent = true;
              return { ...c, amount: numFee };
            }
            return c;
          });
          if (!foundCurrent) {
            changesKK.push({ amount: numFee, date: currentMonthStr });
          }
          changesKK.sort((a, b) => new Date(a.date) - new Date(b.date));
          updated.feeChangesKK = changesKK;
          updated.monthlyFee = numFee;
        }

        if (newRenovationFee !== undefined && newRenovationFee !== null && newRenovationFee !== '' && !isNaN(Number(newRenovationFee))) {
          const numFee = Math.round(Number(newRenovationFee));
          let changesFA = [...(updated.feeChangesFA || [])];
          let foundCurrent = false;
          changesFA = changesFA.map(c => {
            if (c.date >= currentMonthStr) {
              if (c.date === currentMonthStr) foundCurrent = true;
              return { ...c, amount: numFee };
            }
            return c;
          });
          if (!foundCurrent) {
            changesFA.push({ amount: numFee, date: currentMonthStr });
          }
          changesFA.sort((a, b) => new Date(a.date) - new Date(b.date));
          updated.feeChangesFA = changesFA;
          updated.renovationFee = numFee;
        }

        // Custom fees
        if (customFees && typeof customFees === 'object') {
          const nextCustomFees = { ...(updated.customFees || {}) };
          Object.keys(customFees).forEach(accId => {
            const val = customFees[accId];
            if (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) {
              nextCustomFees[accId] = Math.round(Number(val));
            }
          });
          updated.customFees = nextCustomFees;
        }

        const stateWithUpdatedFlat = {
          ...s,
          flats: (s.flats || []).map(f => f.flatNum === flatNum ? updated : f)
        };

        if (newBalance !== undefined && newBalance !== null && newBalance !== '' && !isNaN(Number(newBalance))) {
          const numBal = Math.round(Number(newBalance));
          const tlKK = getFlatLedgerTimeline(flatNum, "Közös Költség", stateWithUpdatedFlat);
          const itemsSumKK = tlKK.reduce((sum, item) => sum + (item.includeInFlatBalance !== false ? item.amount : 0), 0);
          updated.initialBalance = Math.round(numBal - itemsSumKK);
          updated.balance = numBal;
        }

        if (newRenovationBalance !== undefined && newRenovationBalance !== null && newRenovationBalance !== '' && !isNaN(Number(newRenovationBalance))) {
          const numRenovBal = Math.round(Number(newRenovationBalance));
          const tlFA = getFlatLedgerTimeline(flatNum, "Felújítási Alap", stateWithUpdatedFlat);
          const itemsSumFA = tlFA.reduce((sum, item) => sum + (item.includeInFlatBalance !== false ? item.amount : 0), 0);
          updated.initialRenovationBalance = Math.round(numRenovBal - itemsSumFA);
          updated.renovationBalance = numRenovBal;
        }

        // Custom balances
        if (customBalances && typeof customBalances === 'object') {
          const nextCustomInitBalances = { ...(updated.customInitialBalances || {}) };
          const nextCustomBalances = { ...(updated.customBalances || {}) };
          Object.keys(customBalances).forEach(accId => {
            const val = customBalances[accId];
            if (val !== undefined && val !== null && val !== '' && !isNaN(Number(val))) {
              const numBal = Math.round(Number(val));
              const tlCustom = getFlatLedgerTimeline(flatNum, accId, stateWithUpdatedFlat);
              const itemsSum = tlCustom.reduce((sum, item) => sum + (item.includeInFlatBalance !== false ? item.amount : 0), 0);
              nextCustomInitBalances[accId] = Math.round(numBal - itemsSum);
              nextCustomBalances[accId] = numBal;
            }
          });
          updated.customInitialBalances = nextCustomInitBalances;
          updated.customBalances = nextCustomBalances;
        }

        return updated;
      });

      return {
        ...s,
        flats: updatedFlats
      };
    }, true);
    showToast(state.currentLang === 'en' ? "Flat finances updated!" : "Lakás egyenlegek és előírások frissítve!");
  };

  return {
    addTransaction,
    addExpense,
    addManualDebit,
    addMultipleItems,
    copyTransaction,
    pasteTransaction,
    editItem,
    deleteItem,
    setGlobalBalances,
    updateFlatFees
  };
}
