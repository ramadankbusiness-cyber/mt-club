/* Firebase Messaging Service Worker — v2 */
/* global: self, clients */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCzNfjye4nbSRhUEnzhEnmNPM_3-qoz-7E",
  authDomain: "mt-club-notifications.firebaseapp.com",
  projectId: "mt-club-notifications",
  storageBucket: "mt-club-notifications.firebasestorage.app",
  messagingSenderId: "872063727721",
  appId: "1:872063727721:web:0894dd89b2f820fe3c8af8",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[FCM SW] Background message received:", JSON.stringify(payload));

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || "MT Club";
  const body = notification.body || "";
  const image = notification.image || undefined;

  const options = {
    body,
    icon: "/mt-logo.png",
    badge: "/mt-logo.png",
    image,
    data,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    tag: "mtclub",
    renotify: true,
  };

  console.log("[FCM SW] Calling showNotification:", { title, body: body.substring(0, 50) });

  self.registration
    .showNotification(title, options)
    .then(() => {
      console.log("[FCM SW] showNotification resolved successfully");
    })
    .catch((err) => {
      console.error("[FCM SW] showNotification FAILED:", err.message);
    });
});

self.addEventListener("notificationclick", (event) => {
  console.log("[FCM SW] notificationclick fired:", {
    title: event.notification.title,
    tag: event.notification.tag,
  });
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.deepLink || data.screen || "/";

  console.log("[FCM SW] Navigating to:", url);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
