/* Grana — funciona sem internet: guarda os arquivos do app no aparelho.
   Ao publicar uma versão nova, aumente VERSION para os aparelhos atualizarem. */
const VERSION = 'grana-v11';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/util.js', './js/icons.js', './js/catalog.js', './js/store.js', './js/finance.js', './js/charts.js',
  './js/ui.js', './js/add.js', './js/scan.js', './js/screens.js', './js/screens2.js', './js/app.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// rede primeiro (pega atualizações), cache como reserva (funciona offline).
// A chamada à IA (POST) nunca passa pelo cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.includes('generativelanguage.googleapis.com')) return;
  e.respondWith(
    fetch(e.request, url.origin === location.origin ? { cache: 'no-cache' } : {}).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
