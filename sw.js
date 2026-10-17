/* Service worker network-first: sempre tenta a versão mais nova pela rede e usa o cache só quando estiver sem internet.
   As chamadas ao Supabase (dados, login e coach) nunca passam pelo cache. */
const CACHE = "tdj-v1";
const SHELL = ["./", "./index.html", "./backend.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/logo.png", "./conta.js", "./conta.css"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith(".supabase.co")) return;
  const daCasa = url.origin === self.location.origin;
  const cdn = url.hostname === "cdn.jsdelivr.net" || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!daCasa && !cdn) return;
  // Arquivos do app: pede ao servidor a versão atual (revalida em vez de usar o cache de 10 min do navegador).
  const pedido = daCasa ? fetch(req.url, { cache: "no-cache", credentials: "same-origin" }) : fetch(req);
  e.respondWith(
    pedido
      .then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: req.mode === "navigate" }).then((r) => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error()))
      )
  );
});
