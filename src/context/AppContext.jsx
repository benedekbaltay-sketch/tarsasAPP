import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { translations } from '../constants/translations';
import { getFirebaseInstance, IS_FIRESTORE_MODE, isCurrentTabSessionOnly } from '../constants/firebaseConfig';
import { ref, onValue, set, update, get } from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { recalculateFlatBalances } from '../utils/finances';
import { formatTaxNumber } from '../utils/taxNumber';
import { playNotificationSound } from '../utils/sound';
import { bindFirebaseServerTimeOffset } from '../utils/serverClock';
import { RotateCcw, X } from 'lucide-react';

import {
  getPermanentVault,
  savePermanentVault,
  mergeStateWithCloud,
  loadInitialState,
  stripLargeBinaries,
  stripSensitiveUserFields,
  stripSensitiveBuildingFields,
  sanitizeForFirebase,
  extractBuildingReservesMap,
  protectBuildingReserves,
  createCloudPayload
} from './syncEngine';

import {
  hydrateFirestoreSession,
  hydrateFirestoreBuilding,
  hydrateFirestoreBuildingFinancials,
  firestoreBuildingToUiBuilding,
  firestoreTransactionsToUiCollections,
  purgeSensitiveLocalStorage,
  normalizeRoleForFirestore,
} from '../services/firestoreAdapter';
import {
  fetchBuildingRoot,
  fetchPaginatedTransactions,
  updateUserPreferences,
  subscribeUserNotifications,
  subscribeOrganization,
  subscribeUserProfile,
  subscribeBuilding,
} from '../services/firestoreService';

