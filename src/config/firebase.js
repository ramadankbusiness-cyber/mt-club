import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
let messaging = null;

export async function initFirebase() {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.log("[Firebase] Messaging not supported in this browser");
      return false;
    }
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    console.log("[Firebase] Initialized successfully");
    return true;
  } catch (err) {
    console.error("[Firebase] Init failed:", err.message);
    return false;
  }
}

export function getFirebaseMessaging() {
  return messaging;
}

export function getFirebaseApp() {
  return app;
}
