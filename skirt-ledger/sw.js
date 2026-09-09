/* 网络优先：只要联网就一定拿最新代码，断网才回退到缓存 */
var CACHE = 'skirt-ledger-v8';
var FILES = [
  './',
  './index.html',
  './styles.css?v=8',
  './app.js?v=8',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).catch(function () {}));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      // 断网：先用精确匹配，找不到再放宽（忽略查询参数），最后回退到首页
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        return caches.match(req, { ignoreSearch: true }).then(function (h2) {
          if (h2) return h2;
          return url.pathname.indexOf('.') < 0 ? caches.match('./index.html') : h2;
        });
      });
    })
  );
});
