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
  Pencil,
  Users,
  Shield,
  ClipboardCheck,
  Info
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
  buildNotification,
  findOrganizationForBuilding,
  resolveBuildingResidentContact,
  normalizeEmail,
} from '../../utils/teamPermissions';
import {
  getBuildingOwnerCandidates,
  normalizeBuildingSzvb,
  evaluateSzvbCompliance,
  syncSzvbToBuildingFlats,
  buildSzvbUpdateNotifications,
} from '../../utils/szvb';
import {
  getBuildingAlerts,
  dismissBuildingAlertInList,
} from '../../utils/buildingAlerts';
import {
  evaluateEconomicAuditorCompliance,
  isEconomicAuditorActive,
} from '../../utils/economicAuditor';
import { IS_FIRESTORE_MODE } from '../../constants/firebaseConfig';
import {
  callManageSzvbMembers,
  updateBuildingMetadata,
  callCalibrateBuildingBalances,
} from '../../services/firestoreService';

export function GlobalBalancesModal({ isOpen, onClose, onOpenDrawer, buildingId = null, mode = 'full', isReadOnly = false }) {
  const { state, t, setGlobalBalances, persistState, reloadCurrentBuilding, showToast, canUserManageBuilding, updateBuildingEconomicAuditor } = useApp();
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
  const [isEditingSzvb, setIsEditingSzvb] = useState(false);
  const [isEditingApi, setIsEditingApi] = useState(false);
  const [isAuditorInfoHovered, setIsAuditorInfoHovered] = useState(false);
  const [isAuditorInfoPinned, setIsAuditorInfoPinned] = useState(false);

  // 1. Building Master Data
  const [buildingName, setBuildingName] = useState('');
  const [buildingOfficialName, setBuildingOfficialName] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [buildingTaxNumber, setBuildingTaxNumber] = useState('');
  const [buildingHrsz, setBuildingHrsz] = useState('');
  const [totalOwnershipShare, setTotalOwnershipShare] = useState('10000');

  // 1a. SZVB (Accounting Committee) state
  const [szvbChairpersonKey, setSzvbChairpersonKey] = useState('');
  const [szvbMemberKeys, setSzvbMemberKeys] = useState([]);
  const [szvbAddMemberKey, setSzvbAddMemberKey] = useState('');

  // 1a-2. Economic Auditor (Tht. 51/A. §) state (unified inside SZVB card)
  const [auditorMode, setAuditorMode] = useState('none'); // 'none' | 'szvb_member' | 'internal' | 'external'
  const [auditorInternalKey, setAuditorInternalKey] = useState('');
  const [auditorName, setAuditorName] = useState('');
  const [auditorEmail, setAuditorEmail] = useState('');
  const [auditorPhone, setAuditorPhone] = useState('');
  const [auditorCompany, setAuditorCompany] = useState('');
  const [auditorRegNum, setAuditorRegNum] = useState('');
  const [auditorValidFrom, setAuditorValidFrom] = useState('');
  const [auditorValidTo, setAuditorValidTo] = useState('');

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
      setBuildingHrsz(targetBuilding.hrsz || '');
      setTotalOwnershipShare(targetBuilding.totalOwnershipShare !== undefined ? String(targetBuilding.totalOwnershipShare) : '10000');

      const currentSzvb = normalizeBuildingSzvb(targetBuilding);
      setSzvbChairpersonKey(currentSzvb.chairperson?.key || '');
      setSzvbMemberKeys((currentSzvb.members || []).map((m) => m.key).filter(Boolean));
      setSzvbAddMemberKey('');

      const curAud = targetBuilding.economicAuditor || {};
      const curCandidates = getBuildingOwnerCandidates(targetBuilding);
      const curSzvbAll = [currentSzvb.chairperson, ...(currentSzvb.members || [])].filter(Boolean);
      const matchedSzvbAuditor =
        curAud.enabled && curAud.type === 'internal' && curAud.email
          ? curSzvbAll.find((p) => normalizeEmail(p.email) === normalizeEmail(curAud.email))
          : null;
      const matchedInternal =
        curAud.enabled && curAud.type === 'internal' && curAud.email
          ? curCandidates.find((c) => normalizeEmail(c.email) === normalizeEmail(curAud.email))
          : null;
      setAuditorMode(
        curAud.enabled
          ? (matchedSzvbAuditor ? 'szvb_member' : (curAud.type === 'internal' ? 'internal' : 'external'))
          : 'none'
      );
      setAuditorInternalKey(matchedSzvbAuditor?.key || matchedInternal?.key || '');
      setAuditorName(curAud.name || '');
      setAuditorEmail(curAud.email || '');
      setAuditorPhone(curAud.phone || '');
      setAuditorCompany(curAud.companyName || '');
      setAuditorRegNum(curAud.registrationNumber || '');
      setAuditorValidFrom(curAud.validFrom || '');
      setAuditorValidTo(curAud.validTo || '');
      setIsAuditorInfoHovered(false);
      setIsAuditorInfoPinned(false);

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
      setIsEditingSzvb(false);
      setIsEditingApi(false);
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

  // Building owner candidates & SZVB draft computation (strictly from building's existing owners)
  const ownerCandidates = targetBuilding ? getBuildingOwnerCandidates(targetBuilding) : [];
  const candidateByKey = new Map(ownerCandidates.map((c) => [c.key, c]));
  const existingSzvb = targetBuilding ? normalizeBuildingSzvb(targetBuilding) : { chairperson: null, members: [] };
  const existingPersonByKey = new Map();
  if (existingSzvb.chairperson?.key) existingPersonByKey.set(existingSzvb.chairperson.key, existingSzvb.chairperson);
  (existingSzvb.members || []).forEach((m) => {
    if (m?.key) existingPersonByKey.set(m.key, m);
  });

  const resolveCandidateToSzvbPerson = (key) => {
    if (!key) return null;
    const cand = candidateByKey.get(key);
    if (cand) {
      return {
        key: cand.key,
        name: cand.name,
        email: cand.email || '',
        flatNum: cand.primaryFlatNum || '',
      };
    }
    const prev = existingPersonByKey.get(key);
    return prev ? { ...prev } : null;
  };

  const draftSzvb = {
    chairperson: resolveCandidateToSzvbPerson(szvbChairpersonKey),
    members: szvbMemberKeys
      .filter((k) => k && k !== szvbChairpersonKey)
      .map(resolveCandidateToSzvbPerson)
      .filter(Boolean),
  };

  const szvbCompliance = targetBuilding
    ? evaluateSzvbCompliance({
        ...targetBuilding,
        szvb: isEditingSzvb ? draftSzvb : targetBuilding.szvb,
      })
    : null;

  const buildingAlerts = !isAccountsOnly && targetBuilding
    ? getBuildingAlerts(targetBuilding, {
        user: state.currentUser,
        organizations: state.organizations,
        buildings,
      })
    : [];
  const generalTabAlerts = buildingAlerts.filter(
    (a) => a.targetMenu === 'building-settings' && a.targetTab === 'general'
  );
  const apiTabAlerts = buildingAlerts.filter(
    (a) => a.targetMenu === 'building-settings' && a.targetTab === 'api'
  );

  const handleDismissAlert = async (alertId) => {
    if (!targetBuildingId || !alertId || isEffectiveReadOnly) return;
    try {
      const nextDismissed = Array.from(new Set([...(targetBuilding?.dismissedAlerts || []), alertId]));
      if (IS_FIRESTORE_MODE) {
        await updateBuildingMetadata(targetBuildingId, { dismissedAlerts: nextDismissed });
        if (typeof reloadCurrentBuilding === 'function') {
          await reloadCurrentBuilding(targetBuildingId);
        }
        return;
      }
      await persistState((s) => ({
        ...s,
        buildings: dismissBuildingAlertInList(s.buildings || [], targetBuildingId, alertId),
      }));
    } catch (err) {
      console.error("Failed to dismiss building alert:", err);
    }
  };

  const handleSelectSzvbChairperson = (newKey) => {
    const prevKey = szvbChairpersonKey;
    setSzvbChairpersonKey(newKey);
    if (newKey) {
      // Prevent same owner being both Chairperson and regular Member
      setSzvbMemberKeys((prev) => prev.filter((k) => k !== newKey));
      if (szvbAddMemberKey === newKey) setSzvbAddMemberKey('');
    }
    if (auditorMode === 'szvb_member' && prevKey && auditorInternalKey === prevKey && newKey !== prevKey) {
      setAuditorMode('none');
      setAuditorInternalKey('');
      setAuditorName('');
      setAuditorEmail('');
    }
  };

  const handleAddSzvbMember = () => {
    if (!szvbAddMemberKey || szvbAddMemberKey === szvbChairpersonKey) return;
    if (szvbMemberKeys.includes(szvbAddMemberKey)) return;
    setSzvbMemberKeys((prev) => [...prev, szvbAddMemberKey]);
    setSzvbAddMemberKey('');
  };

  const handleRemoveSzvbMember = (keyToRemove) => {
    setSzvbMemberKeys((prev) => prev.filter((k) => k !== keyToRemove));
    if (auditorMode === 'szvb_member' && auditorInternalKey === keyToRemove) {
      setAuditorMode('none');
      setAuditorInternalKey('');
      setAuditorName('');
      setAuditorEmail('');
    }
  };

  const handleToggleSzvbPersonAsAuditor = (person) => {
    if (!person) return;
    if (!person.email) {
      showToast(
        isEn
          ? 'Add an email address on this owner’s flat card first before assigning them as Financial Auditor.'
          : 'Először add meg a tulajdonos e-mail címét a lakás adatlapján, hogy gazdasági ellenőrnek kijelölhesd!',
        'error'
      );
      return;
    }
    if (auditorMode === 'szvb_member' && auditorInternalKey === person.key) {
      setAuditorMode('none');
      setAuditorInternalKey('');
      setAuditorName('');
      setAuditorEmail('');
      return;
    }
    if (normalizeEmail(auditorEmail) !== normalizeEmail(person.email)) {
      setAuditorPhone('');
      setAuditorCompany('');
      setAuditorRegNum('');
      setAuditorValidFrom('');
      setAuditorValidTo('');
    }
    setAuditorMode('szvb_member');
    setAuditorInternalKey(person.key);
    setAuditorName(person.name || '');
    setAuditorEmail(person.email || '');
    setSaveError(null);
  };

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

  const handleSaveSection = async (section = 'all') => {
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

    const saveMaster = section === 'master' || (section === 'all' && isEditingMasterData);
    const saveSzvb = section === 'szvb' || (section === 'all' && isEditingSzvb);
    const saveApi = section === 'api' || (section === 'all' && isEditingApi);

    if (saveMaster) {
      if (!buildingName.trim() || !buildingAddress.trim()) {
        showToast(
          isEn ? "Building name and address are required." : "A társasház elnevezése és címe kötelező!",
          "error"
        );
        return;
      }
    }

    // Build & validate Economic Auditor payload upfront whenever saving the unified SZVB & Auditor card
    let nextAuditorPayload = null;
    if (saveSzvb) {
      const szvbKeySet = new Set([
        ...(draftSzvb.chairperson?.key ? [draftSzvb.chairperson.key] : []),
        ...(draftSzvb.members || []).map((m) => m.key).filter(Boolean),
      ]);

      if (auditorMode === 'szvb_member') {
        const chosen =
          (draftSzvb.chairperson?.key === auditorInternalKey ? draftSzvb.chairperson : null) ||
          (draftSzvb.members || []).find((m) => m.key === auditorInternalKey) ||
          candidateByKey.get(auditorInternalKey);
        if (!chosen || !chosen.email) {
          setSaveError(
            isEn
              ? 'The selected SZVB member has no email address recorded yet.'
              : 'A kiválasztott SZVB-tagnak még nincs e-mail címe rögzítve!'
          );
          return;
        }
        nextAuditorPayload = {
          enabled: true,
          type: 'internal',
          name: chosen.name,
          email: chosen.email,
          phone: auditorPhone.trim(),
          companyName: auditorCompany.trim(),
          registrationNumber: auditorRegNum.trim(),
          flatNum: chosen.flatNum || chosen.primaryFlatNum || '',
          validFrom: auditorValidFrom,
          validTo: auditorValidTo,
          isSzvbMember: true,
          exemptQualifiedSzvbMember: true,
        };
      } else if (auditorMode === 'internal') {
        const chosen = candidateByKey.get(auditorInternalKey);
        if (!chosen || !chosen.email) {
          setSaveError(
            isEn
              ? 'Please select an apartment owner who has a valid email address.'
              : 'Kérjük, válassz olyan tulajdonost, akinek meg van adva az e-mail címe!'
          );
          return;
        }
        const isAlsoSzvb = szvbKeySet.has(chosen.key);
        nextAuditorPayload = {
          enabled: true,
          type: 'internal',
          name: chosen.name,
          email: chosen.email,
          phone: auditorPhone.trim(),
          companyName: auditorCompany.trim(),
          registrationNumber: auditorRegNum.trim(),
          flatNum: chosen.primaryFlatNum || '',
          validFrom: auditorValidFrom,
          validTo: auditorValidTo,
          isSzvbMember: isAlsoSzvb,
          exemptQualifiedSzvbMember: isAlsoSzvb,
        };
      } else if (auditorMode === 'external') {
        const cleanEmail = normalizeEmail(auditorEmail);
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          setSaveError(
            isEn
              ? 'Please enter a valid email address for the external Financial Auditor.'
              : 'Kérjük, adj meg érvényes e-mail címet a külsős gazdasági ellenőrnek!'
          );
          return;
        }
        nextAuditorPayload = {
          enabled: true,
          type: 'external',
          name: auditorName.trim() || cleanEmail,
          email: cleanEmail,
          phone: auditorPhone.trim(),
          companyName: auditorCompany.trim(),
          registrationNumber: auditorRegNum.trim(),
          flatNum: '',
          validFrom: auditorValidFrom,
          validTo: auditorValidTo,
          isSzvbMember: false,
          exemptQualifiedSzvbMember: false,
        };
      } else {
        nextAuditorPayload = {
          enabled: false,
          type: 'external',
          isSzvbMember: false,
          exemptQualifiedSzvbMember: false,
        };
      }
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
      const bankAccountChanges = isAccountsOnly && canEditBankAcc && targetBuilding
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

      // Prepare SZVB update & notifications if edited
      const nextSzvbPayload = saveSzvb
        ? {
            chairperson: draftSzvb.chairperson || null,
            members: draftSzvb.members || [],
            updatedAt: new Date().toISOString(),
            updatedBy: normalizeEmail(state.currentUser?.email) || state.currentUser?.name || 'admin',
          }
        : null;

      // In Cloud Firestore mode, commit metadata & SZVB via server-verified paths (zero RTDB writes).
      // Run SZVB and Financial Auditor transactions SEQUENTIALLY (never concurrently in Promise.all)
      // because both transactions lock `buildings/{buildingId}` and `buildings/{buildingId}/members/{uid}`.
      if (IS_FIRESTORE_MODE && targetBuildingId) {
        const prevAud = targetBuilding?.economicAuditor || {};
        const auditorChanged = Boolean(
          saveSzvb &&
          nextAuditorPayload &&
          (
            Boolean(prevAud.enabled) !== Boolean(nextAuditorPayload.enabled) ||
            normalizeEmail(prevAud.email) !== normalizeEmail(nextAuditorPayload.email) ||
            (prevAud.type || 'external') !== (nextAuditorPayload.type || 'external') ||
            String(prevAud.name || '').trim() !== String(nextAuditorPayload.name || '').trim() ||
            String(prevAud.phone || '').trim() !== String(nextAuditorPayload.phone || '').trim() ||
            String(prevAud.companyName || '').trim() !== String(nextAuditorPayload.companyName || '').trim() ||
            String(prevAud.registrationNumber || '').trim() !== String(nextAuditorPayload.registrationNumber || '').trim() ||
            String(prevAud.flatNum || '').trim() !== String(nextAuditorPayload.flatNum || '').trim() ||
            String(prevAud.validFrom || '').trim() !== String(nextAuditorPayload.validFrom || '').trim() ||
            String(prevAud.validTo || '').trim() !== String(nextAuditorPayload.validTo || '').trim() ||
            Boolean(prevAud.isSzvbMember) !== Boolean(nextAuditorPayload.isSzvbMember) ||
            Boolean(prevAud.exemptQualifiedSzvbMember) !== Boolean(nextAuditorPayload.exemptQualifiedSzvbMember)
          )
        );

        const runSequentialBgSaves = async () => {
          if (saveSzvb && nextSzvbPayload) {
            await callManageSzvbMembers({
              buildingId: targetBuildingId,
              chairperson: nextSzvbPayload.chairperson || null,
              members: nextSzvbPayload.members || [],
            });
          }
          if (auditorChanged && typeof updateBuildingEconomicAuditor === 'function') {
            await updateBuildingEconomicAuditor(targetBuildingId, nextAuditorPayload, {
              sendInviteEmail: true,
              silent: true,
            });
          }
          if (saveMaster) {
            await updateBuildingMetadata(targetBuildingId, {
              name: buildingName.trim() || targetBuilding?.name || '',
              officialName: buildingOfficialName.trim(),
              address: buildingAddress.trim() || targetBuilding?.address || '',
              taxNumber: formatTaxNumber(buildingTaxNumber).trim(),
              hrsz: buildingHrsz.trim(),
              totalOwnershipShare: parseFloat(String(totalOwnershipShare).replace(',', '.')) || 10000,
            });
          }
          if (saveApi) {
            await updateBuildingMetadata(targetBuildingId, {
              bankApi: {
                provider: apiProvider,
                environment: apiEnv,
                clientId: apiClientId.trim(),
                autoSync: Boolean(apiAutoSync),
                syncInterval: 'daily',
                secretManagedServerSide: true,
              },
            });
          }
          if (isAccountsOnly && canEditBankAcc) {
            const customTargets = {};
            updatedCustomAccounts.forEach((acc) => {
              customTargets[acc.id] = Math.round(parseCleanNumber(customBalances[acc.id]));
            });
            await updateBuildingMetadata(targetBuildingId, {
              bankAccounts: {
                KK: nextBankKK,
                FA: nextBankFA,
                custom: updatedCustomAccounts,
              },
            });
            await callCalibrateBuildingBalances({
              buildingId: targetBuildingId,
              targetKK: Math.round(cleanCommon),
              targetFA: Math.round(cleanRenovation),
              customTargets,
            });
          }
        };

        // Apply optimistic local update & exit edit mode IMMEDIATELY (0ms latency)
        await persistState((s) => {
          const updatedBuildings = (s.buildings || []).map((b) => {
            if (!b || b.id !== targetBuildingId) return b;
            return {
              ...b,
              ...(saveMaster ? {
                name: buildingName.trim() || b.name,
                officialName: buildingOfficialName.trim(),
                address: buildingAddress.trim() || b.address,
                taxNumber: formatTaxNumber(buildingTaxNumber).trim(),
                hrsz: buildingHrsz.trim(),
                totalOwnershipShare: parseFloat(String(totalOwnershipShare).replace(',', '.')) || 10000,
              } : {}),
              ...(saveSzvb && nextSzvbPayload ? {
                szvb: nextSzvbPayload,
                flats: syncSzvbToBuildingFlats(b.flats || [], nextSzvbPayload),
              } : {}),
              ...(saveSzvb && nextAuditorPayload ? { economicAuditor: nextAuditorPayload } : {}),
              ...(saveApi ? {
                bankApi: {
                  provider: apiProvider,
                  environment: apiEnv,
                  clientId: apiClientId.trim(),
                  autoSync: Boolean(apiAutoSync),
                  syncInterval: 'daily',
                  secretManagedServerSide: true,
                },
              } : {}),
              ...(isAccountsOnly && canEditBankAcc ? {
                bankKK: nextBankKK,
                bankFA: nextBankFA,
                buildingInitialReserveCommon: calculatedInitKK,
                buildingInitialReserveRenovation: calculatedInitFA,
                customBankAccounts: updatedCustomAccounts,
              } : {}),
            };
          });
          const nextTopFlats =
            saveSzvb && nextSzvbPayload && s.currentBuildingId === targetBuildingId
              ? syncSzvbToBuildingFlats(s.flats || [], nextSzvbPayload)
              : s.flats;
          return { ...s, buildings: updatedBuildings, flats: nextTopFlats };
        }, 'localOnly');

        if (saveMaster) setIsEditingMasterData(false);
        if (saveSzvb) setIsEditingSzvb(false);
        if (saveApi) setIsEditingApi(false);
        showToast(
          isAccountsOnly
            ? (t.bank_accounts_saved_toast || (isEn ? "Bank accounts & reserves saved!" : "A bankszámlák és tartalékok adatai sikeresen elmentve!"))
            : section === 'szvb'
              ? (isEn ? "SZVB & Financial Audit settings saved!" : "Az SZVB és a gazdasági ellenőrzés beállításai elmentve!")
              : section === 'api'
                ? (isEn ? "Banking API settings saved!" : "A banki API beállítások sikeresen elmentve!")
                : (isEn ? "Condominium master data saved!" : "A társasház alapadatai sikeresen elmentve!")
        );

        runSequentialBgSaves()
          .then(() => {
            if (typeof reloadCurrentBuilding === 'function') {
              reloadCurrentBuilding(targetBuildingId).catch(() => {});
            }
          })
          .catch((bgErr) => {
            console.error('Background Firestore GlobalBalancesModal save error:', bgErr);
            if (typeof reloadCurrentBuilding === 'function') {
              reloadCurrentBuilding(targetBuildingId).catch(() => {});
            }
            showToast(
              isEn ? 'Failed to sync settings to cloud. Please try again.' : 'Hiba történt a felhőbe mentés során. Kérjük, próbálja újra!',
              'error'
            );
          });
        return;
      }

      const szvbNotifications = saveSzvb && !IS_FIRESTORE_MODE && targetBuilding && nextSzvbPayload
        ? buildSzvbUpdateNotifications({
            prevSzvb: existingSzvb,
            nextSzvb: nextSzvbPayload,
            building: targetBuilding,
            actorUser: state.currentUser,
          })
        : [];

      await persistState(s => {
        let nextCurrentFlats = s.flats;
        const updatedBuildings = (s.buildings || []).map(b => {
          if (b.id === targetBuildingId) {
            if (isAccountsOnly) {
              const bankUpdates = canEditBankAcc
                ? {
                    bankKK: nextBankKK,
                    bankFA: nextBankFA,
                    buildingInitialReserveCommon: calculatedInitKK,
                    buildingInitialReserveRenovation: calculatedInitFA,
                    reserveCalibratedAt: Date.now(),
                    customBankAccounts: updatedCustomAccounts,
                  }
                : {};
              return {
                ...b,
                totalOwnershipShare: parseFloat(String(totalOwnershipShare).replace(',', '.')) || b.totalOwnershipShare || 10000,
                ...bankUpdates,
              };
            }

            const syncedFlats = nextSzvbPayload
              ? syncSzvbToBuildingFlats(b.flats || [], nextSzvbPayload)
              : b.flats;

            if (nextSzvbPayload && b.id === s.currentBuildingId) {
              nextCurrentFlats = syncedFlats;
            }

            return {
              ...b,
              name: saveMaster ? (buildingName.trim() || b.name) : b.name,
              officialName: saveMaster ? buildingOfficialName.trim() : b.officialName,
              address: saveMaster ? (buildingAddress.trim() || b.address) : b.address,
              taxNumber: saveMaster ? formatTaxNumber(buildingTaxNumber).trim() : b.taxNumber,
              hrsz: saveMaster ? buildingHrsz.trim() : (b.hrsz || ''),
              totalOwnershipShare: saveMaster
                ? (parseFloat(String(totalOwnershipShare).replace(',', '.')) || 10000)
                : (b.totalOwnershipShare || 10000),
              ...(nextSzvbPayload ? { szvb: nextSzvbPayload, flats: syncedFlats } : {}),
              contactDisplayMode: b.contactDisplayMode || 'company',
              managerContact: b.managerContact || null,
              showCentralContactToResidents: b.showCentralContactToResidents !== undefined ? b.showCentralContactToResidents : false,
              bankApi: saveApi
                ? {
                    provider: apiProvider,
                    environment: apiEnv,
                    clientId: apiClientId.trim(),
                    autoSync: Boolean(apiAutoSync),
                    syncInterval: 'daily',
                    secretManagedServerSide: true
                  }
                : (b.bankApi || {
                    provider: 'OTP CorpAPI',
                    environment: 'sandbox',
                    clientId: '',
                    autoSync: true,
                    syncInterval: 'daily',
                    secretManagedServerSide: true
                  })
            };
          }
          return b;
        });

        const newNotifications = [
          ...(criticalOwnerNotification ? [criticalOwnerNotification] : []),
          ...szvbNotifications,
        ];

        return {
          ...s,
          buildings: updatedBuildings,
          flats: nextCurrentFlats,
          ...(isAccountsOnly && canEditBankAcc && s.currentBuildingId === targetBuildingId
            ? {
                buildingInitialReserveCommon: calculatedInitKK,
                buildingInitialReserveRenovation: calculatedInitFA,
              }
            : {}),
          notifications: newNotifications.length > 0
            ? [...newNotifications, ...(s.notifications || [])].slice(0, 300)
            : (s.notifications || []),
        };
      }, isAccountsOnly && canEditBankAcc ? { allowReserveChange: true } : true);

      // Persist Economic Auditor atomically alongside SZVB (external invite email is always automatic)
      let auditorInviteSent = false;
      if (saveSzvb && nextAuditorPayload && typeof updateBuildingEconomicAuditor === 'function') {
        const audRes = await updateBuildingEconomicAuditor(targetBuildingId, nextAuditorPayload, {
          sendInviteEmail: true,
          silent: true,
        });
        auditorInviteSent = Boolean(audRes?.inviteSent);
      }

      if (saveMaster) setIsEditingMasterData(false);
      if (saveSzvb) setIsEditingSzvb(false);
      if (saveApi) setIsEditingApi(false);

      showToast(
        isAccountsOnly
          ? (t.bank_accounts_saved_toast || (isEn ? "Bank accounts & reserves saved!" : "A bankszámlák és tartalékok adatai sikeresen elmentve!"))
          : section === 'szvb'
            ? (auditorInviteSent
                ? (isEn
                    ? "SZVB & Financial Auditor saved, and login invitation email sent!"
                    : "SZVB és gazdasági ellenőr elmentve, a belépési meghívó e-mail elküldve!")
                : (isEn
                    ? "SZVB & Financial Audit settings saved!"
                    : "Az SZVB és a gazdasági ellenőrzés beállításai elmentve!"))
            : section === 'api'
              ? (isEn ? "Banking API settings saved!" : "A banki API beállítások sikeresen elmentve!")
              : (isEn ? "Condominium master data saved!" : "A társasház alapadatai sikeresen elmentve!")
      );
    } catch (err) {
      console.error("Save building settings error:", err);
      setSaveError(err.message || (isEn ? "Failed to save building data to cloud." : "Hiba történt az adatok felhőbe mentésekor."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (activeTab === 'api' && isEditingApi) {
      handleSaveSection('api');
    } else if (isEditingMasterData) {
      handleSaveSection('master');
    } else if (isEditingSzvb) {
      handleSaveSection('szvb');
    }
  };

  const resetSzvbAndAuditorDraft = () => {
    setSzvbChairpersonKey(existingSzvb.chairperson?.key || '');
    setSzvbMemberKeys((existingSzvb.members || []).map((m) => m.key).filter(Boolean));
    setSzvbAddMemberKey('');

    const curAud = targetBuilding?.economicAuditor || {};
    const curSzvbAll = [existingSzvb.chairperson, ...(existingSzvb.members || [])].filter(Boolean);
    const matchedSzvbAuditor =
      curAud.enabled && curAud.type === 'internal' && curAud.email
        ? curSzvbAll.find((p) => normalizeEmail(p.email) === normalizeEmail(curAud.email))
        : null;
    const matchedInternal =
      curAud.enabled && curAud.type === 'internal' && curAud.email
        ? ownerCandidates.find((c) => normalizeEmail(c.email) === normalizeEmail(curAud.email))
        : null;
    setAuditorMode(
      curAud.enabled
        ? (matchedSzvbAuditor ? 'szvb_member' : (curAud.type === 'internal' ? 'internal' : 'external'))
        : 'none'
    );
    setAuditorInternalKey(matchedSzvbAuditor?.key || matchedInternal?.key || '');
    setAuditorName(curAud.name || '');
    setAuditorEmail(curAud.email || '');
    setAuditorPhone(curAud.phone || '');
    setAuditorCompany(curAud.companyName || '');
    setAuditorRegNum(curAud.registrationNumber || '');
    setAuditorValidFrom(curAud.validFrom || '');
    setAuditorValidTo(curAud.validTo || '');
    setSaveError(null);
  };

  const auditorCompliance = targetBuilding ? evaluateEconomicAuditorCompliance(targetBuilding) : null;
  const currentActiveAuditor =
    targetBuilding?.economicAuditor && isEconomicAuditorActive(targetBuilding.economicAuditor)
      ? targetBuilding.economicAuditor
      : null;

  const isSzvbPersonAuditor = (person) => {
    if (!person) return false;
    if (isEditingSzvb) {
      return auditorMode === 'szvb_member' && Boolean(person.key) && auditorInternalKey === person.key;
    }
    return Boolean(
      currentActiveAuditor &&
      currentActiveAuditor.type === 'internal' &&
      person.email &&
      normalizeEmail(currentActiveAuditor.email) === normalizeEmail(person.email)
    );
  };

  const isCurrentAuditorInSzvb = Boolean(
    currentActiveAuditor &&
    currentActiveAuditor.type === 'internal' &&
    [existingSzvb.chairperson, ...(existingSzvb.members || [])]
      .filter(Boolean)
      .some((p) => p.email && normalizeEmail(p.email) === normalizeEmail(currentActiveAuditor.email))
  );

  const showAuditorInfoTooltip = isAuditorInfoHovered || isAuditorInfoPinned;

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
      </div>

      {/* Fullpage Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        <div
          className="flex-1 overflow-y-auto w-full overscroll-contain p-4 md:p-8"
          style={{ scrollbarGutter: 'stable' }}
        >
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Segmented Tab Bar matching Finances (Pénzügyek) design */}
            {!isAccountsOnly && (
              <div
                role="tablist"
                aria-label={t.bld_settings_title || (isEn ? "Building Settings & Banking" : "Társasház Beállításai & Bank")}
                className="bg-white rounded-2xl border border-gray-200 p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'general'}
                  onClick={() => setActiveTab('general')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    activeTab === 'general'
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'general' ? 'text-white' : 'text-gray-500'}`} />
                  <span>{t.bld_settings_tab_general || (isEn ? "Building Details" : "Épület adatai")}</span>
                  {generalTabAlerts.length > 0 && (
                    <span
                      className={`w-2 h-2 rounded-full bg-red-500 shrink-0 ${
                        activeTab === 'general' ? 'ring-2 ring-white/80' : ''
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'api'}
                  onClick={() => setActiveTab('api')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    activeTab === 'api'
                      ? 'bg-[#1E3A8A] text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
                >
                  <Network className={`w-4 h-4 shrink-0 ${activeTab === 'api' ? 'text-white' : 'text-gray-500'}`} />
                  <span>{t.bld_settings_tab_api || (isEn ? "Banking API Integration" : "Banki API Integráció")}</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                    activeTab === 'api'
                      ? 'bg-white/20 text-white'
                      : (apiEnv === 'sandbox' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800')
                  }`}>
                    {apiEnv === 'sandbox' ? 'Test' : 'Live'}
                  </span>
                  {apiTabAlerts.length > 0 && (
                    <span
                      className={`w-2 h-2 rounded-full bg-red-500 shrink-0 ${
                        activeTab === 'api' ? 'ring-2 ring-white/80' : ''
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-6 space-y-6 text-xs">
            {/* ============================================================== */}
            {/* TAB 1: ÉPÜLET ADATAI & FOLYÓSZÁMLÁK (vagy csak Bankszámlák)    */}
            {/* ============================================================== */}
            {(isAccountsOnly || activeTab === 'general') && (
              <div className="space-y-6">
                
                {/* Dismissible Actionable Building Alerts (FIRST block above Condominium Master Data) */}
                {!isAccountsOnly && generalTabAlerts.length > 0 && (
                  <div className="space-y-2.5">
                    {generalTabAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="p-3.5 rounded-xl bg-red-50/80 border border-red-200 text-red-950 flex items-start justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="text-xs leading-relaxed">
                            <span className="font-bold block">
                              {isEn ? alert.titleEn : alert.titleHu}
                            </span>
                            <span className="text-red-900/90">
                              {isEn ? alert.messageEn : alert.messageHu}
                            </span>
                          </div>
                        </div>
                        {alert.dismissible && !isEffectiveReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleDismissAlert(alert.id)}
                            className="p-1 rounded-lg text-red-400 hover:text-red-700 hover:bg-red-100/80 transition-colors cursor-pointer flex-shrink-0"
                            title={t.dismiss || (isEn ? "Dismiss notice" : "Értesítés bezárása")}
                            aria-label={t.dismiss || (isEn ? "Dismiss notice" : "Értesítés bezárása")}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

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
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                setBuildingName(targetBuilding?.name || '');
                                setBuildingOfficialName(targetBuilding?.officialName || '');
                                setBuildingAddress(targetBuilding?.address || '');
                                setBuildingTaxNumber(formatTaxNumber(targetBuilding?.taxNumber || ''));
                                setBuildingHrsz(targetBuilding?.hrsz || '');
                                setTotalOwnershipShare(targetBuilding?.totalOwnershipShare !== undefined ? String(targetBuilding.totalOwnershipShare) : '10000');
                                setIsEditingMasterData(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              <span>{t.cancel || (isEn ? "Cancel" : "Mégse")}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSaveSection('master')}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-[11px] font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
                            >
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              <span>{t.save || (isEn ? "Save" : "Mentés")}</span>
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    {isEffectiveReadOnly || !isEditingMasterData ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-xl bg-white border border-gray-200/80">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            {t.bld_settings_name || (isEn ? "Condominium Name" : "Elnevezés")}
                          </span>
                          <span className="block text-xs sm:text-[13px] font-bold text-gray-900 break-words">
                            {buildingName || '—'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-gray-200/80">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            {t.bld_settings_official_name || (isEn ? "Official Legal Name" : "Hivatalos név")}
                          </span>
                          <span className={`block text-xs sm:text-[13px] break-words ${buildingOfficialName ? 'font-semibold text-gray-900' : 'text-gray-400 italic'}`}>
                            {buildingOfficialName || (isEn ? 'Not set' : 'Nincs megadva')}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-gray-200/80">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            {t.bld_settings_address || (isEn ? "Building Address" : "Cím")}
                          </span>
                          <span className="block text-xs sm:text-[13px] font-semibold text-gray-900 break-words">
                            {buildingAddress || '—'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-gray-200/80">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            {t.bld_settings_tax_number || (isEn ? "Tax Number" : "Adószám")}
                          </span>
                          <span className={`block text-xs sm:text-[13px] font-mono ${buildingTaxNumber ? 'font-semibold text-gray-900' : 'text-gray-400 italic font-sans'}`}>
                            {buildingTaxNumber || (isEn ? 'Not set' : 'Nincs megadva')}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-gray-200/80">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            {t.bld_settings_hrsz || (isEn ? "Land Registry No. (HRSZ)" : "Helyrajzi szám (hrsz.)")}
                          </span>
                          <span className={`block text-xs sm:text-[13px] font-mono ${buildingHrsz ? 'font-semibold text-gray-900' : 'text-gray-400 italic font-sans'}`}>
                            {buildingHrsz || (isEn ? 'Not set' : 'Nincs megadva')}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-gray-200/80">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            {t.bld_settings_total_share || (isEn ? "Total Ownership Share (Basis)" : "Teljes tulajdoni hányad (Alap)")}
                          </span>
                          <span className="block text-xs sm:text-[13px] font-mono font-bold text-gray-900">
                            {totalOwnershipShare ? Number(totalOwnershipShare).toLocaleString(isEn ? 'en-US' : 'hu-HU') : '10 000'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">
                            {t.bld_settings_name || (isEn ? "Condominium Name" : "Elnevezés")} *
                          </label>
                          <input
                            type="text"
                            value={buildingName}
                            onChange={(e) => setBuildingName(e.target.value)}
                            placeholder={isEn ? "e.g. Batyu 21" : "pl. Batyu u. 21."}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#1E3A8A] bg-white text-gray-900"
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
                            onChange={(e) => setBuildingOfficialName(e.target.value)}
                            placeholder={isEn ? "e.g. Batyu utca 21. Társasház" : "pl. Batyu utca 21. Társasház"}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">
                            {t.bld_settings_address || (isEn ? "Building Address" : "Cím")} *
                          </label>
                          <input
                            type="text"
                            value={buildingAddress}
                            onChange={(e) => setBuildingAddress(e.target.value)}
                            placeholder={isEn ? "1051 Budapest, Example St. 1." : "1051 Budapest, Példa utca 1."}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#1E3A8A] bg-white text-gray-900"
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
                            onChange={(e) => setBuildingTaxNumber(formatTaxNumber(e.target.value))}
                            placeholder="12345678-1-42"
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A] bg-white text-gray-900"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-gray-700 mb-1">
                            {t.bld_settings_hrsz || (isEn ? "Land Registry No. (HRSZ)" : "Helyrajzi szám (hrsz.)")}
                          </label>
                          <input
                            type="text"
                            value={buildingHrsz}
                            onChange={(e) => setBuildingHrsz(e.target.value)}
                            placeholder={isEn ? "e.g. 12345/0" : "pl. 12345/0"}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-[#1E3A8A] bg-white text-gray-900"
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
                            onChange={(e) => setTotalOwnershipShare(e.target.value)}
                            placeholder="10000"
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-[#1E3A8A] bg-white text-gray-900"
                            required
                          />
                          <p className="text-[10px] text-gray-500 mt-1">
                            {t.bld_settings_total_share_desc || (isEn 
                              ? "Condominium deed basis for voting and shares (typically 10,000, 1,000, 100,000 or custom deed sum)." 
                              : "Az alapító okirat szerinti teljes eszmei hányad (általában 10 000, de lehet 1 000, 100 000 vagy egyedi összeg).")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Section A1b: Unified SZVB & Economic Auditor (Tht. 51/A. §) Card */}
                {!isAccountsOnly && szvbCompliance && (
                  <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-200/80 space-y-4">
                    {/* Unified Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-indigo-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-indigo-700" />
                          <span>
                            {t.szvb_section_title ||
                              (isEn
                                ? "Accounting Committee (SZVB) & Financial Audit"
                                : "Számvizsgáló Bizottság (SZVB) & Gazdasági ellenőrzés")}
                          </span>
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 text-[10px] font-bold">
                          {szvbCompliance.totalSzvbCount} {isEn ? "SZVB" : "SZVB fő"} &bull; {szvbCompliance.albetetCount} {isEn ? "units (HRSZ)" : "albetét"}
                        </span>
                      </div>

                      {!isEffectiveReadOnly && (
                        !isEditingSzvb ? (
                          <button
                            type="button"
                            onClick={() => setIsEditingSzvb(true)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 hover:text-indigo-900 text-indigo-700 text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                            title={t.szvb_edit_btn || (isEn ? "Edit SZVB & Financial Auditor" : "SZVB és gazdasági ellenőr szerkesztése")}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>{t.edit || (isEn ? "Edit" : "Szerkesztés")}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                resetSzvbAndAuditorDraft();
                                setIsEditingSzvb(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              <span>{t.cancel || (isEn ? "Cancel" : "Mégse")}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleSaveSection('szvb')}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-[11px] font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
                            >
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                              <span>{t.save || (isEn ? "Save" : "Mentés")}</span>
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    <p className="text-[11px] text-gray-600">
                      {t.szvb_readonly_desc || (isEn
                        ? "SZVB members are selected from existing condominium owners and receive strictly read-only audit access to building documents, contracts, bank balances, monthly cashflow, and arrears."
                        : "Az SZVB tagok a ház meglévő tulajdonosai közül jelölhetők ki, és saját lakói nézetük mellett szigorúan csak olvasási jogosultságot kapnak a ház irataihoz, pénzforgalmához, banki egyenlegeihez és a hátraléklistához.")}
                    </p>

                    {ownerCandidates.length === 0 ? (
                      <div className="p-3 rounded-xl bg-white border border-indigo-100 text-[11px] text-gray-500">
                        {isEn
                          ? "No registered owners found in this condominium yet. Add flats and owners first."
                          : "Még nincs rögzített tulajdonos ebben a társasházban. Először vegyél fel lakásokat és tulajdonosokat."}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. SZVB Chairperson (Elnök) */}
                        <div className="p-3 rounded-xl bg-white border border-indigo-100 space-y-2">
                          <label className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{t.szvb_role_chairperson || (isEn ? "SZVB Chairperson" : "SZVB Elnök")}</span>
                          </label>

                          {isEditingSzvb && !isEffectiveReadOnly ? (
                            <div className="space-y-2">
                              <select
                                value={szvbChairpersonKey}
                                onChange={(e) => handleSelectSzvbChairperson(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                              >
                                <option value="">
                                  {isEn ? "— Not assigned —" : "— Nincs kijelölve —"}
                                </option>
                                {ownerCandidates
                                  .filter((c) => !szvbMemberKeys.includes(c.key) || c.key === szvbChairpersonKey)
                                  .map((c) => (
                                    <option key={c.key} value={c.key}>
                                      {c.name}{c.flatNums.length > 0 ? ` (${c.flatNums.join(', ')}. ${isEn ? 'unit' : 'lakás'})` : ''}{c.email ? ` — ${c.email}` : ` (${isEn ? 'no email' : 'nincs e-mail'})`}
                                    </option>
                                  ))}
                              </select>

                              {draftSzvb.chairperson && (
                                <button
                                  type="button"
                                  disabled={!draftSzvb.chairperson.email}
                                  onClick={() => handleToggleSzvbPersonAsAuditor(draftSzvb.chairperson)}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                                    isSzvbPersonAuditor(draftSzvb.chairperson)
                                      ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                                      : 'bg-white hover:bg-teal-50 text-teal-800 border-teal-200'
                                  }`}
                                  title={
                                    !draftSzvb.chairperson.email
                                      ? (isEn ? 'Email address required on flat card' : 'E-mail cím szükséges a lakás adatlapján')
                                      : (isEn
                                          ? 'Mark this SZVB Chairperson as also serving as Financial Auditor (Tht. § 51/A)'
                                          : 'Jelöld be, ha az SZVB Elnök egyben a Gazdasági ellenőrzést segítő személy is (Tht. 51/A. §)')
                                  }
                                >
                                  <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {isSzvbPersonAuditor(draftSzvb.chairperson)
                                      ? (isEn ? 'Financial Auditor ✓' : 'Gazdasági ellenőr ✓')
                                      : (isEn ? 'Also Financial Auditor' : 'Gazdasági ellenőr is')}
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs">
                              {szvbCompliance.szvb.chairperson ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-gray-900">
                                      {szvbCompliance.szvb.chairperson.name}
                                    </span>
                                    {szvbCompliance.szvb.chairperson.flatNum && (
                                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                                        {szvbCompliance.szvb.chairperson.flatNum}. {isEn ? "unit" : "lakás"}
                                      </span>
                                    )}
                                    {isSzvbPersonAuditor(szvbCompliance.szvb.chairperson) && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                                        <ClipboardCheck className="w-3 h-3" />
                                        <span>{isEn ? "Financial Auditor" : "Gazdasági ellenőr"}</span>
                                      </span>
                                    )}
                                  </div>
                                  {szvbCompliance.szvb.chairperson.email ? (
                                    <span className="text-[11px] text-gray-500 font-mono">
                                      {szvbCompliance.szvb.chairperson.email}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-700 font-semibold">
                                      ⚠️ {isEn ? "No email set on flat — required for SZVB login" : "Nincs e-mail cím rögzítve — a belépéshez szükséges"}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">
                                  {isEn ? "Not assigned" : "Nincs kijelölve"}
                                </span>
                              )}
                            </div>
                          )}

                          {isEditingSzvb && draftSzvb.chairperson && !draftSzvb.chairperson.email && (
                            <p className="text-[10px] text-amber-700 font-semibold">
                              ⚠️ {isEn ? "This owner has no email address recorded yet — add one on the flat card so they can log in." : "Ennek a tulajdonosnak még nincs e-mail címe — add meg a lakás adatlapján, hogy be tudjon lépni."}
                            </p>
                          )}
                        </div>

                        {/* 2. SZVB Members (Tagok) */}
                        <div className="p-3 rounded-xl bg-white border border-indigo-100 space-y-2">
                          <label className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{t.szvb_role_members || (isEn ? "SZVB Members" : "SZVB Tagok")}</span>
                          </label>

                          {/* Assigned Members List */}
                          {(() => {
                            const activeMembers = isEditingSzvb ? draftSzvb.members : (szvbCompliance.szvb.members || []);
                            return activeMembers.length > 0 ? (
                              <div className="space-y-1.5">
                                {activeMembers.map((m) => {
                                  const isAud = isSzvbPersonAuditor(m);
                                  return (
                                    <div
                                      key={m.key}
                                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50/60 border border-indigo-100"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-gray-900">
                                          <span className="truncate">{m.name}</span>
                                          {m.flatNum && (
                                            <span className="px-1.5 py-0.2 rounded bg-white text-indigo-700 text-[10px] font-semibold border border-indigo-100 shrink-0">
                                              {m.flatNum}.
                                            </span>
                                          )}
                                          {!isEditingSzvb && isAud && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold shrink-0">
                                              <ClipboardCheck className="w-2.5 h-2.5" />
                                              <span>{isEn ? "Auditor" : "Gazd. ellenőr"}</span>
                                            </span>
                                          )}
                                        </div>
                                        {m.email ? (
                                          <div className="text-[10px] text-gray-500 font-mono truncate">{m.email}</div>
                                        ) : (
                                          <div className="text-[10px] text-amber-700 font-semibold">
                                            ⚠️ {isEn ? "No email set" : "Nincs e-mail"}
                                          </div>
                                        )}
                                      </div>
                                      {isEditingSzvb && !isEffectiveReadOnly && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            disabled={!m.email}
                                            onClick={() => handleToggleSzvbPersonAsAuditor(m)}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                              isAud
                                                ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                                                : 'bg-white hover:bg-teal-50 text-teal-800 border-teal-200'
                                            }`}
                                            title={
                                              !m.email
                                                ? (isEn ? 'Email address required on flat card' : 'E-mail cím szükséges a lakás adatlapján')
                                                : (isEn
                                                    ? 'Toggle Financial Auditor role for this SZVB member'
                                                    : 'Beállítás: ez az SZVB-tag egyben a Gazdasági ellenőrzést segítő személy is')
                                            }
                                          >
                                            <ClipboardCheck className="w-3 h-3 shrink-0" />
                                            <span>{isAud ? (isEn ? 'Auditor ✓' : 'Ellenőr ✓') : (isEn ? 'Auditor' : 'Ellenőr')}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveSzvbMember(m.key)}
                                            className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0"
                                            title={isEn ? "Remove member" : "Tag eltávolítása"}
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 italic">
                                {isEn ? "No SZVB members assigned" : "Nincs SZVB tag kijelölve"}
                              </div>
                            );
                          })()}

                          {/* Add Member Selector (edit mode only) */}
                          {isEditingSzvb && !isEffectiveReadOnly && (() => {
                            const availableForMember = ownerCandidates.filter(
                              (c) => c.key !== szvbChairpersonKey && !szvbMemberKeys.includes(c.key)
                            );
                            if (availableForMember.length === 0) return null;
                            return (
                              <div className="flex items-center gap-1.5 pt-1">
                                <select
                                  value={szvbAddMemberKey}
                                  onChange={(e) => setSzvbAddMemberKey(e.target.value)}
                                  className="flex-1 min-w-0 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 focus:bg-white focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="">
                                    {isEn ? "+ Select owner to add..." : "+ Tulajdonos kiválasztása..."}
                                  </option>
                                  {availableForMember.map((c) => (
                                    <option key={c.key} value={c.key}>
                                      {c.name}{c.flatNums.length > 0 ? ` (${c.flatNums.join(', ')}.)` : ''}{c.email ? ` — ${c.email}` : ''}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={!szvbAddMemberKey}
                                  onClick={handleAddSzvbMember}
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors flex-shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{isEn ? "Add" : "Hozzáad"}</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Unified Sub-Section: Economic Auditor (Gazdasági ellenőrzést segítő személy — Tht. 51/A. §) */}
                    <div className="pt-3.5 border-t border-indigo-200/70 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-teal-900">
                            <ClipboardCheck className="w-4 h-4 text-teal-700 shrink-0" />
                            <span>
                              {t.auditor_card_title ||
                                (isEn
                                  ? 'Financial Audit Assistant (Tht. § 51/A)'
                                  : 'Gazdasági ellenőrzést segítő személy (Tht. 51/A. §)')}
                            </span>
                          </h5>

                          {/* Compact Info "i" Icon with Hover & Click Tooltip */}
                          <div
                            className="relative inline-flex items-center"
                            onMouseEnter={() => setIsAuditorInfoHovered(true)}
                            onMouseLeave={() => setIsAuditorInfoHovered(false)}
                          >
                            <button
                              type="button"
                              onClick={() => setIsAuditorInfoPinned((prev) => !prev)}
                              className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
                                showAuditorInfoTooltip
                                  ? 'bg-teal-700 text-white border-teal-700'
                                  : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
                              }`}
                              aria-label={isEn ? 'More information about Financial Auditor' : 'Bővebb információ a gazdasági ellenőrről'}
                              aria-expanded={showAuditorInfoTooltip}
                            >
                              <Info className="w-3 h-3" />
                            </button>

                            {showAuditorInfoTooltip && (
                              <div
                                role="tooltip"
                                className="absolute left-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 z-40 w-72 sm:w-96 p-3 rounded-xl bg-gray-900 text-white text-[11px] leading-relaxed shadow-xl border border-gray-700"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p>
                                    {isEn
                                      ? 'Internal (owner) or external accountant/auditor professional with strictly inspection and advisory rights (checking bookkeeping, receipts, general assembly annual statement, uploading mandatory written professional opinion, and advising the SZVB). Mandatory over 50 units or 10M HUF annual turnover (unless an SZVB member holds the qualification).'
                                      : 'Belsős (tulajdonos) vagy külsős könyvelő/könyvvizsgáló szakember, tisztán ellenőrző és véleményező jogkörrel (könyvelés, bizonylatok, közgyűlési elszámolás ellenőrzése, kötelező írásbeli szakmai vélemény feltöltése és SZVB tanácsadás). 50 albetét vagy 10 millió Ft éves forgalom felett kötelező (kivéve képesített SZVB-tag esetén).'}
                                  </p>
                                  {isAuditorInfoPinned && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsAuditorInfoPinned(false);
                                        setIsAuditorInfoHovered(false);
                                      }}
                                      className="p-0.5 rounded text-gray-400 hover:text-white shrink-0 cursor-pointer"
                                      aria-label={isEn ? 'Close info' : 'Bezárás'}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {currentActiveAuditor ? (
                            <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                              {isCurrentAuditorInSzvb
                                ? (isEn ? 'Appointed (SZVB Member)' : 'Kijelölve (SZVB-tag)')
                                : currentActiveAuditor.type === 'internal'
                                  ? (isEn ? 'Appointed (Internal Owner)' : 'Kijelölve (Belsős tulajdonos)')
                                  : (isEn ? 'Appointed (External)' : 'Kijelölve (Külsős szakember)')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 text-[10px] font-bold">
                              {isEn ? 'Not appointed' : 'Nincs kijelölve'}
                            </span>
                          )}
                        </div>

                        {auditorCompliance && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-100 text-gray-700 font-semibold">
                              {isEn ? 'Units:' : 'Albetétek:'}{' '}
                              <strong className={auditorCompliance.triggeredByUnits ? 'text-red-700' : 'text-gray-900'}>
                                {auditorCompliance.albetetCount} / 50
                              </strong>
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-white border border-indigo-100 text-gray-700 font-semibold">
                              {isEn
                                ? `${auditorCompliance.turnoverYear} turnover:`
                                : `${auditorCompliance.turnoverYear}. forgalom:`}{' '}
                              <strong className={auditorCompliance.triggeredByTurnover ? 'text-red-700' : 'text-gray-900'}>
                                {formatCurrency(auditorCompliance.annualTurnoverHuf)}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {saveError && isEditingSzvb && (
                        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                          <span>{saveError}</span>
                        </div>
                      )}

                      {/* Read-Only Summary */}
                      {!isEditingSzvb ? (
                        <div className="p-3 rounded-xl bg-white border border-indigo-100 space-y-1.5 text-xs">
                          {currentActiveAuditor ? (
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span className="font-bold text-gray-900">
                                  👤 {currentActiveAuditor.name}
                                </span>
                                <span className="text-gray-600 font-mono text-[11px]">✉️ {currentActiveAuditor.email}</span>
                                {currentActiveAuditor.phone && (
                                  <span className="text-gray-600">📞 {currentActiveAuditor.phone}</span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                                {isCurrentAuditorInSzvb && (
                                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-semibold">
                                    {isEn ? 'SZVB Member' : 'SZVB-tag'}
                                  </span>
                                )}
                                {currentActiveAuditor.type === 'internal' && currentActiveAuditor.flatNum && (
                                  <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1E3A8A] font-semibold">
                                    {currentActiveAuditor.flatNum}. {isEn ? 'Flat' : 'lakás'}
                                  </span>
                                )}
                                {currentActiveAuditor.companyName && (
                                  <span>🏢 {currentActiveAuditor.companyName}</span>
                                )}
                                {currentActiveAuditor.registrationNumber && (
                                  <span className="font-mono">
                                    {isEn ? 'Reg. No.:' : 'Nyilv. szám:'} {currentActiveAuditor.registrationNumber}
                                  </span>
                                )}
                                {(currentActiveAuditor.validFrom || currentActiveAuditor.validTo) && (
                                  <span>
                                    📅 {currentActiveAuditor.validFrom || '...'} – {currentActiveAuditor.validTo || (isEn ? 'Indefinite' : 'Határozatlan')}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 italic">
                              {isEn
                                ? 'No Financial Auditor appointed yet. Click Edit to mark a qualified SZVB member above, or appoint an internal owner / external professional.'
                                : 'Még nincs kijelölve gazdasági ellenőrzést segítő személy. A Szerkesztés gombra kattintva egy SZVB-tag neve mellett is bekapcsolhatod, vagy belsős/külsős szakembert választhatsz.'}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Edit Form inside unified card */
                        <div className="p-3.5 rounded-xl bg-white border border-teal-200/90 space-y-3 text-xs">
                          {auditorMode === 'szvb_member' ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-teal-50/80 border border-teal-200">
                              <div className="flex items-center gap-2 min-w-0">
                                <ClipboardCheck className="w-4 h-4 text-teal-700 shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-teal-950 truncate">
                                    {isEn ? 'Appointed via SZVB member:' : 'SZVB-tag kijelölve gazdasági ellenőrként:'}{' '}
                                    <span>{auditorName}</span>
                                  </div>
                                  <div className="text-[11px] text-teal-800/80 font-mono truncate">{auditorEmail}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAuditorMode('external');
                                    setAuditorInternalKey('');
                                    setAuditorName('');
                                    setAuditorEmail('');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-white border border-teal-200 hover:bg-teal-100/60 text-teal-800 text-[10px] font-bold cursor-pointer transition-colors"
                                >
                                  {isEn ? 'Pick External Instead' : 'Külsős választása'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAuditorMode('none');
                                    setAuditorInternalKey('');
                                    setAuditorName('');
                                    setAuditorEmail('');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-white border border-gray-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-gray-600 text-[10px] font-bold cursor-pointer transition-colors"
                                >
                                  {isEn ? 'Clear' : 'Levétel'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Mode Selector: None / Internal Owner / External Professional */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {[
                                  { id: 'none', label: isEn ? 'None (Not appointed)' : 'Nincs kijelölve' },
                                  { id: 'internal', label: isEn ? 'Internal (Building Owner)' : 'Belsős (Tulajdonos)' },
                                  { id: 'external', label: isEn ? 'External Professional' : 'Külsős szakember' },
                                ].map((opt) => (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                      setAuditorMode(opt.id);
                                      setSaveError(null);
                                    }}
                                    className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                      auditorMode === opt.id
                                        ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>

                              {(draftSzvb.chairperson || draftSzvb.members.length > 0) && auditorMode === 'none' && (
                                <p className="text-[11px] text-teal-800/90 bg-teal-50/60 border border-teal-100 px-2.5 py-1.5 rounded-lg">
                                  💡 {isEn
                                    ? 'Tip: If one of your SZVB members above is also the Financial Auditor, simply click the "Auditor" button next to their name.'
                                    : 'Tipp: Ha a fenti SZVB-tagok valamelyike egyben a gazdasági ellenőr is, egyszerűen kapcsold be a neve melletti „Gazdasági ellenőr” gombot.'}
                                </p>
                              )}

                              {auditorMode === 'internal' && (
                                <div>
                                  <label className="block font-bold text-gray-700 mb-1">
                                    {isEn ? 'Select Owner from Building' : 'Tulajdonos kiválasztása a házból'} *
                                  </label>
                                  <select
                                    value={auditorInternalKey}
                                    onChange={(e) => {
                                      const key = e.target.value;
                                      setAuditorInternalKey(key);
                                      const c = candidateByKey.get(key);
                                      if (c) {
                                        setAuditorName(c.name || '');
                                        setAuditorEmail(c.email || '');
                                        // If the picked owner is already an SZVB member, seamlessly link as szvb_member
                                        const inSzvb =
                                          draftSzvb.chairperson?.key === key ||
                                          draftSzvb.members.some((m) => m.key === key);
                                        if (inSzvb) {
                                          setAuditorMode('szvb_member');
                                        }
                                      }
                                    }}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                                  >
                                    <option value="">{isEn ? '— Select an owner —' : '— Válassz tulajdonost —'}</option>
                                    {ownerCandidates.map((c) => (
                                      <option key={c.key} value={c.key} disabled={!c.email}>
                                        {c.name}
                                        {c.flatNums.length > 0 ? ` (${c.flatNums.join(', ')}.)` : ''}
                                        {c.email ? ` — ${c.email}` : (isEn ? ' (no email!)' : ' (nincs e-mail!)')}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {auditorMode === 'external' && (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block font-bold text-gray-700 mb-1">
                                        {isEn ? 'Full Name' : 'Teljes név'} *
                                      </label>
                                      <input
                                        type="text"
                                        value={auditorName}
                                        onChange={(e) => setAuditorName(e.target.value)}
                                        placeholder={isEn ? 'e.g. Dr. Anna Nagy' : 'pl. Dr. Nagy Anna'}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                                      />
                                    </div>
                                    <div>
                                      <label className="block font-bold text-gray-700 mb-1">
                                        {isEn ? 'Email Address (Login)' : 'E-mail cím (belépéshez)'} *
                                      </label>
                                      <input
                                        type="email"
                                        value={auditorEmail}
                                        onChange={(e) => setAuditorEmail(e.target.value)}
                                        placeholder="ellenor@konyvvizsgalo.hu"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                                      />
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-teal-800/80 flex items-center gap-1.5">
                                    <Mail className="w-3 h-3 shrink-0" />
                                    <span>
                                      {isEn
                                        ? 'On save, an automatic login / password-setup invitation email will be sent to the external professional if they do not have an account yet.'
                                        : 'Mentéskor a külsős szakember automatikusan megkapja a biztonságos belépési / jelszóbeállító meghívót e-mailben.'}
                                    </span>
                                  </p>
                                </div>
                              )}
                            </>
                          )}

                          {auditorMode !== 'none' && (
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                  <label className="block font-semibold text-gray-700 mb-1">
                                    {isEn ? 'Phone (optional)' : 'Telefonszám (opcionális)'}
                                  </label>
                                  <input
                                    type="tel"
                                    value={auditorPhone}
                                    onChange={(e) => setAuditorPhone(e.target.value)}
                                    placeholder="+36 30 123 4567"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                                  />
                                </div>
                                <div>
                                  <label className="block font-semibold text-gray-700 mb-1">
                                    {isEn ? 'Company / Audit Firm' : 'Könyvelő / Könyvvizsgáló cég'}
                                  </label>
                                  <input
                                    type="text"
                                    value={auditorCompany}
                                    onChange={(e) => setAuditorCompany(e.target.value)}
                                    placeholder="pl. Audit Kft."
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                                  />
                                </div>
                                <div>
                                  <label className="block font-semibold text-gray-700 mb-1">
                                    {isEn ? 'Chamber / Reg. Number' : 'Kamarai / Regisztrációs szám'}
                                  </label>
                                  <input
                                    type="text"
                                    value={auditorRegNum}
                                    onChange={(e) => setAuditorRegNum(e.target.value)}
                                    placeholder="pl. MKVK-001234"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:border-teal-600"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block font-semibold text-gray-700 mb-1">
                                    {isEn ? 'Engagement Start (optional)' : 'Megbízás kezdete (opcionális)'}
                                  </label>
                                  <input
                                    type="date"
                                    value={auditorValidFrom}
                                    onChange={(e) => setAuditorValidFrom(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                                  />
                                </div>
                                <div>
                                  <label className="block font-semibold text-gray-700 mb-1">
                                    {isEn ? 'Engagement End (empty = indefinite)' : 'Megbízás vége (üres = határozatlan)'}
                                  </label>
                                  <input
                                    type="date"
                                    value={auditorValidTo}
                                    onChange={(e) => setAuditorValidTo(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:border-teal-600"
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Save / Cancel bar inside SZVB & Financial Audit bubble (so user doesn't have to scroll back up) */}
                    {!isEffectiveReadOnly && isEditingSzvb && (
                      <div className="pt-3 border-t border-indigo-200/70 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            resetSzvbAndAuditorDraft();
                            setIsEditingSzvb(false);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{t.cancel || (isEn ? "Cancel" : "Mégse")}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveSection('szvb')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-[11px] font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-60"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          <span>{t.save || (isEn ? "Save" : "Mentés")}</span>
                        </button>
                      </div>
                    )}
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

                <div className="bg-gray-50/80 rounded-xl border border-gray-200/80 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-[#1E3A8A] text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4" />
                      <span>{t.bld_settings_tab_api || (isEn ? "Banking API Integration" : "Banki API Integráció")}</span>
                    </h4>
                    {!isEffectiveReadOnly && (
                      !isEditingApi ? (
                        <button
                          type="button"
                          onClick={() => setIsEditingApi(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:text-[#1E3A8A] hover:border-blue-200 text-gray-600 text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                          title={t.edit || (isEn ? "Edit API settings" : "API beállítások szerkesztése")}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>{t.edit || (isEn ? "Edit" : "Szerkesztés")}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              const bApi = targetBuilding?.bankApi || {};
                              setApiProvider(bApi.provider || 'OTP CorpAPI');
                              setApiEnv(bApi.environment || 'sandbox');
                              setApiClientId(bApi.clientId || '');
                              setApiAutoSync(bApi.autoSync !== undefined ? bApi.autoSync : true);
                              setIsEditingApi(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                            <span>{t.cancel || (isEn ? "Cancel" : "Mégse")}</span>
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => handleSaveSection('api')}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#1E3A8A] hover:bg-[#1e40af] text-white text-[11px] font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
                          >
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            <span>{t.save || (isEn ? "Save" : "Mentés")}</span>
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  {isEffectiveReadOnly || !isEditingApi ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-white border border-gray-200/80">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                          {t.settings_api_provider || "API Szolgáltató"}
                        </span>
                        <span className="block text-xs sm:text-[13px] font-bold text-gray-900">
                          {apiProvider === 'OTP CorpAPI' ? 'OTP Bank CorpAPI' : apiProvider}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-gray-200/80">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                          {t.settings_api_env || "Működési környezet"}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          apiEnv === 'production' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {apiEnv === 'production'
                            ? (t.settings_api_env_prod || "Éles (Production)")
                            : (t.settings_api_env_sandbox || "Sandbox (Teszt üzemmód)")}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-gray-200/80">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                          {t.settings_api_client_id || "Ügyfél-azonosító (Client ID)"}
                        </span>
                        <span className={`block text-xs sm:text-[13px] font-mono ${apiClientId ? 'font-semibold text-gray-900' : 'text-gray-400 italic font-sans'}`}>
                          {apiClientId || (isEn ? 'Not set' : 'Nincs megadva')}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
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
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">
                          {t.settings_api_provider || "API Szolgáltató"}
                        </label>
                        <select
                          value={apiProvider}
                          onChange={(e) => setApiProvider(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] bg-white text-gray-900"
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
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#1E3A8A] bg-white text-gray-900"
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
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:border-[#1E3A8A] bg-white text-gray-900"
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
                  )}

                  <div className="pt-2 border-t border-gray-200/70 flex flex-wrap items-center justify-between gap-3">
                    {isEffectiveReadOnly || !isEditingApi ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-gray-600">
                          {t.settings_api_autosync || "Automatikus napi számlatörténet-szinkronizáció éjfélkor"}:
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          apiAutoSync ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {apiAutoSync ? (isEn ? 'ENABLED' : 'BEKAPCSOLVA') : (isEn ? 'DISABLED' : 'KIKAPCSOLVA')}
                        </span>
                      </div>
                    ) : (
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
                    )}

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
      </form>
    </div>
  );
}

// Named alias export for backward compatibility
export { GlobalBalancesModal as BuildingSettingsModal };
