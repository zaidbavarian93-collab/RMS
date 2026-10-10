/* عامل الخدمة (Service Worker) لنظام RMS
 * - واجهة التطبيق: تُحفظ لتفتح بدون اتصال (الصفحات: الشبكة أولًا ثم المحفوظ)
 * - الملفات الثابتة ذات البصمة والصور: المحفوظ أولًا
 * - بيانات GET من /api: الشبكة أولًا (مهلة قصيرة) ثم آخر نسخة محفوظة مع ترويسة X-RMS-Offline
 * - طلبات الكتابة (POST...) لا تمر من هنا؛ التطبيق يحفظها في طابور ويرسلها عند عودة الاتصال
 */
const VERSION = 'rms-v1';
const SHELL = `rms-shell-${VERSION}`;
const RUNTIME = `rms-runtime-${VERSION}`;
const API = 'rms-api';
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const API_TIMEOUT_MS = 5000;
const RUNTIME_MAX = 150;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rms-') && ![SHELL, RUNTIME, API].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// عند تسجيل الخروج: حذف البيانات المحفوظة حتى لا يراها مستخدم آخر على نفس الجهاز
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_API_CACHE') event.waitUntil(caches.delete(API));
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function apiNetworkFirst(request) {
  const cache = await caches.open(API);
  try {
    const response = await withTimeout(fetch(request), API_TIMEOUT_MS);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-RMS-Offline', '1');
      return new Response(await cached.blob(), { status: cached.status, statusText: cached.statusText, headers });
    }
    return new Response(JSON.stringify({ message: 'لا يوجد اتصال بالخادم ولا توجد نسخة محفوظة من هذه البيانات' }), {
      status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-RMS-Offline': '1' },
    });
  }
}

async function pageNetworkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(SHELL)).put('/index.html', response.clone());
    return response;
  } catch {
    return (await caches.match('/index.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME);
    await cache.put(request, response.clone());
    trim(RUNTIME, RUNTIME_MAX);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.startsWith('/api/auth/')) return; // الدخول دائمًا عبر الشبكة
    event.respondWith(apiNetworkFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request));
  } else if (/^\/(assets|icons|uploads)\//.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});
