// オフラインでも遊べるようにファイルを保存しておく
// ファイルを更新したら VERSION の数字を上げる
const VERSION = 'v3';
const FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'js/data.js',
  'js/game.js',
  'js/art.js',
  'js/sound.js',
  'js/ui.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
const FONT_CACHE = 'fonts';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)));
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
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
