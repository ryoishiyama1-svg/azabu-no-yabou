// オフラインでも遊べるようにファイルを保存しておく
// ファイルを更新したら、ここの V と index.html の「?v=」の数字を両方上げる
const V = 7;
const VERSION = `v${V}`;
const FILES = [
  './',
  'index.html',
  `style.css?v=${V}`,
  'manifest.json',
  `js/data.js?v=${V}`,
  `js/game.js?v=${V}`,
  `js/events.js?v=${V}`,
  `js/art.js?v=${V}`,
  `js/sound.js?v=${V}`,
  `js/ui.js?v=${V}`,
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
const FONT_CACHE = 'fonts';

self.addEventListener('install', (e) => {
  // ブラウザに残った古いファイルを使わないよう、必ずサーバーから取り直す
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Google Fonts は一度読み込んだら保存しておく
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then((c) =>
        c.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { c.put(e.request, res.clone()); return res; })))
    );
    return;
  }
  // ページ本体はネット優先（最新版を表示）、つながらないときは保存版
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
