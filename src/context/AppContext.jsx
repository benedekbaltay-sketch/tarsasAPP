import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { translations } from '../constants/translations';
import { getFirebaseInstance, IS_FIRESTORE_MODE } from '../constants/firebaseConfig';
import { ref, onValue, set, get } from 'firebase/database';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { recalculateFlatBalances } from '../utils/finances';
import { playNotificationSound } from '../utils/sound';
import { RotateCcw, X } from 'lucide-react';

import {
  getPermanentVault,
  savePermanentVault,
  mergeStateWithCloud,
  loadInitialState,
  stripLargeBinaries,
  stripSensitiveUserFields,
  stripSensitiveBuildingFields,
  createCloudPayload
} from './syncEngine';

import {
  hydrateFirestoreSession,
  hydrateFirestoreBuilding,
  firestoreTransactionsToUiCollections,
  purgeSensitiveLocalStorage,
  normalizeRoleForFirestore,
} from '../services/firestoreAdapter';
import {
  fetchPaginatedTransactions,
  updateUserPreferences,
} from '../services/firestoreService';

import { createAuthActions } from './authActions';
import { createAccountingActions } from './accountingActions';
import { createBuildingActions } from './buildingActions';
import { createLoanActions } from './loanActions';
import { createCalendarActions } from './calendarActions';
import { createTeamActions } from './teamActions';
import {
  resolveUserOrgContext,
  getAccessibleBuildings,
  canUserAccessBuilding,
} from '../utils/teamPermissions';

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
    const nextRepProfile = { ...(state.repProfile || {}), ...profileData };
    if (IS_FIRESTORE_MODE && state.currentUser?.uid) {
      updateUserPreferences(state.currentUser.uid, { repProfile: nextRepProfile }).catch((err) => {
        console.warn('Firestore updateRepProfile error:', err.message);
      });
    }
    persistState(s => ({
      ...s,
      repProfile: nextRepProfile
    }), true);
    showToast(state.currentLang === 'en' ? "Business profile updated!" : "Vállalkozói profil sikeresen mentve!");
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
    const activeB = sessionData.activeBuilding || sessionData.buildings?.[0] || null;
    const isUserAdmin = userCopy.role === 'admin' || userCopy.role === 'superadmin';
    const isKkAdmin = userCopy.role === 'admin';

    setState(prev => {
      const next = {
        ...prev,
        currentLang: sessionData.preferredLang || prev.currentLang || 'hu',
        currentUser: userCopy,
        impersonatedFrom: null,
        activeRoleMode: isUserAdmin ? 'kk' : 'tenant',
        isPortfolioView: isKkAdmin && (sessionData.buildings?.length || 0) > 1 ? true : false,
        currentBuildingId: activeB ? activeB.id : null,
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

  const reloadCurrentBuilding = async (targetBuildingId = null) => {
    if (!IS_FIRESTORE_MODE) return null;
    const { auth } = getFirebaseInstance();
    const uid = auth?.currentUser?.uid || state.currentUser?.uid;
    const bId = targetBuildingId || state.currentBuildingId || state.buildings?.[0]?.id;
    if (!uid || !bId) return null;

    setIsCloudSyncing(true);
    setCloudSyncStatus('syncing');
    try {
      const membership = state.currentUser?.memberships?.[bId];
      const hydrated = await hydrateFirestoreBuilding(bId, {
        role: state.currentUser?.role || membership?.role || 'owner',
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
      await reloadCurrentBuilding(buildingId);
      setState(prev => ({
        ...prev,
        currentBuildingId: buildingId,
        isPortfolioView: Boolean(isPortfolio),
        currentUser: prev.currentUser ? { ...prev.currentUser, buildingId } : prev.currentUser,
      }));
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
  const persistState = (updaterFn, immediateCloud = true) => {
    return new Promise((resolve) => {
      setState(prevState => {
        const nextState = typeof updaterFn === 'function' ? updaterFn(prevState) : { ...prevState, ...updaterFn };
        const isLocalOnly = immediateCloud === 'localOnly' || immediateCloud === false || immediateCloud === null;

        if (!isLocalOnly) {
          nextState.revision = (Number(nextState.revision) || 0) + 1;
          nextState.lastUpdated = Date.now();
        }

        if (!Array.isArray(nextState.manualDebits)) {
          nextState.manualDebits = [];
        }

        // Synchronize active building with building in buildings array
        if (nextState.buildings && nextState.currentBuildingId) {
          const b = nextState.buildings.find(x => x.id === nextState.currentBuildingId);
          if (b) {
            b.flats = Array.isArray(nextState.flats) ? nextState.flats : [];
            b.transactions = Array.isArray(nextState.transactions) ? nextState.transactions : [];
            b.expenses = Array.isArray(nextState.expenses) ? nextState.expenses : [];
            b.manualDebits = Array.isArray(nextState.manualDebits) ? nextState.manualDebits : [];
            b.documents = Array.isArray(nextState.documents) ? nextState.documents : [];
            b.loans = Array.isArray(nextState.loans) ? nextState.loans : (b.loans || []);
            b.infoSections = nextState.infoSections !== undefined ? nextState.infoSections : (b.infoSections || []);
            b.buildingInitialReserveCommon = nextState.buildingInitialReserveCommon !== undefined ? nextState.buildingInitialReserveCommon : (b.buildingInitialReserveCommon || 0);
            b.buildingInitialReserveRenovation = nextState.buildingInitialReserveRenovation !== undefined ? nextState.buildingInitialReserveRenovation : (b.buildingInitialReserveRenovation || 0);
            if (!isLocalOnly) {
              b.lastUpdated = Date.now();
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
            const cleanStateForLocal = {
              ...nextState,
              currentUser: stripSensitiveUserFields(nextState.currentUser),
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

          const payload = createCloudPayload(nextState);

          isCloudSyncingRef.current = true;
          setIsCloudSyncing(true);
          setCloudSyncStatus('syncing');
          try {
            await set(ref(rtdb, "condo_state"), payload);
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
          setIsCloudSyncing(true);
          setCloudSyncStatus('syncing');
          try {
            const sessionData = await hydrateFirestoreSession(firebaseUser);
            if (isCancelled) return;
            if (sessionData && sessionData.currentUser) {
              applyFirestoreSessionData(sessionData);
            } else {
              // Fail closed if user has no active Firestore membership
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
                  const payload = createCloudPayload(merged);
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
          try {
            localStorage.removeItem("tarsashaz_logged_in_user");
            localStorage.removeItem("tarsashaz_remember_me");
            localStorage.removeItem("tarsashaz_state");
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
                  const payload = createCloudPayload(merged);
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
  }, []);

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

      const payload = createCloudPayload(targetState);
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

  // Switch to Common Representative (KK) Mode
  const switchToKkMode = (buildingId = null) => {
    if (!isCurrentUserAdmin(state.currentUser, state.users)) return;
    const isEn = state.currentLang === 'en';
    const userEmail = (state.currentUser?.email || "").toLowerCase().trim();
    const adminUser = (state.users || []).find(u => (u.role === 'admin' || u.role === 'superadmin') && u.email?.toLowerCase().trim() === userEmail) ||
                      (state.users || []).find(u => u.role === 'admin' || u.role === 'superadmin') || {
                        id: "admin",
                        name: state.currentUser?.name || (isEn ? "Common Representative" : "Közös Képviselő"),
                        email: userEmail,
                        role: "admin",
                        flatNum: "0"
                      };

    const targetBuildingId = buildingId || state.currentBuildingId || (state.buildings && state.buildings[0] && state.buildings[0].id) || null;
    const curB = (state.buildings || []).find(b => b.id === targetBuildingId) || (state.buildings || [])[0];

    const updatedUser = stripSensitiveUserFields({
      ...adminUser,
      id: adminUser.id || "admin",
      uid: state.currentUser?.uid || adminUser.uid,
      name: adminUser.name || state.currentUser?.name || (isEn ? "Common Representative" : "Közös Képviselő"),
      email: userEmail || adminUser.email || "",
      role: adminUser.role === 'superadmin' ? 'superadmin' : 'admin',
      flatNum: "0",
      buildingId: targetBuildingId,
      isAdminUser: true,
      memberships: state.currentUser?.memberships,
    });

    if (!IS_FIRESTORE_MODE) {
      try {
        localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(updatedUser));
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
      flats: curB ? curB.flats : s.flats,
      transactions: curB ? curB.transactions : s.transactions,
      expenses: curB ? curB.expenses : s.expenses,
      manualDebits: curB ? curB.manualDebits : s.manualDebits,
      documents: curB ? curB.documents : s.documents,
      docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
      infoSections: curB ? curB.infoSections : s.infoSections,
      buildingInitialReserveCommon: curB ? curB.buildingInitialReserveCommon : 0,
      buildingInitialReserveRenovation: curB ? curB.buildingInitialReserveRenovation : 0
    }), 'localOnly');

    if (IS_FIRESTORE_MODE && targetBuildingId && !curB?.hydrated) {
      reloadCurrentBuilding(targetBuildingId);
    }

    showToast(isEn ? "Switched to Common Representative Portfolio" : "Átváltva: Közös Képviseleti Portfólió");
  };

  // Switch to Resident (Tenant) Mode
  const switchToTenantMode = (flatNum = null, buildingId = null) => {
    const isEn = state.currentLang === 'en';
    const myFlats = getUserFlats(state.currentUser, state.buildings);
    const targetFlat = (flatNum && buildingId) 
      ? myFlats.find(f => f.flatNum === flatNum && f.buildingId === buildingId)
      : (flatNum ? myFlats.find(f => f.flatNum === flatNum) : myFlats[0]);

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
      flatNum: chosenFlat.flatNum,
      unitId: chosenFlat.unitId || chosenFlat.id,
      buildingId: targetBuildingId,
      isAdminUser: state.currentUser?.isAdminUser === true,
      memberships: state.currentUser?.memberships,
    });

    if (!IS_FIRESTORE_MODE) {
      try {
        localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(updatedUser));
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
      flats: curB ? curB.flats : s.flats,
      transactions: curB ? curB.transactions : s.transactions,
      expenses: curB ? curB.expenses : s.expenses,
      manualDebits: curB ? curB.manualDebits : s.manualDebits,
      documents: curB ? curB.documents : s.documents,
      docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
      infoSections: curB ? curB.infoSections : s.infoSections,
      buildingInitialReserveCommon: curB ? curB.buildingInitialReserveCommon : 0,
      buildingInitialReserveRenovation: curB ? curB.buildingInitialReserveRenovation : 0
    }), 'localOnly');

    if (IS_FIRESTORE_MODE && targetBuildingId && !curB?.hydrated) {
      reloadCurrentBuilding(targetBuildingId);
    }

    showToast(isEn ? `Switched to Flat ${chosenFlat.flatNum}` : `Átváltva: ${chosenFlat.flatNum}. lakás`);
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
              buildingInitialReserveCommon: s.buildingInitialReserveCommon !== undefined ? s.buildingInitialReserveCommon : (b.buildingInitialReserveCommon || 0),
              buildingInitialReserveRenovation: s.buildingInitialReserveRenovation !== undefined ? s.buildingInitialReserveRenovation : (b.buildingInitialReserveRenovation || 0),
            };
          }
          return b;
        });
      }
      return {
        ...s,
        buildings: updatedBuildings,
        isPortfolioView: true,
        currentBuildingId: null
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
              buildingInitialReserveCommon: s.buildingInitialReserveCommon !== undefined ? s.buildingInitialReserveCommon : (b.buildingInitialReserveCommon || 0),
              buildingInitialReserveRenovation: s.buildingInitialReserveRenovation !== undefined ? s.buildingInitialReserveRenovation : (b.buildingInitialReserveRenovation || 0),
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
    openPortfolio,
    openBuildingAdmin,
    ...authActions,
    ...accountingActions,
    ...buildingActions,
    ...loanActions,
    ...calendarActions,
    ...teamActions,
    orgContext: resolveUserOrgContext(state.currentUser, state.organizations, state.buildings),
    getAccessibleBuildings: (u = state.currentUser, b = state.buildings, o = state.organizations) =>
      getAccessibleBuildings(u, b, o),
    getUserFlats: (u = state.currentUser, b = state.buildings) => getUserFlats(u, b)
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
