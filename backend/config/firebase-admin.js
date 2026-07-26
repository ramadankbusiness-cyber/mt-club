import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let app = null;
let messagingInstance = null;
let initError = null;

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "firebase-service-account.json");

function loadServiceAccountFromFile() {
  try {
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
      return { loaded: false, reason: `File not found: ${SERVICE_ACCOUNT_PATH}` };
    }

    const raw = fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8");
    const parsed = JSON.parse(raw);

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return { loaded: false, reason: "JSON file missing required fields (project_id, client_email, or private_key)" };
    }

    console.log("[Firebase Admin] Loaded service account from file:", SERVICE_ACCOUNT_PATH);
    console.log("[Firebase Admin]   project_id:", parsed.project_id);
    console.log("[Firebase Admin]   client_email:", parsed.client_email);
    return { loaded: true, serviceAccount: parsed };
  } catch (err) {
    return { loaded: false, reason: `File read/parse error: ${err.message}` };
  }
}

function loadServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || raw.trim() === "") {
    return { loaded: false, reason: "FIREBASE_SERVICE_ACCOUNT env var is empty or not set" };
  }

  try {
    let json = raw.replace(/\\n/g, "\n");
    const parsed = JSON.parse(json);

    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return { loaded: false, reason: "Env var JSON missing required fields (project_id, client_email, or private_key)" };
    }

    console.log("[Firebase Admin] Loaded service account from FIREBASE_SERVICE_ACCOUNT env var");
    console.log("[Firebase Admin]   project_id:", parsed.project_id);
    console.log("[Firebase Admin]   client_email:", parsed.client_email);
    return { loaded: true, serviceAccount: parsed };
  } catch (err) {
    return { loaded: false, reason: `FIREBASE_SERVICE_ACCOUNT JSON parse error: ${err.message}` };
  }
}

export function initFirebaseAdmin() {
  if (app) return app;

  const diagnostics = [];

  try {
    const fileResult = loadServiceAccountFromFile();
    if (fileResult.loaded) {
      app = initializeApp({ credential: cert(fileResult.serviceAccount) });
      console.log("[Firebase Admin] ✅ Initialized successfully (file-based)");
      console.log("[Firebase Admin]   Project ID:", fileResult.serviceAccount.project_id);
      console.log("[Firebase Admin]   Client Email:", fileResult.serviceAccount.client_email);
      return app;
    }
    diagnostics.push(`File: ${fileResult.reason}`);

    const envResult = loadServiceAccountFromEnv();
    if (envResult.loaded) {
      app = initializeApp({ credential: cert(envResult.serviceAccount) });
      console.log("[Firebase Admin] ✅ Initialized successfully (env var)");
      console.log("[Firebase Admin]   Project ID:", envResult.serviceAccount.project_id);
      console.log("[Firebase Admin]   Client Email:", envResult.serviceAccount.client_email);
      return app;
    }
    diagnostics.push(`Env: ${envResult.reason}`);

    const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (gacPath && gacPath.trim() !== "") {
      try {
        if (!fs.existsSync(gacPath)) {
          diagnostics.push(`GOOGLE_APPLICATION_CREDENTIALS: File not found at ${gacPath}`);
        } else {
          app = initializeApp({ credential: applicationDefault() });
          console.log("[Firebase Admin] ✅ Initialized successfully (GOOGLE_APPLICATION_CREDENTIALS)");
          return app;
        }
      } catch (err) {
        diagnostics.push(`GOOGLE_APPLICATION_CREDENTIALS: ${err.message}`);
      }
    } else {
      diagnostics.push("GOOGLE_APPLICATION_CREDENTIALS: not set");
    }

    initError = `No credentials found. Tried:\n  ${diagnostics.join("\n  ")}`;
    console.error("[Firebase Admin] ❌ INIT FAILED —", initError.replace(/\n/g, "\n    "));
    return null;
  } catch (err) {
    initError = `Unexpected init error: ${err.message}`;
    console.error("[Firebase Admin] ❌ INIT FAILED:", err.message);
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
  const fileExists = fs.existsSync(SERVICE_ACCOUNT_PATH);
  const envVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  const envSet = !!(envVar && envVar.trim() !== "");
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const gacSet = !!(gac && gac.trim() !== "");
  const initialized = !!app;

  return {
    configured: initialized || envSet || fileExists || gacSet,
    initialized,
    serviceAccountFile: { exists: fileExists, path: SERVICE_ACCOUNT_PATH },
    envVarSet: envSet,
    gacSet,
    error: initError || null,
  };
}
