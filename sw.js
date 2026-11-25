// Service worker: deja la app guardada en el teléfono para que abra aunque no haya señal.
// Archivos propios: primero la red (así cada arreglo llega al tiro) y si no hay señal, la copia guardada.
// Librerías externas (Firebase, QR): primero la copia guardada.
const VERSION = 'bvndito-v1';
const ARCHIVOS = [
  './', 'index.html', 'llegue.html', 'manifest.json', 'css/app.css', 'css/llegue.css',
  'js/app.js', 'js/llegue.js', 'js/db.js', 'js/comun.js', 'js/config.js',
  'iconos/icon-192.png', 'iconos/apple-touch-icon.png',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(ARCHIVOS.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const propio = url.origin === self.location.origin;
  const lib = (url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) || url.origin === 'https://cdnjs.cloudflare.com';
  if (!propio && !lib) return; // Firestore y Auth van directo a la red
  if (lib) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const c = res.clone(); caches.open(VERSION).then((k) => k.put(req, c)); return res; })));
    return;
  }
  // La página se guarda sin "?b=..." para que la copia sirva siempre.
  const clave = req.mode === 'navigate' ? new Request(url.origin + url.pathname) : req;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const c = res.clone(); caches.open(VERSION).then((k) => k.put(clave, c)); }
    return res;
  }).catch(() => caches.match(clave).then((r) => r || caches.match('index.html'))));
});
