import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyApurSWcsylNLptj3K9YpeQ5XgqKPIjqT0",
  authDomain: "sleepwell-95d3d.firebaseapp.com",
  projectId: "sleepwell-95d3d",

  // ✅ keep whatever Firebase console shows you (either is okay if it matches your project)
  storageBucket: "sleepwell-95d3d.firebasestorage.app",

  messagingSenderId: "483391249062",
  appId: "1:483391249062:web:f0dc267e7348a22e7f7267",
  measurementId: "G-WFSP52MFR6",

  // ✅ REQUIRED for Realtime Database
  databaseURL: "https://sleepwell-95d3d-default-rtdb.firebaseio.com",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Auth
export const auth = getAuth(app);

// ✅ Firestore (keep name "db" so your existing imports don't break)
export const db = getFirestore(app);

// ✅ Realtime Database (for schedule)
export const rtdb = getDatabase(app);

// ✅ Analytics (client-only)
export const analyticsPromise =
  typeof window !== "undefined"
    ? isSupported().then((yes) => (yes ? getAnalytics(app) : null))
    : Promise.resolve(null);

export default app;