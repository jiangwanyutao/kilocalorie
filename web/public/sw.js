// kill-switch Service Worker
// 项目已不再使用 SW · 此 SW 只做一件事：清缓存 + unregister 自己 + 通知客户端 reload
// 老用户浏览器里的旧 vite-plugin-pwa SW 会 autoUpdate 到这个 · 从此他们的 SW 消失
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((c) => c.navigate(c.url));
    } catch (e) {
      // 静默
    }
  })());
});
