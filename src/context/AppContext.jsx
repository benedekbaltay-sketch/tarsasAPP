import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { translations } from '../constants/translations';
import { DEFAULT_BUILDINGS, DEFAULT_USERS, DEFAULT_DOCUMENTS } from '../constants/defaultData';
import { getFirebaseInstance } from '../constants/firebaseConfig';
import { ref, onValue, set, get } from 'firebase/database';
import { recalculateFlatBalances } from '../utils/finances';

const AppContext = createContext(null);

function getPermanentVault() {
  try {
    const raw = localStorage.getItem("tarsashaz_permanent_vault");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { deletedIds: [], deletedFlatNums: [], lastUpdated: 0 };
}

function savePermanentVault(vault) {
  try {
    vault.lastUpdated = Date.now();
    localStorage.setItem("tarsashaz_permanent_vault", JSON.stringify(vault));
  } catch (e) {}
}

function mergeStateWithCloud(local, cloud) {
  if (!cloud) return local;
  if (!local) return cloud;

  const merged = JSON.parse(JSON.stringify(local));
  const localTime = local.lastUpdated || 0;
  const cloudTime = cloud.lastUpdated ? (new Date(cloud.lastUpdated).getTime() || 0) : 0;

  // 1. Current building ID (latest wins)
  if (cloudTime > localTime && cloud.currentBuildingId) {
    merged.currentBuildingId = cloud.currentBuildingId;
  }

  // 2. Merge users
  if (cloud.users && Array.isArray(cloud.users)) {
    const mergedUsers = [...(merged.users || [])];
    cloud.users.forEach(cu => {
      if (!cu) return;
      const index = mergedUsers.findIndex(u => u && (u.id === cu.id || (u.email && cu.email && u.email.toLowerCase() === cu.email.toLowerCase() && u.role === cu.role)));
      if (index >= 0) {
        const localUser = mergedUsers[index];
        mergedUsers[index] = { ...localUser, ...cu };
        if (localUser.pass && (!cu.pass || cu.pass === 'admin123' || cu.pass === 'lakas123' || localTime >= cloudTime)) {
          mergedUsers[index].pass = localUser.pass;
          mergedUsers[index].password = localUser.pass;
        }
      } else {
        mergedUsers.push(cu);
      }
    });
    merged.users = mergedUsers;
  }

  // 3. Merge vault
  const localVault = getPermanentVault();
  const cloudVault = cloud.vault || {};
  const mergedVault = {
    deletedIds: Array.from(new Set([...(localVault.deletedIds || []), ...(cloudVault.deletedIds || [])])),
    deletedFlatNums: Array.from(new Set([...(localVault.deletedFlatNums || []), ...(cloudVault.deletedFlatNums || [])])),
    lastUpdated: Math.max(localVault.lastUpdated || 0, cloudVault.lastUpdated ? (new Date(cloudVault.lastUpdated).getTime() || 0) : 0, Date.now())
  };
  savePermanentVault(mergedVault);

  // 4. Merge buildings
  if (cloud.buildings && Array.isArray(cloud.buildings)) {
    const mergedBuildings = [...(merged.buildings || [])];
    const deletedTxIds = new Set(mergedVault.deletedIds || []);
    const deletedFlatNums = new Set(mergedVault.deletedFlatNums || []);

    cloud.buildings.forEach(cb => {
      if (!cb) return;
      const index = mergedBuildings.findIndex(b => b && b.id === cb.id);
      if (index >= 0) {
        const mb = mergedBuildings[index];

        if (cb.buildingInitialReserveCommon !== undefined) {
          mb.buildingInitialReserveCommon = cb.buildingInitialReserveCommon;
        }
        if (cb.buildingInitialReserveRenovation !== undefined) {
          mb.buildingInitialReserveRenovation = cb.buildingInitialReserveRenovation;
        }

        // Merge flats
        const mbFlats = [...(mb.flats || [])];
        (cb.flats || []).forEach(cf => {
          if (!cf || !cf.flatNum) return;
          if (deletedFlatNums.has(cf.flatNum.trim())) return;

          const fIndex = mbFlats.findIndex(f => f && f.flatNum === cf.flatNum);
          if (fIndex >= 0) {
            mbFlats[fIndex] = { ...mbFlats[fIndex], ...cf };
          } else {
            mbFlats.push(cf);
          }
        });
        mb.flats = mbFlats.filter(f => f && f.flatNum && !deletedFlatNums.has(f.flatNum.trim()));

        // Merge transactions
        const mbTx = [...(mb.transactions || [])];
        (cb.transactions || []).forEach(ctx => {
          if (!ctx || !ctx.id) return;
          if (deletedTxIds.has(ctx.id)) return;

          const txIndex = mbTx.findIndex(t => t && t.id === ctx.id);
          if (txIndex >= 0) {
            mbTx[txIndex] = { ...mbTx[txIndex], ...ctx };
          } else {
            mbTx.push(ctx);
          }
        });
        mb.transactions = mbTx.filter(t => t && t.id && !deletedTxIds.has(t.id));

        // Merge expenses
        const mbExp = [...(mb.expenses || [])];
        (cb.expenses || []).forEach(cexp => {
          if (!cexp || !cexp.id) return;
          if (deletedTxIds.has(cexp.id)) return;

          const expIndex = mbExp.findIndex(e => e && e.id === cexp.id);
          if (expIndex >= 0) {
            mbExp[expIndex] = { ...mbExp[expIndex], ...cexp };
          } else {
            mbExp.push(cexp);
          }
        });
        mb.expenses = mbExp.filter(e => e && e.id && !deletedTxIds.has(e.id));

        // Merge manual debits
        const mbDebits = [...(mb.manualDebits || [])];
        (cb.manualDebits || []).forEach(cdeb => {
          if (!cdeb || !cdeb.id) return;
          if (deletedTxIds.has(cdeb.id)) return;

          const debIndex = mbDebits.findIndex(d => d && d.id === cdeb.id);
          if (debIndex >= 0) {
            mbDebits[debIndex] = { ...mbDebits[debIndex], ...cdeb };
          } else {
            mbDebits.push(cdeb);
          }
        });
        mb.manualDebits = mbDebits.filter(d => d && d.id && !deletedTxIds.has(d.id));

        // Merge documents
        const mbDocs = [...(mb.documents || [])];
        (cb.documents || []).forEach(cdoc => {
          if (!cdoc || !cdoc.id) return;
          if (deletedTxIds.has(cdoc.id)) return;

          const docIndex = mbDocs.findIndex(d => d && d.id === cdoc.id);
          if (docIndex >= 0) {
            mbDocs[docIndex] = { ...mbDocs[docIndex], ...cdoc };
          } else {
            mbDocs.push(cdoc);
          }
        });
        mb.documents = mbDocs.filter(d => d && d.id && !deletedTxIds.has(d.id));

        mergedBuildings[index] = mb;
      } else {
        mergedBuildings.push(cb);
      }
    });
    merged.buildings = mergedBuildings;
  }

  merged.lastUpdated = Math.max(localTime, cloudTime, Date.now());
  merged.revision = Math.max(local.revision || 0, cloud.revision || 0);
  return merged;
}

function loadInitialState() {
  const defaultState = {
    currentLang: 'hu',
    currentUser: null,
    currentBuildingId: "batyu21",
    buildings: JSON.parse(JSON.stringify(DEFAULT_BUILDINGS)),
    users: JSON.parse(JSON.stringify(DEFAULT_USERS)),
    flats: [],
    transactions: [],
    expenses: [],
    manualDebits: [],
    documents: [],
    buildingInitialReserveCommon: 0,
    buildingInitialReserveRenovation: 0,
    revision: 0,
    lastUpdated: 0,
    isGridEditMode: false
  };

  try {
    const raw = localStorage.getItem("tarsashaz_state");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.buildings && parsed.buildings.length > 0) {
        defaultState.currentLang = parsed.currentLang || 'hu';
        defaultState.currentBuildingId = parsed.currentBuildingId || "batyu21";
        defaultState.buildings = parsed.buildings;
        defaultState.users = parsed.users && parsed.users.length > 0 ? parsed.users : defaultState.users;
        defaultState.revision = parsed.revision || 0;
        defaultState.lastUpdated = parsed.lastUpdated || 0;
      }
    }
  } catch (e) {
    console.warn("Could not load from LocalStorage:", e);
  }

  // Restore remember-me user if present
  try {
    const rememberMe = localStorage.getItem("tarsashaz_remember_me") === "true";
    const loggedInUserRaw = localStorage.getItem("tarsashaz_logged_in_user");
    if (rememberMe && loggedInUserRaw) {
      defaultState.currentUser = JSON.parse(loggedInUserRaw);
    }
  } catch (e) {}

  // Sync active building shortcut pointers
  const curB = defaultState.buildings.find(b => b.id === defaultState.currentBuildingId) || defaultState.buildings[0];
  if (curB) {
    defaultState.currentBuildingId = curB.id;
    defaultState.flats = curB.flats || [];
    defaultState.transactions = curB.transactions || [];
    defaultState.expenses = curB.expenses || [];
    defaultState.manualDebits = curB.manualDebits || [];
    defaultState.documents = curB.documents || [];
    defaultState.buildingInitialReserveCommon = curB.buildingInitialReserveCommon || 0;
    defaultState.buildingInitialReserveRenovation = curB.buildingInitialReserveRenovation || 0;
    recalculateFlatBalances(defaultState);
  }

  return defaultState;
}

