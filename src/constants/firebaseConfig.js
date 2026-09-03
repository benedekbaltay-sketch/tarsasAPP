import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

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

let app = null;
let rtdb = null;

export function getFirebaseInstance() {
  if (typeof window === 'undefined') return { app: null, rtdb: null };
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    rtdb = getDatabase(app);
  } catch (err) {
    console.warn("Firebase initialization warning:", err.message);
  }
  return { app, rtdb };
}
