import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
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

let app = null;
let rtdb = null;
let auth = null;
let db = null;
let functions = null;
let storage = null;
let emulatorsConnected = false;

export function getFirebaseInstance() {
  if (typeof window === 'undefined') {
    return { app: null, rtdb: null, auth: null, db: null, functions: null, storage: null };
  }
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    rtdb = getDatabase(app);
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app, 'europe-west1');
    storage = getStorage(app);

    if (USE_EMULATORS && !emulatorsConnected) {
      emulatorsConnected = true;
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
      connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
    }
  } catch (err) {
    console.warn("Firebase initialization warning:", err.message);
  }
  return { app, rtdb, auth, db, functions, storage };
}