export function AppProvider({ children }) {
  const [state, setState] = useState(loadInitialState);
  const [toast, setToast] = useState(null);
  const cloudInitialSyncDoneRef = useRef(false);
  const cloudSaveTimeoutRef = useRef(null);
  const isCloudSyncingRef = useRef(false);

  const t = translations[state.currentLang] || translations.hu;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type, id: Date.now() });
  };

  // Sync state changes to LocalStorage and debounce to Firebase RTDB
  const persistState = (updaterFn, immediateCloud = false) => {
    setState(prevState => {
      const nextState = typeof updaterFn === 'function' ? updaterFn(prevState) : { ...prevState, ...updaterFn };
      nextState.revision = (nextState.revision || 0) + 1;
      nextState.lastUpdated = Date.now();

      // Synchronize active building with building in buildings array
      if (nextState.buildings && nextState.currentBuildingId) {
        const b = nextState.buildings.find(x => x.id === nextState.currentBuildingId);
        if (b) {
          b.flats = nextState.flats;
          b.transactions = nextState.transactions;
          b.expenses = nextState.expenses;
          b.manualDebits = nextState.manualDebits;
          b.documents = nextState.documents;
          b.buildingInitialReserveCommon = nextState.buildingInitialReserveCommon;
          b.buildingInitialReserveRenovation = nextState.buildingInitialReserveRenovation;
          b.lastUpdated = Date.now();
        }
      }

      recalculateFlatBalances(nextState);

      // LocalStorage write
      try {
        localStorage.setItem("tarsashaz_state", JSON.stringify(nextState));
      } catch (e) {
        console.warn("LocalStorage save error:", e);
      }

      // Cloud sync debounced
      if (cloudSaveTimeoutRef.current) {
        clearTimeout(cloudSaveTimeoutRef.current);
      }

      const syncToCloud = () => {
        const { rtdb } = getFirebaseInstance();
        if (!rtdb) return;

        const payload = {
          buildings: nextState.buildings,
          users: nextState.users,
          vault: getPermanentVault(),
          revision: nextState.revision || 0,
          lastUpdated: new Date().toISOString()
        };

        isCloudSyncingRef.current = true;
        set(ref(rtdb, "condo_state"), payload)
          .catch(err => console.warn("Firebase RTDB sync error:", err.message))
          .finally(() => {
            setTimeout(() => { isCloudSyncingRef.current = false; }, 500);
          });
      };

      if (immediateCloud) {
        syncToCloud();
      } else {
        cloudSaveTimeoutRef.current = setTimeout(syncToCloud, 250);
      }

      return nextState;
    });
  };

  // Setup Firebase Realtime Database cloud listener
  useEffect(() => {
    const { rtdb } = getFirebaseInstance();
    if (!rtdb) return;

    const stateRef = ref(rtdb, "condo_state");
    const unsubscribe = onValue(stateRef, snapshot => {
      if (isCloudSyncingRef.current) return;
      const cloudData = snapshot.val();
      if (cloudData && cloudData.buildings && cloudData.buildings.length > 0) {
        setState(localState => {
          const localRevision = localState.revision || 0;
          const cloudRevision = cloudData.revision || 0;
          const merged = mergeStateWithCloud(localState, cloudData);

          const curB = (merged.buildings || []).find(b => b.id === merged.currentBuildingId) || merged.buildings[0];
          if (curB) {
            merged.currentBuildingId = curB.id;
            merged.flats = curB.flats || [];
            merged.transactions = curB.transactions || [];
            merged.expenses = curB.expenses || [];
            merged.manualDebits = curB.manualDebits || [];
            merged.documents = curB.documents || [];
            merged.buildingInitialReserveCommon = curB.buildingInitialReserveCommon || 0;
            merged.buildingInitialReserveRenovation = curB.buildingInitialReserveRenovation || 0;
            recalculateFlatBalances(merged);
          }

          try {
            localStorage.setItem("tarsashaz_state", JSON.stringify(merged));
          } catch (e) {}

          cloudInitialSyncDoneRef.current = true;

          if (localRevision > cloudRevision) {
            // Local revision strictly higher, sync merged back to cloud
            setTimeout(() => {
              set(ref(rtdb, "condo_state"), {
                buildings: merged.buildings,
                users: merged.users,
                vault: getPermanentVault(),
                revision: merged.revision || 0,
                lastUpdated: new Date().toISOString()
              });
            }, 100);
          }

          return merged;
        });
      } else if (!cloudData && !cloudInitialSyncDoneRef.current) {
        cloudInitialSyncDoneRef.current = true;
        // Populate empty cloud with current local state
        setState(s => {
          set(ref(rtdb, "condo_state"), {
            buildings: s.buildings,
            users: s.users,
            vault: getPermanentVault(),
            revision: s.revision || 0,
            lastUpdated: new Date().toISOString()
          });
          return s;
        });
      }
    });

    // Handle tab wake, regain focus, or reconnect
    const handleWake = () => {
      get(stateRef).then(snapshot => {
        const cloudData = snapshot.val();
        if (cloudData && cloudData.buildings) {
          setState(local => mergeStateWithCloud(local, cloudData));
        }
      }).catch(() => {});
    };

    window.addEventListener("focus", handleWake);
    window.addEventListener("online", handleWake);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") handleWake();
    });

    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("online", handleWake);
    };
  }, []);

  // Language toggle
  const toggleLanguage = () => {
    persistState(s => ({
      ...s,
      currentLang: s.currentLang === 'hu' ? 'en' : 'hu'
    }));
  };

  // Auth: Login
  const login = (email, pass, rememberMe = false) => {
    const trimmedEmail = (email || "").trim().toLowerCase();
    const cleanPass = (pass || "").trim();

    // Check admin or owners
    let foundUser = (state.users || []).find(u => {
      const uEmail = (u.email || "").toLowerCase().trim();
      const uPass = u.pass || u.password || "lakas123";
      return uEmail === trimmedEmail && uPass === cleanPass;
    });

    // Special Benedek credentials handling
    if (!foundUser && (trimmedEmail === "benedek.baltay@gmail.com" || trimmedEmail === "benedek.baltay01@gmail.com")) {
      if (cleanPass === "Csalad2001") {
        foundUser = (state.users || []).find(u => u.role === "admin") || {
          id: "admin",
          name: "Baltay Benedek",
          email: "benedek.baltay@gmail.com",
          role: "admin",
          flatNum: "0"
        };
      }
    }

    if (!foundUser) {
      // Check buildings flat email
      for (const b of (state.buildings || [])) {
        const flat = (b.flats || []).find(f => (f.email || "").toLowerCase().trim() === trimmedEmail);
        if (flat) {
          const flatPass = flat.pass || flat.password || "lakas123";
          if (cleanPass === flatPass) {
            foundUser = {
              id: flat.flatNum,
              name: flat.ownerName,
              email: flat.email,
              role: "Owner",
              flatNum: flat.flatNum,
              buildingId: b.id
            };
            break;
          }
        }
      }
    }

    if (foundUser) {
      const userCopy = JSON.parse(JSON.stringify(foundUser));
      const targetBuildingId = userCopy.buildingId || state.currentBuildingId || "batyu21";

      if (rememberMe) {
        localStorage.setItem("tarsashaz_remember_me", "true");
        localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(userCopy));
      } else {
        localStorage.removeItem("tarsashaz_remember_me");
        localStorage.removeItem("tarsashaz_logged_in_user");
      }

      persistState(s => {
        const curB = (s.buildings || []).find(b => b.id === targetBuildingId) || s.buildings[0];
        return {
          ...s,
          currentUser: userCopy,
          currentBuildingId: targetBuildingId,
          flats: curB ? curB.flats : s.flats,
          transactions: curB ? curB.transactions : s.transactions,
          expenses: curB ? curB.expenses : s.expenses,
          manualDebits: curB ? curB.manualDebits : s.manualDebits,
          documents: curB ? (curB.documents || []) : s.documents,
          buildingInitialReserveCommon: curB ? curB.buildingInitialReserveCommon : 0,
          buildingInitialReserveRenovation: curB ? curB.buildingInitialReserveRenovation : 0
        };
      }, true);
      return { success: true };
    }

    return { success: false, error: t.login_error };
  };

  // Auth: Quick login (demo)
  const quickLogin = (user) => {
    const userCopy = JSON.parse(JSON.stringify(user));
    const targetBuildingId = userCopy.buildingId || state.currentBuildingId || "batyu21";

    localStorage.setItem("tarsashaz_remember_me", "true");
    localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(userCopy));

    persistState(s => {
      const curB = (s.buildings || []).find(b => b.id === targetBuildingId) || s.buildings[0];
      return {
        ...s,
        currentUser: userCopy,
        currentBuildingId: targetBuildingId,
        flats: curB ? curB.flats : s.flats,
        transactions: curB ? curB.transactions : s.transactions,
        expenses: curB ? curB.expenses : s.expenses,
        manualDebits: curB ? curB.manualDebits : s.manualDebits,
        documents: curB ? (curB.documents || []) : s.documents,
        buildingInitialReserveCommon: curB ? curB.buildingInitialReserveCommon : 0,
        buildingInitialReserveRenovation: curB ? curB.buildingInitialReserveRenovation : 0
      };
    }, true);
  };

  // Auth: Logout
  const logout = () => {
    localStorage.removeItem("tarsashaz_remember_me");
    localStorage.removeItem("tarsashaz_logged_in_user");
    persistState(s => ({
      ...s,
      currentUser: null
    }), true);
  };

  // Auth: Change Password
  const changePassword = (oldPass, newPass) => {
    if (!state.currentUser) return { success: false, error: "Nincs bejelentkezett felhasználó" };
    const curPass = state.currentUser.pass || state.currentUser.password || "lakas123";
    if (curPass !== oldPass) {
      return { success: false, error: state.currentLang === 'en' ? "Old password is incorrect." : "A régi jelszó helytelen." };
    }

    persistState(s => {
      const updatedUsers = (s.users || []).map(u => {
        if (u.id === s.currentUser.id || (u.email && u.email.toLowerCase() === s.currentUser.email.toLowerCase() && u.role === s.currentUser.role)) {
          return { ...u, pass: newPass, password: newPass };
        }
        return u;
      });

      const curB = (s.buildings || []).find(b => b.id === s.currentBuildingId);
      if (curB && curB.flats && s.currentUser.flatNum) {
        curB.flats = curB.flats.map(f => {
          if (f.flatNum === s.currentUser.flatNum) {
            return { ...f, pass: newPass, password: newPass };
          }
          return f;
        });
      }

      const updatedCurrentUser = { ...s.currentUser, pass: newPass, password: newPass };
      localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(updatedCurrentUser));

      return {
        ...s,
        users: updatedUsers,
        currentUser: updatedCurrentUser
      };
    }, true);

    showToast(state.currentLang === 'en' ? "Password changed successfully!" : "A jelszó sikeresen megváltoztatva!");
    return { success: true };
  };

  // Switch Building
  const switchBuilding = (buildingId) => {
    const curB = (state.buildings || []).find(b => b.id === buildingId);
    if (!curB) return;
    persistState(s => ({
      ...s,
      currentBuildingId: buildingId,
      flats: curB.flats || [],
      transactions: curB.transactions || [],
      expenses: curB.expenses || [],
      manualDebits: curB.manualDebits || [],
      documents: curB.documents || [],
      buildingInitialReserveCommon: curB.buildingInitialReserveCommon || 0,
      buildingInitialReserveRenovation: curB.buildingInitialReserveRenovation || 0
    }));
  };

  // Add Transaction
  const addTransaction = (newTx) => {
    persistState(s => ({
      ...s,
      transactions: [newTx, ...(s.transactions || [])]
    }));
    showToast(state.currentLang === 'en' ? "Payment saved!" : "Befizetés mentve!");
  };

  // Add Expense
  const addExpense = (newExpense) => {
    persistState(s => ({
      ...s,
      expenses: [newExpense, ...(s.expenses || [])]
    }));
    showToast(state.currentLang === 'en' ? "Expense saved!" : "Kiadás mentve!");
  };

  // Add Manual Debit
  const addManualDebit = (newDebit) => {
    persistState(s => ({
      ...s,
      manualDebits: [newDebit, ...(s.manualDebits || [])]
    }));
    showToast(state.currentLang === 'en' ? "Debit item saved!" : "Terhelés rögzítve!");
  };

  // Edit Transaction / Expense / ManualDebit
  const editItem = (id, type, updatedFields) => {
    persistState(s => {
      let updatedTransactions = s.transactions || [];
      let updatedExpenses = s.expenses || [];
      let updatedDebits = s.manualDebits || [];

      if (type === "Expense") {
        updatedExpenses = updatedExpenses.map(e => e.id === id ? { ...e, ...updatedFields } : e);
      } else if (type === "Debit") {
        updatedDebits = updatedDebits.map(d => d.id === id ? { ...d, ...updatedFields } : d);
      } else {
        updatedTransactions = updatedTransactions.map(t => t.id === id ? { ...t, ...updatedFields } : t);
      }

      return {
        ...s,
        transactions: updatedTransactions,
        expenses: updatedExpenses,
        manualDebits: updatedDebits
      };
    });
    showToast(state.currentLang === 'en' ? "Item updated!" : "Tétel módosítva!");
  };

  // Delete Item (Payment, Expense, or ManualDebit)
  const deleteItem = (id, type, flatNum = null, date = null, account = null) => {
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
      if (type === "Debit" && !id && flatNum && date && account) {
        // Recurring debit cancellation
        updatedFlats = updatedFlats.map(f => {
          if (f.flatNum === flatNum) {
            const cancelled = f.cancelledDebits || [];
            const key = `${date}_${account}`;
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
    showToast(state.currentLang === 'en' ? "Item deleted!" : "Tétel törölve!");
  };

  // Add Flat
  const addFlat = (newFlat) => {
    persistState(s => {
      const updatedFlats = [...(s.flats || []), newFlat];
      const newUser = {
        id: newFlat.flatNum,
        name: newFlat.ownerName,
        email: newFlat.email,
        pass: "lakas123",
        role: "Owner",
        flatNum: newFlat.flatNum,
        buildingId: s.currentBuildingId
      };
      return {
        ...s,
        flats: updatedFlats,
        users: [...(s.users || []), newUser]
      };
    });
    showToast(state.currentLang === 'en' ? "Flat added!" : "Új lakás hozzáadva!");
  };

  // Delete Flat
  const deleteFlat = (flatNum) => {
    const vault = getPermanentVault();
    vault.deletedFlatNums = vault.deletedFlatNums || [];
    if (!vault.deletedFlatNums.includes(flatNum)) {
      vault.deletedFlatNums.push(flatNum);
      savePermanentVault(vault);
    }

    persistState(s => ({
      ...s,
      flats: (s.flats || []).filter(f => f.flatNum !== flatNum),
      users: (s.users || []).filter(u => !(u.flatNum === flatNum && u.role === "Owner"))
    }));
    showToast(state.currentLang === 'en' ? "Flat deleted!" : "Lakás törölve!");
  };

  // Save Flat Master Data
  const saveFlatMaster = (flatNum, updatedData) => {
    persistState(s => {
      const updatedFlats = (s.flats || []).map(f => {
        if (f.flatNum === flatNum) {
          return { ...f, ...updatedData };
        }
        return f;
      });

      // Also update email or name in users
      const updatedUsers = (s.users || []).map(u => {
        if (u.flatNum === flatNum && u.role === "Owner") {
          return {
            ...u,
            name: updatedData.ownerName || u.name,
            email: updatedData.email || u.email
          };
        }
        return u;
      });

      return {
        ...s,
        flats: updatedFlats,
        users: updatedUsers
      };
    });
    showToast(state.currentLang === 'en' ? "Flat data saved!" : "Lakás adatai mentve!");
  };

  // Reset Flat Password
  const resetFlatPassword = (flatNum) => {
    persistState(s => {
      const updatedUsers = (s.users || []).map(u => {
        if (u.flatNum === flatNum && u.role === "Owner") {
          return { ...u, pass: "lakas123", password: "lakas123" };
        }
        return u;
      });
      const updatedFlats = (s.flats || []).map(f => {
        if (f.flatNum === flatNum) {
          return { ...f, pass: "lakas123", password: "lakas123" };
        }
        return f;
      });
      return {
        ...s,
        users: updatedUsers,
        flats: updatedFlats
      };
    }, true);
    showToast(state.currentLang === 'en' ? "Password reset to default (lakas123)!" : "Jelszó visszaállítva az alapértelmezettre (lakas123)!");
  };

  // Set Global Balances (Common Cost & Renovation Fund)
  const setGlobalBalances = (currentCommon, currentRenovation) => {
    persistState(s => {
      // Calculate verified payments minus expenses
      const totalPaymentsKK = (s.transactions || [])
        .filter(t => t.status === "Verified" && t.targetAccount === "Közös Költség" && t.includeInBalance !== false && t.type !== "Correction")
        .reduce((acc, t) => acc + t.amount, 0);
      const totalExpensesKK = (s.expenses || [])
        .filter(e => e.targetAccount === "Közös Költség" && e.includeInBalance !== false)
        .reduce((acc, e) => acc + e.amount, 0);

      const totalPaymentsFA = (s.transactions || [])
        .filter(t => t.status === "Verified" && t.targetAccount === "Felújítási Alap" && t.includeInBalance !== false && t.type !== "Correction")
        .reduce((acc, t) => acc + t.amount, 0);
      const totalExpensesFA = (s.expenses || [])
        .filter(e => e.targetAccount === "Felújítási Alap" && e.includeInBalance !== false)
        .reduce((acc, e) => acc + e.amount, 0);

      const newInitKK = Math.round(currentCommon - totalPaymentsKK + totalExpensesKK);
      const newInitFA = Math.round(currentRenovation - totalPaymentsFA + totalExpensesFA);

      return {
        ...s,
        buildingInitialReserveCommon: newInitKK,
        buildingInitialReserveRenovation: newInitFA
      };
    }, true);
    showToast(state.currentLang === 'en' ? "Account balances updated!" : "Számlafőösszegek sikeresen beállítva!");
  };

  // Document management
  const uploadDocument = (newDoc) => {
    persistState(s => ({
      ...s,
      documents: [newDoc, ...(s.documents || [])]
    }));
    showToast(state.currentLang === 'en' ? "Document uploaded!" : "Dokumentum feltöltve!");
  };

  const deleteDocument = (docId) => {
    const vault = getPermanentVault();
    vault.deletedIds = vault.deletedIds || [];
    if (!vault.deletedIds.includes(docId)) {
      vault.deletedIds.push(docId);
      savePermanentVault(vault);
    }
    persistState(s => ({
      ...s,
      documents: (s.documents || []).filter(d => d.id !== docId)
    }));
    showToast(state.currentLang === 'en' ? "Document deleted!" : "Dokumentum törölve!");
  };

  // Add Building
  const addBuilding = (newBuilding) => {
    persistState(s => ({
      ...s,
      buildings: [...(s.buildings || []), newBuilding],
      currentBuildingId: newBuilding.id,
      flats: newBuilding.flats || [],
      transactions: newBuilding.transactions || [],
      expenses: newBuilding.expenses || [],
      manualDebits: newBuilding.manualDebits || [],
      documents: newBuilding.documents || [],
      buildingInitialReserveCommon: newBuilding.buildingInitialReserveCommon || 0,
      buildingInitialReserveRenovation: newBuilding.buildingInitialReserveRenovation || 0
    }), true);
    showToast(state.currentLang === 'en' ? "Condominium created!" : "Új társasház sikeresen létrehozva!");
  };

  // Toggle Grid Edit Mode
  const toggleGridEditMode = () => {
    setState(s => ({ ...s, isGridEditMode: !s.isGridEditMode }));
  };

  // Update Flat Fee and FeeChanges
  const updateFlatFees = (flatNum, newMonthlyFee, newRenovationFee, feeDateKK = null, feeDateFA = null) => {
    persistState(s => {
      const updatedFlats = (s.flats || []).map(flat => {
        if (flat.flatNum !== flatNum) return flat;

        const updated = { ...flat };
        if (newMonthlyFee !== undefined && newMonthlyFee !== null) {
          const numFee = Number(newMonthlyFee);
          if (feeDateKK) {
            updated.feeChangesKK = [...(updated.feeChangesKK || []), { amount: numFee, date: feeDateKK }];
          } else {
            updated.monthlyFee = numFee;
          }
        }

        if (newRenovationFee !== undefined && newRenovationFee !== null) {
          const numFee = Number(newRenovationFee);
          if (feeDateFA) {
            updated.feeChangesFA = [...(updated.feeChangesFA || []), { amount: numFee, date: feeDateFA }];
          } else {
            updated.renovationFee = numFee;
          }
        }

        return updated;
      });

      return {
        ...s,
        flats: updatedFlats
      };
    });
    showToast(state.currentLang === 'en' ? "Fees updated!" : "Előírások frissítve!");
  };

  const value = {
    state,
    t,
    showToast,
    toggleLanguage,
    login,
    quickLogin,
    logout,
    changePassword,
    switchBuilding,
    addTransaction,
    addExpense,
    addManualDebit,
    editItem,
    deleteItem,
    addFlat,
    deleteFlat,
    saveFlatMaster,
    resetFlatPassword,
    setGlobalBalances,
    uploadDocument,
    deleteDocument,
    addBuilding,
    toggleGridEditMode,
    updateFlatFees
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      {toast && <Toast key={toast.id} toast={toast} onClose={() => setToast(null)} />}
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

// Temporary inline Toast component until Toast.jsx is mounted
function Toast({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 bg-slate-900/90 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/60 text-sm font-medium animate-fadeIn">
      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
      <span>{toast.msg}</span>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white">&times;</button>
    </div>
  );
}
