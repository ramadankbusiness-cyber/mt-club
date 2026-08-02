const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
let scriptLoaded = false;
let scriptLoading = false;
let googleInitialized = false;

console.log("[GOOGLE] VITE_GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 20)}...${GOOGLE_CLIENT_ID.slice(-10)}` : "EMPTY");

export function getGoogleClientId() {
  return GOOGLE_CLIENT_ID;
}

export function isGoogleConfigured() {
  return !!GOOGLE_CLIENT_ID;
}

export async function loadGoogleScript() {
  if (scriptLoaded) return true;
  if (scriptLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (scriptLoaded) { clearInterval(check); resolve(true); }
      }, 50);
    });
  }

  scriptLoading = true;

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src*="accounts.google.com/gsi/client"]`);
    if (existingScript) {
      scriptLoaded = true;
      scriptLoading = false;
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve(true);
    };
    script.onerror = () => {
      scriptLoading = false;
      reject(new Error("Failed to load Google Identity Services"));
    };
    document.head.appendChild(script);
  });
}

export function initializeGoogleId(callback) {
  if (googleInitialized || !window.google?.accounts?.id) return;

  try {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    googleInitialized = true;
    console.log("[GOOGLE] accounts.id.initialize called once");
  } catch (err) {
    console.error("[GOOGLE] initialize error:", err.message);
  }
}

export function renderGoogleButton(container, callback) {
  if (!window.google?.accounts?.id || !container) return null;

  container.innerHTML = "";

  try {
    if (!googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      googleInitialized = true;
    }

    window.google.accounts.id.renderButton(container, {
      type: "standard",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      theme: "outline",
      width: container.offsetWidth || 300,
    });

    return true;
  } catch (err) {
    console.error("[GOOGLE] Render button error:", err.message);
    return null;
  }
}

export function promptGoogleOneTap(callback) {
  if (!window.google?.accounts?.id) return;

  try {
    if (!googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback,
        auto_select: true,
        cancel_on_tap_outside: false,
      });
      googleInitialized = true;
    }

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        console.log("[GOOGLE] One-tap not displayed:", notification.getNotDisplayedReason());
      }
    });
  } catch (err) {
    console.error("[GOOGLE] One-tap error:", err.message);
  }
}
