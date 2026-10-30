// ════════════════════════════════════════════════════════
//  firebaseConfig.js
//  ✏️  បំពេញ values ពី Firebase Console:
//      console.firebase.google.com → Project Settings → Web App
//  ⚠️  ប្រសិនបើ Firebase មិនទាន់កំណត់ កម្មវិធីនៅតែដំណើរការបាន
//      ការចូលដោយ Google/Email នឹងប្តូរទៅប្រើ backend fallback ដោយស្វ័យប្រវត្តិ
// ════════════════════════════════════════════════════════

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// ── Safe init: placeholder keys must NOT crash the whole app ────────────
const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_");

let app = null;
let auth = null;
let db   = null;
let storage = null;
const googleProvider = new GoogleAuthProvider();

if (isConfigured) {
  try {
    app     = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth    = getAuth(app);
    db      = getFirestore(app);
    storage = getStorage(app);
  } catch (e) {
    console.warn("[Firebase] Init failed — running in offline/fallback mode:", e.message);
  }
} else {
  console.info("[Firebase] No real config detected — running in fallback mode (backend auth only).");
}

export { auth, googleProvider, db, storage };
export default app;
