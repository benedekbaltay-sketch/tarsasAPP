import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { getFirebaseInstance } from '../constants/firebaseConfig';
import { DEFAULT_INFO_SECTIONS } from '../constants/defaultData';
import { ref, get } from 'firebase/database';
import { mergeStateWithCloud } from './syncEngine';
import { recalculateFlatBalances } from '../utils/finances';

export function createAuthActions({ state, setState, persistState, showToast, t, ensureFirebaseAuth }) {
  // Auth: Login
  const login = async (email, pass, rememberMe = false) => {
    const trimmedEmail = (email || "").trim().toLowerCase();
    const cleanPass = (pass || "").trim();

    if (!trimmedEmail || !cleanPass) {
      return { success: false, error: t.login_error || "Kérjük, add meg az e-mail címet és a jelszót!" };
    }

    // 1. Authenticate with Firebase Authentication
    const { auth, rtdb } = getFirebaseInstance();
    let firebaseAuthSuccess = false;
    if (auth) {
      try {
        await signInWithEmailAndPassword(auth, trimmedEmail, cleanPass);
        firebaseAuthSuccess = true;
      } catch (authErr) {
        console.warn("Firebase Auth sign-in:", authErr.code, authErr.message);

        // If user used alias email, attempt sign-in ONLY with the exact entered password (cleanPass)
        if (trimmedEmail === "benedek.baltay@gmail.com" || trimmedEmail === "benedek.baltay01@gmail.com") {
          const altEmail = trimmedEmail === "benedek.baltay@gmail.com" ? "benedek.baltay01@gmail.com" : "benedek.baltay@gmail.com";
          try {
            await signInWithEmailAndPassword(auth, altEmail, cleanPass);
            firebaseAuthSuccess = true;
          } catch (e2) {}
        }

        // STRICT SECURITY: If password was explicitly wrong, REJECT IMMEDIATELY!
        if (!firebaseAuthSuccess && (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential')) {
          return { success: false, error: t.login_error || "Hibás e-mail cím vagy jelszó!" };
        }
      }
    }

    // 2. Find user in state.users
    let matchingUsers = (state.users || []).filter(u => {
      const uEmail = (u.email || "").toLowerCase().trim();
      return uEmail === trimmedEmail || (trimmedEmail === "benedek.baltay@gmail.com" && uEmail === "benedek.baltay01@gmail.com");
    });

    let foundUser = null;

    if (firebaseAuthSuccess) {
      // Firebase approved the password!
      if (matchingUsers.length > 0) {
        // Prioritize admin / superadmin if multiple roles exist for this email
        foundUser = matchingUsers.find(u => u.role === 'admin' || u.role === 'superadmin') || matchingUsers[0];
      }
    } else {
      // Local fallback check (e.g. offline or for accounts not yet in Firebase Auth)
      const validMatchingUser = matchingUsers.find(u => {
        const uPass = u.pass || u.password;
        return uPass && uPass === cleanPass;
      });
      if (validMatchingUser) {
        foundUser = validMatchingUser;
        // Attempt to create user in Firebase Auth so subsequent logins use cloud auth directly
        if (auth) {
          try {
            await createUserWithEmailAndPassword(auth, trimmedEmail, cleanPass);
          } catch (createErr) {
            console.warn("Firebase user registration fallback warning:", createErr.message);
          }
        }
      }
    }

    // 3. If not found in state.users, check building flats
    if (!foundUser) {
      for (const b of (state.buildings || [])) {
        const flat = (b.flats || []).find(f => {
          const mainEmail = (f.email || "").toLowerCase().trim();
          if (mainEmail === trimmedEmail) return true;
          if (Array.isArray(f.owners)) {
            return f.owners.some(o => {
              const oEmail = (o.email || "").toLowerCase().trim();
              const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
              return oEmail === trimmedEmail || oEmails.includes(trimmedEmail);
            });
          }
          return false;
        });

        if (flat) {
          const flatPass = flat.pass || flat.password;
          const isPassValid = firebaseAuthSuccess || (flatPass && cleanPass === flatPass);
          if (isPassValid) {
            let individualName = flat.ownerName;
            if (Array.isArray(flat.owners) && flat.owners.length > 0) {
              const matchedOwner = flat.owners.find(o => {
                const oEmail = (o.email || "").toLowerCase().trim();
                const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
                return oEmail === trimmedEmail || oEmails.includes(trimmedEmail);
              });
              if (matchedOwner && matchedOwner.name) {
                individualName = matchedOwner.name;
              } else if (flat.owners.length === 1 && flat.owners[0].name) {
                individualName = flat.owners[0].name;
              }
            }

            foundUser = {
              id: flat.flatNum,
              name: individualName,
              email: trimmedEmail,
              role: "Owner",
              flatNum: flat.flatNum,
              buildingId: b.id,
              pass: cleanPass,
              password: cleanPass
            };
            break;
          }
        }
      }
    }

    // 4. Resolve exact individual name for Owner if needed
    if (foundUser && foundUser.role !== 'admin' && foundUser.role !== 'superadmin') {
      for (const b of (state.buildings || [])) {
        const flat = (b.flats || []).find(f => f.flatNum === foundUser.flatNum);
        if (flat && Array.isArray(flat.owners) && flat.owners.length > 0) {
          const uEmail = (trimmedEmail || foundUser.email || "").toLowerCase().trim();
          const matchedOwner = flat.owners.find(o => {
            const oEmail = (o.email || "").toLowerCase().trim();
            const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
            return uEmail && (oEmail === uEmail || oEmails.includes(uEmail));
          });
          if (matchedOwner && matchedOwner.name) {
            foundUser.name = matchedOwner.name;
            break;
          }
        }
      }
    }

    // 5. Successful login
    if (foundUser) {
      const userCopy = JSON.parse(JSON.stringify(foundUser));
      userCopy.pass = cleanPass;
      userCopy.password = cleanPass;
      const targetBuildingId = userCopy.buildingId || state.currentBuildingId || "batyu21";

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

      // Immediate pre-render pull from cloud so the user immediately sees the latest revision
      if (firebaseAuthSuccess && rtdb) {
        try {
          const snapshot = await get(ref(rtdb, "condo_state"));
          const cloudData = snapshot.val();
          if (cloudData && cloudData.buildings && cloudData.buildings.length > 0) {
            setState(localState => mergeStateWithCloud(localState, cloudData));
          }
        } catch (fetchErr) {
          console.warn("Immediate post-login cloud fetch warning:", fetchErr);
        }
      }

      await persistState(s => {
        // Synchronize password across ALL user records matching this email
        const updatedUsers = (s.users || []).map(u => {
          const uEmail = (u.email || "").toLowerCase().trim();
          if (uEmail === trimmedEmail || (trimmedEmail === "benedek.baltay@gmail.com" && uEmail === "benedek.baltay01@gmail.com") || u.id === userCopy.id) {
            return { ...u, pass: cleanPass, password: cleanPass };
          }
          return u;
        });

        // Also synchronize flat password if flatNum matches
        const updatedBuildings = (s.buildings || []).map(b => {
          if (b.flats && userCopy.flatNum) {
            b.flats = b.flats.map(f => {
              if (f.flatNum === userCopy.flatNum) {
                return { ...f, pass: cleanPass, password: cleanPass };
              }
              return f;
            });
          }
          return b;
        });

        const curB = updatedBuildings.find(b => b.id === targetBuildingId) || updatedBuildings[0];
        const isUserAdmin = userCopy.role === 'admin' || userCopy.role === 'superadmin';
        const isKkAdmin = userCopy.role === 'admin';
        return {
          ...s,
          users: updatedUsers,
          buildings: updatedBuildings,
          currentUser: userCopy,
          currentBuildingId: isKkAdmin ? null : targetBuildingId,
          activeRoleMode: isUserAdmin ? 'kk' : 'tenant',
          isPortfolioView: isKkAdmin ? true : false,
          flats: (curB && curB.flats) || s.flats || [],
          transactions: (curB && curB.transactions) || s.transactions || [],
          expenses: (curB && curB.expenses) || s.expenses || [],
          manualDebits: (curB && Array.isArray(curB.manualDebits)) ? curB.manualDebits : (Array.isArray(s.manualDebits) ? s.manualDebits : []),
          documents: curB ? (curB.documents || []) : s.documents,
        docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
          docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
          infoSections: curB ? (curB.infoSections || (curB.id === 'batyu21' ? JSON.parse(JSON.stringify(DEFAULT_INFO_SECTIONS)) : [])) : (s.infoSections || []),
          buildingInitialReserveCommon: curB ? curB.buildingInitialReserveCommon : 0,
          buildingInitialReserveRenovation: curB ? curB.buildingInitialReserveRenovation : 0
        };
      }, 'localOnly');

      return { success: true };
    }

    return { success: false, error: t.login_error };
  };

  // Auth: Quick Login
  const quickLogin = (user) => {
    const userCopy = JSON.parse(JSON.stringify(user));
    const targetBuildingId = userCopy.buildingId || state.currentBuildingId || "batyu21";

    localStorage.setItem("tarsashaz_remember_me", "true");
    localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(userCopy));
    try {
      sessionStorage.setItem("tarsashaz_session_user", JSON.stringify(userCopy));
    } catch (e) {}

    persistState(s => {
      const curB = (s.buildings || []).find(b => b.id === targetBuildingId) || s.buildings[0];
      const isUserAdmin = userCopy.role === 'admin' || userCopy.role === 'superadmin';
      const isKkAdmin = userCopy.role === 'admin';
      return {
        ...s,
        currentUser: userCopy,
        currentBuildingId: isKkAdmin ? null : targetBuildingId,
        activeRoleMode: isUserAdmin ? 'kk' : 'tenant',
        isPortfolioView: isKkAdmin ? true : false,
        flats: (curB && curB.flats) || s.flats || [],
        transactions: (curB && curB.transactions) || s.transactions || [],
        expenses: (curB && curB.expenses) || s.expenses || [],
        manualDebits: (curB && Array.isArray(curB.manualDebits)) ? curB.manualDebits : (Array.isArray(s.manualDebits) ? s.manualDebits : []),
        documents: curB ? (curB.documents || []) : s.documents,
        docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
        infoSections: curB ? (curB.infoSections || (curB.id === 'batyu21' ? JSON.parse(JSON.stringify(DEFAULT_INFO_SECTIONS)) : [])) : (s.infoSections || []),
        buildingInitialReserveCommon: curB ? curB.buildingInitialReserveCommon : 0,
        buildingInitialReserveRenovation: curB ? curB.buildingInitialReserveRenovation : 0
      };
    }, 'localOnly');
  };

  // Auth: Switch active flat for multi-flat owners
  const switchActiveFlat = (flatNum, buildingId = state.currentBuildingId) => {
    if (!state.currentUser) return;
    const targetBuilding = (state.buildings || []).find(b => b.id === buildingId) || state.buildings[0];
    const targetFlat = (targetBuilding?.flats || []).find(f => f.flatNum === flatNum);

    let individualName = state.currentUser.name;
    if (targetFlat) {
      if (Array.isArray(targetFlat.owners) && targetFlat.owners.length > 0) {
        const uEmail = (state.currentUser.email || "").toLowerCase().trim();
        const uName = (state.currentUser.name || "").toLowerCase().trim();
        const matchedOwner = targetFlat.owners.find(o => {
          const oEmail = (o.email || "").toLowerCase().trim();
          const oEmails = Array.isArray(o.emails) ? o.emails.map(e => (e || "").toLowerCase().trim()) : [];
          const oName = (o.name || "").toLowerCase().trim();
          return (
            (uEmail && (oEmail === uEmail || oEmails.includes(uEmail))) ||
            (uName && oName && (oName === uName || uName.includes(oName) || oName.includes(uName)))
          );
        });
        if (matchedOwner && matchedOwner.name) {
          individualName = matchedOwner.name;
        } else if (targetFlat.owners.length === 1 && targetFlat.owners[0].name) {
          individualName = targetFlat.owners[0].name;
        } else {
          individualName = state.currentUser.name || targetFlat.ownerName;
        }
      } else {
        individualName = targetFlat.ownerName || state.currentUser.name;
      }
    }

    const wasAdmin = (
      state.currentUser.role === 'admin' ||
      state.currentUser.isAdminUser ||
      state.currentUser.email?.toLowerCase().trim() === 'benedek.baltay@gmail.com' ||
      state.currentUser.email?.toLowerCase().trim() === 'benedek.baltay01@gmail.com' ||
      (state.users || []).some(u => u.email && u.email.toLowerCase().trim() === (state.currentUser.email || "").toLowerCase().trim() && u.role === 'admin')
    );

    const updatedUser = {
      ...state.currentUser,
      id: targetFlat?.flatNum || flatNum,
      role: "Owner",
      flatNum: flatNum,
      buildingId: buildingId,
      name: individualName,
      email: state.currentUser.email || targetFlat?.email || "",
      isAdminUser: wasAdmin
    };
    quickLogin(updatedUser);
    showToast(state.currentLang === 'en' ? `Switched to Flat ${flatNum}` : `Átváltva: ${flatNum}. lakás`);
  };

  // SuperAdmin: Impersonate / Act as another user
  const actAsUser = (targetUser, targetBuildingId) => {
    if (!state.currentUser) return;
    const originalUser = state.impersonatedFrom ? state.impersonatedFrom.originalUser : state.currentUser;
    const bId = targetBuildingId || targetUser.buildingId || state.currentBuildingId || "batyu21";

    persistState(s => {
      const curB = (s.buildings || []).find(b => b.id === bId) || s.buildings[0];
      return {
        ...s,
        currentUser: JSON.parse(JSON.stringify(targetUser)),
        currentBuildingId: bId,
        impersonatedFrom: {
          originalUser: JSON.parse(JSON.stringify(originalUser)),
          timestamp: Date.now()
        },
        flats: (curB && curB.flats) || s.flats || [],
        transactions: (curB && curB.transactions) || s.transactions || [],
        expenses: (curB && curB.expenses) || s.expenses || [],
        manualDebits: (curB && Array.isArray(curB.manualDebits)) ? curB.manualDebits : (Array.isArray(s.manualDebits) ? s.manualDebits : []),
        documents: curB ? (curB.documents || []) : s.documents,
        docFolders: curB ? (curB.docFolders || []) : (s.docFolders || []),
        infoSections: curB ? (curB.infoSections || (curB.id === 'batyu21' ? JSON.parse(JSON.stringify(DEFAULT_INFO_SECTIONS)) : [])) : (s.infoSections || []),
        buildingInitialReserveCommon: curB ? curB.buildingInitialReserveCommon : 0,
        buildingInitialReserveRenovation: curB ? curB.buildingInitialReserveRenovation : 0
      };
    }, 'localOnly');

    showToast(
      state.currentLang === 'en'
        ? `SuperAdmin: Acting as ${targetUser.name || targetUser.email}`
        : `Rendszergazda: Belépve mint ${targetUser.name || targetUser.email}`
    );
  };

  // SuperAdmin: Exit impersonation
  const exitImpersonation = () => {
    if (!state.impersonatedFrom) return;
    const originalUser = state.impersonatedFrom.originalUser;

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

  // Auth: Logout
  const logout = () => {
    const { auth } = getFirebaseInstance();
    if (auth) {
      try {
        signOut(auth);
      } catch (e) {}
    }
    localStorage.removeItem("tarsashaz_remember_me");
    localStorage.removeItem("tarsashaz_logged_in_user");
    localStorage.removeItem("tarsashaz_role_mode");
    localStorage.removeItem("tarsashaz_is_portfolio");
    try {
      sessionStorage.removeItem("tarsashaz_session_user");
      sessionStorage.removeItem("tarsas_nav_state");
      if (window.location.hash && !window.location.hash.includes('mode=resetPassword') && !window.location.hash.includes('pay=1')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (e) {}
    setState(s => {
      const next = {
        ...s,
        currentUser: null,
        impersonatedFrom: null,
        activeRoleMode: null,
        isPortfolioView: false
      };
      try {
        localStorage.setItem("tarsashaz_state", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Auth: Change Password (nem szükséges a régi jelszó megadása bejelentkezett felhasználónak)
  const changePassword = async (arg1, arg2) => {
    if (!state.currentUser) return { success: false, error: state.currentLang === 'en' ? "No user logged in." : "Nincs bejelentkezett felhasználó." };
    
    // Támogatja a changePassword(newPass) és a korábbi changePassword(oldPass, newPass) hívási formát is
    const newPass = arg2 !== undefined ? arg2 : arg1;
    if (!newPass || String(newPass).trim().length < 4) {
      return { 
        success: false, 
        error: state.currentLang === 'en' 
          ? "Password must be at least 4 characters long." 
          : "A jelszónak legalább 4 karakter hosszúnak kell lennie." 
      };
    }

    // Connect and update password in Firebase Auth
    const { auth } = getFirebaseInstance();
    if (auth && auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPass);
      } catch (authErr) {
        console.warn("Firebase Auth updatePassword warning:", authErr.code, authErr.message);
      }
    }

    persistState(s => {
      const userEmail = (s.currentUser.email || "").toLowerCase().trim();
      const updatedUsers = (s.users || []).map(u => {
        const uEmail = (u.email || "").toLowerCase().trim();
        const isBenedek = (userEmail.startsWith("benedek.baltay") && uEmail.startsWith("benedek.baltay"));
        if (u.id === s.currentUser.id || (userEmail && (uEmail === userEmail || isBenedek))) {
          return { ...u, pass: newPass, password: newPass };
        }
        return u;
      });

      const updatedBuildings = (s.buildings || []).map(b => {
        if (b.flats && s.currentUser.flatNum) {
          b.flats = b.flats.map(f => {
            if (f.flatNum === s.currentUser.flatNum) {
              return { ...f, pass: newPass, password: newPass };
            }
            return f;
          });
        }
        return b;
      });

      const updatedCurrentUser = {
        ...s.currentUser,
        pass: newPass,
        password: newPass
      };

      try {
        localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(updatedCurrentUser));
      } catch (e) {}

      return {
        ...s,
        users: updatedUsers,
        buildings: updatedBuildings,
        currentUser: updatedCurrentUser
      };
    });

    showToast(state.currentLang === 'en' ? "Password successfully updated!" : "Jelszó sikeresen frissítve!");
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
