import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { getFirebaseInstance } from '../constants/firebaseConfig';
import { ref, get } from 'firebase/database';
import {
  mergeStateWithCloud,
  stripSensitiveUserFields,
  stripSensitiveBuildingFields
} from './syncEngine';

const MIN_PASSWORD_LENGTH = 10;

export function createAuthActions({ state, setState, persistState, showToast, t, getUserFlats }) {
  // Auth: Strictly cloud-verified Firebase Authentication login (zero plaintext fallback, zero client self-signup)
  const login = async (email, pass, rememberMe = false) => {
    const trimmedEmail = (email || "").trim().toLowerCase();
    const cleanPass = (pass || "").trim();
    const isEn = state.currentLang === 'en';

    if (!trimmedEmail || !cleanPass) {
      return { success: false, error: t.login_error || (isEn ? "Please enter your email and password." : "Kérjük, add meg az e-mail címet és a jelszót!") };
    }

    const { auth, rtdb } = getFirebaseInstance();
    if (!auth) {
      return {
        success: false,
        error: isEn
          ? "Authentication service is unavailable. Please try again later."
          : "A hitelesítési szolgáltatás jelenleg nem elérhető. Kérjük, próbáld újra később."
      };
    }

    // 1. Configure Firebase Auth session persistence & authenticate strictly via Firebase Identity Platform
    let firebaseUser = null;
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, cleanPass);
      firebaseUser = userCred.user;
    } catch (authErr) {
      console.warn("Firebase Auth sign-in failed:", authErr.code);
      return {
        success: false,
        error: t.login_error || (isEn ? "Invalid email address or password." : "Hibás e-mail cím vagy jelszó!")
      };
    }

    // 2. Pull fresh cloud state immediately after Firebase Auth succeeds
    // (Required because production client bundle contains zero hardcoded users/buildings/PII)
    let effectiveUsers = (state.users || []).map(stripSensitiveUserFields);
    let effectiveBuildings = stripSensitiveBuildingFields(state.buildings || []);
    let fetchedCloudData = null;

    if (rtdb) {
      try {
        const snapshot = await get(ref(rtdb, "condo_state"));
        const cloudData = snapshot.val();
        if (cloudData && Array.isArray(cloudData.buildings) && cloudData.buildings.length > 0) {
          fetchedCloudData = cloudData;
          effectiveUsers = (cloudData.users || []).map(stripSensitiveUserFields);
          effectiveBuildings = stripSensitiveBuildingFields(cloudData.buildings || []);
        }
      } catch (fetchErr) {
        console.warn("Immediate post-login cloud fetch warning:", fetchErr.message);
      }
    }

    // 3. Check Firebase Custom Claims if configured (forward-compatible with Phase 1 Firestore/Claims)
    let tokenClaims = {};
    try {
      const tokenResult = await firebaseUser.getIdTokenResult();
      tokenClaims = tokenResult?.claims || {};
    } catch (e) {}

    // 4. Resolve user profile strictly by exact authenticated email (no alias or prefix matching)
    const verifiedEmail = (firebaseUser.email || trimmedEmail).toLowerCase().trim();
    const matchingUsers = effectiveUsers.filter(u => {
      const uEmail = (u?.email || "").toLowerCase().trim();
      return uEmail === verifiedEmail;
    });

    let foundUser = null;
    if (matchingUsers.length > 0) {
      foundUser = matchingUsers.find(u => u.role === 'superadmin' || u.role === 'admin' || u.role === 'szvb') || matchingUsers[0];
    }

    // Fallback lookup in building flat owner emails if not listed in top-level users array
    if (!foundUser) {
      for (const b of effectiveBuildings) {
        const flat = (b.flats || []).find(f => {
          const mainEmail = (f.email || "").toLowerCase().trim();
          if (mainEmail === verifiedEmail) return true;
          if (Array.isArray(f.owners)) {
            return f.owners.some(o => {
              const oEmail = (o.email || "").toLowerCase().trim();
              const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
              return oEmail === verifiedEmail || oEmails.includes(verifiedEmail);
            });
          }
          return false;
        });

        if (flat) {
          let individualName = flat.ownerName;
          if (Array.isArray(flat.owners) && flat.owners.length > 0) {
            const matchedOwner = flat.owners.find(o => {
              const oEmail = (o.email || "").toLowerCase().trim();
              const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
              return oEmail === verifiedEmail || oEmails.includes(verifiedEmail);
            });
            if (matchedOwner && matchedOwner.name) {
              individualName = matchedOwner.name;
            } else if (flat.owners.length === 1 && flat.owners[0].name) {
              individualName = flat.owners[0].name;
            }
          }

          foundUser = {
            id: flat.flatNum,
            uid: firebaseUser.uid,
            name: individualName,
            email: verifiedEmail,
            role: tokenClaims.role || "Owner",
            flatNum: flat.flatNum,
            buildingId: b.id
          };
          break;
        }
      }
    }

    // If user exists in Firebase Auth with a custom role claim but not yet in legacy RTDB users list
    if (!foundUser && tokenClaims.role) {
      foundUser = {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || verifiedEmail,
        email: verifiedEmail,
        role: tokenClaims.role,
        flatNum: tokenClaims.flatNum || "0",
        buildingId: tokenClaims.buildingId || (effectiveBuildings[0]?.id || null)
      };
    }

    if (!foundUser) {
      // Signed in to Firebase Auth but not provisioned to any condominium unit/role — fail closed
      try {
        await signOut(auth);
      } catch (e) {}
      return {
        success: false,
        error: isEn
          ? "Your account is not linked to an active condominium profile. Please contact your representative."
          : "Ez a fiók nincs hozzárendelve aktív társasházi profilhoz. Kérjük, vedd fel a kapcsolatot a közös képviselettel!"
      };
    }

    // Resolve exact individual name for Owner if needed
    if (foundUser.role !== 'admin' && foundUser.role !== 'superadmin' && foundUser.role !== 'szvb') {
      for (const b of effectiveBuildings) {
        const flat = (b.flats || []).find(f => f.flatNum === foundUser.flatNum);
        if (flat && Array.isArray(flat.owners) && flat.owners.length > 0) {
          const matchedOwner = flat.owners.find(o => {
            const oEmail = (o.email || "").toLowerCase().trim();
            const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
            return verifiedEmail && (oEmail === verifiedEmail || oEmails.includes(verifiedEmail));
          });
          if (matchedOwner && matchedOwner.name) {
            foundUser = { ...foundUser, name: matchedOwner.name };
            break;
          }
        }
      }
    }

    // 5. Construct sanitized session user object (NEVER store plaintext passwords!)
    const userCopy = stripSensitiveUserFields({
      ...JSON.parse(JSON.stringify(foundUser)),
      uid: firebaseUser.uid,
      email: verifiedEmail,
      role: tokenClaims.role || foundUser.role
    });

    const targetBuildingId = userCopy.buildingId || state.currentBuildingId || effectiveBuildings[0]?.id || null;

    if (rememberMe) {
      localStorage.setItem("tarsashaz_remember_me", "true");
      localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(userCopy));
    } else {
      localStorage.removeItem("tarsashaz_remember_me");
      localStorage.removeItem("tarsashaz_logged_in_user");
    }
    try {
      sessionStorage.setItem("tarsashaz_session_user", JSON.stringify(userCopy));
    } catch (e) {}

    await persistState(s => {
      const baseState = fetchedCloudData ? mergeStateWithCloud(s, fetchedCloudData) : s;
      const safeBuildings = stripSensitiveBuildingFields(baseState.buildings || []);
      const safeUsers = (baseState.users || []).map(stripSensitiveUserFields);
      const curB = safeBuildings.find(b => b.id === targetBuildingId) || safeBuildings[0];
      const isUserAdmin = userCopy.role === 'admin' || userCopy.role === 'superadmin';
      const isKkAdmin = userCopy.role === 'admin';

      return {
        ...baseState,
        users: safeUsers,
        buildings: safeBuildings,
        currentUser: userCopy,
        currentBuildingId: isKkAdmin ? null : (curB?.id || targetBuildingId),
        activeRoleMode: isUserAdmin ? 'kk' : 'tenant',
        isPortfolioView: isKkAdmin ? true : false,
        flats: (curB && curB.flats) || baseState.flats || [],
        transactions: (curB && curB.transactions) || baseState.transactions || [],
        expenses: (curB && curB.expenses) || baseState.expenses || [],
        manualDebits: (curB && Array.isArray(curB.manualDebits)) ? curB.manualDebits : (Array.isArray(baseState.manualDebits) ? baseState.manualDebits : []),
        documents: curB ? (curB.documents || []) : (baseState.documents || []),
        docFolders: curB ? (curB.docFolders || []) : (baseState.docFolders || []),
        loans: curB ? (curB.loans || []) : (baseState.loans || []),
        infoSections: curB ? (curB.infoSections || []) : (baseState.infoSections || []),
        buildingInitialReserveCommon: curB ? (curB.buildingInitialReserveCommon || 0) : 0,
        buildingInitialReserveRenovation: curB ? (curB.buildingInitialReserveRenovation || 0) : 0
      };
    }, 'localOnly');

    return { success: true };
  };

  // Auth: Internal session switch (strictly for already-authenticated multi-flat/profile switching)
  const quickLogin = (user) => {
    if (!state.currentUser || !user) return;
    const isTargetPrivileged = user.role === 'admin' || user.role === 'superadmin' || user.isAdminUser === true;
    const isCurrentPrivileged = (
      state.currentUser.role === 'admin' ||
      state.currentUser.role === 'superadmin' ||
      state.currentUser.isAdminUser === true
    );
    if (isTargetPrivileged && !isCurrentPrivileged) {
      showToast(state.currentLang === 'en' ? "Unauthorized role switch." : "Jogosulatlan szerepkörváltás.", "error");
      return;
    }
    const userCopy = stripSensitiveUserFields(JSON.parse(JSON.stringify(user)));
    const targetBuildingId = userCopy.buildingId || state.currentBuildingId || state.buildings?.[0]?.id || null;

    try {
      if (localStorage.getItem("tarsashaz_remember_me") === "true") {
        localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(userCopy));
      }
      sessionStorage.setItem("tarsashaz_session_user", JSON.stringify(userCopy));
    } catch (e) {}

    persistState(s => {
      const curB = (s.buildings || []).find(b => b.id === targetBuildingId) || s.buildings?.[0];
      const isUserAdmin = userCopy.role === 'admin' || userCopy.role === 'superadmin';
      const isKkAdmin = userCopy.role === 'admin';
      return {
        ...s,
        currentUser: userCopy,
        currentBuildingId: isKkAdmin ? null : (curB?.id || targetBuildingId),
        activeRoleMode: isUserAdmin ? 'kk' : 'tenant',
        isPortfolioView: isKkAdmin ? true : false,
        flats: (curB && curB.flats) || s.flats || [],
        transactions: (curB && curB.transactions) || s.transactions || [],
        expenses: (curB && curB.expenses) || s.expenses || [],
        manualDebits: (curB && Array.isArray(curB.manualDebits)) ? curB.manualDebits : (Array.isArray(s.manualDebits) ? s.manualDebits : []),
        documents: curB ? (curB.documents || []) : (s.documents || []),
        docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
        loans: curB ? (curB.loans || []) : (s.loans || []),
        infoSections: curB ? (curB.infoSections || []) : (s.infoSections || []),
        buildingInitialReserveCommon: curB ? (curB.buildingInitialReserveCommon || 0) : 0,
        buildingInitialReserveRenovation: curB ? (curB.buildingInitialReserveRenovation || 0) : 0
      };
    }, 'localOnly');
  };

  // Auth: Switch active flat for multi-flat owners (strictly verified ownership)
  const switchActiveFlat = (flatNum, buildingId = state.currentBuildingId) => {
    if (!state.currentUser) return;
    const isAdminOrSuper = state.currentUser.role === 'admin' || state.currentUser.role === 'superadmin';

    if (!isAdminOrSuper && getUserFlats) {
      const ownedFlats = getUserFlats(state.currentUser, state.buildings);
      const isAllowed = ownedFlats.some(f => f.flatNum === flatNum && (!buildingId || f.buildingId === buildingId));
      if (!isAllowed) {
        showToast(state.currentLang === 'en' ? "Unauthorized apartment access." : "Nincs jogosultságod ehhez a lakáshoz.", "error");
        return;
      }
    }

    const targetBuilding = (state.buildings || []).find(b => b.id === buildingId) || state.buildings?.[0];
    const targetFlat = (targetBuilding?.flats || []).find(f => f.flatNum === flatNum);

    let individualName = state.currentUser.name;
    if (targetFlat) {
      if (Array.isArray(targetFlat.owners) && targetFlat.owners.length > 0) {
        const uEmail = (state.currentUser.email || "").toLowerCase().trim();
        const matchedOwner = targetFlat.owners.find(o => {
          const oEmail = (o.email || "").toLowerCase().trim();
          const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
          return Boolean(uEmail && (oEmail === uEmail || oEmails.includes(uEmail)));
        });
        if (matchedOwner && matchedOwner.name) {
          individualName = matchedOwner.name;
        } else if (targetFlat.owners.length === 1 && targetFlat.owners[0].name) {
          individualName = targetFlat.owners[0].name;
        }
      } else {
        individualName = targetFlat.ownerName || state.currentUser.name;
      }
    }

    const wasAdmin = (
      state.currentUser.role === 'admin' ||
      state.currentUser.role === 'superadmin' ||
      state.currentUser.isAdminUser === true
    );

    const updatedUser = stripSensitiveUserFields({
      ...state.currentUser,
      id: targetFlat?.flatNum || flatNum,
      role: "Owner",
      flatNum: flatNum,
      buildingId: targetBuilding?.id || buildingId,
      name: individualName,
      email: state.currentUser.email || "",
      isAdminUser: wasAdmin
    });
    quickLogin(updatedUser);
    showToast(state.currentLang === 'en' ? `Switched to Flat ${flatNum}` : `Átváltva: ${flatNum}. lakás`);
  };

  // SuperAdmin: Impersonate / Act as another user (strictly guarded to superadmin only)
  const actAsUser = (targetUser, targetBuildingId) => {
    if (!state.currentUser) return;
    const isSuperAdmin = (
      state.currentUser.role === 'superadmin' ||
      state.impersonatedFrom?.originalUser?.role === 'superadmin'
    );
    if (!isSuperAdmin) {
      showToast(state.currentLang === 'en' ? "Unauthorized action." : "Jogosulatlan művelet.", "error");
      return;
    }

    const originalUser = stripSensitiveUserFields(
      state.impersonatedFrom ? state.impersonatedFrom.originalUser : state.currentUser
    );
    const safeTarget = stripSensitiveUserFields(JSON.parse(JSON.stringify(targetUser)));
    const bId = targetBuildingId || safeTarget.buildingId || state.currentBuildingId || state.buildings?.[0]?.id || null;

    persistState(s => {
      const curB = (s.buildings || []).find(b => b.id === bId) || s.buildings?.[0];
      return {
        ...s,
        currentUser: safeTarget,
        currentBuildingId: curB?.id || bId,
        impersonatedFrom: {
          originalUser: JSON.parse(JSON.stringify(originalUser)),
          timestamp: Date.now()
        },
        flats: (curB && curB.flats) || s.flats || [],
        transactions: (curB && curB.transactions) || s.transactions || [],
        expenses: (curB && curB.expenses) || s.expenses || [],
        manualDebits: (curB && Array.isArray(curB.manualDebits)) ? curB.manualDebits : (Array.isArray(s.manualDebits) ? s.manualDebits : []),
        documents: curB ? (curB.documents || []) : (s.documents || []),
        docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
        loans: curB ? (curB.loans || []) : (s.loans || []),
        infoSections: curB ? (curB.infoSections || []) : (s.infoSections || []),
        buildingInitialReserveCommon: curB ? (curB.buildingInitialReserveCommon || 0) : 0,
        buildingInitialReserveRenovation: curB ? (curB.buildingInitialReserveRenovation || 0) : 0
      };
    }, 'localOnly');

    showToast(
      state.currentLang === 'en'
        ? `SuperAdmin: Acting as ${safeTarget.name || safeTarget.email}`
        : `Rendszergazda: Belépve mint ${safeTarget.name || safeTarget.email}`
    );
  };

  // SuperAdmin: Exit impersonation
  const exitImpersonation = () => {
    if (!state.impersonatedFrom) return;
    const originalUser = stripSensitiveUserFields(state.impersonatedFrom.originalUser);

    persistState(s => ({
      ...s,
      currentUser: JSON.parse(JSON.stringify(originalUser)),
      impersonatedFrom: null
    }), 'localOnly');

    showToast(
      state.currentLang === 'en'
        ? "Returned to SuperAdmin Center"
        : "Visszatérve a Rendszergazda felületre"
    );
  };

  // Auth: Logout — completely purges all cached PII, financial records, and session state from browser storage & memory
  const logout = () => {
    const { auth } = getFirebaseInstance();
    if (auth) {
      try {
        signOut(auth);
      } catch (e) {}
    }
    try {
      localStorage.removeItem("tarsashaz_state");
      localStorage.removeItem("tarsashaz_permanent_vault");
      localStorage.removeItem("tarsashaz_remember_me");
      localStorage.removeItem("tarsashaz_logged_in_user");
      localStorage.removeItem("tarsashaz_role_mode");
      localStorage.removeItem("tarsashaz_is_portfolio");
    } catch (e) {}
    try {
      sessionStorage.clear();
      if (window.location.hash && !window.location.hash.includes('mode=resetPassword') && !window.location.hash.includes('pay=1')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (e) {}

    setState(s => ({
      ...s,
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
      calendarEvents: [],
      buildingInitialReserveCommon: 0,
      buildingInitialReserveRenovation: 0,
      revision: 0,
      lastUpdated: 0,
      isGridEditMode: false
    }));
  };

  // Auth: Change Password — strictly requires current password re-authentication + strong length (>= 10 chars) + zero plaintext DB storage
  const changePassword = async (currentPass, newPass) => {
    const isEn = state.currentLang === 'en';
    if (!state.currentUser) {
      return { success: false, error: isEn ? "No user logged in." : "Nincs bejelentkezett felhasználó." };
    }

    if (!currentPass || !String(currentPass).trim()) {
      return {
        success: false,
        error: isEn
          ? "Please enter your current password to verify your identity."
          : "Kérjük, add meg a jelenlegi jelszavadat a személyazonosság igazolásához!"
      };
    }

    const cleanNewPass = String(newPass || "");
    if (cleanNewPass.length < MIN_PASSWORD_LENGTH) {
      return {
        success: false,
        error: isEn
          ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
          : `A jelszónak legalább ${MIN_PASSWORD_LENGTH} karakter hosszúnak kell lennie.`
      };
    }

    const { auth } = getFirebaseInstance();
    if (!auth || !auth.currentUser || !auth.currentUser.email) {
      return {
        success: false,
        error: isEn
          ? "Your authentication session has expired. Please log out and sign in again."
          : "A hitelesítési munkameneted lejárt. Kérjük, lépj ki és jelentkezz be újra!"
      };
    }

    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, String(currentPass).trim());
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, cleanNewPass);
    } catch (authErr) {
      console.warn("Firebase Auth changePassword error:", authErr.code);
      if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
        return {
          success: false,
          error: isEn ? "Current password is incorrect." : "A megadott jelenlegi jelszó hibás!"
        };
      }
      if (authErr.code === 'auth/weak-password') {
        return {
          success: false,
          error: isEn ? "The new password is too weak. Choose a stronger password." : "Az új jelszó túl gyenge. Kérjük, válassz erősebb jelszót!"
        };
      }
      if (authErr.code === 'auth/requires-recent-login') {
        return {
          success: false,
          error: isEn
            ? "For security, please log out and sign in again before changing your password."
            : "Biztonsági okokból kérjük, jelentkezz ki, majd lépj be újra a jelszó módosításához!"
        };
      }
      return {
        success: false,
        error: isEn
          ? "Failed to update password. Please try again."
          : "Nem sikerült módosítani a jelszót. Kérjük, próbáld újra!"
      };
    }

    showToast(isEn ? "Password successfully updated!" : "Jelszó sikeresen frissítve!");
    return { success: true };
  };

  return {
    login,
    quickLogin,
    switchActiveFlat,
    actAsUser,
    exitImpersonation,
    logout,
    changePassword
  };
}
