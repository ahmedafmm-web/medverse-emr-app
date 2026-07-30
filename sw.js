const CACHE_NAME = 'medverse-v2';

// التثبيت الفوري وتخطي الانتظار
self.addEventListener('install', event => {
  self.skipWaiting();
});

// تفعيل السيرفيس وركر والاستحواذ الفوري على الصفحات
self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// التعامل مع الطلبات: جلب النسخة الجديدة فوراً من الشبكة، واستخدام الكاش عند انقطاع الإنترنت
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
