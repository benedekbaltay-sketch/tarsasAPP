import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getAuth, initializeAuth, browserSessionPersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyC31_8JTUntwtTCr6dZQH_VvsfGZ3ypUxc",
  authDomain: "tarsashaz-cfe5d.firebaseapp.com",
  databaseURL: "https://tarsashaz-cfe5d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tarsashaz-cfe5d",
  storageBucket: "tarsashaz-cfe5d.firebasestorage.app",
  messagingSenderId: "770214898892",
  appId: "1:770214898892:web:11e98dbf84f5b6d714a669",
  measurementId: "G-DQ473LSYQC"
};

export const IS_FIRESTORE_MODE =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_DATA_BACKEND === 'firestore';

export const USE_EMULATORS =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_EMULATORS === 'true';

let emulatorsConnected = false;

export function getTabSessionId() {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = sessionStorage.getItem('tarsashaz_tab_id');
    if (!id) {
      id = 'tab_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('tarsashaz_tab_id', id);
    }
    return id;
  } catch (e) {
    return 'default';
  }
}

export function isCurrentTabSessionOnly() {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem('tarsashaz_is_tab_session') === 'true';
  } catch (e) {
    return false;
  }
}

export function setTabSessionMode(isSessionOnly) {
  if (typeof window === 'undefined') return;
  try {
    if (isSessionOnly) {
      sessionStorage.setItem('tarsashaz_is_tab_session', 'true');
    } else {
      sessionStorage.removeItem('tarsashaz_is_tab_session');
    }
  } catch (e) {}
}

export function saveSessionUser(user) {
  if (typeof window === 'undefined') return;
  try {
    const isTabSession = isCurrentTabSessionOnly();
    sessionStorage.setItem("tarsashaz_session_user", JSON.stringify(user));
    if (!isTabSession && localStorage.getItem("tarsashaz_remember_me") === "true") {
      localStorage.setItem("tarsashaz_logged_in_user", JSON.stringify(user));
    }
  } catch (e) {}
}

export function getFirebaseInstance(forceSessionApp = false) {
  if (typeof window === 'undefined') {
    return { app: null, rtdb: null, auth: null, db: null, functions: null, storage: null };
  }
  try {
    const useSession = forceSessionApp || isCurrentTabSessionOnly();
    const appName = useSession ? `session_${getTabSessionId()}` : '[DEFAULT]';

    let app = getApps().find(a => a.name === appName);
    let auth = null;

    if (!app) {
      if (appName === '[DEFAULT]') {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      } else {
        app = initializeApp(firebaseConfig, appName);
      }
    }

    try {
      if (useSession) {
        auth = initializeAuth(app, { persistence: browserSessionPersistence });
      } else {
        auth = getAuth(app);
      }
    } catch {
      auth = getAuth(app);
    }

    const rtdb = getDatabase(app);
    const db = getFirestore(app);
    const functions = getFunctions(app, 'europe-west1');
    const storage = getStorage(app);

    if (USE_EMULATORS && !emulatorsConnected) {
      emulatorsConnected = true;
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
    }

    return { app, rtdb, auth, db, functions, storage };
  } catch (err) {
    console.warn("Firebase initialization warning:", err.message);
    return { app: null, rtdb: null, auth: null, db: null, functions: null, storage: null };
  }
}
