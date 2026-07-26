import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let app = null;
let messagingInstance = null;
let initError = null;

function loadServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || raw.trim() === "") {
    return { loaded: false, reason: "FIREBASE_SERVICE_ACCOUNT env var is empty or not set" };
  }

  try {
    let json = raw.replace(/\\n/g, "\n");
    const parsed = JSON.parse(json);

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return { loaded: false, reason: "JSON missing required fields (project_id, client_email, or private_key)" };
    }

    console.log("[Firebase Admin] Loaded service account from FIREBASE_SERVICE_ACCOUNT env var");
    console.log("[Firebase Admin]   project_id:", parsed.project_id);
    console.log("[Firebase Admin]   client_email:", parsed.client_email);
    return { loaded: true, serviceAccount: parsed };
  } catch (err) {
    return { loaded: false, reason: `JSON parse error: ${err.message}` };
  }
}

export function initFirebaseAdmin() {
  if (app) return app;

  try {
    const result = loadServiceAccountFromEnv();
    if (result.loaded) {
      app = initializeApp({ credential: cert(result.serviceAccount) });
      console.log("[Firebase Admin] Initialized successfully");
      console.log("[Firebase Admin]   Project ID:", result.serviceAccount.project_id);
      console.log("[Firebase Admin]   Client Email:", result.serviceAccount.client_email);
      return app;
    }

    initError = result.reason;
    console.error("[Firebase Admin] INIT FAILED:", initError);
    return null;
  } catch (err) {
    initError = `Unexpected init error: ${err.message}`;
    console.error("[Firebase Admin] INIT FAILED:", err.message);
    return null;
  }
}

export function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;
  if (!app) {
    app = initFirebaseAdmin();
  }
  if (!app) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export function getFirebaseConfig() {
  const envVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  const envSet = !!(envVar && envVar.trim() !== "");
  const initialized = !!app;

  return {
    configured: initialized || envSet,
    initialized,
    envVarSet: envSet,
    error: initError || null,
  };
}