import { createAuthActions } from './authActions';
import { createAccountingActions } from './accountingActions';
import { createBuildingActions } from './buildingActions';
import { createLoanActions } from './loanActions';
import { createCalendarActions } from './calendarActions';
import { createTeamActions } from './teamActions';
import { createEmailActions } from './emailActions';
import {
  resolveUserOrgContext,
  getAccessibleBuildings,
  canUserAccessBuilding,
  canUserManageBuilding,
  isUserBuildingViewer,
} from '../utils/teamPermissions';
import {
  getUserBuildingSzvbInfo,
  getUserSzvbRolesAcrossBuildings,
  isUserBuildingSzvb as checkUserBuildingSzvb,
} from '../utils/szvb';
import {
  getUserEconomicAuditorRolesAcrossBuildings,
  isUserBuildingEconomicAuditor as checkUserBuildingEconomicAuditor,
} from '../utils/economicAuditor';
import {
  resolveUserProfiles,
  resolveActiveProfileValidity,
  saveLastActiveProfile,
} from '../utils/userProfiles';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(loadInitialState);
  const [toast, setToast] = useState(null);
  const [copiedTx, setCopiedTx] = useState(null);
  const cloudInitialSyncDoneRef = useRef(false);
  const [isInitialSyncDone, setIsInitialSyncDone] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(true);
  const [cloudSyncStatus, setCloudSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'error'
  const [cloudSyncError, setCloudSyncError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const cloudSaveTimeoutRef = useRef(null);
  const isCloudSyncingRef = useRef(false);
  const pendingCloudSyncFnRef = useRef(null);
  const txCursorRef = useRef(null);
  const hydratedUidRef = useRef(null);
  const lastKnownCloudReservesRef = useRef(extractBuildingReservesMap(state.buildings || []));
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);

  const t = translations[state.currentLang] || translations.hu;

  const showToast = (msg, type = 'success', onUndo = null) => {
    let toastType = typeof type === 'string' ? type : (type?.type || 'success');
    let undoFn = typeof type === 'object' && type?.onUndo ? type.onUndo : onUndo;
    if (state.globalSettings?.soundEffectsEnabled !== false) {
      playNotificationSound(toastType);
    }
    setToast({ msg, type: toastType, id: Date.now(), onUndo: undoFn });
  };

  const toggleLanguage = () => {
    const nextLang = state.currentLang === 'hu' ? 'en' : 'hu';
    try { localStorage.setItem('tarsashaz_lang', nextLang); } catch {}
    if (IS_FIRESTORE_MODE && state.currentUser?.uid) {
      updateUserPreferences(state.currentUser.uid, { preferredLang: nextLang }).catch(() => {});
    }
    persistState(s => ({
      ...s,
      currentLang: nextLang
    }), 'localOnly');
  };

  const setLanguage = (lang) => {
    const validLang = lang === 'en' ? 'en' : 'hu';
    try { localStorage.setItem('tarsashaz_lang', validLang); } catch {}
    if (IS_FIRESTORE_MODE && state.currentUser?.uid) {
      updateUserPreferences(state.currentUser.uid, { preferredLang: validLang }).catch(() => {});
    }
    persistState(s => ({
      ...s,
      currentLang: validLang
    }), 'localOnly');
  };

  const updateRepProfile = (profileData) => {
    if (!isCurrentUserAdmin(state.currentUser, state.users)) return;
    const actorCtx = resolveUserOrgContext(state.currentUser, state.organizations, state.buildings);
    const isStaffActor = Boolean(actorCtx.isStaff);
    const nextRepProfile = isStaffActor ? state.repProfile : { ...(state.repProfile || {}), ...profileData };

    if (IS_FIRESTORE_MODE && state.currentUser?.uid) {
      updateUserPreferences(state.currentUser.uid, { repProfile: { ...(state.repProfile || {}), ...profileData } }).catch((err) => {
        console.warn('Firestore updateRepProfile error:', err.message);
      });
    }
    persistState(s => {
      const userEmail = (s.currentUser?.email || '').toLowerCase().trim();
      const updatedName = profileData.name !== undefined ? String(profileData.name).trim() : (s.currentUser?.name || '');
      const updatedPhone = profileData.phone !== undefined ? String(profileData.phone).trim() : undefined;
      const updatedOfficeHours = profileData.officeHours !== undefined ? String(profileData.officeHours).trim() : undefined;

      let nextCurrentUser = s.currentUser;
      if (nextCurrentUser) {
        nextCurrentUser = {
          ...nextCurrentUser,
          ...(updatedName ? { name: updatedName } : {}),
          ...(updatedPhone !== undefined ? { phone: updatedPhone } : {}),
          ...(updatedOfficeHours !== undefined ? { officeHours: updatedOfficeHours } : {}),
        };
        try {
          localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(nextCurrentUser));
          sessionStorage.setItem("tarsashaz_session_user", JSON.stringify(nextCurrentUser));
        } catch (e) {}
      }

      let nextUsers = s.users;
      if (Array.isArray(s.users) && userEmail) {
        nextUsers = s.users.map(u => {
          if (u && (u.email || '').toLowerCase().trim() === userEmail) {
            return {
              ...u,
              ...(updatedName ? { name: updatedName } : {}),
              ...(updatedPhone !== undefined ? { phone: updatedPhone } : {}),
              ...(updatedOfficeHours !== undefined ? { officeHours: updatedOfficeHours } : {}),
            };
          }
          return u;
        });
      }

      let nextOrgs = s.organizations;
      if (Array.isArray(s.organizations) && s.organizations.length > 0) {
        nextOrgs = s.organizations.map(org => {
          let updatedMembers = org.members;
          if (Array.isArray(org.members) && userEmail) {
            updatedMembers = org.members.map(m => {
              if (m && (m.email || '').toLowerCase().trim() === userEmail) {
                return {
                  ...m,
                  ...(updatedName ? { name: updatedName } : {}),
                  ...(updatedPhone !== undefined ? { phone: updatedPhone } : {}),
                  ...(updatedOfficeHours !== undefined ? { officeHours: updatedOfficeHours } : {}),
                };
              }
              return m;
            });
          }

          const orgOwnerEmail = (org.ownerEmail || '').toLowerCase().trim();
          if (!isStaffActor && userEmail && orgOwnerEmail === userEmail) {
            return {
              ...org,
              ...(updatedName ? { ownerName: updatedName } : {}),
              members: updatedMembers,
              ...(profileData.companyName !== undefined ? { name: String(profileData.companyName).trim() } : {}),
              ...(profileData.taxNumber !== undefined ? { taxNumber: formatTaxNumber(profileData.taxNumber).trim() } : {}),
              centralContact: {
                ...(org.centralContact || {}),
                name: updatedName || org.centralContact?.name || '',
                phone: updatedPhone !== undefined ? updatedPhone : (org.centralContact?.phone || ''),
                email: profileData.email ? String(profileData.email).trim() : (org.centralContact?.email || ''),
                officeHours: updatedOfficeHours !== undefined ? updatedOfficeHours : (org.centralContact?.officeHours || ''),
              },
              showCentralContactToResidents: profileData.showCentralContactToResidents !== undefined
                ? Boolean(profileData.showCentralContactToResidents)
                : org.showCentralContactToResidents
            };
          }
          return { ...org, members: updatedMembers };
        });
      }
      return {
        ...s,
        currentUser: nextCurrentUser,
        users: nextUsers,
        repProfile: nextRepProfile,
        organizations: nextOrgs
      };
    }, true);
    showToast(state.currentLang === 'en' ? "Profile updated!" : "Profil sikeresen mentve!");
  };

  const updateGlobalSettings = (settingsData) => {
    if (!isCurrentUserAdmin(state.currentUser, state.users)) return;
    const nextGlobalSettings = { ...(state.globalSettings || {}), ...settingsData };
    if (IS_FIRESTORE_MODE && state.currentUser?.uid) {
      updateUserPreferences(state.currentUser.uid, { globalSettings: nextGlobalSettings }).catch((err) => {
        console.warn('Firestore updateGlobalSettings error:', err.message);
      });
    }
    persistState(s => ({
      ...s,
      globalSettings: nextGlobalSettings
    }), true);
    showToast(state.currentLang === 'en' ? "System preferences updated!" : "Rendszerbeállítások sikeresen mentve!");
  };

  // --- Cloud Firestore Hydration & Pagination Helpers (D-1.1) ---
  const applyFirestoreSessionData = (sessionData) => {
    if (!sessionData || !sessionData.currentUser) return;
    purgeSensitiveLocalStorage();
    txCursorRef.current = sessionData.txPagination?.cursorDoc || null;
    setHasMoreTransactions(Boolean(sessionData.txPagination?.hasMore));

    const userCopy = stripSensitiveUserFields(sessionData.currentUser);
    hydratedUidRef.current = userCopy?.uid || null;
    const activeB = sessionData.activeBuilding || sessionData.buildings?.[0] || null;
    const isUserAdmin = userCopy.role === 'admin' || userCopy.role === 'superadmin';
    const isKkAdmin = userCopy.role === 'admin';

    setState(prev => {
      const keepActiveImpersonation = Boolean(
        prev.impersonatedFrom &&
        userCopy?.uid &&
        prev.impersonatedFrom.originalUser?.uid === userCopy.uid
      );
      const keepSwitchedProfile = Boolean(
        !keepActiveImpersonation &&
        prev.currentUser?.uid &&
        userCopy?.uid &&
        prev.currentUser.uid === userCopy.uid &&
        prev.currentUser.role !== userCopy.role
      );
      const preserveCurrentView = keepActiveImpersonation || keepSwitchedProfile;

      const next = {
        ...prev,
        currentLang: sessionData.preferredLang || prev.currentLang || 'hu',
        currentUser: preserveCurrentView ? prev.currentUser : userCopy,
        impersonatedFrom: keepActiveImpersonation ? prev.impersonatedFrom : null,
        activeRoleMode: preserveCurrentView ? prev.activeRoleMode : (isUserAdmin ? 'kk' : 'tenant'),
        isPortfolioView: preserveCurrentView
          ? prev.isPortfolioView
          : (isKkAdmin && (sessionData.buildings?.length || 0) > 1 ? true : false),
        currentBuildingId: preserveCurrentView ? prev.currentBuildingId : (activeB ? activeB.id : null),
        buildings: sessionData.buildings || [],
        users: sessionData.users || [],
        flats: activeB?.flats || [],
        transactions: activeB?.transactions || [],
        expenses: activeB?.expenses || [],
        manualDebits: activeB?.manualDebits || [],
        documents: activeB?.documents || [],
        docFolders: activeB?.docFolders || [],
        loans: activeB?.loans || [],
        infoSections: activeB?.infoSections || [],
        calendarEvents: sessionData.calendarEvents || [],
        organizations: sessionData.organizations || prev.organizations || [],
        notifications: sessionData.notifications || prev.notifications || [],
        emailRules: Array.isArray(sessionData.emailRules) && sessionData.emailRules.length > 0 ? sessionData.emailRules : prev.emailRules,
        emailOutbox: Array.isArray(sessionData.emailOutbox) ? sessionData.emailOutbox : (prev.emailOutbox || []),
        buildingInitialReserveCommon: activeB?.buildingInitialReserveCommon || 0,
        buildingInitialReserveRenovation: activeB?.buildingInitialReserveRenovation || 0,
        repProfile: sessionData.repProfile ? { ...prev.repProfile, ...sessionData.repProfile } : prev.repProfile,
        globalSettings: sessionData.globalSettings ? { ...prev.globalSettings, ...sessionData.globalSettings } : prev.globalSettings,
      };
      recalculateFlatBalances(next);
      return next;
    });
    cloudInitialSyncDoneRef.current = true;
    setIsInitialSyncDone(true);
    setIsCloudSyncing(false);
    setCloudSyncStatus('synced');
    setCloudSyncError(null);
    setLastSyncTime(new Date());
  };

  const reloadCurrentBuilding = async (targetBuildingId = null, { roleOverride = null } = {}) => {
    if (!IS_FIRESTORE_MODE) return null;
    const { auth } = getFirebaseInstance();
    const uid = auth?.currentUser?.uid || state.currentUser?.uid;
    const bId = targetBuildingId || state.currentBuildingId || state.buildings?.[0]?.id;
    if (!uid || !bId) return null;

    setIsCloudSyncing(true);
    setCloudSyncStatus('syncing');
    try {
      const membership = state.currentUser?.memberships?.[bId];
      const isSuperSession = Boolean(
        state.currentUser?.role === 'superadmin' ||
        state.currentUser?.isSuperAdmin === true ||
        state.impersonatedFrom?.originalUser?.role === 'superadmin' ||
        state.impersonatedFrom?.originalUser?.isSuperAdmin === true
      );
      const effectiveReadRole = isSuperSession
        ? 'superadmin'
        : (roleOverride || state.currentUser?.role || membership?.role || 'owner');
      const hydrated = await hydrateFirestoreBuilding(bId, {
        role: effectiveReadRole,
        uid,
        unitIds: membership?.unitIds || [],
        accessFromDate: state.currentUser?.accessFromDate || null,
      });
      if (!hydrated) return null;

      txCursorRef.current = hydrated.txPagination?.cursorDoc || null;
      setHasMoreTransactions(Boolean(hydrated.txPagination?.hasMore));

      setState(prev => {
        const exists = (prev.buildings || []).some(b => b.id === bId);
        const updatedBuildings = exists
          ? (prev.buildings || []).map(b => (b.id === bId ? hydrated.building : b))
          : [...(prev.buildings || []), hydrated.building];

        const next = {
          ...prev,
          buildings: updatedBuildings,
          currentBuildingId: bId,
          flats: hydrated.building.flats || [],
          transactions: hydrated.building.transactions || [],
          expenses: hydrated.building.expenses || [],
          manualDebits: hydrated.building.manualDebits || [],
          documents: hydrated.building.documents || [],
          docFolders: hydrated.building.docFolders || [],
          loans: hydrated.building.loans || [],
          infoSections: hydrated.building.infoSections || [],
          calendarEvents: hydrated.calendarEvents || [],
          users: hydrated.users.length > 0 ? hydrated.users : prev.users,
          buildingInitialReserveCommon: hydrated.building.buildingInitialReserveCommon || 0,
          buildingInitialReserveRenovation: hydrated.building.buildingInitialReserveRenovation || 0,
        };
        recalculateFlatBalances(next);
        return next;
      });
      setCloudSyncStatus('synced');
      setCloudSyncError(null);
      setLastSyncTime(new Date());
      return hydrated;
    } catch (err) {
      console.warn('Firestore reloadCurrentBuilding error:', err.message);
      setCloudSyncStatus('error');
      setCloudSyncError(err.message);
      return null;
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Lightweight background reconciler (3 tiny reads: building root + units + monthlySummaries)
  // so optimistic financial edits feel 0ms-instant while converging cleanly to authoritative server totals.
  const refreshBuildingFinancials = async (targetBuildingId = null) => {
    if (!IS_FIRESTORE_MODE) return null;
    const { auth } = getFirebaseInstance();
    const uid = auth?.currentUser?.uid || state.currentUser?.uid;
    const bId = targetBuildingId || state.currentBuildingId || state.buildings?.[0]?.id;
    if (!uid || !bId) return null;

    try {
      const membership = state.currentUser?.memberships?.[bId];
      const isSuperSession = Boolean(
        state.currentUser?.role === 'superadmin' ||
        state.currentUser?.isSuperAdmin === true ||
        state.impersonatedFrom?.originalUser?.role === 'superadmin' ||
        state.impersonatedFrom?.originalUser?.isSuperAdmin === true
      );
      const fin = await hydrateFirestoreBuildingFinancials(bId, {
        role: isSuperSession ? 'superadmin' : (state.currentUser?.role || membership?.role || 'owner'),
        uid,
      });
      if (!fin) return null;

      setState(prev => {
        const updatedBuildings = (prev.buildings || []).map(b => {
          if (!b || b.id !== bId) return b;
          return {
            ...b,
            firestoreBalances: fin.firestoreBalances,
            initialReserves: fin.initialReserves,
            buildingInitialReserveCommon: fin.buildingInitialReserveCommon,
            buildingInitialReserveRenovation: fin.buildingInitialReserveRenovation,
            aggregates: fin.aggregates,
            firestoreMonthlySummaries: fin.firestoreMonthlySummaries,
            flats: fin.flats.length > 0 ? fin.flats : (b.flats || []),
          };
        });
        const isCurrent = prev.currentBuildingId === bId || (!prev.currentBuildingId && updatedBuildings[0]?.id === bId);
        const next = {
          ...prev,
          buildings: updatedBuildings,
          ...(isCurrent ? {
            flats: fin.flats.length > 0 ? fin.flats : prev.flats,
            buildingInitialReserveCommon: fin.buildingInitialReserveCommon,
            buildingInitialReserveRenovation: fin.buildingInitialReserveRenovation,
          } : {}),
        };
        recalculateFlatBalances(next);
        return next;
      });
      setCloudSyncStatus('synced');
      setLastSyncTime(new Date());
      return fin;
    } catch (err) {
      console.warn('Firestore refreshBuildingFinancials warning:', err?.message);
      return null;
    }
  };

  const hydrateAndSwitchBuilding = async (buildingId, isPortfolio = false, refreshSession = false) => {
    if (!IS_FIRESTORE_MODE) return;
    if (refreshSession) {
      const { auth } = getFirebaseInstance();
      if (auth?.currentUser) {
        const sessionData = await hydrateFirestoreSession(auth.currentUser);
        if (sessionData) applyFirestoreSessionData(sessionData);
      }
    }
    if (buildingId) {
      // Switch into the building IMMEDIATELY (0ms latency) using cached/hydrated data in memory,
      // then silently reconcile fresh Firestore data in the background without blocking navigation!
      let wasAlreadyHydrated = false;
      setState(prev => {
        const targetB = (prev.buildings || []).find(b => b && b.id === buildingId);
        wasAlreadyHydrated = Boolean(targetB?.hydrated);
        const next = {
          ...prev,
          currentBuildingId: buildingId,
          isPortfolioView: Boolean(isPortfolio),
          currentUser: prev.currentUser ? { ...prev.currentUser, buildingId } : prev.currentUser,
          ...(targetB ? {
            flats: Array.isArray(targetB.flats) ? targetB.flats : prev.flats,
            transactions: Array.isArray(targetB.transactions) ? targetB.transactions : prev.transactions,
            expenses: Array.isArray(targetB.expenses) ? targetB.expenses : prev.expenses,
            manualDebits: Array.isArray(targetB.manualDebits) ? targetB.manualDebits : prev.manualDebits,
            documents: Array.isArray(targetB.documents) ? targetB.documents : prev.documents,
            docFolders: Array.isArray(targetB.docFolders) ? targetB.docFolders : prev.docFolders,
            loans: Array.isArray(targetB.loans) ? targetB.loans : prev.loans,
            infoSections: Array.isArray(targetB.infoSections) ? targetB.infoSections : prev.infoSections,
            buildingInitialReserveCommon: targetB.buildingInitialReserveCommon !== undefined ? targetB.buildingInitialReserveCommon : prev.buildingInitialReserveCommon,
            buildingInitialReserveRenovation: targetB.buildingInitialReserveRenovation !== undefined ? targetB.buildingInitialReserveRenovation : prev.buildingInitialReserveRenovation,
          } : {}),
        };
        recalculateFlatBalances(next);
        return next;
      });

      // Background refresh: lightweight 3-read financials if already hydrated, full hydrate if first visit
      if (wasAlreadyHydrated) {
        refreshBuildingFinancials(buildingId).catch(() => {});
      } else {
        reloadCurrentBuilding(buildingId).catch(() => {});
      }
    }
  };

  const loadMoreTransactions = async () => {
    if (!IS_FIRESTORE_MODE || !hasMoreTransactions || !txCursorRef.current) return;
    const bId = state.currentBuildingId || state.buildings?.[0]?.id;
    if (!bId || !state.currentUser) return;
    const fsRole = normalizeRoleForFirestore(state.currentUser.role);
    const isPrivileged = fsRole === 'admin' || fsRole === 'superadmin' || fsRole === 'szvb';

    try {
      const page = await fetchPaginatedTransactions({
        buildingId: bId,
        role: fsRole,
        visibility: isPrivileged ? null : 'building',
        pageSize: 50,
        cursorDoc: txCursorRef.current,
      });
      txCursorRef.current = page.nextCursor;
      setHasMoreTransactions(Boolean(page.hasMore));
      if (!page.items || page.items.length === 0) return;

      const curB = (state.buildings || []).find(b => b.id === bId);
      const { transactions: newTxs, expenses: newExps, manualDebits: newDebs } = firestoreTransactionsToUiCollections(
        page.items,
        curB?.customBankAccounts || []
      );

      setState(prev => {
        const mergeUnique = (existing, incoming) => {
          const seen = new Set((existing || []).map(x => x.id));
          return [...(existing || []), ...incoming.filter(x => !seen.has(x.id))];
        };
        const mergedTxs = mergeUnique(prev.transactions, newTxs);
        const mergedExps = mergeUnique(prev.expenses, newExps);
        const mergedDebs = mergeUnique(prev.manualDebits, newDebs);
        return {
          ...prev,
          transactions: mergedTxs,
          expenses: mergedExps,
          manualDebits: mergedDebs,
          buildings: (prev.buildings || []).map(b =>
            b.id === bId ? { ...b, transactions: mergedTxs, expenses: mergedExps, manualDebits: mergedDebs } : b
          ),
        };
      });
    } catch (err) {
      console.warn('Firestore loadMoreTransactions error:', err.message);
    }
  };

  // Helper to verify active Firebase Auth session (relying strictly on Firebase SDK persistence — never storing plaintext passwords)
  const ensureFirebaseAuth = async () => {
    const { auth } = getFirebaseInstance();
    if (!auth) return false;
    if (auth.currentUser) return true;
    try {
      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      }
    } catch (e) {
      console.warn("Firebase Auth state check warning:", e.message);
    }
    return Boolean(auth.currentUser);
  };

  const archiveFilesToStorage = async (cloudBuildings) => {
    const { rtdb, auth } = getFirebaseInstance();
    if (!rtdb || !Array.isArray(cloudBuildings)) return;
    try {
      if (auth && !auth.currentUser) await ensureFirebaseAuth();
      if (!auth || !auth.currentUser) return;

      for (const b of cloudBuildings) {
        if (!b) continue;
        if (Array.isArray(b.documents)) {
          for (const doc of b.documents) {
            if (doc && doc.id && doc.fileData && doc.fileData.length > 50) {
              await set(ref(rtdb, `condo_files/${doc.id}`), doc.fileData);
            }
          }
        }
        if (Array.isArray(b.infoSections)) {
          for (const sec of b.infoSections) {
            if (sec && Array.isArray(sec.items)) {
              for (const item of sec.items) {
                if (item && Array.isArray(item.attachments)) {
                  for (const att of item.attachments) {
                    if (att && att.id && att.fileData && att.fileData.length > 50) {
                      await set(ref(rtdb, `condo_files/${att.id}`), att.fileData);
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("archiveFilesToStorage warning:", e.message);
    }
  };

  // Sync state changes to LocalStorage and optionally Firebase RTDB
  // Supports syncMode:
  //   - 'localOnly' | false | null : local/session state only (zero cloud writes)
  //   - 'notificationsOnly'        : surgical RTDB update(condo_state, { notifications, revision, lastUpdated })
  //                                  (physically CANNOT touch buildings, flats, transactions, or reserves!)
  //   - true                       : full RTDB sync WITH ironclad reserve circuit-breaker guard
  //   - { allowReserveChange: true }: explicit admin balance calibration (updates reserve baseline)
  const persistState = (updaterFn, immediateCloud = true) => {
    return new Promise((resolve) => {
      setState(prevState => {
        const nextState = typeof updaterFn === 'function' ? updaterFn(prevState) : { ...prevState, ...updaterFn };
        const isLocalOnly = immediateCloud === 'localOnly' || immediateCloud === false || immediateCloud === null;
        const isNotificationsOnly = immediateCloud === 'notificationsOnly';
        const allowReserveChange = Boolean(
          immediateCloud && typeof immediateCloud === 'object' && immediateCloud.allowReserveChange === true
        );

        if (!isLocalOnly) {
          nextState.revision = (Number(nextState.revision) || 0) + 1;
          nextState.lastUpdated = Date.now();
        }

        if (!Array.isArray(nextState.manualDebits)) {
          nextState.manualDebits = [];
        }

        // Synchronize active building with building in buildings array ONLY when:
        // 1. A specific building is active (`nextState.currentBuildingId` is non-null)
        // 2. We did NOT switch buildings inside this updater (`prevState.currentBuildingId === nextState.currentBuildingId`)
        // 3. For initial reserves, respect whichever side (building object vs top-level) actually changed!
        //    NEVER let stale top-level values stomp a building's authoritative reserves.
        const sameActiveBuilding = Boolean(
          nextState.currentBuildingId &&
          prevState.currentBuildingId === nextState.currentBuildingId
        );

        if (nextState.buildings && nextState.currentBuildingId && sameActiveBuilding && !isNotificationsOnly) {
          const prevB = (prevState.buildings || []).find(x => x && x.id === prevState.currentBuildingId);
          const b = nextState.buildings.find(x => x && x.id === nextState.currentBuildingId);
          if (b) {
            b.flats = Array.isArray(nextState.flats) ? nextState.flats : [];
            b.transactions = Array.isArray(nextState.transactions) ? nextState.transactions : [];
            b.expenses = Array.isArray(nextState.expenses) ? nextState.expenses : [];
            b.manualDebits = Array.isArray(nextState.manualDebits) ? nextState.manualDebits : [];
            b.documents = Array.isArray(nextState.documents) ? nextState.documents : [];
            b.loans = Array.isArray(nextState.loans) ? nextState.loans : (b.loans || []);
            b.infoSections = nextState.infoSections !== undefined ? nextState.infoSections : (b.infoSections || []);

            const prevBCommon = prevB?.buildingInitialReserveCommon;
            const prevTopCommon = prevState.buildingInitialReserveCommon;
            const bCommonChanged = prevB && b.buildingInitialReserveCommon !== prevBCommon;
            const topCommonChanged = nextState.buildingInitialReserveCommon !== prevTopCommon;

            if (bCommonChanged) {
              nextState.buildingInitialReserveCommon = Number(b.buildingInitialReserveCommon) || 0;
            } else if (topCommonChanged && nextState.buildingInitialReserveCommon !== undefined) {
              b.buildingInitialReserveCommon = Number(nextState.buildingInitialReserveCommon) || 0;
            } else {
              const authoritativeCommon = b.buildingInitialReserveCommon !== undefined
                ? (Number(b.buildingInitialReserveCommon) || 0)
                : (Number(nextState.buildingInitialReserveCommon) || 0);
              b.buildingInitialReserveCommon = authoritativeCommon;
              nextState.buildingInitialReserveCommon = authoritativeCommon;
            }

            const prevBRenov = prevB?.buildingInitialReserveRenovation;
            const prevTopRenov = prevState.buildingInitialReserveRenovation;
            const bRenovChanged = prevB && b.buildingInitialReserveRenovation !== prevBRenov;
            const topRenovChanged = nextState.buildingInitialReserveRenovation !== prevTopRenov;

            if (bRenovChanged) {
              nextState.buildingInitialReserveRenovation = Number(b.buildingInitialReserveRenovation) || 0;
            } else if (topRenovChanged && nextState.buildingInitialReserveRenovation !== undefined) {
              b.buildingInitialReserveRenovation = Number(nextState.buildingInitialReserveRenovation) || 0;
            } else {
              const authoritativeRenov = b.buildingInitialReserveRenovation !== undefined
                ? (Number(b.buildingInitialReserveRenovation) || 0)
                : (Number(nextState.buildingInitialReserveRenovation) || 0);
              b.buildingInitialReserveRenovation = authoritativeRenov;
              nextState.buildingInitialReserveRenovation = authoritativeRenov;
            }

            if (!isLocalOnly) {
              b.lastUpdated = Date.now();
            }
          }
        }

        // Ironclad reserve circuit-breaker on in-memory state as well (unless explicitly calibrating or adding a new building)
        if (!isLocalOnly && !isNotificationsOnly && !allowReserveChange && Array.isArray(nextState.buildings)) {
          const guarded = protectBuildingReserves(
            nextState.buildings,
            lastKnownCloudReservesRef.current,
            { allowReserveChange: false }
          );
          if (guarded.blockedMutations.length > 0) {
            console.error('[RESERVE_GUARD] Blocked unexpected in-memory reserve mutation:', guarded.blockedMutations);
            nextState.buildings = guarded.buildings;
            if (nextState.currentBuildingId) {
              const restoredCurB = nextState.buildings.find(x => x && x.id === nextState.currentBuildingId);
              if (restoredCurB) {
                nextState.buildingInitialReserveCommon = Number(restoredCurB.buildingInitialReserveCommon) || 0;
                nextState.buildingInitialReserveRenovation = Number(restoredCurB.buildingInitialReserveRenovation) || 0;
              }
            }
          }
        }

        // Guarantee that all buildings have valid arrays and no undefined properties
        if (Array.isArray(nextState.buildings)) {
          nextState.buildings.forEach(b => {
            if (b) {
              if (!Array.isArray(b.flats)) b.flats = [];
              if (!Array.isArray(b.transactions)) b.transactions = [];
              if (!Array.isArray(b.expenses)) b.expenses = [];
              if (!Array.isArray(b.manualDebits)) b.manualDebits = [];
              if (!Array.isArray(b.documents)) b.documents = [];
              if (!Array.isArray(b.loans)) b.loans = [];
            }
          });
        }

        recalculateFlatBalances(nextState);

        // In Cloud Firestore mode: NEVER persist financial or PII state to localStorage or legacy RTDB.
        if (IS_FIRESTORE_MODE) {
          purgeSensitiveLocalStorage();
          resolve(nextState);
          return nextState;
        }

        // Legacy RTDB LocalStorage write - lightweight synchronous save without binaries, passwords, or banking API secrets
        if (nextState.currentUser) {
          try {
            const isTabSession = isCurrentTabSessionOnly();
            let savedLocalUser = null;
            if (isTabSession) {
              const rawRem = localStorage.getItem("tarsashaz_logged_in_user");
              if (rawRem) {
                try { savedLocalUser = JSON.parse(rawRem); } catch {}
              }
            } else {
              savedLocalUser = stripSensitiveUserFields(nextState.currentUser);
            }

            const cleanStateForLocal = {
              ...nextState,
              currentUser: savedLocalUser,
              users: (nextState.users || []).map(stripSensitiveUserFields),
              buildings: stripSensitiveBuildingFields(stripLargeBinaries(nextState.buildings || [], { stripInlineAttachments: true }))
            };
            localStorage.setItem("tarsashaz_state", JSON.stringify(cleanStateForLocal));
          } catch (e) {
            console.warn("LocalStorage save error:", e);
          }
        }

        // For local-only updates (login, logout, active flat, language), complete immediately without cloud mutation
        if (isLocalOnly) {
          resolve(nextState);
          return nextState;
        }

        // Cloud sync debounced or immediate
        if (cloudSaveTimeoutRef.current) {
          clearTimeout(cloudSaveTimeoutRef.current);
          cloudSaveTimeoutRef.current = null;
        }

        const syncToCloud = async () => {
          const { rtdb, auth } = getFirebaseInstance();
          if (!rtdb) {
            resolve(nextState);
            return;
          }

          // Auto-reconnect if needed
          if (auth && !auth.currentUser) {
            await ensureFirebaseAuth();
          }

          if (auth && !auth.currentUser) {
            console.warn("Cloud sync skipped: User is not authenticated in Firebase Auth.");
            setCloudSyncStatus('error');
            setCloudSyncError('unauthenticated');
            setIsCloudSyncing(false);
            isCloudSyncingRef.current = false;
            pendingCloudSyncFnRef.current = null;
            resolve(nextState);
            return;
          }

          isCloudSyncingRef.current = true;
          setIsCloudSyncing(true);
          setCloudSyncStatus('syncing');
          try {
            if (isNotificationsOnly) {
              // Surgical RTDB update: ONLY updates notifications + revision + lastUpdated.
              // Physically CANNOT touch buildings, flats, transactions, expenses, or initial reserves!
              const notifPatch = sanitizeForFirebase({
                notifications: (nextState.notifications || []).slice(0, 300),
                revision: Number(nextState.revision) || 0,
                lastUpdated: new Date().toISOString(),
              });
              await update(ref(rtdb, "condo_state"), notifPatch);
            } else {
              const payload = createCloudPayload(nextState, {
                authoritativeReservesMap: lastKnownCloudReservesRef.current,
                allowReserveChange,
              });
              await set(ref(rtdb, "condo_state"), payload);
              if (allowReserveChange) {
                lastKnownCloudReservesRef.current = extractBuildingReservesMap(payload.buildings || []);
              } else {
                // Register newly created buildings into baseline without altering existing buildings' baseline
                const currentMap = lastKnownCloudReservesRef.current || {};
                const nextMap = { ...currentMap };
                const freshMap = extractBuildingReservesMap(payload.buildings || []);
                for (const [bId, val] of Object.entries(freshMap)) {
                  if (!nextMap[bId]) nextMap[bId] = val;
                }
                lastKnownCloudReservesRef.current = nextMap;
              }
            }
            setCloudSyncStatus('synced');
            setCloudSyncError(null);
            setLastSyncTime(new Date());
          } catch (syncErr) {
            console.warn("Firebase RTDB sync error:", syncErr.message);
            setCloudSyncStatus('error');
            setCloudSyncError(syncErr.message);
          } finally {
            pendingCloudSyncFnRef.current = null;
            setTimeout(() => { 
              isCloudSyncingRef.current = false; 
              setIsCloudSyncing(false);
            }, 100);
            resolve(nextState);
          }
        };

        pendingCloudSyncFnRef.current = syncToCloud;
        syncToCloud();

        return nextState;
      });
    });
  };

  // Setup Cloud Firestore (D-1.1) OR Legacy Realtime Database synchronization listener
  useEffect(() => {
    // === MODE A: CLOUD FIRESTORE (Zero RTDB, Zero localStorage PII) ===
    if (IS_FIRESTORE_MODE) {
      purgeSensitiveLocalStorage();
      const { auth } = getFirebaseInstance();
      if (!auth) {
        cloudInitialSyncDoneRef.current = true;
        setIsInitialSyncDone(true);
        setIsCloudSyncing(false);
        return;
      }

      let isCancelled = false;
      const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (isCancelled) return;
        if (firebaseUser) {
          // If login() or an earlier auth callback already hydrated this exact UID,
          // NEVER re-hydrate over the user's active profile or SuperAdmin impersonation!
          if (hydratedUidRef.current === firebaseUser.uid) {
            cloudInitialSyncDoneRef.current = true;
            setIsInitialSyncDone(true);
            setIsCloudSyncing(false);
            return;
          }
          setIsCloudSyncing(true);
          setCloudSyncStatus('syncing');
          try {
            const sessionData = await hydrateFirestoreSession(firebaseUser);
            if (isCancelled || hydratedUidRef.current === firebaseUser.uid) {
              setIsCloudSyncing(false);
              return;
            }
            if (sessionData && sessionData.currentUser) {
              applyFirestoreSessionData(sessionData);
            } else {
              // Fail closed if user has no active Firestore membership
              hydratedUidRef.current = null;
              try { await signOut(auth); } catch {}
              cloudInitialSyncDoneRef.current = true;
              setIsInitialSyncDone(true);
              setIsCloudSyncing(false);
            }
          } catch (err) {
            if (isCancelled) return;
            console.warn("Firestore auth hydration warning:", err.message);
            setCloudSyncStatus('error');
            setCloudSyncError(err.message);
            cloudInitialSyncDoneRef.current = true;
            setIsInitialSyncDone(true);
            setIsCloudSyncing(false);
          }
        } else {
          hydratedUidRef.current = null;
          purgeSensitiveLocalStorage();
          try { sessionStorage.removeItem("tarsashaz_session_user"); } catch {}
          txCursorRef.current = null;
          setHasMoreTransactions(false);
          setState(prev => prev.currentUser ? {
            ...prev,
            currentUser: null,
            impersonatedFrom: null,
            activeRoleMode: null,
            isPortfolioView: false,
            currentBuildingId: null,
            buildings: [],
            users: [],
            flats: [],
            transactions: [],
            expenses: [],
            manualDebits: [],
            documents: [],
            docFolders: [],
            loans: [],
            infoSections: [],
            calendarEvents: []
          } : prev);
          cloudInitialSyncDoneRef.current = true;
          setIsInitialSyncDone(true);
          setIsCloudSyncing(false);
        }
      });

      return () => {
        isCancelled = true;
        unsubscribeAuth();
      };
    }

    // === MODE B: LEGACY RTDB ===
    const { rtdb, auth } = getFirebaseInstance();
    if (!rtdb) {
      cloudInitialSyncDoneRef.current = true;
      setIsInitialSyncDone(true);
      setIsCloudSyncing(false);
      return;
    }

    const stateRef = ref(rtdb, "condo_state");
    let unsubscribeRtdb = null;

    // Safety timeout: if completely offline or slow network, unlock after 7s
    const offlineSafetyTimeout = setTimeout(() => {
      if (!cloudInitialSyncDoneRef.current) {
        cloudInitialSyncDoneRef.current = true;
        setIsInitialSyncDone(true);
        setIsCloudSyncing(false);
      }
    }, 7000);

    const setupRtdbListener = () => {
      if (unsubscribeRtdb) {
        unsubscribeRtdb();
        unsubscribeRtdb = null;
      }
      unsubscribeRtdb = onValue(stateRef, snapshot => {
        if (isCloudSyncingRef.current) return;
        const cloudData = snapshot.val();
        if (cloudData && cloudData.buildings && cloudData.buildings.length > 0) {
          lastKnownCloudReservesRef.current = extractBuildingReservesMap(cloudData.buildings);
          // Asynchronously archive any inline fileData to dedicated condo_files storage node
          setTimeout(() => {
            archiveFilesToStorage(cloudData.buildings);
          }, 150);

          setState(localState => {
            const localRevision = Number(localState.revision) || 0;
            const cloudRevision = Number(cloudData.revision) || 0;
            const merged = mergeStateWithCloud(localState, cloudData);

            try {
              if (merged.currentUser) {
                const cleanLocal = {
                  ...merged,
                  currentUser: stripSensitiveUserFields(merged.currentUser),
                  users: (merged.users || []).map(stripSensitiveUserFields),
                  buildings: stripSensitiveBuildingFields(stripLargeBinaries(merged.buildings || [], { stripInlineAttachments: true }))
                };
                localStorage.setItem("tarsashaz_state", JSON.stringify(cleanLocal));
              }
            } catch (e) {}

            cloudInitialSyncDoneRef.current = true;
            setIsInitialSyncDone(true);
            setIsCloudSyncing(false);
            setCloudSyncStatus('synced');
            setCloudSyncError(null);
            setLastSyncTime(new Date());

            // The ONLY reason local pushes back to cloud is if local genuinely had uncommitted offline user edits (localRevision > cloudRevision)
            const localHasPendingChanges = localRevision > cloudRevision;

            if (localHasPendingChanges) {
              setTimeout(async () => {
                const { rtdb: curRtdb, auth: curAuth } = getFirebaseInstance();
                if (!curRtdb) return;
                if (curAuth && !curAuth.currentUser) await ensureFirebaseAuth();
                if (curAuth && curAuth.currentUser) {
                  merged.revision = Math.max(localRevision, cloudRevision) + 1;
                  const payload = createCloudPayload(merged, {
                    authoritativeReservesMap: lastKnownCloudReservesRef.current,
                    allowReserveChange: false,
                  });
                  set(ref(curRtdb, "condo_state"), payload)
                    .then(() => {
                      setCloudSyncStatus('synced');
                      setCloudSyncError(null);
                      setLastSyncTime(new Date());
                    })
                    .catch(err => {
                      console.warn("Failed to push authoritative local revision to cloud:", err.message);
                      setCloudSyncStatus('error');
                      setCloudSyncError(err.message);
                    });
                }
              }, 50);
            }

            return merged;
          });
        } else if (!cloudData && !cloudInitialSyncDoneRef.current) {
          cloudInitialSyncDoneRef.current = true;
          setIsInitialSyncDone(true);
          setIsCloudSyncing(false);
        }
      }, (err) => {
        console.warn("Firebase RTDB sync error:", err.message);
        // Only mark initial sync done if no remembered user exists (so LoginView can show).
        // If a user session is remembered, we keep the loading spinner until auth finishes reconnecting.
        try {
          const hasStoredUser = Boolean(localStorage.getItem("tarsashaz_logged_in_user"));
          if (!hasStoredUser) {
            cloudInitialSyncDoneRef.current = true;
            setIsInitialSyncDone(true);
          }
        } catch (e) {
          cloudInitialSyncDoneRef.current = true;
          setIsInitialSyncDone(true);
        }
        setIsCloudSyncing(false);
        setCloudSyncStatus('error');
        setCloudSyncError(err.message);
      });
    };

    // Attach immediately only if already authenticated (otherwise onAuthStateChanged attaches after auth resolves)
    if (!auth || auth.currentUser) {
      setupRtdbListener();
    }

    // Re-attach whenever Firebase Auth signs in or restores session token
    let unsubscribeAuth = null;
    if (auth) {
      unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setCloudSyncStatus('synced');
          setCloudSyncError(null);
          setupRtdbListener();
        } else {
          // No verified Firebase Auth session: clear any stale cached session and show LoginView
          if (unsubscribeRtdb) {
            unsubscribeRtdb();
            unsubscribeRtdb = null;
          }
          const isTabSession = isCurrentTabSessionOnly();
          if (!isTabSession) {
            try {
              localStorage.removeItem("tarsashaz_logged_in_user");
              localStorage.removeItem("tarsashaz_remember_me");
              localStorage.removeItem("tarsashaz_state");
            } catch (e) {}
          }
          try {
            sessionStorage.removeItem("tarsashaz_session_user");
          } catch (e) {}
          setState(prev => prev.currentUser ? {
            ...prev,
            currentUser: null,
            impersonatedFrom: null,
            activeRoleMode: null,
            isPortfolioView: false,
            buildings: [],
            users: [],
            flats: [],
            transactions: [],
            expenses: [],
            manualDebits: [],
            documents: [],
            docFolders: [],
            loans: [],
            infoSections: [],
            calendarEvents: []
          } : prev);
          cloudInitialSyncDoneRef.current = true;
          setIsInitialSyncDone(true);
          setIsCloudSyncing(false);
        }
      });
    }

    // Handle tab wake, regain focus, or reconnect
    let lastWakeCall = 0;
    const handleWake = async () => {
      const now = Date.now();
      if (now - lastWakeCall < 2000) return;
      lastWakeCall = now;

      if (isCloudSyncingRef.current) return;

      const { rtdb: curRtdb, auth: curAuth } = getFirebaseInstance();
      if (!curRtdb) return;

      if (curAuth && !curAuth.currentUser) {
        await ensureFirebaseAuth();
      }

      if (curAuth && !curAuth.currentUser) {
        setCloudSyncStatus('error');
        setCloudSyncError('unauthenticated');
        return;
      }

      setIsCloudSyncing(true);
      get(stateRef).then(snapshot => {
        const cloudData = snapshot.val();
        if (cloudData && cloudData.buildings) {
          lastKnownCloudReservesRef.current = extractBuildingReservesMap(cloudData.buildings);
          setState(local => {
            const localRevision = Number(local.revision) || 0;
            const cloudRevision = Number(cloudData.revision) || 0;

            const merged = mergeStateWithCloud(local, cloudData);

            try {
              if (merged.currentUser) {
                const cleanLocal = {
                  ...merged,
                  currentUser: stripSensitiveUserFields(merged.currentUser),
                  users: (merged.users || []).map(stripSensitiveUserFields),
                  buildings: stripSensitiveBuildingFields(stripLargeBinaries(merged.buildings || [], { stripInlineAttachments: true }))
                };
                localStorage.setItem("tarsashaz_state", JSON.stringify(cleanLocal));
              }
            } catch (e) {}

            const localHasPendingChanges = localRevision > cloudRevision;

            if (localHasPendingChanges) {
              setTimeout(async () => {
                const { rtdb: cRtdb, auth: cAuth } = getFirebaseInstance();
                if (!cRtdb) return;
                if (cAuth && !cAuth.currentUser) await ensureFirebaseAuth();
                if (cAuth && cAuth.currentUser) {
                  merged.revision = Math.max(localRevision, cloudRevision) + 1;
                  const payload = createCloudPayload(merged, {
                    authoritativeReservesMap: lastKnownCloudReservesRef.current,
                    allowReserveChange: false,
                  });
                  set(ref(cRtdb, "condo_state"), payload).catch(console.warn);
                }
              }, 50);
            }

            return merged;
          });
          setCloudSyncStatus('synced');
          setCloudSyncError(null);
          setLastSyncTime(new Date());
        }
      }).catch((e) => {
        console.warn("Wake snapshot fetch warning:", e.message);
        setCloudSyncStatus('error');
        setCloudSyncError(e.message);
      })
      .finally(() => {
        setIsCloudSyncing(false);
      });
    };

    window.addEventListener("focus", handleWake);
    window.addEventListener("online", handleWake);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleWake();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Safeguard active in-flight saves on beforeunload / pagehide
    const handleBeforeUnload = (e) => {
      if (cloudSaveTimeoutRef.current) {
        clearTimeout(cloudSaveTimeoutRef.current);
        cloudSaveTimeoutRef.current = null;
        if (pendingCloudSyncFnRef.current) {
          pendingCloudSyncFnRef.current();
        }
      }

      if (isCloudSyncingRef.current || pendingCloudSyncFnRef.current) {
        e.preventDefault();
        const msg = state.currentLang === 'en'
          ? "A cloud save is currently in progress. Are you sure you want to leave?"
          : "A módosítások mentése folyamatban van a felhőbe. Biztosan elhagyja az oldalt?";
        e.returnValue = msg;
        return msg;
      }
    };

    const handlePageHide = () => {
      if (cloudSaveTimeoutRef.current) {
        clearTimeout(cloudSaveTimeoutRef.current);
        cloudSaveTimeoutRef.current = null;
        if (pendingCloudSyncFnRef.current) {
          pendingCloudSyncFnRef.current();
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      if (unsubscribeRtdb) unsubscribeRtdb();
      if (unsubscribeAuth) unsubscribeAuth();
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("online", handleWake);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [state.currentUser?.email]);

  // Manual re-synchronization with cloud on demand
  const refreshFromCloud = async (showNotification = true) => {
    if (IS_FIRESTORE_MODE) {
      const res = await reloadCurrentBuilding();
      if (showNotification) {
        if (res) {
          showToast(state.currentLang === 'en' ? "Data refreshed from cloud!" : "Adatok sikeresen frissítve a felhőből!");
        } else {
          showToast(
            state.currentLang === 'en'
              ? "Failed to refresh from cloud. Please log in again!"
              : "Nem sikerült a felhőből frissíteni. Kérjük, lépj ki és jelentkezz be újra!",
            "error"
          );
        }
      }
      return;
    }

    const { rtdb, auth } = getFirebaseInstance();
    if (!rtdb) return;
    setIsCloudSyncing(true);
    setCloudSyncStatus('syncing');

    try {
      if (auth && !auth.currentUser) {
        await ensureFirebaseAuth();
      }

      if (auth && !auth.currentUser) {
        setCloudSyncStatus('error');
        setCloudSyncError('unauthenticated');
        if (showNotification) {
          showToast(
            state.currentLang === 'en'
              ? "Session expired or password changed. Please log in again to sync!"
              : "A munkamenet lejárt (a jelszó megváltozott). Kérjük, lépj ki és jelentkezz be újra!",
            "warning"
          );
        }
        return;
      }

      const stateRef = ref(rtdb, "condo_state");
      const snapshot = await get(stateRef);
      const cloudData = snapshot.val();
      if (cloudData && cloudData.buildings) {
        lastKnownCloudReservesRef.current = extractBuildingReservesMap(cloudData.buildings);
        setState(local => {
          const merged = mergeStateWithCloud(local, cloudData);
          const curB = (merged.buildings || []).find(b => b.id === merged.currentBuildingId) || merged.buildings[0];
          if (curB) {
            merged.currentBuildingId = curB.id;
            merged.flats = curB.flats || [];
            merged.transactions = curB.transactions || cloudData.transactions || [];
            merged.expenses = curB.expenses || cloudData.expenses || [];
            merged.manualDebits = curB.manualDebits || cloudData.manualDebits || [];
            merged.documents = curB.documents || cloudData.documents || [];
            merged.loans = curB.loans || cloudData.loans || [];
            merged.infoSections = curB.infoSections || [];
            merged.buildingInitialReserveCommon = curB.buildingInitialReserveCommon || 0;
            merged.buildingInitialReserveRenovation = curB.buildingInitialReserveRenovation || 0;
            recalculateFlatBalances(merged);
          }
          try {
            if (merged.currentUser) {
              const cleanLocal = {
                ...merged,
                currentUser: stripSensitiveUserFields(merged.currentUser),
                users: (merged.users || []).map(stripSensitiveUserFields),
                buildings: stripSensitiveBuildingFields(stripLargeBinaries(merged.buildings || [], { stripInlineAttachments: true }))
              };
              localStorage.setItem("tarsashaz_state", JSON.stringify(cleanLocal));
            }
          } catch (e) {}
          return merged;
        });
        setCloudSyncStatus('synced');
        setCloudSyncError(null);
        setLastSyncTime(new Date());
        if (showNotification) {
          showToast(state.currentLang === 'en' ? "Data refreshed from cloud!" : "Adatok sikeresen frissítve a felhőből!");
        }
      }
    } catch (err) {
      console.warn("Manual cloud refresh error:", err);
      setCloudSyncStatus('error');
      setCloudSyncError(err.message);
      if (showNotification) {
        showToast(
          state.currentLang === 'en'
            ? "Failed to refresh from cloud. Please log in again!"
            : "Nem sikerült a felhőből frissíteni. Kérjük, lépj ki és jelentkezz be újra!",
          "error"
        );
      }
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Force authoritative local state upload to cloud (legacy RTDB only; in Firestore mode refreshes server-authoritative data)
  const forceSyncLocalToCloud = async (showNotification = true) => {
    if (!isCurrentUserAdmin(state.currentUser, state.users)) return false;
    if (IS_FIRESTORE_MODE) {
      await refreshFromCloud(showNotification);
      return true;
    }
    const { rtdb, auth } = getFirebaseInstance();
    if (!rtdb) return false;
    setIsCloudSyncing(true);
    setCloudSyncStatus('syncing');

    try {
      if (auth && !auth.currentUser) {
        await ensureFirebaseAuth();
      }

      if (auth && !auth.currentUser) {
        setCloudSyncStatus('error');
        setCloudSyncError('unauthenticated');
        if (showNotification) {
          showToast(t.sync_force_error, "error");
        }
        return false;
      }

      let targetState = state;
      const nextRev = Math.max(Number(targetState.revision) || 0, 1) + 1;
      targetState = { ...targetState, revision: nextRev, lastUpdated: Date.now() };

      const payload = createCloudPayload(targetState, {
        authoritativeReservesMap: lastKnownCloudReservesRef.current,
        allowReserveChange: false,
      });
      await set(ref(rtdb, "condo_state"), payload);

      setState(targetState);
      try {
        if (targetState.currentUser) {
          const cleanLocal = {
            ...targetState,
            currentUser: stripSensitiveUserFields(targetState.currentUser),
            users: (targetState.users || []).map(stripSensitiveUserFields),
            buildings: stripSensitiveBuildingFields(stripLargeBinaries(targetState.buildings || [], { stripInlineAttachments: true }))
          };
          localStorage.setItem("tarsashaz_state", JSON.stringify(cleanLocal));
        }
      } catch (e) {}

      setCloudSyncStatus('synced');
      setCloudSyncError(null);
      setLastSyncTime(new Date());

      if (showNotification) {
        showToast(t.sync_force_success, "success");
      }
      return true;
    } catch (err) {
      console.warn("forceSyncLocalToCloud error:", err);
      setCloudSyncStatus('error');
      setCloudSyncError(err.message);
      if (showNotification) {
        showToast(t.sync_force_error, "error");
      }
      return false;
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Initialize modular domain actions
  const authActions = createAuthActions({
    state,
    setState,
    persistState,
    showToast,
    t,
    ensureFirebaseAuth,
    getUserFlats,
    onFirestoreSessionHydrated: applyFirestoreSessionData,
    reloadCurrentBuilding,
  });
  const accountingActions = createAccountingActions({
    state,
    persistState,
    showToast,
    t,
    copiedTx,
    setCopiedTx,
    ensureFirebaseAuth,
    reloadCurrentBuilding,
    refreshBuildingFinancials,
  });
  const buildingActions = createBuildingActions({
    state,
    setState,
    persistState,
    showToast,
    t,
    reloadCurrentBuilding,
    hydrateAndSwitchBuilding,
  });
  const loanActions = createLoanActions({
    state,
    persistState,
    showToast,
    t,
    reloadCurrentBuilding,
  });
  const calendarActions = createCalendarActions({ state, persistState, showToast, t });
  const teamActions = createTeamActions({ state, persistState, showToast, t });
  const emailActions = createEmailActions({ state, setState, persistState, showToast, t });

  // Real-time Cloud Firestore listeners for user notifications, user memberships,
  // organization permissions, and building role metadata (`szvb`, `economicAuditor`, `archived`)
  // so role grants/revocations and incoming mail reflect IMMEDIATELY across open sessions!
  const orgIdsKey = (state.organizations || []).map((o) => o?.id).filter(Boolean).sort().join(',');
  const buildingIdsKey = (state.buildings || [])
    .filter((b) => b && b.id && b.archived !== true)
    .map((b) => b.id)
    .sort()
    .join(',');

  const isImpersonating = Boolean(state.impersonatedFrom);
  const currentUserUid = state.currentUser?.uid || null;
  const hasCurrentUser = Boolean(state.currentUser);

  // Live notifications listener: runs BOTH for normal logged-in users AND for SuperAdmin
  // impersonating a resident/admin whose UID is resolved (firestore.rules grants SuperAdmin read).
  useEffect(() => {
    if (!IS_FIRESTORE_MODE || !currentUserUid) return;
    return subscribeUserNotifications(currentUserUid, (liveNotifs) => {
      setState((prev) => ({
        ...prev,
        notifications: liveNotifs,
      }));
    });
  }, [currentUserUid]);

  // Live building root metadata listener (`szvb`, `economicAuditor`, `archived`):
  // runs BOTH for normal sessions AND during SuperAdmin impersonation so role revocations
  // propagate immediately (<200ms) across open tabs!
  useEffect(() => {
    if (!IS_FIRESTORE_MODE || !hasCurrentUser || !buildingIdsKey) return;
    const buildingIds = buildingIdsKey.split(',').filter(Boolean);
    const unsubs = buildingIds.map((bId) =>
      subscribeBuilding(
        bId,
        (liveBuildingDoc) => {
          setState((prev) => {
            const existingList = prev.buildings || [];
            const existing = existingList.find((b) => b && b.id === liveBuildingDoc.id);
            if (!existing) return prev;
            const merged = firestoreBuildingToUiBuilding(liveBuildingDoc, {
              flats: existing.flats || [],
              transactions: existing.transactions || [],
              expenses: existing.expenses || [],
              manualDebits: existing.manualDebits || [],
              loans: existing.loans || [],
              documents: existing.documents || [],
              infoSections: existing.infoSections || [],
              categories: existing.categories || [],
              hydrated: existing.hydrated,
            });
            if (!merged) return prev;
            merged.firestoreMonthlySummaries = existing.firestoreMonthlySummaries || merged.firestoreMonthlySummaries || {};
            return {
              ...prev,
              buildings: existingList.map((b) => (b && b.id === liveBuildingDoc.id ? merged : b)),
            };
          });
        },
        (deniedBuildingId) => {
          // Building membership was revoked completely (e.g. external auditor removed):
          // NEVER drop buildings during SuperAdmin sessions or impersonation.
          setState((prev) => {
            if (
              prev.impersonatedFrom ||
              prev.currentUser?.role === 'superadmin' ||
              prev.currentUser?.isSuperAdmin === true
            ) {
              return prev;
            }
            return {
              ...prev,
              buildings: (prev.buildings || []).filter((b) => b && b.id !== deniedBuildingId),
            };
          });
        }
      )
    );
    return () => {
      unsubs.forEach((fn) => {
        try { fn(); } catch {}
      });
    };
  }, [hasCurrentUser, buildingIdsKey]);

  // Live user profile (memberships) & organization listeners (non-impersonated sessions only)
  useEffect(() => {
    if (!IS_FIRESTORE_MODE || !currentUserUid || isImpersonating) return;
    const uid = currentUserUid;
    const unsubs = [];

    unsubs.push(
      subscribeUserProfile(uid, (liveUserDoc) => {
        if (!liveUserDoc) return;
        const liveMemberships = liveUserDoc.memberships || {};
        setState((prev) => {
          if (!prev.currentUser || prev.currentUser.uid !== uid || prev.impersonatedFrom) return prev;
          return {
            ...prev,
            currentUser: {
              ...prev.currentUser,
              memberships: liveMemberships,
            },
          };
        });

        // If user just gained an active membership on a building not yet loaded locally, fetch its root doc
        const knownIds = new Set((buildingIdsKey ? buildingIdsKey.split(',') : []).filter(Boolean));
        const newlyGrantedIds = Object.entries(liveMemberships)
          .filter(([bId, m]) => bId && m && m.active === true && !knownIds.has(bId))
          .map(([bId]) => bId);

        for (const newBId of newlyGrantedIds) {
          fetchBuildingRoot(newBId)
            .then((bDoc) => {
              if (!bDoc || bDoc.archived === true) return;
              const uiB = firestoreBuildingToUiBuilding(bDoc);
              if (!uiB) return;
              setState((prev) => {
                if ((prev.buildings || []).some((b) => b && b.id === uiB.id)) return prev;
                return {
                  ...prev,
                  buildings: [...(prev.buildings || []), uiB],
                };
              });
            })
            .catch(() => {});
        }
      })
    );

    const orgIds = orgIdsKey ? orgIdsKey.split(',').filter(Boolean) : [];
    for (const orgId of orgIds) {
      unsubs.push(
        subscribeOrganization(orgId, (liveOrg) => {
          setState((prev) => {
            const existing = prev.organizations || [];
            const hasOrg = existing.some((o) => o && o.id === liveOrg.id);
            const nextOrgs = hasOrg
              ? existing.map((o) => (o && o.id === liveOrg.id ? liveOrg : o))
              : [...existing, liveOrg];
            return {
              ...prev,
              organizations: nextOrgs,
            };
          });
        })
      );
    }

    return () => {
      unsubs.forEach((fn) => {
        try { fn(); } catch {}
      });
    };
  }, [currentUserUid, orgIdsKey, buildingIdsKey, isImpersonating]);

  // Reactive Active-Profile Revocation Guard:
  // If the user's currently active profile (SZVB, Financial Auditor, or offboarded KK) is revoked
  // in real time while they are inside it, IMMEDIATELY eject them back to their valid apartment
  // Owner profile (or sign them out cleanly if no profiles remain) so they can never view stale
  // privileged screens or submit actions with revoked authority.
  // Also runs during SuperAdmin impersonation strictly for delegated SZVB/Auditor views
  // (preserving `impersonatedFrom` and never signing out the SuperAdmin).
  const lastRevocationSigRef = useRef('');
  useEffect(() => {
    if (
      !isInitialSyncDone ||
      !state.currentUser ||
      state.currentUser.role === 'superadmin' ||
      state.currentUser.isSuperAdmin === true
    ) {
      return;
    }

    const isImpersonatedSession = Boolean(state.impersonatedFrom);
    if (
      isImpersonatedSession &&
      state.currentUser.role !== 'szvb' &&
      state.currentUser.role !== 'auditor'
    ) {
      return;
    }

    const validity = resolveActiveProfileValidity(state.currentUser, {
      buildings: state.buildings,
      organizations: state.organizations,
      users: state.users,
    });

    // Seamless in-place sync if SZVB sub-role changed (e.g. Chairperson <-> Member) without revocation
    if (validity.isValid) {
      lastRevocationSigRef.current = '';
      if (validity.szvbRoleChanged && validity.matchedProfile?.szvbRole) {
        const nextSzvbRole = validity.matchedProfile.szvbRole;
        setState((prev) => {
          if (!prev.currentUser || prev.currentUser.role !== 'szvb' || prev.currentUser.szvbRole === nextSzvbRole) {
            return prev;
          }
          return {
            ...prev,
            currentUser: {
              ...prev.currentUser,
              szvbRole: nextSzvbRole,
            },
          };
        });
      }
      return;
    }

    const sig = `${state.currentUser.uid || state.currentUser.email}:${state.currentUser.role}:${state.currentUser.buildingId || ''}:${validity.fallbackProfile?.id || 'none'}`;
    if (lastRevocationSigRef.current === sig) return;
    lastRevocationSigRef.current = sig;

    const isEn = state.currentLang === 'en';
    const revokedRole = validity.revokedRole;
    const fallback = validity.fallbackProfile;

    if (!fallback) {
      // Only auto-eject external SZVB/Auditor accounts whose sole access was revoked (never admin/superadmin!)
      if (revokedRole !== 'szvb' && revokedRole !== 'auditor') return;
      if (isImpersonatedSession) {
        // SuperAdmin impersonating a now-revoked external auditor: exit back to SuperAdmin (NEVER signOut!)
        const originalUser = stripSensitiveUserFields(state.impersonatedFrom?.originalUser || {});
        setState((prev) => ({
          ...prev,
          currentUser: originalUser?.email ? originalUser : prev.currentUser,
          impersonatedFrom: null,
          activeRoleMode: 'kk',
          isPortfolioView: true,
        }));
        showToast(
          isEn
            ? 'The impersonated role was revoked — returned to SuperAdmin Center.'
            : 'A megtekintett szerepkör visszavonásra került — visszairányítottunk a Rendszergazda felületre.',
          'warning'
        );
        return;
      }
      if (IS_FIRESTORE_MODE) {
        const { auth } = getFirebaseInstance();
        if (auth) signOut(auth).catch(() => {});
        purgeSensitiveLocalStorage();
      }
      setState((prev) => ({
        ...prev,
        currentUser: null,
        impersonatedFrom: null,
        activeRoleMode: null,
        isPortfolioView: false,
        currentBuildingId: null,
        buildings: [],
        flats: [],
        transactions: [],
        expenses: [],
        manualDebits: [],
        documents: [],
        docFolders: [],
        loans: [],
        infoSections: [],
      }));
      showToast(
        isEn
          ? 'Your access to this condominium has been revoked.'
          : 'A hozzáférésed megszűnt ehhez a társasházhoz.',
        'warning'
      );
      return;
    }

    const { kkProfile } = resolveUserProfiles(state.currentUser, {
      buildings: state.buildings,
      organizations: state.organizations,
      users: state.users,
    });

    const targetBuildingId = fallback.buildingId || null;
    const curB = targetBuildingId ? (state.buildings || []).find((b) => b && b.id === targetBuildingId) : null;
    const userEmail = (state.currentUser.email || '').toLowerCase().trim();

    let nextUser = null;
    let nextRoleMode = 'tenant';
    let nextIsPortfolio = false;

    if (fallback.type === 'owner') {
      nextUser = stripSensitiveUserFields({
        id: `${targetBuildingId}-${fallback.flatNum}`,
        uid: state.currentUser.uid,
        name: fallback.ownerName || fallback.name || state.currentUser.name,
        email: state.currentUser.email || fallback.email,
        role: 'Owner',
        szvbRole: null,
        flatNum: fallback.flatNum,
        unitId: fallback.unitId || null,
        buildingId: targetBuildingId,
        isAdminUser: Boolean(kkProfile),
        memberships: state.currentUser.memberships,
      });
      nextRoleMode = 'tenant';
      nextIsPortfolio = false;
    } else if (fallback.type === 'szvb') {
      nextUser = stripSensitiveUserFields({
        id: `szvb-${targetBuildingId}`,
        uid: state.currentUser.uid,
        name: fallback.name || state.currentUser.name,
        email: state.currentUser.email || fallback.email,
        role: 'szvb',
        szvbRole: fallback.szvbRole || 'member',
        flatNum: fallback.flatNum || '0',
        buildingId: targetBuildingId,
        isAdminUser: Boolean(kkProfile),
        memberships: state.currentUser.memberships,
      });
      nextRoleMode = 'szvb';
      nextIsPortfolio = false;
    } else if (fallback.type === 'auditor') {
      nextUser = stripSensitiveUserFields({
        id: `auditor-${targetBuildingId}`,
        uid: state.currentUser.uid,
        name: fallback.name || state.currentUser.name,
        email: state.currentUser.email || fallback.email,
        role: 'auditor',
        auditorType: fallback.auditorType || 'external',
        flatNum: fallback.flatNum || '0',
        buildingId: targetBuildingId,
        isAdminUser: Boolean(kkProfile),
        memberships: state.currentUser.memberships,
      });
      nextRoleMode = 'auditor';
      nextIsPortfolio = false;
    } else {
      nextUser = stripSensitiveUserFields({
        id: fallback.role === 'superadmin' ? (state.currentUser.uid || 'superadmin') : (state.currentUser.uid || 'admin'),
        uid: state.currentUser.uid,
        name: fallback.name || state.currentUser.name,
        email: state.currentUser.email || fallback.email,
        role: fallback.role || 'admin',
        orgId: fallback.orgId || null,
        orgRole: fallback.orgRole || null,
        flatNum: '0',
        buildingId: null,
        isAdminUser: true,
        memberships: state.currentUser.memberships,
      });
      nextRoleMode = 'kk';
      nextIsPortfolio = true;
    }

    setCopiedTx(null);
    if (!isImpersonatedSession) {
      saveLastActiveProfile(nextUser.email, {
        id: fallback.id,
        type: fallback.type,
        buildingId: targetBuildingId,
        flatNum: nextUser.flatNum || '0',
      });

      if (!IS_FIRESTORE_MODE) {
        try {
          if (!isCurrentTabSessionOnly() && localStorage.getItem('tarsashaz_remember_me') === 'true') {
            localStorage.setItem('tarsashaz_logged_in_user', JSON.stringify(nextUser));
          }
          sessionStorage.setItem('tarsashaz_session_user', JSON.stringify(nextUser));
          localStorage.setItem('tarsashaz_role_mode', nextRoleMode);
          localStorage.setItem('tarsashaz_is_portfolio', nextIsPortfolio ? 'true' : 'false');
        } catch {}
      }
    }

    // Immediately strip privileged SZVB/Auditor building-wide flats & loans from memory when dropping to Owner!
    const safeFlats = fallback.type === 'owner'
      ? (curB?.flats || []).filter((f) => {
          if (!f) return false;
          if (fallback.flatNum && String(f.flatNum) === String(fallback.flatNum)) return true;
          const mainEm = String(f.email || '').trim().toLowerCase();
          if (userEmail && mainEm === userEmail) return true;
          return Array.isArray(f.owners) && f.owners.some((o) => String(o?.email || '').trim().toLowerCase() === userEmail);
        })
      : (curB?.flats || []);

    persistState((s) => ({
      ...s,
      currentUser: nextUser,
      currentBuildingId: targetBuildingId,
      activeRoleMode: nextRoleMode,
      isPortfolioView: nextIsPortfolio,
      flats: curB ? safeFlats : s.flats,
      transactions: curB ? (curB.transactions || []) : s.transactions,
      expenses: curB ? (curB.expenses || []) : s.expenses,
      manualDebits: curB ? (curB.manualDebits || []) : s.manualDebits,
      documents: curB ? (curB.documents || []) : s.documents,
      docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
      loans: fallback.type === 'owner' ? [] : (curB ? (curB.loans || []) : s.loans),
      infoSections: curB ? (curB.infoSections || []) : s.infoSections,
      buildingInitialReserveCommon: curB ? (curB.buildingInitialReserveCommon || 0) : 0,
      buildingInitialReserveRenovation: curB ? (curB.buildingInitialReserveRenovation || 0) : 0,
    }), 'localOnly');

    if (IS_FIRESTORE_MODE && targetBuildingId) {
      reloadCurrentBuilding(targetBuildingId, {
        roleOverride: isImpersonatedSession ? 'superadmin' : nextUser.role,
      }).catch(() => {});
    }

    if (revokedRole === 'szvb' && fallback.type === 'owner') {
      showToast(
        isEn
          ? `Your SZVB access was revoked — switched back to Flat ${fallback.flatNum}.`
          : `Az SZVB szerepköröd megszűnt — visszairányítottunk a(z) ${fallback.flatNum}. lakás profilba.`,
        'warning'
      );
    } else if (revokedRole === 'auditor' && fallback.type === 'owner') {
      showToast(
        isEn
          ? `Your Financial Auditor access was revoked — switched back to Flat ${fallback.flatNum}.`
          : `A gazdasági ellenőri jogosultságod megszűnt — visszairányítottunk a(z) ${fallback.flatNum}. lakás profilba.`,
        'warning'
      );
    } else {
      showToast(
        isEn
          ? 'Your previous profile access was revoked — switched to your remaining profile.'
          : 'A korábbi profil jogosultságod megszűnt — átváltottunk a megmaradt profilodra.',
        'warning'
      );
    }
  }, [isInitialSyncDone, state.currentUser, state.impersonatedFrom, state.buildings, state.organizations, state.users]);

  // Invisible Server Clock Sync: subscribe to Firebase `.info/serverTimeOffset`
  // so Europe/Budapest scheduling & calendar logic never relies on drifted client clocks.
  useEffect(() => {
    const { rtdb } = getFirebaseInstance();
    if (!rtdb) return;
    return bindFirebaseServerTimeOffset(rtdb, ref, onValue);
  }, []);

  // Periodic Automated Dunning Dispatch Check (runs daily at 8:00 AM Europe/Budapest)
  const isAutoDunningInProgressRef = useRef(false);

  useEffect(() => {
    if (!state.currentUser || !isInitialSyncDone || !state.buildings || state.buildings.length === 0) {
      return;
    }

    const canManage = canUserManageBuilding(state.currentUser, null, state.organizations, state.buildings);
    if (!canManage) return;

    const triggerSafeCheck = async () => {
      if (isAutoDunningInProgressRef.current) return;
      isAutoDunningInProgressRef.current = true;
      try {
        await emailActions.executeAutomatedDunningDailyCheck();
      } catch (err) {
        console.warn('[automatedDunningDailyCheck] Check error:', err?.message);
      } finally {
        setTimeout(() => {
          isAutoDunningInProgressRef.current = false;
        }, 10000);
      }
    };

    // Run short initial check 6 seconds after hydration
    const initialTimer = setTimeout(triggerSafeCheck, 6000);

    // Periodic check every 60 seconds
    const intervalTimer = setInterval(triggerSafeCheck, 60000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [state.currentUser?.uid, isInitialSyncDone]);

  // Helper to check if current user is admin/KK authorized (respecting org suspension & staff delegation)
  const isCurrentUserAdmin = (user = state.currentUser, users = state.users) => {
    if (!user) return false;
    const orgCtx = resolveUserOrgContext(user, state.organizations, state.buildings);
    if (orgCtx.isSuspended) return false;
    if (orgCtx.isSuperAdmin || orgCtx.isOwner || orgCtx.isStaff) return true;
    const userEmail = (user.email || "").toLowerCase().trim();
    return (
      user.isAdminUser === true ||
      user.role === 'admin' ||
      user.role === 'superadmin' ||
      Boolean(userEmail && (users || []).some(u => u.email && u.email.toLowerCase().trim() === userEmail && (u.role === 'admin' || u.role === 'superadmin')))
    );
  };

  // Switch to Common Representative (KK) Mode (strictly verified via resolveUserProfiles)
  const switchToKkMode = (buildingId = null) => {
    const isEn = state.currentLang === 'en';
    const { kkProfile } = resolveUserProfiles(state.currentUser, {
      buildings: state.buildings,
      organizations: state.organizations,
      users: state.users,
    });
    if (!kkProfile) {
      showToast(
        isEn ? "You do not have Common Representative access." : "Nincs közös képviseleti jogosultságod.",
        "error"
      );
      return;
    }

    const userEmail = (state.currentUser?.email || "").toLowerCase().trim();
    const targetBuildingId = buildingId || null;
    const curB = targetBuildingId ? (state.buildings || []).find(b => b.id === targetBuildingId) : null;

    const updatedUser = stripSensitiveUserFields({
      id: kkProfile.role === 'superadmin' ? (state.currentUser?.uid || 'superadmin') : (state.currentUser?.uid || 'admin'),
      uid: state.currentUser?.uid,
      name: kkProfile.name || state.currentUser?.name || (isEn ? "Common Representative" : "Közös Képviselő"),
      email: userEmail || kkProfile.email || "",
      role: kkProfile.role,
      orgId: kkProfile.orgId || null,
      orgRole: kkProfile.orgRole || null,
      flatNum: "0",
      buildingId: targetBuildingId,
      isAdminUser: true,
      isSuperAdmin: Boolean(state.currentUser?.isSuperAdmin || state.currentUser?.role === 'superadmin' || kkProfile.role === 'superadmin'),
      memberships: state.currentUser?.memberships,
    });

    setCopiedTx(null);
    saveLastActiveProfile(updatedUser.email, { id: 'kk', type: 'kk', buildingId: null, flatNum: '0' });

    if (!IS_FIRESTORE_MODE) {
      try {
        if (!isCurrentTabSessionOnly() && localStorage.getItem("tarsashaz_remember_me") === "true") {
          localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(updatedUser));
        }
        sessionStorage.setItem("tarsashaz_session_user", JSON.stringify(updatedUser));
        localStorage.setItem("tarsashaz_role_mode", "kk");
        localStorage.setItem("tarsashaz_is_portfolio", buildingId ? "false" : "true");
      } catch (e) {}
    }

    persistState(s => ({
      ...s,
      currentUser: updatedUser,
      currentBuildingId: targetBuildingId,
      activeRoleMode: 'kk',
      isPortfolioView: buildingId ? false : true,
      flats: curB ? (curB.flats || []) : s.flats,
      transactions: curB ? (curB.transactions || []) : s.transactions,
      expenses: curB ? (curB.expenses || []) : s.expenses,
      manualDebits: curB ? (curB.manualDebits || []) : s.manualDebits,
      documents: curB ? (curB.documents || []) : s.documents,
      docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
      loans: curB ? (curB.loans || []) : (s.loans || []),
      infoSections: curB ? (curB.infoSections || []) : s.infoSections,
      buildingInitialReserveCommon: curB ? (Number(curB.buildingInitialReserveCommon) || 0) : undefined,
      buildingInitialReserveRenovation: curB ? (Number(curB.buildingInitialReserveRenovation) || 0) : undefined
    }), 'localOnly');

    if (IS_FIRESTORE_MODE && targetBuildingId && !curB?.hydrated) {
      reloadCurrentBuilding(targetBuildingId);
    }

    showToast(isEn ? "Switched to Common Representative Portfolio" : "Átváltva: Közös Képviseleti Portfólió");
  };

  // Switch to Resident (Tenant / Owner) Mode
  const switchToTenantMode = (flatNum = null, buildingId = null) => {
    const isEn = state.currentLang === 'en';
    const prevRole = state.currentUser?.role;
    const isSuperSession = Boolean(state.currentUser?.isSuperAdmin || prevRole === 'superadmin');
    const { kkProfile, ownerProfiles } = resolveUserProfiles(state.currentUser, {
      buildings: state.buildings,
      organizations: state.organizations,
      users: state.users,
    });
    const myFlats = ownerProfiles.length > 0 ? ownerProfiles : getUserFlats(state.currentUser, state.buildings);
    const targetFlat = (flatNum && buildingId)
      ? myFlats.find(f => String(f.flatNum) === String(flatNum) && f.buildingId === buildingId)
      : (flatNum ? myFlats.find(f => String(f.flatNum) === String(flatNum)) : myFlats[0]);

    if (!targetFlat && myFlats.length === 0) {
      showToast(isEn ? "No resident flat found for this account." : "Nincs lakói profil társítva ehhez a fiókhoz.", "warning");
      return;
    }

    const chosenFlat = targetFlat || myFlats[0];
    const targetBuildingId = chosenFlat.buildingId || state.currentBuildingId || (state.buildings && state.buildings[0]?.id) || null;
    const curB = (state.buildings || []).find(b => b.id === targetBuildingId) || (state.buildings || [])[0];

    const updatedUser = stripSensitiveUserFields({
      id: `${targetBuildingId}-${chosenFlat.flatNum}`,
      uid: state.currentUser?.uid,
      name: chosenFlat.ownerName || state.currentUser?.name,
      email: state.currentUser?.email || chosenFlat.email,
      role: "Owner",
      szvbRole: null,
      flatNum: chosenFlat.flatNum,
      unitId: chosenFlat.unitId || chosenFlat.id,
      buildingId: targetBuildingId,
      isAdminUser: Boolean(kkProfile),
      isSuperAdmin: isSuperSession,
      memberships: state.currentUser?.memberships,
    });

    setCopiedTx(null);
    saveLastActiveProfile(updatedUser.email, {
      id: `owner:${targetBuildingId}:${chosenFlat.flatNum}`,
      type: 'owner',
      buildingId: targetBuildingId,
      flatNum: chosenFlat.flatNum,
    });

    if (!IS_FIRESTORE_MODE) {
      try {
        if (!isCurrentTabSessionOnly() && localStorage.getItem("tarsashaz_remember_me") === "true") {
          localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(updatedUser));
        }
        sessionStorage.setItem("tarsashaz_session_user", JSON.stringify(updatedUser));
        localStorage.setItem("tarsashaz_role_mode", "tenant");
        localStorage.setItem("tarsashaz_is_portfolio", "false");
      } catch (e) {}
    }

    persistState(s => ({
      ...s,
      currentUser: updatedUser,
      currentBuildingId: targetBuildingId,
      activeRoleMode: 'tenant',
      isPortfolioView: false,
      flats: curB ? (curB.flats || []) : s.flats,
      transactions: curB ? (curB.transactions || []) : s.transactions,
      expenses: curB ? (curB.expenses || []) : s.expenses,
      manualDebits: curB ? (curB.manualDebits || []) : s.manualDebits,
      documents: curB ? (curB.documents || []) : s.documents,
      docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
      loans: curB ? (curB.loans || []) : (s.loans || []),
      infoSections: curB ? (curB.infoSections || []) : s.infoSections,
      buildingInitialReserveCommon: curB ? (curB.buildingInitialReserveCommon || 0) : 0,
      buildingInitialReserveRenovation: curB ? (curB.buildingInitialReserveRenovation || 0) : 0
    }), 'localOnly');

    if (IS_FIRESTORE_MODE && targetBuildingId) {
      const shouldForceOwnerScope = !isSuperSession && (prevRole === 'szvb' || prevRole === 'auditor');
      reloadCurrentBuilding(targetBuildingId, shouldForceOwnerScope ? { roleOverride: 'Owner' } : {});
    }

    showToast(isEn ? `Switched to Flat ${chosenFlat.flatNum}` : `Átváltva: ${chosenFlat.flatNum}. lakás`);
  };

  // Switch to SZVB (Accounting Committee) Read-Only Audit Mode (strictly verified per building)
  const switchToSzvbMode = (buildingId = null) => {
    const isEn = state.currentLang === 'en';
    if (!state.currentUser) return;

    const { kkProfile } = resolveUserProfiles(state.currentUser, {
      buildings: state.buildings,
      organizations: state.organizations,
      users: state.users,
    });

    const szvbRoles = getUserSzvbRolesAcrossBuildings(state.currentUser, state.buildings);
    const matchedRole = buildingId
      ? szvbRoles.find((r) => r.buildingId === buildingId)
      : szvbRoles[0];

    const targetBuildingId = matchedRole?.buildingId || buildingId;
    const curB = (state.buildings || []).find((b) => b.id === targetBuildingId);
    const verifiedInfo = curB ? getUserBuildingSzvbInfo(state.currentUser, curB) : null;

    if (!curB || !verifiedInfo) {
      showToast(
        isEn
          ? "You do not have Accounting Committee (SZVB) audit access for this condominium."
          : "Nincs Számvizsgáló Bizottsági (SZVB) jogosultságod ehhez a társasházhoz.",
        "error"
      );
      return;
    }

    const updatedUser = stripSensitiveUserFields({
      id: `szvb-${curB.id}`,
      uid: state.currentUser?.uid,
      name: verifiedInfo.name || state.currentUser?.name,
      email: state.currentUser?.email || verifiedInfo.email,
      role: 'szvb',
      szvbRole: verifiedInfo.role,
      flatNum: verifiedInfo.flatNum || state.currentUser?.flatNum || '0',
      buildingId: curB.id,
      isAdminUser: Boolean(kkProfile),
      isSuperAdmin: Boolean(state.currentUser?.isSuperAdmin || state.currentUser?.role === 'superadmin'),
      memberships: state.currentUser?.memberships,
    });

    setCopiedTx(null);
    saveLastActiveProfile(updatedUser.email, {
      id: `szvb:${curB.id}`,
      type: 'szvb',
      buildingId: curB.id,
      flatNum: verifiedInfo.flatNum || '0',
    });

    if (!IS_FIRESTORE_MODE) {
      try {
        if (!isCurrentTabSessionOnly() && localStorage.getItem("tarsashaz_remember_me") === "true") {
          localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(updatedUser));
        }
        sessionStorage.setItem("tarsashaz_session_user", JSON.stringify(updatedUser));
        localStorage.setItem("tarsashaz_role_mode", "szvb");
        localStorage.setItem("tarsashaz_is_portfolio", "false");
      } catch (e) {}
    }

    persistState((s) => ({
      ...s,
      currentUser: updatedUser,
      currentBuildingId: curB.id,
      activeRoleMode: 'szvb',
      isPortfolioView: false,
      flats: curB.flats || s.flats || [],
      transactions: curB.transactions || s.transactions || [],
      expenses: curB.expenses || s.expenses || [],
      manualDebits: Array.isArray(curB.manualDebits) ? curB.manualDebits : (s.manualDebits || []),
      documents: curB.documents || [],
      docFolders: curB.docFolders || [],
      loans: curB.loans || [],
      infoSections: curB.infoSections || [],
      buildingInitialReserveCommon: curB.buildingInitialReserveCommon || 0,
      buildingInitialReserveRenovation: curB.buildingInitialReserveRenovation || 0,
    }), 'localOnly');

    if (IS_FIRESTORE_MODE && curB.id) {
      reloadCurrentBuilding(curB.id);
    }

    const roleLabel = verifiedInfo.role === 'chairperson'
      ? (isEn ? "SZVB Chairperson (Read-Only)" : "SZVB Elnök (Csak olvasás)")
      : (isEn ? "SZVB Member (Read-Only)" : "SZVB Tag (Csak olvasás)");
    showToast(isEn ? `Switched to ${roleLabel}` : `Átváltva: ${roleLabel}`);
  };

  // Switch to Economic Auditor (Tht. 51/A. §) Read-Only & Advisory Mode (strictly verified per building)
  const switchToAuditorMode = (buildingId = null) => {
    const isEn = state.currentLang === 'en';
    if (!state.currentUser) return;

    const { kkProfile } = resolveUserProfiles(state.currentUser, {
      buildings: state.buildings,
      organizations: state.organizations,
      users: state.users,
    });

    const auditorRoles = getUserEconomicAuditorRolesAcrossBuildings(state.currentUser, state.buildings);
    const matchedRole = buildingId
      ? auditorRoles.find((r) => r.buildingId === buildingId)
      : auditorRoles[0];

    const targetBuildingId = matchedRole?.buildingId || buildingId;
    const curB = (state.buildings || []).find((b) => b.id === targetBuildingId);
    const isVerified = curB ? checkUserBuildingEconomicAuditor(state.currentUser, curB) : false;

    if (!curB || !isVerified) {
      showToast(
        isEn
          ? "You do not have Financial Auditor access for this condominium."
          : "Nincs gazdasági ellenőri jogosultságod ehhez a társasházhoz.",
        "error"
      );
      return;
    }

    const aud = curB.economicAuditor || {};
    const updatedUser = stripSensitiveUserFields({
      id: `auditor-${curB.id}`,
      uid: state.currentUser?.uid,
      name: aud.name || state.currentUser?.name,
      email: state.currentUser?.email || aud.email,
      role: 'auditor',
      auditorType: aud.type === 'internal' ? 'internal' : 'external',
      flatNum: aud.type === 'internal' ? (aud.flatNum || state.currentUser?.flatNum || '0') : '0',
      buildingId: curB.id,
      isAdminUser: Boolean(kkProfile),
      isSuperAdmin: Boolean(state.currentUser?.isSuperAdmin || state.currentUser?.role === 'superadmin'),
      memberships: state.currentUser?.memberships,
    });

    setCopiedTx(null);
    saveLastActiveProfile(updatedUser.email, {
      id: `auditor:${curB.id}`,
      type: 'auditor',
      buildingId: curB.id,
      flatNum: updatedUser.flatNum,
    });

    if (!IS_FIRESTORE_MODE) {
      try {
        if (!isCurrentTabSessionOnly() && localStorage.getItem("tarsashaz_remember_me") === "true") {
          localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(updatedUser));
        }
        sessionStorage.setItem("tarsashaz_session_user", JSON.stringify(updatedUser));
        localStorage.setItem("tarsashaz_role_mode", "auditor");
        localStorage.setItem("tarsashaz_is_portfolio", "false");
      } catch (e) {}
    }

    persistState((s) => ({
      ...s,
      currentUser: updatedUser,
      currentBuildingId: curB.id,
      activeRoleMode: 'auditor',
      isPortfolioView: false,
      flats: curB.flats || s.flats || [],
      transactions: curB.transactions || s.transactions || [],
      expenses: curB.expenses || s.expenses || [],
      manualDebits: Array.isArray(curB.manualDebits) ? curB.manualDebits : (s.manualDebits || []),
      documents: curB.documents || [],
      docFolders: curB.docFolders || [],
      loans: curB.loans || [],
      infoSections: curB.infoSections || [],
      buildingInitialReserveCommon: curB.buildingInitialReserveCommon || 0,
      buildingInitialReserveRenovation: curB.buildingInitialReserveRenovation || 0,
    }), 'localOnly');

    if (IS_FIRESTORE_MODE && curB.id) {
      reloadCurrentBuilding(curB.id);
    }

    showToast(
      isEn
        ? "Switched to Financial Auditor (Read-Only)"
        : "Átváltva: Gazdasági ellenőr (Csak olvasás)"
    );
  };

  // Open Portfolio view ("Társasházaim")
  const openPortfolio = () => {
    if (!IS_FIRESTORE_MODE) {
      try {
        localStorage.setItem("tarsashaz_is_portfolio", "true");
      } catch (e) {}
    }
    persistState(s => {
      let updatedBuildings = s.buildings || [];
      if (s.buildings && s.currentBuildingId) {
        updatedBuildings = s.buildings.map(b => {
          if (b.id === s.currentBuildingId) {
            return {
              ...b,
              flats: Array.isArray(s.flats) ? s.flats : (b.flats || []),
              transactions: Array.isArray(s.transactions) ? s.transactions : (b.transactions || []),
              expenses: Array.isArray(s.expenses) ? s.expenses : (b.expenses || []),
              manualDebits: Array.isArray(s.manualDebits) ? s.manualDebits : (b.manualDebits || []),
              documents: Array.isArray(s.documents) ? s.documents : (b.documents || []),
              docFolders: Array.isArray(s.docFolders) ? s.docFolders : (b.docFolders || []),
              loans: Array.isArray(s.loans) ? s.loans : (b.loans || []),
              infoSections: s.infoSections !== undefined ? s.infoSections : (b.infoSections || []),
              buildingInitialReserveCommon: b.buildingInitialReserveCommon !== undefined ? b.buildingInitialReserveCommon : (s.buildingInitialReserveCommon || 0),
              buildingInitialReserveRenovation: b.buildingInitialReserveRenovation !== undefined ? b.buildingInitialReserveRenovation : (s.buildingInitialReserveRenovation || 0),
            };
          }
          return b;
        });
      }
      return {
        ...s,
        buildings: updatedBuildings,
        isPortfolioView: true,
        currentBuildingId: null,
        buildingInitialReserveCommon: undefined,
        buildingInitialReserveRenovation: undefined
      };
    }, 'localOnly');
  };

  // Open specific building in Admin view (enforcing staff building assignment isolation)
  const openBuildingAdmin = (buildingId) => {
    const targetObj = (state.buildings || []).find(b => b.id === buildingId);
    if (targetObj && state.currentUser && !canUserAccessBuilding(state.currentUser, targetObj, state.organizations, state.buildings)) {
      showToast(
        t.error_unauthorized || (state.currentLang === 'en' ? "You do not have access to this condominium." : "Nincs jogosultságod ennek a társasháznak a megnyitásához."),
        "error"
      );
      return;
    }
    if (!IS_FIRESTORE_MODE) {
      try {
        localStorage.setItem("tarsashaz_is_portfolio", "false");
      } catch (e) {}
    }
    if (IS_FIRESTORE_MODE && buildingId) {
      hydrateAndSwitchBuilding(buildingId, false);
      return;
    }
    persistState(s => {
      let updatedBuildings = s.buildings || [];
      if (s.buildings && s.currentBuildingId && s.currentBuildingId !== buildingId) {
        updatedBuildings = s.buildings.map(b => {
          if (b.id === s.currentBuildingId) {
            return {
              ...b,
              flats: Array.isArray(s.flats) ? s.flats : (b.flats || []),
              transactions: Array.isArray(s.transactions) ? s.transactions : (b.transactions || []),
              expenses: Array.isArray(s.expenses) ? s.expenses : (b.expenses || []),
              manualDebits: Array.isArray(s.manualDebits) ? s.manualDebits : (b.manualDebits || []),
              documents: Array.isArray(s.documents) ? s.documents : (b.documents || []),
              docFolders: Array.isArray(s.docFolders) ? s.docFolders : (b.docFolders || []),
              loans: Array.isArray(s.loans) ? s.loans : (b.loans || []),
              infoSections: s.infoSections !== undefined ? s.infoSections : (b.infoSections || []),
              buildingInitialReserveCommon: b.buildingInitialReserveCommon !== undefined ? b.buildingInitialReserveCommon : (s.buildingInitialReserveCommon || 0),
              buildingInitialReserveRenovation: b.buildingInitialReserveRenovation !== undefined ? b.buildingInitialReserveRenovation : (s.buildingInitialReserveRenovation || 0),
            };
          }
          return b;
        });
      }
      const targetB = updatedBuildings.find(b => b.id === buildingId) || updatedBuildings[0];
      return {
        ...s,
        buildings: updatedBuildings,
        currentBuildingId: buildingId,
        isPortfolioView: false,
        flats: targetB ? targetB.flats : s.flats,
        transactions: targetB ? targetB.transactions : s.transactions,
        expenses: targetB ? targetB.expenses : s.expenses,
        manualDebits: targetB ? targetB.manualDebits : s.manualDebits,
        documents: targetB ? targetB.documents : s.documents,
        docFolders: targetB ? (targetB.docFolders || []) : (s.docFolders || []),
        loans: targetB ? (targetB.loans || []) : (s.loans || []),
        infoSections: targetB ? targetB.infoSections : s.infoSections,
        buildingInitialReserveCommon: targetB ? targetB.buildingInitialReserveCommon : 0,
        buildingInitialReserveRenovation: targetB ? targetB.buildingInitialReserveRenovation : 0
      };
    }, 'localOnly');
  };

  const value = {
    state,
    t,
    isFirestoreMode: IS_FIRESTORE_MODE,
    isInitialSyncDone,
    isCloudSyncing,
    cloudSyncStatus,
    cloudSyncError,
    lastSyncTime,
    refreshFromCloud,
    reloadCurrentBuilding,
    loadMoreTransactions,
    hasMoreTransactions,
    forceSyncLocalToCloud,
    showToast,
    toggleLanguage,
    setLanguage,
    updateRepProfile,
    updateGlobalSettings,
    persistState,
    copiedTx,
    isCurrentUserAdmin,
    switchToKkMode,
    switchToTenantMode,
    switchToSzvbMode,
    switchToAuditorMode,
    openPortfolio,
    openBuildingAdmin,
    ...authActions,
    ...accountingActions,
    ...buildingActions,
    ...loanActions,
    ...calendarActions,
    ...teamActions,
    ...emailActions,
    orgContext: resolveUserOrgContext(state.currentUser, state.organizations, state.buildings),
    canUserManageBuilding: (b = state.currentBuildingId) =>
      canUserManageBuilding(state.currentUser, b, state.organizations, state.buildings),
    isUserBuildingViewer: (b = state.currentBuildingId) =>
      isUserBuildingViewer(state.currentUser, b, state.organizations, state.buildings),
    isReadOnly: isUserBuildingViewer(state.currentUser, state.currentBuildingId, state.organizations, state.buildings),
    getAccessibleBuildings: (u = state.currentUser, b = state.buildings, o = state.organizations) =>
      getAccessibleBuildings(u, b, o),
    getUserFlats: (u = state.currentUser, b = state.buildings) => getUserFlats(u, b),
    getUserSzvbRoles: (u = state.currentUser, b = state.buildings) => getUserSzvbRolesAcrossBuildings(u, b),
    isUserBuildingSzvb: (b = state.currentBuildingId) => {
      const bObj = typeof b === 'string' ? (state.buildings || []).find((x) => x.id === b) : b;
      return checkUserBuildingSzvb(state.currentUser, bObj);
    },
    getUserAuditorRoles: (u = state.currentUser, b = state.buildings) => getUserEconomicAuditorRolesAcrossBuildings(u, b),
    isUserBuildingAuditor: (b = state.currentBuildingId) => {
      const bObj = typeof b === 'string' ? (state.buildings || []).find((x) => x.id === b) : b;
      return checkUserBuildingEconomicAuditor(state.currentUser, bObj);
    }
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {toast && <Toast key={toast.id} toast={toast} onClose={() => setToast(null)} currentLang={state.currentLang} />}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}

/**
 * Collects all flats where the specified user is an owner or co-owner (with shares).
 */
export function getUserFlats(user, buildings) {
  if (!user) return [];
  const userEmail = (user.email || "").toLowerCase().trim();
  const res = [];

  (buildings || []).forEach(b => {
    (b.flats || []).forEach(f => {
      const fEmail = (f.email || "").toLowerCase().trim();

      let matchedShare = null;
      let isMatched = false;

      if (Array.isArray(f.owners) && f.owners.length > 0 && userEmail) {
        const matchingOwner = f.owners.find(o => {
          const oEmail = (o.email || "").toLowerCase().trim();
          const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
          return oEmail === userEmail || oEmails.includes(userEmail);
        });

        if (matchingOwner) {
          isMatched = true;
          matchedShare = matchingOwner.share;
        }
      }

      if (!isMatched) {
        if (
          (userEmail && fEmail === userEmail) ||
          (user.flatNum && user.flatNum !== "0" && user.flatNum === f.flatNum && (!user.buildingId || user.buildingId === b.id))
        ) {
          isMatched = true;
          matchedShare = "1/1";
        }
      }

      if (isMatched) {
        if (!res.some(existing => existing.buildingId === b.id && existing.flatNum === f.flatNum)) {
          res.push({
            ...f,
            buildingId: b.id,
            buildingName: b.name || "Társasház",
            ownershipShareText: matchedShare || "1/1"
          });
        }
      }
    });
  });

  return res;
}

function Toast({ toast, onClose, currentLang }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleUndoClick = (e) => {
    e.stopPropagation();
    if (toast.onUndo) {
      toast.onUndo();
    }
    onClose();
  };

  const getToastColors = () => {
    switch (toast.type) {
      case 'info':
        return 'bg-blue-600 text-white border-blue-700 shadow-blue-500/20';
      case 'error':
        return 'bg-red-600 text-white border-red-700 shadow-red-500/20';
      default:
        return 'bg-gray-900 text-white border-gray-800 shadow-gray-900/20';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-70 animate-slideUp">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium ${getToastColors()}`}>
        <span>{toast.msg}</span>
        {toast.onUndo && (
          <button
            type="button"
            onClick={handleUndoClick}
            className="flex items-center gap-1 px-2 py-0.5 ml-2 text-xs font-bold text-amber-300 hover:text-amber-200 bg-white/10 hover:bg-white/20 rounded-md cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{currentLang === 'en' ? 'Undo' : 'Visszavonás'}</span>
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
