const shell = "hk-shell-v1";
const accountCache = "hk-account-worker";
const shellFiles = [
  "/harbour.webp",
  "/arabic.woff2",
  "/latin.woff2",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(shell);
      await cache.addAll(shellFiles);
      const response = await fetch("/", { cache: "reload" });
      if (!response.ok) throw new Error("Shell failed");
      const html = await response.clone().text();
      const assets = [
        ...new Set(
          [...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)].map(
            (m) => m[1],
          ),
        ),
      ];
      await cache.addAll(assets);
      await cache.put("/", response);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("hk-shell-") && key !== shell)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET")
    return;
  if (url.pathname === "/" && event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.open(shell).then((cache) => cache.match("/")),
      ),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    shellFiles.includes(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(shell);
        const saved = await cache.match(event.request);
        if (saved) return saved;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      })(),
    );
  }
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "purge")
    event.waitUntil(
      (async () => {
        await caches.delete(accountCache);
        for (const notice of await self.registration.getNotifications())
          notice.close();
        event.ports[0]?.postMessage("purged");
      })(),
    );
  if (event.data?.type === "account" && typeof event.data.account === "string")
    event.waitUntil(
      (async () => {
        const cache = await caches.open(accountCache);
        await cache.put(
          "/.hk-device-account",
          new Response(event.data.account),
        );
      })(),
    );
});
self.addEventListener("push", (event) =>
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data.json();
      } catch {
        return;
      }
      const account = await (
        await caches.open(accountCache)
      ).match("/.hk-device-account");
      if (!account || (await account.text()) !== payload.account) return;
      await self.registration.showNotification(payload.title, {
        body: "تذكير من رفيق هونج كونج · Hong Kong Companion reminder",
        tag: payload.tag,
        icon: "/icon-192.png",
      });
    })(),
  ),
);
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
