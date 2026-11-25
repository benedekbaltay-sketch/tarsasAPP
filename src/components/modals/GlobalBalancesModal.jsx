import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Menu,
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
  RefreshCw,
  UserCheck,
  Phone,
  Mail,
  Clock,
  Eye,
  ChevronDown,
  Pencil
} from 'lucide-react';
import { 
  getBuildingReserve, 
  getBuildingRenovationFund, 
  getBuildingAccountReserve,
  parseCleanNumber, 
  formatCurrency 
} from '../../utils/finances';
import { useBackdropClose } from '../../utils/useBackdropClose';
import { formatPhoneNumber } from '../../utils/phone';
import { formatTaxNumber } from '../../utils/taxNumber';
import { NavLogoButton } from '../NavLogoButton';
import { BankAccountsSection } from '../BankAccountsSection';
import {
  resolveUserOrgContext,
  canUserEditBankAccountNumbers,
  detectBankAccountChanges,
  buildBankChangeNotification,
  findOrganizationForBuilding,
  resolveBuildingResidentContact,
} from '../../utils/teamPermissions';

export function GlobalBalancesModal({ isOpen, onClose, onOpenDrawer, buildingId = null, mode = 'full', isReadOnly = false }) {
  const { state, t, setGlobalBalances, persistState, showToast, canUserManageBuilding } = useApp();
  const { currentLang, buildings, currentBuildingId } = state;
  const isEn = currentLang === 'en';
  const isHu = !isEn;
  const isAccountsOnly = mode === 'accounts';

  // Active target building
  const targetBuildingId = (typeof buildingId === 'string' && buildingId.trim()) ? buildingId : (currentBuildingId || (buildings && buildings[0] && buildings[0].id));
  const targetBuilding = (buildings || []).find(b => b.id === targetBuildingId) || buildings[0];

  const isEffectiveReadOnly = Boolean(
    isReadOnly ||
    (targetBuilding && canUserManageBuilding && !canUserManageBuilding(targetBuilding?.id || targetBuilding))
  );

  // Active tab: 'general' (Building info) vs 'api' (Building-specific Banking API)
  const [activeTab, setActiveTab] = useState('general');
  const [isEditingMasterData, setIsEditingMasterData] = useState(false);

  // 1. Building Master Data
  const [buildingName, setBuildingName] = useState('');
  const [buildingOfficialName, setBuildingOfficialName] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [buildingTaxNumber, setBuildingTaxNumber] = useState('');
  const [totalOwnershipShare, setTotalOwnershipShare] = useState('10000');

  // 1b. Resident-Facing Contact Switcher ('company' | 'manager', editable by actual building manager)
  const [contactDisplayMode, setContactDisplayMode] = useState('company');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerOfficeHours, setManagerOfficeHours] = useState('');

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
  const [expandedAccountIds, setExpandedAccountIds] = useState({});
  const toggleAccountExpanded = (accKey) => {
    setExpandedAccountIds((prev) => ({ ...prev, [accKey]: !prev[accKey] }));
  };
  const [newName, setNewName] = useState('');
  const [newShortName, setNewShortName] = useState('');
  const [newBeneficiary, setNewBeneficiary] = useState('');
  const [newAccountNum, setNewAccountNum] = useState('');
  const [newBank, setNewBank] = useState('OTP');
  const [newHasMonthlyFee, setNewHasMonthlyFee] = useState(false);
  const [newInitialBalance, setNewInitialBalance] = useState('');

  const resetNewAccountForm = () => {
    setNewName('');
    setNewShortName('');
    setNewBeneficiary(targetBuilding?.name || '');
    setNewAccountNum('');
    setNewBank('OTP');
    setNewHasMonthlyFee(false);
    setNewInitialBalance('');
  };

  // Initialize all form fields whenever modal opens or target building changes
  useEffect(() => {
    if (isOpen && targetBuilding) {
      setActiveTab('general');
      setBuildingName(targetBuilding.name || '');
      setBuildingOfficialName(targetBuilding.officialName || '');
      setBuildingAddress(targetBuilding.address || '');
      setBuildingTaxNumber(formatTaxNumber(targetBuilding.taxNumber || ''));
      setTotalOwnershipShare(targetBuilding.totalOwnershipShare !== undefined ? String(targetBuilding.totalOwnershipShare) : '10000');

      setContactDisplayMode(targetBuilding.contactDisplayMode === 'manager' ? 'manager' : 'company');
      setManagerName(targetBuilding.managerContact?.name || '');
      setManagerPhone(targetBuilding.managerContact?.phone || '');
      setManagerEmail(targetBuilding.managerContact?.email || '');
      setManagerOfficeHours(targetBuilding.managerContact?.officeHours || '');

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
      setExpandedAccountIds({});
      setIsEditingMasterData(false);
      resetNewAccountForm();
    }
  }, [isOpen, targetBuildingId]);

  const isAdmin = state.currentUser?.role === 'admin' || state.currentUser?.role === 'superadmin';
  const orgCtx = resolveUserOrgContext(state.currentUser, state.organizations, buildings);
  const canEditBankAcc = canUserEditBankAccountNumbers(state.currentUser, targetBuilding, state.organizations, buildings);
  const isBankLocked = !canEditBankAcc || isEffectiveReadOnly;
  const companyPreviewContact = resolveBuildingResidentContact(
    targetBuilding ? { ...targetBuilding, contactDisplayMode: 'company' } : null,
    state.repProfile,
    state.organizations
  );
  const backdropProps = useBackdropClose(isSaving ? () => {} : onClose);

  if (!isOpen || !isAdmin) return null;

  const handleFillMyContact = () => {
    setManagerName(state.currentUser?.name || '');
    setManagerEmail(state.currentUser?.email || '');
    if (!managerPhone && state.repProfile?.phone) {
      setManagerPhone(formatPhoneNumber(state.repProfile.phone));
    }
  };

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
    if (!canEditBankAcc || !newName.trim()) return;

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
    setExpandedAccountIds(prev => ({ ...prev, [newId]: true }));
    setIsAddingNew(false);
    resetNewAccountForm();
  };

  const handleDeleteCustomAccount = (accId) => {
    if (!canEditBankAcc) return;
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
    if (isEffectiveReadOnly) {
      showToast(
        t.team_viewer_readonly_error || (isEn
          ? "You have read-only (viewer) access to this condominium. Editing is not allowed."
          : "Csak megtekintési jogosultságod van ezen a társasházon. A módosítás nem engedélyezett."),
        "error"
      );
      return;
    }
    setIsSaving(true);
    setSaveError(null);

    try {
      const prevCustomById = new Map((targetBuilding?.customBankAccounts || []).map(a => [a.id, a]));
      // When !canEditBankAcc, strictly preserve ALL existing bank account fields untouched
      const updatedCustomAccounts = canEditBankAcc
        ? customAccounts.map(acc => {
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
          })
        : (targetBuilding?.customBankAccounts || []).map(orig => ({ ...orig }));

      const nextBankKK = canEditBankAcc
        ? {
            name: bankKKName.trim() || targetBuilding?.name || '',
            account: bankKKAccount.trim(),
            bank: bankKKBank.trim() || 'OTP',
          }
        : { ...(targetBuilding?.bankKK || {}) };

      const nextBankFA = canEditBankAcc
        ? {
            name: bankFAName.trim() || targetBuilding?.name || '',
            account: bankFAAccount.trim(),
            bank: bankFABank.trim() || 'OTP',
          }
        : { ...(targetBuilding?.bankFA || {}) };

      // Detect any bank account number changes and emit pale-red critical alert to Owner if edited by staff!
      const bankAccountChanges = canEditBankAcc && targetBuilding
        ? detectBankAccountChanges(targetBuilding, nextBankKK, nextBankFA, updatedCustomAccounts)
        : [];

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

      const nextManagerContact = {
        name: managerName.trim(),
        phone: formatPhoneNumber(managerPhone),
        email: managerEmail.trim(),
        officeHours: managerOfficeHours.trim(),
      };

      await persistState(s => {
        const updatedBuildings = (s.buildings || []).map(b => {
          if (b.id === targetBuildingId) {
            if (isAccountsOnly) {
              const bankUpdates = canEditBankAcc
                ? {
                    bankKK: nextBankKK,
                    bankFA: nextBankFA,
                    buildingInitialReserveCommon: calculatedInitKK,
                    buildingInitialReserveRenovation: calculatedInitFA,
                    customBankAccounts: updatedCustomAccounts,
                  }
                : {};
              return {
                ...b,
                totalOwnershipShare: parseFloat(String(totalOwnershipShare).replace(',', '.')) || b.totalOwnershipShare || 10000,
                ...bankUpdates,
              };
            }

            return {
              ...b,
              name: isEditingMasterData ? (buildingName.trim() || b.name) : b.name,
              officialName: isEditingMasterData ? buildingOfficialName.trim() : b.officialName,
              address: isEditingMasterData ? (buildingAddress.trim() || b.address) : b.address,
              taxNumber: isEditingMasterData ? formatTaxNumber(buildingTaxNumber).trim() : b.taxNumber,
              totalOwnershipShare: isEditingMasterData
                ? (parseFloat(String(totalOwnershipShare).replace(',', '.')) || 10000)
                : (b.totalOwnershipShare || 10000),
              contactDisplayMode: b.contactDisplayMode || 'company',
              managerContact: b.managerContact || null,
              showCentralContactToResidents: b.showCentralContactToResidents !== undefined ? b.showCentralContactToResidents : false,
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
          buildings: updatedBuildings,
          notifications: criticalOwnerNotification
            ? [criticalOwnerNotification, ...(s.notifications || [])].slice(0, 300)
            : (s.notifications || []),
        };
      });

      setIsEditingMasterData(false);

      showToast(
        isAccountsOnly
          ? (t.bank_accounts_saved_toast || (isEn ? "Bank accounts & reserves saved!" : "A bankszámlák és tartalékok adatai sikeresen elmentve!"))
          : (isEn ? "Building settings & bank data saved!" : "A társasház adatai és banki beállításai sikeresen elmentve!")
      );
      onClose();
    } catch (err) {
      console.error("Save building settings error:", err);
      setSaveError(err.message || (isEn ? "Failed to save building data to cloud." : "Hiba történt az adatok felhőbe mentésekor."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F3F4F6] flex flex-col overflow-hidden animate-fadeIn cursor-default">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 w-full shadow-xs bg-white border-b border-gray-200 px-3 sm:px-4 md:px-8 py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Menu & Website Logo -> Back to Home */}
          <div className="flex items-center justify-start gap-2 sm:gap-2.5 flex-1 min-w-0">
            {onOpenDrawer && (
              <button
                type="button"
                onClick={onOpenDrawer}
                className="w-8 h-8 sm:w-9 sm:h-8.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-700 shadow-2xs transition-all cursor-pointer flex-shrink-0 hover:border-gray-300"
                title={isEn ? "Open Menu" : "Menü megnyitása"}
                aria-label={isEn ? "Open Menu" : "Menü megnyitása"}
              >
                <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-gray-700" />
              </button>
            )}
            <NavLogoButton onClick={onClose} isReadOnly={isEffectiveReadOnly} />
          </div>

          {/* Center: Module Title & Icon */}
          <div className="flex items-center justify-center text-center px-1 sm:px-2 flex-shrink-0 max-w-[55%] sm:max-w-[50%]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-[#1E3A8A] flex items-center justify-center flex-shrink-0 shadow-2xs">
                {isAccountsOnly ? <Landmark className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              </div>
              <div className="min-w-0 text-left sm:text-center">
                <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 font-display truncate">
                  {isAccountsOnly
                    ? (t.bank_accounts_edit_title || (isEn ? "Bank Accounts & Reserves" : "Folyószámlák és Tartalékok"))
                    : (t.bld_settings_title || (isEn ? "Building Settings & Banking" : "Társasház Beállításai & Bank"))}
                </h2>
                <span className="text-[10px] sm:text-xs text-gray-500 truncate block">
                  {targetBuilding?.name}{targetBuilding?.address ? ` • ${targetBuilding.address}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Close button */}
          <div className="flex items-center justify-end gap-2 flex-1 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 shadow-2xs"
              title={t.close || "Bezárás"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Only in full Building Settings mode (never in Folyószámlák & Tartalékok mode) */}
        {!isAccountsOnly && (
          <div className="mt-3 pt-2.5 border-t border-gray-100 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'general'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{t.bld_settings_tab_general || (isEn ? "Building Details" : "Épület adatai")}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('api')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
        )}
      </div>

      {/* Fullpage Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto w-full overscroll-contain p-4 md:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-6 space-y-6 text-xs">
            {/* ============================================================== */}
            {/* TAB 1: ÉPÜLET ADATAI & FOLYÓSZÁMLÁK (vagy csak Bankszámlák)    */}
            {/* ============================================================== */}
            {(isAccountsOnly || activeTab === 'general') && (
              <div className="space-y-6">
                
                {/* Section A: Building Master Info (Read-only until Pencil icon is clicked) */}
                {!isAccountsOnly && (
                  <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-[#1E3A8A] text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        <span>{isEn ? "Condominium Master Data" : "Társasház alapadatok"}</span>
                      </h4>
                      {!isEffectiveReadOnly && (
                        !isEditingMasterData ? (
                          <button
                            type="button"
                            onClick={() => setIsEditingMasterData(true)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:text-[#1E3A8A] hover:border-blue-200 text-gray-600 text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                            title={t.edit || (isEn ? "Edit master data" : "Alapadatok szerkesztése")}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>{t.edit || (isEn ? "Edit" : "Szerkesztés")}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setBuildingName(targetBuilding?.name || '');
                              setBuildingOfficialName(targetBuilding?.officialName || '');
                              setBuildingAddress(targetBuilding?.address || '');
                              setBuildingTaxNumber(formatTaxNumber(targetBuilding?.taxNumber || ''));
                              setTotalOwnershipShare(targetBuilding?.totalOwnershipShare !== undefined ? String(targetBuilding.totalOwnershipShare) : '10000');
                              setIsEditingMasterData(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>{t.cancel || (isEn ? "Cancel" : "Mégse")}</span>
                          </button>
                        )
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">
                          {t.bld_settings_name || (isEn ? "Condominium Name" : "Elnevezés")} *
                        </label>
                        <input
                          type="text"
                          value={buildingName}
                          disabled={isEffectiveReadOnly || !isEditingMasterData}
                          onChange={(e) => setBuildingName(e.target.value)}
                          placeholder={isEn ? "e.g. Batyu 21" : "pl. Batyu u. 21."}
                          className={`w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] ${
                            isEffectiveReadOnly || !isEditingMasterData ? 'bg-gray-100/80 text-gray-700 cursor-default' : 'bg-white text-gray-900'
                          }`}
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">
                          {t.bld_settings_official_name || (isEn ? "Official Legal Name" : "Hivatalos név")}
                        </label>
                        <input
                          type="text"
                          value={buildingOfficialName}
                          disabled={isEffectiveReadOnly || !isEditingMasterData}
                          onChange={(e) => setBuildingOfficialName(e.target.value)}
                          placeholder={isEn ? "e.g. Batyu utca 21. Társasház" : "pl. Batyu utca 21. Társasház"}
                          className={`w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] ${
                            isEffectiveReadOnly || !isEditingMasterData ? 'bg-gray-100/80 text-gray-700 cursor-default' : 'bg-white text-gray-900'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">
                          {t.bld_settings_address || (isEn ? "Building Address" : "Cím")} *
                        </label>
                        <input
                          type="text"
                          value={buildingAddress}
                          disabled={isEffectiveReadOnly || !isEditingMasterData}
                          onChange={(e) => setBuildingAddress(e.target.value)}
                          placeholder={isEn ? "1051 Budapest, Example St. 1." : "1051 Budapest, Példa utca 1."}
                          className={`w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] ${
                            isEffectiveReadOnly || !isEditingMasterData ? 'bg-gray-100/80 text-gray-700 cursor-default' : 'bg-white text-gray-900'
                          }`}
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">
                          {t.bld_settings_tax_number || (isEn ? "Tax Number" : "Adószám")}
                        </label>
                        <input
                          type="text"
                          value={buildingTaxNumber}
                          disabled={isEffectiveReadOnly || !isEditingMasterData}
                          onChange={(e) => setBuildingTaxNumber(formatTaxNumber(e.target.value))}
                          placeholder="12345678-1-42"
                          className={`w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A] ${
                            isEffectiveReadOnly || !isEditingMasterData ? 'bg-gray-100/80 text-gray-700 cursor-default' : 'bg-white text-gray-900'
                          }`}
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-semibold text-gray-700">
                            {t.bld_settings_total_share || (isEn ? "Total Ownership Share (Basis)" : "Teljes tulajdoni hányad (Alap)")} *
                          </label>
                          <span className="text-[10px] text-gray-400">
                            {isEn ? "Default: 10,000" : "Alapértelmezett: 10 000"}
                          </span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          min="1"
                          value={totalOwnershipShare}
                          disabled={isEffectiveReadOnly || !isEditingMasterData}
                          onChange={(e) => setTotalOwnershipShare(e.target.value)}
                          placeholder="10000"
                          className={`w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-[#1E3A8A] ${
                            isEffectiveReadOnly || !isEditingMasterData ? 'bg-gray-100/80 text-gray-700 cursor-default' : 'bg-white text-gray-900'
                          }`}
                          required
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          {t.bld_settings_total_share_desc || (isEn 
                            ? "Condominium deed basis for voting and shares (typically 10,000, 1,000, 100,000 or custom deed sum)." 
                            : "Az alapító okirat szerinti teljes eszmei hányad (általában 10 000, de lehet 1 000, 100 000 vagy egyedi összeg).")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section A2: Per-Building Resident Contact Summary (managed exclusively in Team & Permissions) */}
                {!isAccountsOnly && (
                  <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-200/80 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 text-[#1E3A8A]">
                        <UserCheck className="w-4 h-4" />
                        <span>{t.bld_contact_section_title || (isEn ? "Resident-Facing Representative Contact" : "Lakóknak megjelenő kapcsolattartó")}</span>
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#1E3A8A] text-[10px] font-bold">
                        {targetBuilding?.contactDisplayMode === 'manager'
                          ? (isEn ? "Colleague Contact" : "Munkatárs elérhetősége")
                          : (isEn ? "Central Company" : "Központi cég")}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border border-blue-100 text-xs space-y-2">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-700">
                        {targetBuilding?.contactDisplayMode === 'manager' && targetBuilding?.managerContact ? (
                          <>
                            <span className="font-bold text-gray-900">
                              👤 {targetBuilding.managerContact.name || '—'}
                            </span>
                            {targetBuilding.managerContact.phone && <span>📞 {targetBuilding.managerContact.phone}</span>}
                            {targetBuilding.managerContact.email && <span>✉️ {targetBuilding.managerContact.email}</span>}
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-gray-900">
                              🏢 {companyPreviewContact.name || '—'}
                            </span>
                            {companyPreviewContact.phone && <span>📞 {companyPreviewContact.phone}</span>}
                            {companyPreviewContact.email && <span>✉️ {companyPreviewContact.email}</span>}
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 text-[11px] text-gray-500">
                        <span>
                          {isEn ? "Central company escalation channel:" : "Központi cégadatok megjelenítése eszkalációként:"}
                        </span>
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                            targetBuilding?.showCentralContactToResidents
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {targetBuilding?.showCentralContactToResidents
                            ? (isEn ? "ENABLED" : "BEKAPCSOLVA")
                            : (isEn ? "DISABLED" : "KIKAPCSOLVA")}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                      <span>ℹ️</span>
                      <span>
                        {t.bld_contact_team_managed_hint || (
                          isEn
                            ? "Resident-facing representative contact and central company escalation visibility are configured under Csapat & Jogosultságok (Team & Permissions)."
                            : "A lakóknak megjelenő kapcsolattartó és a központi cégadatok láthatósága a Csapat & Jogosultságok menüpontban, a munkatársak házhoz rendelésénél állítható be."
                        )}
                      </span>
                    </p>
                  </div>
                )}

                {/* Unified Section: Számlák — Only rendered here in accounts-only mode (in full mode, Accounts live under Building Finances -> Bank) */}
                {isAccountsOnly && (
                  <BankAccountsSection
                    buildingId={targetBuildingId}
                    isReadOnly={isEffectiveReadOnly}
                  />
                )}

              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: BANKI API INTEGRÁCIÓ (HÁZ-SPECIFIKUS)                   */}
            {/* ============================================================== */}
            {!isAccountsOnly && activeTab === 'api' && (
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
                        disabled={isEffectiveReadOnly}
                        onChange={(e) => setApiProvider(e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A] ${
                          isEffectiveReadOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 text-gray-800'
                        }`}
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
                        disabled={isEffectiveReadOnly}
                        onChange={(e) => setApiEnv(e.target.value)}
                        className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-[#1E3A8A] ${
                          isEffectiveReadOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 text-gray-800'
                        }`}
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
                        disabled={isEffectiveReadOnly}
                        onChange={(e) => setApiClientId(e.target.value)}
                        placeholder={isEn ? "e.g. corp-building-001" : "pl. corp-tarsashaz-001"}
                        className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:border-[#1E3A8A] ${
                          isEffectiveReadOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 text-gray-800'
                        }`}
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
                    <label className={`flex items-center gap-2 ${isEffectiveReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={apiAutoSync}
                        disabled={isEffectiveReadOnly}
                        onChange={(e) => setApiAutoSync(e.target.checked)}
                        className="w-4 h-4 rounded text-[#1E3A8A] focus:ring-[#1E3A8A]"
                      />
                      <span className="font-bold text-gray-800 text-xs">
                        {t.settings_api_autosync || "Automatikus napi számlatörténet-szinkronizáció éjfélkor"}
                      </span>
                    </label>

                    {!isEffectiveReadOnly && (
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
                    )}
                  </div>
                </div>
              </div>
            )}

            </div>

            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Bottom Footer Bar */}
        {!isAccountsOnly && (
          <div className="bg-white border-t border-gray-200 px-4 sm:px-8 py-3 flex items-center justify-end gap-2.5 shadow-md flex-shrink-0">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer transition-colors disabled:opacity-40"
            >
              {isEffectiveReadOnly || (activeTab === 'general' && !isEditingMasterData) ? (t.close || (isEn ? "Close" : "Bezárás")) : (t.cancel || "Mégse")}
            </button>
            {!isEffectiveReadOnly && (activeTab === 'api' || isEditingMasterData) ? (
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
            ) : isEffectiveReadOnly ? (
              <button
                type="button"
                disabled
                className="px-4 py-2 bg-gray-100 border border-gray-200 text-gray-400 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-not-allowed"
                title={t.team_viewer_readonly_error || (isEn ? "Read-only access" : "Csak megtekintési jogosultság")}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t.view_only || (isEn ? "Read-Only" : "Csak megtekintés")}</span>
              </button>
            ) : null}
          </div>
        )}
      </form>
    </div>
  );
}

// Named alias export for backward compatibility
export { GlobalBalancesModal as BuildingSettingsModal };
