// تغيير اسم الكاش في كل تعديل يجبر المتصفح يمسح القديم فوراً
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // يطلب الملفات الجديدة مباشرة من جيت هاب دائماً
  event.respondWith(fetch(event.request));
});
