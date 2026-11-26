import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { IosSideDrawer } from './components/IosSideDrawer';
import { LoginView } from './views/LoginView';
import { TenantView } from './views/TenantView';
import { AdminView } from './views/AdminView';
import { SuperAdminView } from './views/SuperAdminView';
import { PortfolioView } from './views/PortfolioView';
import { getFirebaseInstance } from './constants/firebaseConfig';
import { verifyPasswordResetCode } from 'firebase/auth';
import { extractInviteContextFromUrl, normalizeEmail } from './utils/teamPermissions';

// Modals
import { CalendarModal } from './components/modals/CalendarModal';
import { FlatDetailModal } from './components/modals/FlatDetailModal';
import { UniversalTransactionModal } from './components/modals/UniversalTransactionModal';
import { EditTransactionModal } from './components/modals/EditTransactionModal';
import { GlobalBalancesModal } from './components/modals/GlobalBalancesModal';
import { AddFlatModal } from './components/modals/AddFlatModal';
import { EditFlatMasterModal } from './components/modals/EditFlatMasterModal';
import { FlatsDataModal } from './components/modals/FlatsDataModal';
import { FinancialSituationModal } from './components/modals/FinancialSituationModal';
import { DocumentsModal } from './components/modals/DocumentsModal';
import { LoansModal } from './components/modals/LoansModal';
import { AssemblyModal } from './components/modals/AssemblyModal';
import { ProfileModal } from './components/modals/ProfileModal';
import { BuildingSelectorModal } from './components/modals/BuildingSelectorModal';
import { AddBuildingModal } from './components/modals/AddBuildingModal';
import { TeamManagementModal } from './components/modals/TeamManagementModal';
import { FullscreenTxModal } from './components/modals/FullscreenTxModal';
import { CommunicationCenterModal } from './components/modals/CommunicationCenterModal';
import { 
  DeleteFlatConfirmModal, 
  DeleteTxConfirmModal, 
  DeleteDocConfirmModal, 
  QuickPayConfirmModal
} from './components/modals/ConfirmModals';
import { 
  ForgotPasswordModal, 
  ResetPasswordModal, 
  ChangePasswordModal, 
  HelpModal 
} from './components/modals/AuthModals';
import { SmartMobilePayModal } from './components/modals/SmartMobilePayModal';
import { InitialLoadingScreen } from './components/InitialLoadingScreen';

