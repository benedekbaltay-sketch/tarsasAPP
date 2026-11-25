import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Landmark,
  Lock,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  Save,
  Loader2,
} from 'lucide-react';
import {
  getBuildingReserve,
  getBuildingRenovationFund,
  getBuildingAccountReserve,
  parseCleanNumber,
  formatCurrency,
} from '../utils/finances';
import {
  resolveUserOrgContext,
  canUserEditBankAccountNumbers,
  detectBankAccountChanges,
  buildBankChangeNotification,
  findOrganizationForBuilding,
} from '../utils/teamPermissions';

/**
 * Unified collapsible "Számlák" (Accounts) management section.
 * Lists KK, FA, and all additional sub-accounts in a single collapsible list.
 * Strictly locks EVERY bank account field (name, bank, account number, balance, add, delete)
 * when the user does not have bank account editing permission or is read-only.
 */
export function BankAccountsSection({ buildingId = null, isReadOnly = false }) {
  const { state, t, persistState, showToast, canUserManageBuilding } = useApp();
  const { currentLang, buildings, currentBuildingId } = state;
  const isEn = currentLang === 'en';

  const targetBuildingId =
    typeof buildingId === 'string' && buildingId.trim()
      ? buildingId
      : currentBuildingId || (buildings && buildings[0] && buildings[0].id);
  const targetBuilding = (buildings || []).find((b) => b.id === targetBuildingId) || buildings?.[0];

  const isEffectiveReadOnly = Boolean(
    isReadOnly ||
      (targetBuilding && canUserManageBuilding && !canUserManageBuilding(targetBuilding?.id || targetBuilding))
  );

  const orgCtx = resolveUserOrgContext(state.currentUser, state.organizations, buildings);
  const canEditBankAcc = canUserEditBankAccountNumbers(
    state.currentUser,
    targetBuilding,
    state.organizations,
    buildings
  );
  const isBankLocked = !canEditBankAcc || isEffectiveReadOnly;

  // Primary Bank Accounts (KK & FA)
  const [bankKKName, setBankKKName] = useState('');
  const [bankKKAccount, setBankKKAccount] = useState('');
  const [bankKKBank, setBankKKBank] = useState('OTP');

  const [bankFAName, setBankFAName] = useState('');
  const [bankFAAccount, setBankFAAccount] = useState('');
  const [bankFABank, setBankFABank] = useState('OTP');

  // Balances & additional accounts
  const [commonBalance, setCommonBalance] = useState('');
  const [renovationBalance, setRenovationBalance] = useState('');
  const [customAccounts, setCustomAccounts] = useState([]);
  const [customBalances, setCustomBalances] = useState({});

  // Expandable state & add-new form
  const [expandedAccountIds, setExpandedAccountIds] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [newBeneficiary, setNewBeneficiary] = useState('');
  const [newAccountNum, setNewAccountNum] = useState('');
  const [newBank, setNewBank] = useState('OTP');
  const [newHasMonthlyFee, setNewHasMonthlyFee] = useState(false);
  const [newInitialBalance, setNewInitialBalance] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const toggleAccountExpanded = (accKey) => {
    setExpandedAccountIds((prev) => ({ ...prev, [accKey]: !prev[accKey] }));
  };

  const resetNewAccountForm = () => {
    setNewName('');
    setNewShortName('');
    setNewBeneficiary(targetBuilding?.name || '');
    setNewAccountNum('');
    setNewBank('OTP');
    setNewHasMonthlyFee(false);
    setNewInitialBalance('');
  };

  useEffect(() => {
    if (!targetBuilding) return;
    setBankKKName(targetBuilding.bankKK?.name || targetBuilding.name || '');
    setBankKKAccount(targetBuilding.bankKK?.account || '');
    setBankKKBank(targetBuilding.bankKK?.bank || 'OTP');

    setBankFAName(targetBuilding.bankFA?.name || targetBuilding.name || '');
    setBankFAAccount(targetBuilding.bankFA?.account || '');
    setBankFABank(targetBuilding.bankFA?.bank || 'OTP');

    const curKK = getBuildingReserve({ ...state, currentBuildingId: targetBuilding.id });
    const curFA = getBuildingRenovationFund({ ...state, currentBuildingId: targetBuilding.id });
    setCommonBalance(Math.round(curKK).toString());
    setRenovationBalance(Math.round(curFA).toString());

    const rawCustom = (targetBuilding.customBankAccounts || []).map((a) => ({ ...a }));
    setCustomAccounts(rawCustom);

    const initialCustomBalances = {};
    rawCustom.forEach((acc) => {
      const curRes = getBuildingAccountReserve(acc.id, { ...state, currentBuildingId: targetBuilding.id });
      initialCustomBalances[acc.id] = Math.round(curRes).toString();
    });
    setCustomBalances(initialCustomBalances);
    setIsAddingNew(false);
    setIsDirty(false);
    resetNewAccountForm();
  }, [targetBuildingId, targetBuilding?.bankKK?.account, targetBuilding?.bankFA?.account, targetBuilding?.customBankAccounts?.length]);

  if (!targetBuilding) return null;

  const isBankTx = (tx) =>
    tx.affectsBankBalance !== false &&
    tx.method !== 'Készpénz' &&
    tx.method !== 'Cash' &&
    tx.method !== 'Cash Offset';

  const buildingTxs = (state.transactions || []).filter((tx) => !tx.buildingId || tx.buildingId === targetBuildingId);
  const buildingExpenses = (state.expenses || []).filter((ex) => !ex.buildingId || ex.buildingId === targetBuildingId);

  const totalPaymentsKK = buildingTxs
    .filter(
      (tx) =>
        tx.status === 'Verified' &&
        (tx.targetAccount === 'Közös Költség' || (!tx.targetAccount && tx.targetAccount !== 'Felújítási Alap')) &&
        tx.includeInBalance !== false &&
        tx.type !== 'Correction' &&
        isBankTx(tx)
    )
    .reduce((acc, tx) => acc + tx.amount, 0);
  const totalExpensesKK = buildingExpenses
    .filter(
      (ex) =>
        (ex.targetAccount === 'Közös Költség' || (!ex.targetAccount && ex.provider !== 'Felújítási Alap')) &&
        ex.includeInBalance !== false &&
        isBankTx(ex)
    )
    .reduce((acc, ex) => acc + ex.amount, 0);

  const totalPaymentsFA = buildingTxs
    .filter(
      (tx) =>
        tx.status === 'Verified' &&
        tx.targetAccount === 'Felújítási Alap' &&
        tx.includeInBalance !== false &&
        tx.type !== 'Correction' &&
        isBankTx(tx)
    )
    .reduce((acc, tx) => acc + tx.amount, 0);
  const totalExpensesFA = buildingExpenses
    .filter(
      (ex) =>
        (ex.targetAccount === 'Felújítási Alap' || (!ex.targetAccount && ex.provider === 'Felújítási Alap')) &&
        ex.includeInBalance !== false &&
        isBankTx(ex)
    )
    .reduce((acc, ex) => acc + ex.amount, 0);

  const cleanCommon = parseCleanNumber(commonBalance);
  const cleanRenovation = parseCleanNumber(renovationBalance);
  const calculatedInitKK = Math.round(cleanCommon - totalPaymentsKK + totalExpensesKK);
  const calculatedInitFA = Math.round(cleanRenovation - totalPaymentsFA + totalExpensesFA);

  const getCustomAccountTxTotals = (acc) => {
    const payments = buildingTxs
      .filter(
        (tx) =>
          tx.status === 'Verified' &&
          (tx.targetAccount === acc.name || tx.targetAccount === acc.id) &&
          tx.includeInBalance !== false &&
          tx.type !== 'Correction' &&
          isBankTx(tx)
      )
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expenses = buildingExpenses
      .filter(
        (ex) =>
          (ex.targetAccount === acc.name || ex.targetAccount === acc.id) &&
          ex.includeInBalance !== false &&
          isBankTx(ex)
      )
      .reduce((sum, ex) => sum + ex.amount, 0);
    return { payments, expenses };
  };

  const handleAddNewAccount = () => {
    if (isBankLocked || !newName.trim()) return;
    const newId = `acc-${Date.now()}`;
    const cleanBal = parseCleanNumber(newInitialBalance);
    const shortName = newShortName.trim() || (newName.trim().length > 5 ? newName.trim().slice(0, 4) : newName.trim());
    const newAcc = {
      id: newId,
      name: newName.trim(),
      shortName,
      account: newAccountNum.trim(),
      bank: newBank.trim() || 'OTP',
      beneficiary: newBeneficiary.trim() || targetBuilding?.name || '',
      hasMonthlyFee: Boolean(newHasMonthlyFee),
      initialReserve: cleanBal,
      color: 'emerald',
    };
    setCustomAccounts((prev) => [...prev, newAcc]);
    setCustomBalances((prev) => ({ ...prev, [newId]: cleanBal.toString() }));
    setExpandedAccountIds((prev) => ({ ...prev, [newId]: true }));
    setIsAddingNew(false);
    setIsDirty(true);
    resetNewAccountForm();
  };

  const handleDeleteCustomAccount = (accId) => {
    if (isBankLocked) return;
    setCustomAccounts((prev) => prev.filter((a) => a.id !== accId));
    setCustomBalances((prev) => {
      const copy = { ...prev };
      delete copy[accId];
      return copy;
    });
    setIsDirty(true);
  };

  const handleSaveAccounts = async () => {
    if (isBankLocked || isSaving) return;
    setIsSaving(true);
    try {
      const updatedCustomAccounts = customAccounts.map((acc) => {
        const numVal = parseCleanNumber(customBalances[acc.id]);
        const txTotals = getCustomAccountTxTotals(acc);
        const newInit = Math.round(numVal - txTotals.payments + txTotals.expenses);
        return {
          ...acc,
          name: String(acc.name || '').trim() || acc.name,
          bank: String(acc.bank || '').trim() || 'OTP',
          account: String(acc.account || '').trim(),
          initialReserve: newInit,
        };
      });

      const nextBankKK = {
        name: bankKKName.trim() || targetBuilding?.name || '',
        account: bankKKAccount.trim(),
        bank: bankKKBank.trim() || 'OTP',
      };
      const nextBankFA = {
        name: bankFAName.trim() || targetBuilding?.name || '',
        account: bankFAAccount.trim(),
        bank: bankFABank.trim() || 'OTP',
      };

      const bankAccountChanges = detectBankAccountChanges(
        targetBuilding,
        nextBankKK,
        nextBankFA,
        updatedCustomAccounts
      );

      let criticalOwnerNotification = null;
      if (bankAccountChanges.length > 0 && orgCtx.isStaff) {
        const ownerOrg = orgCtx.org || findOrganizationForBuilding(targetBuilding, state.organizations);
        const ownerEmail = orgCtx.ownerEmail || ownerOrg?.ownerEmail || '';
        if (ownerEmail) {
          criticalOwnerNotification = buildBankChangeNotification({
            actorUser: state.currentUser,
            ownerEmail,
            building: targetBuilding,
            changes: bankAccountChanges,
          });
        }
      }

      await persistState((s) => ({
        ...s,
        buildings: (s.buildings || []).map((b) =>
          b.id === targetBuildingId
            ? {
                ...b,
                bankKK: nextBankKK,
                bankFA: nextBankFA,
                buildingInitialReserveCommon: calculatedInitKK,
                buildingInitialReserveRenovation: calculatedInitFA,
                customBankAccounts: updatedCustomAccounts,
              }
            : b
        ),
        notifications: criticalOwnerNotification
          ? [criticalOwnerNotification, ...(s.notifications || [])].slice(0, 300)
          : s.notifications || [],
      }));

      setIsDirty(false);
      showToast(
        t.bank_accounts_saved_toast ||
          (isEn ? 'Bank accounts & reserves saved!' : 'A bankszámlák és tartalékok adatai sikeresen elmentve!')
      );
    } catch (err) {
      console.error('Failed to save bank accounts:', err);
      showToast(
        isEn ? 'Failed to save bank accounts. Please try again.' : 'Hiba történt a számlák mentése során.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-bold text-[#1E3A8A] text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Landmark className="w-4 h-4" />
            <span>{isEn ? 'Accounts' : 'Számlák'}</span>
          </h4>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-[#1E3A8A] border border-blue-100 text-[10px] font-bold">
            {2 + customAccounts.length}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isBankLocked ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
              <Lock className="w-3 h-3" />
              <span>{isEn ? 'Bank accounts locked by Owner' : 'Bankszámlák módosítása zárolva'}</span>
            </span>
          ) : orgCtx.isStaff ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
              <AlertTriangle className="w-3 h-3" />
              <span>
                {t.team_bank_alert_badge ||
                  (isEn
                    ? 'Owner is notified of account number changes'
                    : 'Számlaszám-módosításról a tulajdonos értesítést kap')}
              </span>
            </span>
          ) : null}

          {!isAddingNew && !isBankLocked && (
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isEn ? 'New Account' : 'Új számla'}</span>
            </button>
          )}

          {!isBankLocked && isDirty && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAccounts}
              className="px-3 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{t.save || (isEn ? 'Save' : 'Mentés')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. KK Account (Collapsible) */}
      <div className="rounded-xl border border-blue-200/70 bg-blue-50/30 overflow-hidden transition-colors">
        <button
          type="button"
          onClick={() => toggleAccountExpanded('kk')}
          className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-blue-50/70 transition-colors cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#1E3A8A] text-xs">
                {t.account_common || 'Közös Költség (KK) Főszámla'}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-[#1E3A8A] font-bold text-[10px]">
                {bankKKBank || 'OTP'}
              </span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
              {bankKKAccount || (isEn ? 'No account number set' : 'Nincs számlaszám megadva')}
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-bold text-gray-900">{formatCurrency(cleanCommon)}</span>
            <ChevronDown
              className={`w-4 h-4 text-[#1E3A8A] transition-transform duration-200 ${
                expandedAccountIds['kk'] ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {expandedAccountIds['kk'] && (
          <div className="px-3.5 pb-3.5 pt-2.5 border-t border-blue-100 space-y-3 bg-white/60 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 mb-0.5">
                  <span>{isEn ? 'Account Name' : 'Számla elnevezése'}</span>
                  {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </label>
                <input
                  type="text"
                  value={bankKKName}
                  disabled={isBankLocked}
                  onChange={(e) => {
                    setBankKKName(e.target.value);
                    setIsDirty(true);
                  }}
                  className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] ${
                    isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 mb-0.5">
                  <span>{t.bank_provider_label || (isEn ? 'Account-Holding Bank' : 'Számlavezető bank')}</span>
                  {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </label>
                <input
                  type="text"
                  value={bankKKBank}
                  disabled={isBankLocked}
                  onChange={(e) => {
                    setBankKKBank(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="OTP Bank"
                  className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] ${
                    isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 mb-0.5">
                  <span>{isEn ? 'Bank Account Number' : 'Bankszámlaszám'}</span>
                  {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </label>
                <input
                  type="text"
                  value={bankKKAccount}
                  disabled={isBankLocked}
                  onChange={(e) => {
                    setBankKKAccount(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="11700000 00000000"
                  className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A] ${
                    isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 mb-0.5">
                  <span>{t.current_bank_balance || 'Jelenlegi banki egyenleg'} (Ft)</span>
                  {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </label>
                <input
                  type="text"
                  value={commonBalance}
                  disabled={isBankLocked}
                  onChange={(e) => {
                    setCommonBalance(e.target.value);
                    setIsDirty(true);
                  }}
                  className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-[#1E3A8A] ${
                    isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                  }`}
                />
              </div>
            </div>

            <div className="text-[10px] text-gray-500 bg-white p-2 rounded-lg flex items-center justify-between flex-wrap gap-1 border border-blue-100">
              <span>
                {t.calculated_initial_reserve || 'Kiszámított induló tartalék'}: <b>{formatCurrency(calculatedInitKK)}</b>
              </span>
              <span className="text-gray-400">
                ({formatCurrency(cleanCommon)} - {formatCurrency(totalPaymentsKK)} + {formatCurrency(totalExpensesKK)})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. FA Account (Collapsible) */}
      <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/30 overflow-hidden transition-colors">
        <button
          type="button"
          onClick={() => toggleAccountExpanded('fa')}
          className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-emerald-50/70 transition-colors cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-emerald-800 text-xs">
                {t.account_renovation || 'Felújítási Alap (FA) Számla'}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                {bankFABank || 'OTP'}
              </span>
            </div>
            <div className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
              {bankFAAccount || (isEn ? 'No account number set' : 'Nincs számlaszám megadva')}
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs font-bold text-gray-900">{formatCurrency(cleanRenovation)}</span>
            <ChevronDown
              className={`w-4 h-4 text-emerald-700 transition-transform duration-200 ${
                expandedAccountIds['fa'] ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {expandedAccountIds['fa'] && (
          <div className="px-3.5 pb-3.5 pt-2.5 border-t border-emerald-100 space-y-3 bg-white/60 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 mb-0.5">
                  <span>{isEn ? 'Account Name' : 'Számla elnevezése'}</span>
                  {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </label>
                <input
                  type="text"
                  value={bankFAName}
                  disabled={isBankLocked}
                  onChange={(e) => {
                    setBankFAName(e.target.value);
                    setIsDirty(true);
                  }}
                  className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-600 ${
                    isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 mb-0.5">
                  <span>{t.bank_provider_label || (isEn ? 'Account-Holding Bank' : 'Számlavezető bank')}</span>
                  {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </label>
                <input
                  type="text"
                  value={bankFABank}
                  disabled={isBankLocked}
                  onChange={(e) => {
                    setBankFABank(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="OTP Bank"
                  className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-600 ${
                    isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 mb-0.5">
                  <span>{isEn ? 'Bank Account Number' : 'Bankszámlaszám'}</span>
                  {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </label>
                <input
                  type="text"
                  value={bankFAAccount}
                  disabled={isBankLocked}
                  onChange={(e) => {
                    setBankFAAccount(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="11700000 00000000"
                  className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-600 ${
                    isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-gray-600 mb-0.5">
                  <span>{t.current_bank_balance || 'Jelenlegi banki egyenleg'} (Ft)</span>
                  {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                </label>
                <input
                  type="text"
                  value={renovationBalance}
                  disabled={isBankLocked}
                  onChange={(e) => {
                    setRenovationBalance(e.target.value);
                    setIsDirty(true);
                  }}
                  className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-600 ${
                    isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                  }`}
                />
              </div>
            </div>

            <div className="text-[10px] text-gray-500 bg-white p-2 rounded-lg flex items-center justify-between flex-wrap gap-1 border border-emerald-100">
              <span>
                {t.calculated_initial_reserve || 'Kiszámított induló tartalék'}: <b>{formatCurrency(calculatedInitFA)}</b>
              </span>
              <span className="text-gray-400">
                ({formatCurrency(cleanRenovation)} - {formatCurrency(totalPaymentsFA)} + {formatCurrency(totalExpensesFA)})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Additional Accounts (Collapsible, same unified design) */}
      {customAccounts.map((acc) => {
        const cleanVal = parseCleanNumber(customBalances[acc.id]);
        const txTotals = getCustomAccountTxTotals(acc);
        const calcInit = Math.round(cleanVal - txTotals.payments + txTotals.expenses);
        const isExpanded = Boolean(expandedAccountIds[acc.id]);

        return (
          <div key={acc.id} className="rounded-xl border border-gray-200 bg-gray-50/70 overflow-hidden transition-colors">
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleAccountExpanded(acc.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleAccountExpanded(acc.id);
                }
              }}
              className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-100/70 transition-colors cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-xs">{acc.name}</span>
                  {acc.bank && (
                    <span className="px-2 py-0.5 rounded bg-gray-200/90 text-gray-700 font-bold text-[10px]">
                      {acc.bank}
                    </span>
                  )}
                  {acc.hasMonthlyFee && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                      {isEn ? 'Monthly fee enabled' : 'Havi előírással'}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 font-mono truncate mt-0.5">
                  {acc.account || (isEn ? 'No account number set' : 'Nincs számlaszám megadva')}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-gray-900">{formatCurrency(cleanVal)}</span>
                {!isBankLocked && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomAccount(acc.id);
                    }}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    title={t.delete || (isEn ? 'Delete' : 'Törlés')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            {isExpanded && (
              <div className="px-3.5 pb-3.5 pt-2.5 border-t border-gray-200/80 space-y-3 bg-white/80 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="text-[11px] text-gray-600 flex items-center gap-1 font-semibold mb-0.5">
                      <span>{isEn ? 'Account Name' : 'Számla elnevezése'}</span>
                      {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                    </label>
                    <input
                      type="text"
                      value={acc.name || ''}
                      disabled={isBankLocked}
                      onChange={(e) => {
                        setCustomAccounts((prev) =>
                          prev.map((item) => (item.id === acc.id ? { ...item, name: e.target.value } : item))
                        );
                        setIsDirty(true);
                      }}
                      className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] ${
                        isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 flex items-center gap-1 font-semibold mb-0.5">
                      <span>{t.bank_provider_label || (isEn ? 'Account-Holding Bank' : 'Számlavezető bank')}</span>
                      {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                    </label>
                    <input
                      type="text"
                      value={acc.bank || ''}
                      disabled={isBankLocked}
                      onChange={(e) => {
                        setCustomAccounts((prev) =>
                          prev.map((item) => (item.id === acc.id ? { ...item, bank: e.target.value } : item))
                        );
                        setIsDirty(true);
                      }}
                      className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] ${
                        isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 flex items-center gap-1 font-semibold mb-0.5">
                      <span>{isEn ? 'Bank Account Number' : 'Bankszámlaszám'}</span>
                      {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                    </label>
                    <input
                      type="text"
                      value={acc.account || ''}
                      disabled={isBankLocked}
                      onChange={(e) => {
                        setCustomAccounts((prev) =>
                          prev.map((item) => (item.id === acc.id ? { ...item, account: e.target.value } : item))
                        );
                        setIsDirty(true);
                      }}
                      placeholder="11700000 00000000"
                      className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A] ${
                        isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-600 flex items-center gap-1 font-semibold mb-0.5">
                      <span>{t.current_bank_balance || 'Jelenlegi banki egyenleg'} (Ft)</span>
                      {isBankLocked && <Lock className="w-2.5 h-2.5 text-amber-600" />}
                    </label>
                    <input
                      type="text"
                      value={customBalances[acc.id] !== undefined ? customBalances[acc.id] : ''}
                      disabled={isBankLocked}
                      onChange={(e) => {
                        setCustomBalances((prev) => ({ ...prev, [acc.id]: e.target.value }));
                        setIsDirty(true);
                      }}
                      className={`w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-[#1E3A8A] ${
                        isBankLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'
                      }`}
                    />
                  </div>
                </div>

                <div className="text-[10px] text-gray-500 bg-white p-2 rounded-lg flex items-center justify-between flex-wrap gap-1 border border-gray-100">
                  <span>
                    {t.calculated_initial_reserve || 'Kiszámított induló tartalék'}: <b>{formatCurrency(calcInit)}</b>
                  </span>
                  <span className="text-gray-400">
                    ({formatCurrency(cleanVal)} - {formatCurrency(txTotals.payments)} + {formatCurrency(txTotals.expenses)})
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add New Account Inline Form */}
      {isAddingNew && !isBankLocked && (
        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
          <h5 className="font-bold text-[#1E3A8A] text-xs">{isEn ? 'Add New Bank Account' : 'Új számla felvétele'}</h5>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">{isEn ? 'Account Name' : 'Számla neve'}</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="pl. Liftfelújítási Alap"
                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">{isEn ? 'Short Name' : 'Rövidítés'}</label>
              <input
                type="text"
                value={newShortName}
                onChange={(e) => setNewShortName(e.target.value)}
                placeholder="pl. LIFT"
                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                {isEn ? 'Bank Account Number' : 'Bankszámlaszám'}
              </label>
              <input
                type="text"
                value={newAccountNum}
                onChange={(e) => setNewAccountNum(e.target.value)}
                placeholder="11700000 00000000"
                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">{isEn ? 'Bank Name' : 'Bank neve'}</label>
              <input
                type="text"
                value={newBank}
                onChange={(e) => setNewBank(e.target.value)}
                placeholder="OTP Bank"
                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-gray-700 mb-1">
                {t.current_bank_balance || 'Jelenlegi banki egyenleg'} (Ft)
              </label>
              <input
                type="text"
                value={newInitialBalance}
                onChange={(e) => setNewInitialBalance(e.target.value)}
                placeholder="0"
                className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newHasMonthlyFee}
                onChange={(e) => setNewHasMonthlyFee(e.target.checked)}
                className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A]"
              />
              <span className="font-bold text-gray-800 text-xs">
                {t.has_monthly_fee || 'Havi előírás beállítható a lakásokhoz'}
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-blue-100">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-white cursor-pointer"
            >
              {t.cancel || 'Mégse'}
            </button>
            <button
              type="button"
              onClick={handleAddNewAccount}
              className="px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isEn ? 'Add Account' : 'Számla hozzáadása'}</span>
            </button>
          </div>
        </div>
      )}

      {!isBankLocked && isDirty && (
        <div className="pt-2 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAccounts}
            className="px-4 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isEn ? 'Save Account Changes' : 'Számla módosítások mentése'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
