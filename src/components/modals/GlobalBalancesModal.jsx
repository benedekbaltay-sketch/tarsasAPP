import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Save, 
  Calculator, 
  Loader2, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Landmark, 
  Check, 
  Building2, 
  Network, 
  Lock, 
  Copy, 
  CheckCircle2, 
  ShieldCheck, 
  SlidersHorizontal,
  RefreshCw
} from 'lucide-react';
import { 
  getBuildingReserve, 
  getBuildingRenovationFund, 
  getBuildingAccountReserve,
  parseCleanNumber, 
  formatCurrency 
} from '../../utils/finances';
import { useBackdropClose } from '../../utils/useBackdropClose';

export function GlobalBalancesModal({ isOpen, onClose, buildingId = null }) {
  const { state, t, setGlobalBalances, persistState, showToast } = useApp();
  const { currentLang, buildings, currentBuildingId } = state;
  const isEn = currentLang === 'en';
  const isHu = !isEn;

  // Active target building
  const targetBuildingId = (typeof buildingId === 'string' && buildingId.trim()) ? buildingId : (currentBuildingId || (buildings && buildings[0] && buildings[0].id));
  const targetBuilding = (buildings || []).find(b => b.id === targetBuildingId) || buildings[0];

  // Active tab: 'general' (Building info & bank accounts) vs 'api' (Building-specific Banking API)
  const [activeTab, setActiveTab] = useState('general');

  // 1. Building Master Data
  const [buildingName, setBuildingName] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [buildingTaxNumber, setBuildingTaxNumber] = useState('');

  // 2. Primary Bank Accounts (KK & FA)
  const [bankKKName, setBankKKName] = useState('');
  const [bankKKAccount, setBankKKAccount] = useState('');
  const [bankKKBank, setBankKKBank] = useState('OTP');

  const [bankFAName, setBankFAName] = useState('');
  const [bankFAAccount, setBankFAAccount] = useState('');
  const [bankFABank, setBankFABank] = useState('OTP');

  // 3. Bank balances & custom accounts
  const [commonBalance, setCommonBalance] = useState('');
  const [renovationBalance, setRenovationBalance] = useState('');
  const [customAccounts, setCustomAccounts] = useState([]);
  const [customBalances, setCustomBalances] = useState({});

  // 4. Building-specific Bank API Integration (secrets & mTLS keys are managed strictly server-side)
  const [apiProvider, setApiProvider] = useState('OTP CorpAPI');
  const [apiEnv, setApiEnv] = useState('sandbox');
  const [apiClientId, setApiClientId] = useState('');
  const [apiAutoSync, setApiAutoSync] = useState(true);
  const [apiTestStatus, setApiTestStatus] = useState(null); // null | 'server_managed'

  // Form handling & loading states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // New custom account inline form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [newBeneficiary, setNewBeneficiary] = useState('');
  const [newAccountNum, setNewAccountNum] = useState('');
  const [newBank, setNewBank] = useState('OTP');
  const [newHasMonthlyFee, setNewHasMonthlyFee] = useState(false);
  const [newInitialBalance, setNewInitialBalance] = useState('');

  // Initialize all form fields whenever modal opens or target building changes
  useEffect(() => {
    if (isOpen && targetBuilding) {
      setActiveTab('general');
      setBuildingName(targetBuilding.name || '');
      setBuildingAddress(targetBuilding.address || '');
      setBuildingTaxNumber(targetBuilding.taxNumber || '');

      setBankKKName(targetBuilding.bankKK?.name || targetBuilding.name || '');
      setBankKKAccount(targetBuilding.bankKK?.account || '');
      setBankKKBank(targetBuilding.bankKK?.bank || 'OTP');

      setBankFAName(targetBuilding.bankFA?.name || targetBuilding.name || '');
      setBankFAAccount(targetBuilding.bankFA?.account || '');
      setBankFABank(targetBuilding.bankFA?.bank || 'OTP');

      // Balances
      const curKK = getBuildingReserve({ ...state, currentBuildingId: targetBuilding.id });
      const curFA = getBuildingRenovationFund({ ...state, currentBuildingId: targetBuilding.id });
      setCommonBalance(Math.round(curKK).toString());
      setRenovationBalance(Math.round(curFA).toString());

      const rawCustom = (targetBuilding.customBankAccounts || []).map(a => ({ ...a }));
      setCustomAccounts(rawCustom);

      const initialCustomBalances = {};
      rawCustom.forEach(acc => {
        const curRes = getBuildingAccountReserve(acc.id, { ...state, currentBuildingId: targetBuilding.id });
        initialCustomBalances[acc.id] = Math.round(curRes).toString();
      });
      setCustomBalances(initialCustomBalances);

      // Building-specific Banking API (non-secret metadata only; secrets & mTLS keys are managed server-side)
      const bApi = targetBuilding.bankApi || {};
      setApiProvider(bApi.provider || 'OTP CorpAPI');
      setApiEnv(bApi.environment || 'sandbox');
      setApiClientId(bApi.clientId || '');
      setApiAutoSync(bApi.autoSync !== undefined ? bApi.autoSync : true);
      setApiTestStatus(null);

      setIsSaving(false);
      setSaveError(null);
      setIsAddingNew(false);
      resetNewAccountForm();
    }
  }, [isOpen, targetBuildingId]);

  const resetNewAccountForm = () => {
    setNewName('');
    setNewShortName('');
    setNewBeneficiary(targetBuilding?.name || '');
    setNewAccountNum('');
    setNewBank('OTP');
    setNewHasMonthlyFee(false);
    setNewInitialBalance('');
  };

  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  const backdropProps = useBackdropClose(isSaving ? () => {} : onClose);

  if (!isOpen || !isAdmin) return null;

  const isBankTx = tx => tx.affectsBankBalance !== false && tx.method !== "Készpénz" && tx.method !== "Cash" && tx.method !== "Cash Offset";

  // Account calculations for target building
  const buildingTxs = (state.transactions || []).filter(t => !t.buildingId || t.buildingId === targetBuildingId);
  const buildingExpenses = (state.expenses || []).filter(e => !e.buildingId || e.buildingId === targetBuildingId);

  const totalPaymentsKK = buildingTxs
    .filter(t => t.status === "Verified" && (t.targetAccount === "Közös Költség" || (!t.targetAccount && t.targetAccount !== "Felújítási Alap")) && t.includeInBalance !== false && t.type !== "Correction" && isBankTx(t))
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpensesKK = buildingExpenses
    .filter(e => (e.targetAccount === "Közös Költség" || (!e.targetAccount && e.provider !== "Felújítási Alap")) && e.includeInBalance !== false && isBankTx(e))
    .reduce((acc, e) => acc + e.amount, 0);

  const totalPaymentsFA = buildingTxs
    .filter(t => t.status === "Verified" && t.targetAccount === "Felújítási Alap" && t.includeInBalance !== false && t.type !== "Correction" && isBankTx(t))
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpensesFA = buildingExpenses
    .filter(e => (e.targetAccount === "Felújítási Alap" || (!e.targetAccount && e.provider === "Felújítási Alap")) && e.includeInBalance !== false && isBankTx(e))
    .reduce((acc, e) => acc + e.amount, 0);

  const cleanCommon = parseCleanNumber(commonBalance);
  const cleanRenovation = parseCleanNumber(renovationBalance);

  const calculatedInitKK = Math.round(cleanCommon - totalPaymentsKK + totalExpensesKK);
  const calculatedInitFA = Math.round(cleanRenovation - totalPaymentsFA + totalExpensesFA);

  // Helper for custom accounts payments and expenses
  const getCustomAccountTxTotals = (acc) => {
    const payments = buildingTxs
      .filter(t => t.status === "Verified" && (t.targetAccount === acc.name || t.targetAccount === acc.id) && t.includeInBalance !== false && t.type !== "Correction" && isBankTx(t))
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = buildingExpenses
      .filter(e => (e.targetAccount === acc.name || e.targetAccount === acc.id) && e.includeInBalance !== false && isBankTx(e))
      .reduce((sum, e) => sum + e.amount, 0);
    return { payments, expenses };
  };

  const handleAddNewAccount = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

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
      color: 'emerald'
    };

    setCustomAccounts(prev => [...prev, newAcc]);
    setCustomBalances(prev => ({ ...prev, [newId]: cleanBal.toString() }));
    setIsAddingNew(false);
    resetNewAccountForm();
  };

  const handleDeleteCustomAccount = (accId) => {
    setCustomAccounts(prev => prev.filter(a => a.id !== accId));
    setCustomBalances(prev => {
      const copy = { ...prev };
      delete copy[accId];
      return copy;
    });
  };

  const handleTestConnection = () => {
    setApiTestStatus('server_managed');
    showToast(
      t.bld_settings_api_server_managed_toast || (
        isEn
          ? "Open Banking credentials and mTLS certificates are verified strictly on the secure backend server."
          : "A banki API titkos kulcsok és mTLS tanúsítványok ellenőrzése kizárólag a biztonságos szerveroldali háttérszolgáltatáson keresztül történik."
      ),
      'info'
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin || isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const parsedCustomBalances = {};
      const updatedCustomAccounts = customAccounts.map(acc => {
        const numVal = parseCleanNumber(customBalances[acc.id]);
        parsedCustomBalances[acc.id] = numVal;
        const txTotals = getCustomAccountTxTotals(acc);
        const newInit = Math.round(numVal - txTotals.payments + txTotals.expenses);
        return {
          ...acc,
          initialReserve: newInit
        };
      });

      await persistState(s => {
        const updatedBuildings = (s.buildings || []).map(b => {
          if (b.id === targetBuildingId) {
            return {
              ...b,
              name: buildingName.trim() || b.name,
              address: buildingAddress.trim() || b.address,
              taxNumber: buildingTaxNumber.trim(),
              bankKK: {
                name: bankKKName.trim() || b.name,
                account: bankKKAccount.trim(),
                bank: bankKKBank.trim() || 'OTP'
              },
              bankFA: {
                name: bankFAName.trim() || b.name,
                account: bankFAAccount.trim(),
                bank: bankFABank.trim() || 'OTP'
              },
              buildingInitialReserveCommon: calculatedInitKK,
              buildingInitialReserveRenovation: calculatedInitFA,
              customBankAccounts: updatedCustomAccounts,
              bankApi: {
                provider: apiProvider,
                environment: apiEnv,
                clientId: apiClientId.trim(),
                autoSync: Boolean(apiAutoSync),
                syncInterval: 'daily',
                secretManagedServerSide: true
              }
            };
          }
          return b;
        });

        return {
          ...s,
          buildings: updatedBuildings
        };
      });

      showToast(isEn ? "Building settings & bank data saved!" : "A társasház adatai és banki beállításai sikeresen elmentve!");
      onClose();
    } catch (err) {
      console.error("Save building settings error:", err);
      setSaveError(err.message || (isEn ? "Failed to save building data to cloud." : "Hiba történt az adatok felhőbe mentésekor."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn cursor-default"
      {...backdropProps}
    >
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Header - Fixed */}
        <div className="p-4 px-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/70 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-bold flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 font-display truncate">
                {t.bld_settings_title || (isEn ? "Building Settings & Banking" : "Társasház Beállításai & Bank")}
              </h3>
              <p className="text-xs text-gray-500 truncate">
                {targetBuilding?.name} • {targetBuilding?.address}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
            title={t.close || "Bezárás"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: 1. Épület adatai & Számlák | 2. Banki API Integráció */}
        <div className="px-5 pt-3 pb-2 border-b border-gray-100 flex gap-2 bg-gray-50/30 flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{t.bld_settings_tab_general || (isEn ? "Building Details & Accounts" : "Épület adatai & Számlák")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('api')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'api'
                ? 'bg-[#1E3A8A] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>{t.bld_settings_tab_api || (isEn ? "Banking API Integration" : "Banki API Integráció")}</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${apiEnv === 'sandbox' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {apiEnv === 'sandbox' ? 'Test' : 'Live'}
            </span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-5 space-y-6 flex-1 text-xs">
            
            {/* ============================================================== */}
            {/* TAB 1: ÉPÜLET ADATAI & FOLYÓSZÁMLÁK                           */}
            {/* ============================================================== */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                
                {/* Section A: Building Master Info */}
                <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 space-y-3">
                  <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#1E3A8A]">
                    <Building2 className="w-4 h-4" />
                    <span>{isEn ? "Condominium Master Data" : "Társasház alapadatok"}</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-gray-700 mb-1">
                        {t.bld_settings_name || "Társasház megnevezése"}
                      </label>
                      <input
                        type="text"
                        value={buildingName}
                        onChange={(e) => setBuildingName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#1E3A8A]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        {t.bld_settings_tax_number || "Adószám"}
                      </label>
                      <input
                        type="text"
                        value={buildingTaxNumber}
                        onChange={(e) => setBuildingTaxNumber(e.target.value)}
                        placeholder="12345678-1-42"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block font-semibold text-gray-700 mb-1">
                        {t.bld_settings_address || "Épület címe / Levelezési cím"}
                      </label>
                      <input
                        type="text"
                        value={buildingAddress}
                        onChange={(e) => setBuildingAddress(e.target.value)}
                        placeholder={isEn ? "1051 Budapest, Example St. 1." : "1051 Budapest, Példa utca 1."}
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Base Accounts (KK & FA) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#1E3A8A]">
                      <Landmark className="w-4 h-4" />
                      <span>{isEn ? "Primary Condominium Bank Accounts" : "Alapértelmezett társasházi bankszámlák"}</span>
                    </h4>
                  </div>

                  {/* 1. KK Account */}
                  <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-200/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1E3A8A] text-xs">
                        {t.account_common || "Közös Költség (KK) Főszámla"}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-[#1E3A8A] font-bold text-[10px]">
                        {bankKKBank}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                          {isEn ? "Account Name" : "Számla elnevezése"}
                        </label>
                        <input
                          type="text"
                          value={bankKKName}
                          onChange={(e) => setBankKKName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                          {isEn ? "Bank Account Number" : "Bankszámlaszám"}
                        </label>
                        <input
                          type="text"
                          value={bankKKAccount}
                          onChange={(e) => setBankKKAccount(e.target.value)}
                          placeholder="11700000 00000000"
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                          {t.current_bank_balance || "Jelenlegi banki egyenleg"} (Ft)
                        </label>
                        <input
                          type="text"
                          value={commonBalance}
                          onChange={(e) => setCommonBalance(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1E3A8A]"
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-500 bg-white/70 p-2 rounded-lg flex items-center justify-between border border-blue-100">
                      <span>{t.calculated_initial_reserve || "Kiszámított induló tartalék"}: <b>{formatCurrency(calculatedInitKK)}</b></span>
                      <span className="text-gray-400">({formatCurrency(cleanCommon)} - {formatCurrency(totalPaymentsKK)} + {formatCurrency(totalExpensesKK)})</span>
                    </div>
                  </div>

                  {/* 2. FA Account */}
                  <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-200/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-800 text-xs">
                        {t.account_renovation || "Felújítási Alap (FA) Számla"}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {bankFABank}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                          {isEn ? "Account Name" : "Számla elnevezése"}
                        </label>
                        <input
                          type="text"
                          value={bankFAName}
                          onChange={(e) => setBankFAName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                          {isEn ? "Bank Account Number" : "Bankszámlaszám"}
                        </label>
                        <input
                          type="text"
                          value={bankFAAccount}
                          onChange={(e) => setBankFAAccount(e.target.value)}
                          placeholder="11700000 00000000"
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 mb-0.5">
                          {t.current_bank_balance || "Jelenlegi banki egyenleg"} (Ft)
                        </label>
                        <input
                          type="text"
                          value={renovationBalance}
                          onChange={(e) => setRenovationBalance(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-500 bg-white/70 p-2 rounded-lg flex items-center justify-between border border-emerald-100">
                      <span>{t.calculated_initial_reserve || "Kiszámított induló tartalék"}: <b>{formatCurrency(calculatedInitFA)}</b></span>
                      <span className="text-gray-400">({formatCurrency(cleanRenovation)} - {formatCurrency(totalPaymentsFA)} + {formatCurrency(totalExpensesFA)})</span>
                    </div>
                  </div>
                </div>

                {/* Section C: Custom Bank Accounts */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#1E3A8A]">
                        <span>{t.custom_bank_accounts_title || "Egyedi banki alszámlák & alapok"}</span>
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        {t.custom_bank_accounts_desc || "Külön célalapok (pl. liftfelújítás, megtakarítás) kezelése."}
                      </p>
                    </div>

                    {!isAddingNew && (
                      <button
                        type="button"
                        onClick={() => setIsAddingNew(true)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.add_custom_account || "Új alszámla"}</span>
                      </button>
                    )}
                  </div>

                  {customAccounts.map(acc => {
                    const cleanVal = parseCleanNumber(customBalances[acc.id]);
                    const txTotals = getCustomAccountTxTotals(acc);
                    const calcInit = Math.round(cleanVal - txTotals.payments + txTotals.expenses);

                    return (
                      <div key={acc.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-xs">{acc.name}</span>
                            <span className="px-1.5 py-0.2 rounded bg-gray-200 text-gray-700 font-bold text-[10px]">
                              {acc.bank}
                            </span>
                            {acc.hasMonthlyFee && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                                {isEn ? "Monthly fee enabled" : "Havi előírással"}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomAccount(acc.id)}
                            className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Törlés"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-gray-400 block font-bold">{isEn ? "Account Number" : "Számlaszám"}</span>
                            <span className="font-mono text-gray-700">{acc.account || '-'}</span>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-500 block font-bold mb-0.5">
                              {t.current_bank_balance || "Jelenlegi banki egyenleg"} (Ft)
                            </label>
                            <input
                              type="text"
                              value={customBalances[acc.id] !== undefined ? customBalances[acc.id] : ''}
                              onChange={(e) => setCustomBalances(prev => ({ ...prev, [acc.id]: e.target.value }))}
                              className="w-full px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:border-[#1E3A8A]"
                            />
                          </div>
                        </div>

                        <div className="text-[10px] text-gray-500 bg-white/80 p-2 rounded-lg flex items-center justify-between border border-gray-100">
                          <span>{t.calculated_initial_reserve || "Kiszámított induló tartalék"}: <b>{formatCurrency(calcInit)}</b></span>
                          <span className="text-gray-400">({formatCurrency(cleanVal)} - {formatCurrency(txTotals.payments)} + {formatCurrency(txTotals.expenses)})</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add New Custom Account Form */}
                  {isAddingNew && (
                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
                      <h5 className="font-bold text-[#1E3A8A] text-xs">
                        {t.add_new_account_title || "Új egyedi bankszámla felvétele"}
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">{isEn ? "Account Name" : "Számla neve"}</label>
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
                          <label className="block font-semibold text-gray-700 mb-1">{isEn ? "Short Name" : "Rövidítés"}</label>
                          <input
                            type="text"
                            value={newShortName}
                            onChange={(e) => setNewShortName(e.target.value)}
                            placeholder="pl. LIFT"
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">{isEn ? "Bank Account Number" : "Bankszámlaszám"}</label>
                          <input
                            type="text"
                            value={newAccountNum}
                            onChange={(e) => setNewAccountNum(e.target.value)}
                            placeholder="11700000 00000000"
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">{isEn ? "Bank Name" : "Bank neve"}</label>
                          <input
                            type="text"
                            value={newBank}
                            onChange={(e) => setNewBank(e.target.value)}
                            placeholder="OTP Bank"
                            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A]"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-gray-700 mb-1">{t.current_bank_balance || "Jelenlegi banki egyenleg"} (Ft)</label>
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
                            {t.has_monthly_fee || "Havi előírás beállítható a lakásokhoz"}
                          </span>
                        </label>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-blue-100">
                        <button
                          type="button"
                          onClick={() => setIsAddingNew(false)}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-white"
                        >
                          {t.cancel || "Mégse"}
                        </button>
                        <button
                          type="button"
                          onClick={handleAddNewAccount}
                          className="px-3.5 py-1.5 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isEn ? "Add Account" : "Számla hozzáadása"}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: BANKI API INTEGRÁCIÓ (HÁZ-SPECIFIKUS)                   */}
            {/* ============================================================== */}
            {activeTab === 'api' && (
              <div className="space-y-4">
                
                {/* Specific Condominium Bank Context Alert */}
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-[#1E3A8A] flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                    <Network className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1E3A8A] text-xs">
                      {isEn ? "Condominium Specific Banking API" : "Társasház-specifikus banki integráció"}
                    </h4>
                    <p className="text-[11px] text-gray-600 mt-0.5">
                      {t.bld_settings_api_desc || "Mivel minden társasház saját külön bankszámlával és banki hozzáféréssel rendelkezik, az open banking API paramétereket (pl. OTP CorpAPI) épületenként külön kell beállítani."}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        {t.settings_api_provider || "API Szolgáltató"}
                      </label>
                      <select
                        value={apiProvider}
                        onChange={(e) => setApiProvider(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                      >
                        <option value="OTP CorpAPI">OTP Bank CorpAPI</option>
                        <option value="Erste Open Banking API">Erste Open Banking API</option>
                        <option value="MBH Bank Connect">MBH Bank Connect</option>
                        <option value="K&H OpenBanking">K&H OpenBanking</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        {t.settings_api_env || "Működési környezet"}
                      </label>
                      <select
                        value={apiEnv}
                        onChange={(e) => setApiEnv(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                      >
                        <option value="sandbox">{t.settings_api_env_sandbox || "Sandbox (Teszt üzemmód)"}</option>
                        <option value="production">{t.settings_api_env_prod || "Éles (Production)"}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        {t.settings_api_client_id || "Ügyfél-azonosító (Client ID)"}
                      </label>
                      <input
                        type="text"
                        value={apiClientId}
                        onChange={(e) => setApiClientId(e.target.value)}
                        placeholder={isEn ? "e.g. corp-building-001" : "pl. corp-tarsashaz-001"}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-[#1E3A8A]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">
                        {t.settings_api_key || (isEn ? "API Secret & mTLS Certificate" : "API Titkos Kulcs és mTLS Tanúsítvány")}
                      </label>
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">
                          {t.bld_settings_api_secret_notice || (
                            isEn
                              ? "Managed strictly server-side (Secret Manager / KMS). Banking secrets are never stored in the browser or client database."
                              : "Kizárólag szerveroldalon tárolva (Secret Manager / KMS). A banki titkos kulcsok soha nem kerülnek a böngészőbe vagy az ügyféloldali adatbázisba."
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={apiAutoSync}
                        onChange={(e) => setApiAutoSync(e.target.checked)}
                        className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A]"
                      />
                      <span className="font-bold text-gray-800 text-xs">
                        {t.settings_api_autosync || "Automatikus napi számlatörténet-szinkronizáció éjfélkor"}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleTestConnection}
                      className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-[#1E3A8A] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {apiTestStatus === 'server_managed' ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-[#1E3A8A]" />
                          <span>{isEn ? "Server-Side Verification Only" : "Szerveroldali ellenőrzés szükséges"}</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-[#1E3A8A]" />
                          <span>{t.bld_settings_api_test_btn || "Banki kapcsolat tesztelése"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
          </div>

          {/* Fixed Footer Bar */}
          <div className="p-4 px-5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5 flex-shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-white hover:text-gray-900 cursor-pointer transition-colors disabled:opacity-40"
            >
              {t.cancel || "Mégse"}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-[#1E3A8A] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95 disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.saving || (isEn ? "Saving..." : "Mentés...")}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{t.save || "Mentés"}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

// Named alias export for backward compatibility
export { GlobalBalancesModal as BuildingSettingsModal };