// Helper to parse navigation state from URL hash
const parseNavFromHash = (hashStr) => {
  if (!hashStr) return null;
  const clean = hashStr.replace(/^#/, '');
  if (!clean || clean.includes('pay=1') || clean.includes('mode=resetPassword')) return null;
  try {
    const params = new URLSearchParams(clean.includes('?') ? clean.split('?')[1] : clean);
    const flat = params.get('flat');
    const master = params.get('master');
    const bId = params.get('bId');
    const view = params.get('view');
    const from = params.get('from');

    if (flat || master || view) {
      return {
        flatDetailNum: flat || null,
        editFlatMasterData: master ? { buildingId: bId || undefined, flatNum: master } : null,
        isFlatsDataOpen: view === 'flats' || from === 'flats',
        isFinancialSituationOpen: view === 'finance',
        isDocumentsOpen: view === 'docs',
        isLoansOpen: view === 'loans',
        isAssemblyOpen: view === 'assembly',
        isCalendarOpen: view === 'calendar',
        calendarBuildingId: null,
        isGlobalBalancesOpen: view === 'balances',
        buildingSettingsTargetId: null,
        isProfileOpen: view === 'profile',
        fullscreenTxData: null
      };
    }
  } catch (e) {}
  return null;
};

// Helper to determine initial navigation state from URL hash and sessionStorage
const getInitialNavState = () => {
  try {
    let stateFromStorage = null;
    const stored = sessionStorage.getItem("tarsas_nav_state");
    if (stored) {
      try {
        stateFromStorage = JSON.parse(stored);
      } catch (e) {}
    }

    const fromHash = parseNavFromHash(window.location.hash);
    if (fromHash) {
      return {
        flatDetailNum: fromHash.flatDetailNum || stateFromStorage?.flatDetailNum || null,
        editFlatMasterData: fromHash.editFlatMasterData || stateFromStorage?.editFlatMasterData || null,
        isFlatsDataOpen: fromHash.isFlatsDataOpen || Boolean(stateFromStorage?.isFlatsDataOpen),
        isFinancialSituationOpen: fromHash.isFinancialSituationOpen || Boolean(stateFromStorage?.isFinancialSituationOpen),
        isDocumentsOpen: fromHash.isDocumentsOpen || Boolean(stateFromStorage?.isDocumentsOpen),
        isLoansOpen: fromHash.isLoansOpen || Boolean(stateFromStorage?.isLoansOpen),
        isAssemblyOpen: fromHash.isAssemblyOpen || Boolean(stateFromStorage?.isAssemblyOpen),
        isCalendarOpen: fromHash.isCalendarOpen || Boolean(stateFromStorage?.isCalendarOpen),
        calendarBuildingId: stateFromStorage?.calendarBuildingId || null,
        isGlobalBalancesOpen: fromHash.isGlobalBalancesOpen || Boolean(stateFromStorage?.isGlobalBalancesOpen),
        buildingSettingsTargetId: stateFromStorage?.buildingSettingsTargetId || null,
        isProfileOpen: fromHash.isProfileOpen || Boolean(stateFromStorage?.isProfileOpen),
        fullscreenTxData: stateFromStorage?.fullscreenTxData || null
      };
    }

    if (stateFromStorage && typeof stateFromStorage === 'object') {
      return stateFromStorage;
    }
  } catch (e) {
    console.warn("Could not get initial nav state:", e);
  }
  return null;
};

function MainLayout() {
  const { 
    state, 
    t,
    isInitialSyncDone, 
    isCloudSyncing, 
    addTransaction, 
    deleteItem, 
    deleteFlat, 
    deleteDocument, 
    resetFlatPassword,
    logout,
    isCurrentUserAdmin,
    getUserFlats,
    switchToKkMode,
    switchToTenantMode,
    switchToSzvbMode,
    openPortfolio,
    openBuildingAdmin,
    acceptTeamInvite,
    canUserManageBuilding,
    isUserBuildingViewer,
    markNotificationRead,
    showToast
  } = useApp();
  const { currentUser } = state;
  const isEn = state.currentLang === 'en';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const isSzvb = currentUser?.role === 'szvb';
  const canAuditBuilding = isAdmin || isSzvb;
  const isAdminUser = isCurrentUserAdmin(currentUser, state.users);
  const isManagingCurrentBuilding = isAdmin && canUserManageBuilding(state.currentBuildingId);
  const isCurrentBuildingViewer = isUserBuildingViewer(state.currentBuildingId);
  const myFlats = getUserFlats(currentUser, state.buildings);
  const hasMultipleRoles = isAdminUser && myFlats.length > 0;

  const [initialNavState] = useState(getInitialNavState);

  // Calendar modal state
  const [isCalendarOpen, setIsCalendarOpen] = useState(() => Boolean(initialNavState?.isCalendarOpen));
  const [calendarBuildingId, setCalendarBuildingId] = useState(() => initialNavState?.calendarBuildingId || null);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modal states
  const [flatDetailNum, setFlatDetailNum] = useState(() => initialNavState?.flatDetailNum || null);
  const [universalTxModalData, setUniversalTxModalData] = useState(null);
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [flatDetailAddTxNum, setFlatDetailAddTxNum] = useState(null);
  const [editTxData, setEditTxData] = useState(null); // { id, type }

  const handleOpenUniversalTx = (initOptions) => {
    if (!initOptions || initOptions.nativeEvent) {
      setUniversalTxModalData({});
      return;
    }
    if (typeof initOptions === 'string') {
      setUniversalTxModalData({
        scope: initOptions === 'Global' ? 'global' : 'single',
        flatNum: initOptions === 'Global' ? undefined : initOptions
      });
    } else if (typeof initOptions === 'object') {
      setUniversalTxModalData(initOptions);
    } else {
      setUniversalTxModalData({});
    }
  };
  const [isGlobalBalancesOpen, setIsGlobalBalancesOpen] = useState(() => Boolean(initialNavState?.isGlobalBalancesOpen));
  const [globalBalancesMode, setGlobalBalancesMode] = useState('full'); // 'accounts' (Bank accounts & reserves only) | 'full' (Building settings + Bank + API)
  const [buildingSettingsTargetId, setBuildingSettingsTargetId] = useState(() => initialNavState?.buildingSettingsTargetId || null);
  const [isAddFlatOpen, setIsAddFlatOpen] = useState(false);
  const [editFlatMasterData, setEditFlatMasterData] = useState(() => initialNavState?.editFlatMasterData || null); // { buildingId, flatNum }
  const [isFlatsDataOpen, setIsFlatsDataOpen] = useState(() => Boolean(initialNavState?.isFlatsDataOpen));
  const [isFinancialSituationOpen, setIsFinancialSituationOpen] = useState(() =>
    Boolean(initialNavState?.isFinancialSituationOpen || initialNavState?.isLoansOpen)
  );
  const [financeInitialTab, setFinanceInitialTab] = useState(() =>
    initialNavState?.isLoansOpen ? 'loans' : 'overview'
  );
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(() => Boolean(initialNavState?.isDocumentsOpen));
  const [isLoansOpen, setIsLoansOpen] = useState(false);
  const [isAssemblyOpen, setIsAssemblyOpen] = useState(() => Boolean(initialNavState?.isAssemblyOpen));
  const [isProfileOpen, setIsProfileOpen] = useState(() => Boolean(initialNavState?.isProfileOpen));
  const [isBuildingSelectorOpen, setIsBuildingSelectorOpen] = useState(false);
  const [isAddBuildingOpen, setIsAddBuildingOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [initialInviteUrlCtx] = useState(() =>
    extractInviteContextFromUrl(window.location.search, window.location.hash)
  );
  const [pendingInviteToken, setPendingInviteToken] = useState(() => initialInviteUrlCtx.inviteToken || '');
  const [prefilledLoginEmail, setPrefilledLoginEmail] = useState(() => initialInviteUrlCtx.email || '');
  const [passwordJustSet, setPasswordJustSet] = useState(() => Boolean(initialInviteUrlCtx.passwordSet && !initialInviteUrlCtx.oobCode));
  const [fullscreenTxData, setFullscreenTxData] = useState(() => initialNavState?.fullscreenTxData || null); // { type, flatNum }
  const [profileNavigation, setProfileNavigation] = useState(null); // { tileId, caseId, timestamp }
  const [isCommunicationCenterOpen, setIsCommunicationCenterOpen] = useState(false);
  const [communicationBuildingId, setCommunicationBuildingId] = useState('all');

  // Confirm modals
  const [deleteFlatNum, setDeleteFlatNum] = useState(null);
  const [deleteTxData, setDeleteTxData] = useState(null); // { id, type }
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [quickPayData, setQuickPayData] = useState(null); // { flatNum, accountType, amount }

  // Auth modals
  const [isForgotPassOpen, setIsForgotPassOpen] = useState(false);
  const [resetPassData, setResetPassData] = useState(null); // { email, oobCode, error }
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Standalone Mobile Pay assistant state (triggered by scanning QR code with camera)
  const [standalonePayData, setStandalonePayData] = useState(null);

  useEffect(() => {
    let params = new URLSearchParams(window.location.search);
    if (!params.get('pay') && window.location.hash) {
      const hashContent = window.location.hash.includes('?') 
        ? window.location.hash.split('?')[1] 
        : window.location.hash.replace(/^#/, '');
      params = new URLSearchParams(hashContent);
    }

    if (params.get('pay') === '1') {
      const rawFlat = (params.get('flat') || '').replace(/[\r\n/\\<>]/g, '').trim().slice(0, 24);
      const rawFund = params.get('fund') === 'FA' ? 'FA' : 'KK';
      const parsedAmt = Number(params.get('amt'));
      const safeAmt = Number.isFinite(parsedAmt) ? Math.min(50_000_000, Math.max(0, Math.round(parsedAmt))) : 0;
      const rawBId = (params.get('b') || '').trim();
      const safeBId = /^[a-zA-Z0-9_-]{1,64}$/.test(rawBId) ? rawBId : '';
      setStandalonePayData({
        flatNum: rawFlat,
        fundType: rawFund,
        amount: safeAmt,
        buildingId: safeBId
      });
    }
  }, []);

  // Parse URL on mount for Firebase Auth password reset / colleague activation link
  useEffect(() => {
    const urlCtx = extractInviteContextFromUrl(window.location.search, window.location.hash);

    if (urlCtx.mode === 'resetPassword' && urlCtx.oobCode) {
      const { auth } = getFirebaseInstance();
      if (auth) {
        verifyPasswordResetCode(auth, urlCtx.oobCode)
          .then((verifiedEmail) => {
            setResetPassData({
              email: verifiedEmail,
              oobCode: urlCtx.oobCode,
              isInviteSetup: Boolean(urlCtx.isInvitePasswordReset || urlCtx.inviteToken),
            });
          })
          .catch((err) => {
            console.warn("verifyPasswordResetCode error:", err);
            setResetPassData({
              isInviteSetup: Boolean(urlCtx.isInvitePasswordReset || urlCtx.inviteToken),
              error: "A jelszó-visszaállító hivatkozás érvénytelen vagy már lejárt. Kérjük, igényelj új hivatkozást a bejelentkezési oldalon!"
            });
          });
      }
      return;
    }

    // If colleague just returned from Firebase's hosted password-setup page (?passwordSet=1&email=...)
    // while another session was still open in this browser, switch cleanly to LoginView!
    if (urlCtx.passwordSet && urlCtx.email) {
      try {
        localStorage.setItem('tarsashaz_last_email', urlCtx.email);
      } catch {}
      if (currentUser && normalizeEmail(currentUser.email) !== normalizeEmail(urlCtx.email)) {
        logout();
      }
    }
  }, []);

  // Automatically process ?invite=<token> once the invited user is authenticated and cloud state has synced
  useEffect(() => {
    if (!pendingInviteToken || !currentUser || !isInitialSyncDone || resetPassData) return;
    if (prefilledLoginEmail && normalizeEmail(currentUser.email) !== normalizeEmail(prefilledLoginEmail)) {
      return;
    }
    const res = acceptTeamInvite(pendingInviteToken);
    if (!res?.success && res?.reason) {
      const isEn = state.currentLang === 'en';
      const errMsg =
        res.reason === 'email_mismatch'
          ? (isEn ? 'This invite link belongs to a different email address.' : 'Ez a meghívó link egy másik e-mail címhez tartozik.')
          : res.reason === 'expired'
          ? (isEn ? 'This invite link has expired. Ask the owner for a new link.' : 'Ez a meghívó link lejárt. Kérj új meghívót a tulajdonostól!')
          : (isEn ? 'Invite link is invalid or already used.' : 'A meghívó link érvénytelen vagy már fel lett használva.');
      showToast(errMsg, 'error');
    }
    setPendingInviteToken('');
    setPasswordJustSet(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      url.searchParams.delete('email');
      url.searchParams.delete('passwordSet');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch {}
  }, [pendingInviteToken, currentUser?.email, isInitialSyncDone, resetPassData]);

  // Global protection: Prevent mouse wheel from changing input[type=number] values anywhere
  useEffect(() => {
    const handleWheel = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
      if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
        e.target.blur();
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  // Lock background body scroll whenever any modal, tile, or dialog is open
  const isAnyModalOpen = Boolean(
    flatDetailNum ||
    universalTxModalData ||
    editFlatMasterData ||
    fullscreenTxData ||
    isAddTxOpen ||
    flatDetailAddTxNum ||
    editTxData ||
    isGlobalBalancesOpen ||
    isAddFlatOpen ||
    isBuildingSelectorOpen ||
    isAddBuildingOpen ||
    isTeamModalOpen ||
    isFlatsDataOpen ||
    isFinancialSituationOpen ||
    isDocumentsOpen ||
    isLoansOpen ||
    isAssemblyOpen ||
    isCalendarOpen ||
    isProfileOpen ||
    deleteFlatNum ||
    deleteTxData ||
    deleteDocId ||
    quickPayData ||
    isForgotPassOpen ||
    resetPassData ||
    isChangePassOpen ||
    isHelpOpen ||
    isDrawerOpen
  );

  // Ensure body scroll is always unlocked on mount
  useEffect(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  // Centralized body scroll lock: lock body scroll when any modal/drawer is open, unlock when closed
  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  // Comprehensive close all modals helper to guarantee clean return to home view
  const closeAllModals = () => {
    setIsFlatsDataOpen(false);
    setIsFinancialSituationOpen(false);
    setIsDocumentsOpen(false);
    setIsLoansOpen(false);
    setIsAssemblyOpen(false);
    setIsCalendarOpen(false);
    setIsProfileOpen(false);
    setFullscreenTxData(null);
    setFlatDetailNum(null);
    setUniversalTxModalData(null);
    setEditFlatMasterData(null);
    setIsAddTxOpen(false);
    setFlatDetailAddTxNum(null);
    setEditTxData(null);
    setIsGlobalBalancesOpen(false);
    setBuildingSettingsTargetId(null);
    setIsAddFlatOpen(false);
    setIsBuildingSelectorOpen(false);
    setIsAddBuildingOpen(false);
    setIsTeamModalOpen(false);
    setIsCommunicationCenterOpen(false);
    setIsDrawerOpen(false);
    setDeleteFlatNum(null);
    setDeleteTxData(null);
    setDeleteDocId(null);
    setQuickPayData(null);
    setIsForgotPassOpen(false);
    setResetPassData(null);
    setIsChangePassOpen(false);
    setIsHelpOpen(false);
    setProfileNavigation(null);

    try {
      sessionStorage.removeItem("tarsas_nav_state");
      const currentSearch = window.location.search || '';
      const currentHash = window.location.hash || '';
      if (!currentSearch.includes('mode=resetPassword') && !currentSearch.includes('pay=1') &&
          !currentHash.includes('mode=resetPassword') && !currentHash.includes('pay=1')) {
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    } catch (e) {}
  };

  // Automatically close all open modals when user logs out
  useEffect(() => {
    if (!currentUser) {
      closeAllModals();
      try {
        sessionStorage.removeItem("tarsas_nav_state");
        sessionStorage.removeItem("tarsashaz_session_user");
        if (window.location.hash && !window.location.hash.includes('mode=resetPassword') && !window.location.hash.includes('pay=1')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (e) {}
    }
  }, [currentUser]);

  // Synchronize active navigation and modal state to sessionStorage and URL hash across refreshes
  useEffect(() => {
    if (!currentUser) return;

    const navState = {
      flatDetailNum,
      editFlatMasterData,
      isFlatsDataOpen,
      isFinancialSituationOpen,
      isDocumentsOpen,
      isLoansOpen,
      isAssemblyOpen,
      isCalendarOpen,
      calendarBuildingId,
      isGlobalBalancesOpen,
      buildingSettingsTargetId,
      isProfileOpen,
      fullscreenTxData
    };

    const hasAnyActiveNav = Boolean(
      flatDetailNum ||
      editFlatMasterData ||
      isFlatsDataOpen ||
      isFinancialSituationOpen ||
      isDocumentsOpen ||
      isLoansOpen ||
      isAssemblyOpen ||
      isCalendarOpen ||
      isGlobalBalancesOpen ||
      isProfileOpen ||
      fullscreenTxData
    );

    try {
      if (hasAnyActiveNav) {
        sessionStorage.setItem("tarsas_nav_state", JSON.stringify(navState));
      } else {
        sessionStorage.removeItem("tarsas_nav_state");
      }

      const currentSearch = window.location.search || '';
      const currentHash = window.location.hash || '';
      if (currentSearch.includes('mode=resetPassword') || currentSearch.includes('pay=1') ||
          currentHash.includes('mode=resetPassword') || currentHash.includes('pay=1')) {
        return;
      }

      let newHash = '';
      if (editFlatMasterData?.flatNum) {
        newHash = `#master=${encodeURIComponent(editFlatMasterData.flatNum)}${editFlatMasterData.buildingId ? `&bId=${encodeURIComponent(editFlatMasterData.buildingId)}` : ''}${isFlatsDataOpen ? '&from=flats' : ''}`;
      } else if (flatDetailNum) {
        newHash = `#flat=${encodeURIComponent(flatDetailNum)}${isFlatsDataOpen ? '&from=flats' : ''}`;
      } else if (isFlatsDataOpen) {
        newHash = '#view=flats';
      } else if (isFinancialSituationOpen) {
        newHash = '#view=finance';
      } else if (isDocumentsOpen) {
        newHash = '#view=docs';
      } else if (isLoansOpen) {
        newHash = '#view=loans';
      } else if (isAssemblyOpen) {
        newHash = '#view=assembly';
      } else if (isCalendarOpen) {
        newHash = '#view=calendar';
      } else if (isGlobalBalancesOpen) {
        newHash = '#view=balances';
      } else if (isProfileOpen) {
        newHash = '#view=profile';
      }

      const targetUrl = newHash ? `${window.location.pathname}${newHash}` : window.location.pathname;
      if (window.location.pathname + window.location.hash !== targetUrl) {
        window.history.replaceState(null, '', targetUrl);
      }
    } catch (e) {
      console.warn("Could not synchronize nav state:", e);
    }
  }, [
    currentUser,
    flatDetailNum,
    editFlatMasterData,
    isFlatsDataOpen,
    isFinancialSituationOpen,
    isDocumentsOpen,
    isLoansOpen,
    isAssemblyOpen,
    isCalendarOpen,
    calendarBuildingId,
    isGlobalBalancesOpen,
    buildingSettingsTargetId,
    isProfileOpen,
    fullscreenTxData
  ]);

  // Handle browser Back / Forward buttons (hashchange)
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseNavFromHash(window.location.hash);
      if (!parsed) {
        if (!window.location.hash || window.location.hash === '#') {
          closeAllModals();
        }
        return;
      }
      setFlatDetailNum(parsed.flatDetailNum);
      setEditFlatMasterData(parsed.editFlatMasterData);
      setIsFlatsDataOpen(parsed.isFlatsDataOpen);
      setIsFinancialSituationOpen(parsed.isFinancialSituationOpen);
      setIsDocumentsOpen(parsed.isDocumentsOpen);
      setIsLoansOpen(parsed.isLoansOpen);
      setIsAssemblyOpen(parsed.isAssemblyOpen);
      setIsCalendarOpen(parsed.isCalendarOpen);
      setIsGlobalBalancesOpen(parsed.isGlobalBalancesOpen);
      setIsProfileOpen(parsed.isProfileOpen);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Automatically close all open modals when returning to superadmin from impersonation
  useEffect(() => {
    if (currentUser?.role === 'superadmin' && !state.impersonatedFrom) {
      closeAllModals();
    }
  }, [currentUser?.role, state.impersonatedFrom]);

  const handleDrawerOption = (action) => {
    closeAllModals();

    switch (action) {
      case 'logout':
        // User logged out, closeAllModals handles closing everything
        break;
      case 'main':
        // All modals closed, back to main dashboard
        break;
      case 'portfolio':
        openPortfolio();
        break;
      case 'team':
        if (isAdmin) setIsTeamModalOpen(true);
        break;
      case 'calendar':
        if (isAdmin) {
          setCalendarBuildingId(isAdmin && (state.isPortfolioView || !state.currentBuildingId) ? 'all' : state.currentBuildingId);
          setIsCalendarOpen(true);
        }
        break;
      case 'switch-to-tenant':
        switchToTenantMode();
        break;
      case 'switch-to-szvb':
        switchToSzvbMode();
        break;
      case 'switch-to-kk':
        switchToKkMode();
        break;
      case 'finance':
        setFinanceInitialTab('overview');
        setIsFinancialSituationOpen(true);
        break;
      case 'flats-data':
        if (canAuditBuilding) setIsFlatsDataOpen(true);
        break;
      case 'assembly':
        if (canAuditBuilding) setIsAssemblyOpen(true);
        break;
      case 'loans':
        setFinanceInitialTab('loans');
        setIsFinancialSituationOpen(true);
        break;
      case 'docs':
        setIsDocumentsOpen(true);
        break;
      case 'building-settings':
        if (isAdmin) {
          setBuildingSettingsTargetId(state.currentBuildingId);
          setGlobalBalancesMode('full');
          setIsGlobalBalancesOpen(true);
        }
        break;
      case 'profile':
        setIsProfileOpen(true);
        break;
      case 'profile-switcher':
        setIsBuildingSelectorOpen(true);
        break;
      default:
        break;
    }
  };

  const handleQuickPayConfirm = (flatNum, targetAccount, amount) => {
    const isKK = targetAccount === 'Közös Költség' || targetAccount === 'KK';
    const isFA = targetAccount === 'Felújítási Alap' || targetAccount === 'FA';
    const resolvedAccount = isKK ? 'Közös Költség' : (isFA ? 'Felújítási Alap' : targetAccount);
    const comment = isKK 
      ? "1 havi közös költség befizetés" 
      : (isFA ? "1 havi felújítási alap befizetés" : `1 havi ${targetAccount} befizetés`);

    addTransaction({
      id: `t-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      flatNum,
      targetAccount: resolvedAccount,
      amount: Number(amount) || 0,
      status: "Verified",
      method: "Bank Transfer",
      comment,
      includeInBalance: true
    });
  };

  const handleGoHome = () => {
    closeAllModals();
  };

  const handleNavigateToCase = (tileId, caseId) => {
    setFullscreenTxData(null);
    setFlatDetailNum(null);
    setProfileNavigation({ tileId, caseId, timestamp: Date.now() });
    setIsProfileOpen(true);
  };

  if (standalonePayData) {
    return (
      <div className="min-h-screen bg-[#F3F4F6] text-gray-900 flex flex-col justify-center items-center p-4 font-sans">
        <SmartMobilePayModal
          isOpen={true}
          isStandalone={true}
          onClose={() => {
            window.history.replaceState({}, '', window.location.pathname);
            setStandalonePayData(null);
          }}
          data={standalonePayData}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-gray-900 flex flex-col font-sans">
      
      {/* Global Top Cloud Sync Progress Bar (Linear / GitHub / Vercel style) */}
      {isCloudSyncing && (
        <div className="fixed top-0 left-0 right-0 z-[110] h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 animate-pulse shadow-sm pointer-events-none" />
      )}

      {/* Initial Cloud Sync Screen */}
      {!isInitialSyncDone && (
        <InitialLoadingScreen isEn={state.currentLang === 'en'} />
      )}

      {/* Header (shown when authenticated) */}
      {currentUser && (
        <Header
          onOpenDrawer={() => setIsDrawerOpen(true)}
          onOpenProfileSelector={() => {
            setIsBuildingSelectorOpen(true);
          }}
          onGoHome={handleGoHome}
          onGoPortfolio={() => {
            openPortfolio();
            closeAllModals();
          }}
          onSelectBuilding={(bId) => {
            openBuildingAdmin(bId);
            closeAllModals();
          }}
          onOpenCalendar={() => {
            setCalendarBuildingId(isAdmin && (state.isPortfolioView || !state.currentBuildingId) ? 'all' : state.currentBuildingId);
            setIsCalendarOpen(true);
          }}
          onOpenCommunicationCenter={() => {
            if (!isAdmin) return;
            setCommunicationBuildingId(state.isPortfolioView || !state.currentBuildingId ? 'all' : state.currentBuildingId);
            setIsCommunicationCenterOpen(true);
          }}
        />
      )}

      {/* Main View router */}
      <main className="flex-1 pb-12">
        {!currentUser ? (
          <LoginView
            onOpenForgotPassword={() => setIsForgotPassOpen(true)}
            onOpenHelp={() => setIsHelpOpen(true)}
            pendingInviteToken={pendingInviteToken}
            prefilledEmail={prefilledLoginEmail}
            passwordJustSet={passwordJustSet}
          />
        ) : currentUser.role === 'superadmin' ? (
          <SuperAdminView
            onOpenEditFlatMaster={(bId, fNum) => setEditFlatMasterData({ buildingId: bId, flatNum: fNum })}
          />
        ) : currentUser.role === 'admin' ? (
          state.isPortfolioView ? (
            <PortfolioView
              onSelectBuilding={(bId) => openBuildingAdmin(bId)}
              onOpenAddBuilding={() => setIsAddBuildingOpen(true)}
              onOpenTeamManagement={() => setIsTeamModalOpen(true)}
              onOpenCalendar={(bId) => {
                const targetId = typeof bId === 'string' ? bId : 'all';
                setCalendarBuildingId(targetId);
                setIsCalendarOpen(true);
              }}
              onOpenBuildingSettings={(bId) => {
                setBuildingSettingsTargetId(bId);
                setGlobalBalancesMode('full');
                setIsGlobalBalancesOpen(true);
              }}
            />
          ) : (
            <AdminView
              onBackToPortfolio={() => openPortfolio()}
              isReadOnly={!isManagingCurrentBuilding}
              onOpenFlatDetail={(fNum) => setFlatDetailNum(fNum)}
              onOpenAddTransaction={isManagingCurrentBuilding ? (init) => handleOpenUniversalTx(init) : undefined}
              onOpenAddFlat={isManagingCurrentBuilding ? () => setIsAddFlatOpen(true) : undefined}
              onOpenGlobalBalances={isManagingCurrentBuilding ? () => {
                setBuildingSettingsTargetId(state.currentBuildingId);
                setGlobalBalancesMode('accounts');
                setIsGlobalBalancesOpen(true);
              } : undefined}
              onOpenGlobalAddTx={isManagingCurrentBuilding ? () => handleOpenUniversalTx({ scope: 'global' }) : undefined}
              onOpenEditFlatMaster={(bId, fNum) => setEditFlatMasterData({ buildingId: bId, flatNum: fNum })}
              onOpenEditTx={(id, type, initialEditMode = false) => setEditTxData({ id, type, initialEditMode: isManagingCurrentBuilding ? initialEditMode : false })}
              onOpenDeleteFlatConfirm={isManagingCurrentBuilding ? (fNum) => setDeleteFlatNum(fNum) : undefined}
              onOpenDeleteTxConfirm={isManagingCurrentBuilding ? (id, type) => setDeleteTxData({ id, type }) : undefined}
              onOpenQuickPayConfirm={isManagingCurrentBuilding ? (flatNum, accountType, amount) => setQuickPayData({ flatNum, accountType, amount }) : undefined}
              onOpenFullscreenTx={(type) => setFullscreenTxData({ type, fromFlatDetail: false })}
              onNavigateToCase={handleNavigateToCase}
              onOpenAssembly={() => setIsAssemblyOpen(true)}
              onOpenLoans={() => {
                setFinanceInitialTab('loans');
                setIsFinancialSituationOpen(true);
              }}
              onOpenCalendar={() => {
                setCalendarBuildingId(state.currentBuildingId);
                setIsCalendarOpen(true);
              }}
            />
          )
        ) : currentUser.role === 'szvb' ? (
          <AdminView
            onBackToPortfolio={undefined}
            isReadOnly={true}
            onOpenFlatDetail={(fNum) => setFlatDetailNum(fNum)}
            onOpenAddTransaction={undefined}
            onOpenAddFlat={undefined}
            onOpenGlobalBalances={undefined}
            onOpenGlobalAddTx={undefined}
            onOpenEditFlatMaster={(bId, fNum) => setEditFlatMasterData({ buildingId: bId, flatNum: fNum })}
            onOpenEditTx={(id, type) => setEditTxData({ id, type, initialEditMode: false })}
            onOpenDeleteFlatConfirm={undefined}
            onOpenDeleteTxConfirm={undefined}
            onOpenQuickPayConfirm={undefined}
            onOpenFullscreenTx={(type) => setFullscreenTxData({ type, fromFlatDetail: false })}
            onNavigateToCase={handleNavigateToCase}
            onOpenAssembly={() => setIsAssemblyOpen(true)}
            onOpenLoans={() => {
              setFinanceInitialTab('loans');
              setIsFinancialSituationOpen(true);
            }}
            onOpenCalendar={undefined}
          />
        ) : (
          <TenantView
            onOpenFullscreenTx={(type) => setFullscreenTxData({ type, flatNum: currentUser.flatNum, fromFlatDetail: false })}
            onOpenFinanceModal={() => setIsFinancialSituationOpen(true)}
          />
        )}
      </main>

      {/* iOS Side Drawer */}
      <IosSideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSelectOption={handleDrawerOption}
      />

      {/* Fullscreen Views (z-40) */}
      <FlatsDataModal
        isOpen={Boolean(canAuditBuilding && isFlatsDataOpen)}
        onClose={() => setIsFlatsDataOpen(false)}
        isReadOnly={!isManagingCurrentBuilding}
        onOpenFlatDetail={(fNum) => {
          if (canAuditBuilding) setFlatDetailNum(fNum);
        }}
        onOpenEditFlatMaster={(bId, fNum) => {
          if (canAuditBuilding) setEditFlatMasterData({ buildingId: bId, flatNum: fNum });
        }}
        onOpenBuildingSettings={isManagingCurrentBuilding ? () => {
          setBuildingSettingsTargetId(state.currentBuildingId);
          setGlobalBalancesMode('full');
          setIsGlobalBalancesOpen(true);
        } : undefined}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenProfileSelector={() => setIsBuildingSelectorOpen(true)}
      />

      <FinancialSituationModal
        isOpen={Boolean(currentUser && isFinancialSituationOpen)}
        initialTab={financeInitialTab}
        isReadOnly={!isManagingCurrentBuilding}
        onClose={() => {
          setIsFinancialSituationOpen(false);
          setFinanceInitialTab('overview');
        }}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenProfileSelector={() => setIsBuildingSelectorOpen(true)}
        onOpenEditTx={isAdmin && isManagingCurrentBuilding ? (id, type, initialEditMode = true) => setEditTxData({ id, type, initialEditMode }) : undefined}
      />

      <DocumentsModal
        isOpen={Boolean(currentUser && isDocumentsOpen)}
        onClose={() => setIsDocumentsOpen(false)}
        isReadOnly={!isManagingCurrentBuilding}
        onOpenDeleteDocConfirm={(docId) => {
          if (isAdmin && isManagingCurrentBuilding) setDeleteDocId(docId);
        }}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenProfileSelector={() => setIsBuildingSelectorOpen(true)}
      />

      <CalendarModal
        isOpen={Boolean(currentUser && isAdmin && isCalendarOpen)}
        onClose={() => setIsCalendarOpen(false)}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        initialBuildingId={calendarBuildingId}
        isReadOnly={!isManagingCurrentBuilding}
      />

      <LoansModal
        isOpen={Boolean(currentUser && canAuditBuilding && isLoansOpen)}
        isReadOnly={!isManagingCurrentBuilding}
        onClose={() => setIsLoansOpen(false)}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenProfileSelector={() => setIsBuildingSelectorOpen(true)}
      />

      <AssemblyModal
        isOpen={Boolean(canAuditBuilding && isAssemblyOpen)}
        onClose={() => setIsAssemblyOpen(false)}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenProfileSelector={() => setIsBuildingSelectorOpen(true)}
      />

      <ProfileModal
        isOpen={Boolean(currentUser && isProfileOpen)}
        onClose={() => {
          setIsProfileOpen(false);
          setProfileNavigation(null);
        }}
        onOpenChangePassword={() => setIsChangePassOpen(true)}
        onOpenProfileSelector={() => setIsBuildingSelectorOpen(true)}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        profileNavigation={profileNavigation}
        onOpenTeamManagement={() => setIsTeamModalOpen(true)}
        onOpenEditTx={(id, type, initialEditMode = false) => {
          setEditTxData({ id, type, initialEditMode: isManagingCurrentBuilding ? initialEditMode : false });
        }}
      />

      <FullscreenTxModal
        isOpen={Boolean(currentUser && fullscreenTxData)}
        type={fullscreenTxData?.type || 'global'}
        flatNum={canAuditBuilding ? (fullscreenTxData?.flatNum || currentUser?.flatNum) : currentUser?.flatNum}
        isReadOnly={!isManagingCurrentBuilding}
        onClose={() => {
          const shouldReturnToFlatDetail = Boolean(
            canAuditBuilding &&
            fullscreenTxData?.fromFlatDetail &&
            fullscreenTxData?.flatNum
          );
          const targetFlat = shouldReturnToFlatDetail ? fullscreenTxData.flatNum : null;
          setFullscreenTxData(null);
          if (targetFlat) {
            setFlatDetailNum(targetFlat);
          }
        }}
        onOpenEditTx={(id, type, initialEditMode = false) => setEditTxData({ id, type, flatNum: fullscreenTxData?.flatNum, initialEditMode: isManagingCurrentBuilding ? initialEditMode : false })}
        onOpenDeleteTx={isAdmin && isManagingCurrentBuilding ? (id, type) => setDeleteTxData({ id, type, flatNum: fullscreenTxData?.flatNum }) : undefined}
        onNavigateToCase={handleNavigateToCase}
      />

      {/* Dialog Modals (z-50) */}
      <FlatDetailModal
        flatNum={flatDetailNum}
        isOpen={Boolean(canAuditBuilding && flatDetailNum)}
        onClose={() => setFlatDetailNum(null)}
        isReadOnly={!isManagingCurrentBuilding}
        onOpenAddTx={isManagingCurrentBuilding ? (fNum) => {
          handleOpenUniversalTx({ scope: 'single', flatNum: fNum });
        } : undefined}
        onOpenFullscreen={(type, fNum) => {
          setFlatDetailNum(null);
          setFullscreenTxData({ type, flatNum: fNum, fromFlatDetail: true });
        }}
        onOpenEditTx={(id, type, initialEditMode = false) => {
          setEditTxData({ id, type, flatNum: flatDetailNum, initialEditMode: isManagingCurrentBuilding ? initialEditMode : false });
        }}
        onOpenDeleteTx={isManagingCurrentBuilding ? (id, type) => {
          setDeleteTxData({ id, type, flatNum: flatDetailNum });
        } : undefined}
      />

      <EditFlatMasterModal
        buildingId={editFlatMasterData?.buildingId}
        flatNum={editFlatMasterData?.flatNum}
        isOpen={Boolean(canAuditBuilding && editFlatMasterData)}
        onClose={() => setEditFlatMasterData(null)}
      />

      <UniversalTransactionModal
        isOpen={Boolean(isAdmin && universalTxModalData && isManagingCurrentBuilding)}
        initialData={universalTxModalData}
        onClose={() => setUniversalTxModalData(null)}
      />

      <EditTransactionModal
        itemId={editTxData?.id}
        itemType={editTxData?.type}
        flatNum={editTxData?.flatNum}
        isOpen={Boolean(canAuditBuilding && editTxData)}
        isReadOnly={!isManagingCurrentBuilding}
        initialEditMode={Boolean(editTxData?.initialEditMode && isManagingCurrentBuilding)}
        onClose={() => setEditTxData(null)}
      />

      <GlobalBalancesModal
        isOpen={Boolean(isAdmin && isGlobalBalancesOpen)}
        buildingId={buildingSettingsTargetId || state.currentBuildingId}
        mode={globalBalancesMode}
        isReadOnly={!canUserManageBuilding(buildingSettingsTargetId || state.currentBuildingId)}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onClose={() => {
          setIsGlobalBalancesOpen(false);
          setGlobalBalancesMode('full');
          setBuildingSettingsTargetId(null);
        }}
      />

      <AddFlatModal
        isOpen={Boolean(isAdmin && isAddFlatOpen && isManagingCurrentBuilding)}
        onClose={() => setIsAddFlatOpen(false)}
      />

      <BuildingSelectorModal
        isOpen={isBuildingSelectorOpen}
        onClose={() => setIsBuildingSelectorOpen(false)}
        onOpenAddBuilding={() => setIsAddBuildingOpen(true)}
        onGoPortfolio={() => {
          openPortfolio();
          closeAllModals();
        }}
        onProfileSwitched={handleGoHome}
      />

      <AddBuildingModal
        isOpen={Boolean(isAdmin && isAddBuildingOpen)}
        onClose={() => setIsAddBuildingOpen(false)}
      />

      <TeamManagementModal
        isOpen={Boolean(isAdmin && isTeamModalOpen)}
        onClose={() => setIsTeamModalOpen(false)}
      />

      <CommunicationCenterModal
        isOpen={Boolean(isAdmin && isCommunicationCenterOpen)}
        initialBuildingId={communicationBuildingId}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onClose={() => setIsCommunicationCenterOpen(false)}
      />

      {/* Confirm & Alert Dialogs (z-60) */}
      <DeleteFlatConfirmModal
        isOpen={Boolean(isAdmin && deleteFlatNum)}
        flatNum={deleteFlatNum}
        onClose={() => setDeleteFlatNum(null)}
        onConfirm={(fNum) => {
          if (isAdmin) deleteFlat(fNum);
        }}
      />

      <DeleteTxConfirmModal
        isOpen={Boolean(isAdmin && deleteTxData)}
        itemId={deleteTxData?.id}
        itemType={deleteTxData?.type}
        onClose={() => setDeleteTxData(null)}
        onConfirm={(id, type) => {
          if (isAdmin) deleteItem(id, type, deleteTxData?.flatNum);
        }}
      />

      <DeleteDocConfirmModal
        isOpen={Boolean(isAdmin && deleteDocId)}
        docId={deleteDocId}
        onClose={() => setDeleteDocId(null)}
        onConfirm={(id) => {
          if (isAdmin) deleteDocument(id);
        }}
      />

      <QuickPayConfirmModal
        isOpen={Boolean(isAdmin && quickPayData)}
        flatNum={quickPayData?.flatNum}
        accountType={quickPayData?.accountType}
        amount={quickPayData?.amount}
        onClose={() => setQuickPayData(null)}
        onConfirm={handleQuickPayConfirm}
        onOpenDetailed={(flatNum, accountType, amount) => handleOpenUniversalTx({
          type: 'payment',
          scope: 'single',
          flatNum,
          targetAccount: accountType === 'KK' ? 'Közös Költség' : 'Felújítási Alap',
          amount,
          affectsBalance: true,
          comment: accountType === 'KK' ? "1 havi közös költség befizetés" : "1 havi felújítási alap befizetés"
        })}
      />

      {/* Auth Modals */}
      <ForgotPasswordModal
        isOpen={isForgotPassOpen}
        onClose={() => setIsForgotPassOpen(false)}
      />

      <ResetPasswordModal
        isOpen={Boolean(resetPassData)}
        email={resetPassData?.email}
        oobCode={resetPassData?.oobCode}
        initialError={resetPassData?.error}
        isInviteSetup={Boolean(resetPassData?.isInviteSetup)}
        onSuccessRedirectToLogin={(verifiedEmail) => {
          const clean = normalizeEmail(verifiedEmail);
          if (clean) {
            setPrefilledLoginEmail(clean);
            try {
              localStorage.setItem('tarsashaz_last_email', clean);
            } catch {}
          }
          setPasswordJustSet(true);
          if (currentUser) {
            logout();
          }
        }}
        onClose={() => {
          setResetPassData(null);
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {}
        }}
      />

      <ChangePasswordModal
        isOpen={isChangePassOpen}
        onClose={() => setIsChangePassOpen(false)}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
