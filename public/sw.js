/* No page or child-data caching. This worker only handles opted-in push alerts. */
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch {
    /* Show a generic visible alert. */
  }
  const data = payload || {};
  let target = new URL('/ko/today', self.location.origin);
  try {
    const proposed = new URL(data.url, self.location.origin);
    if (
      proposed.origin === self.location.origin &&
      /^\/(ko|en)\/today$/.test(proposed.pathname)
    )
      target = proposed;
  } catch {
    /* Keep the safe local target. */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '포둥 · Podung', {
      body: data.body || '아기의 식사 시간을 확인해 주세요.',
      icon: '/icons/podung-192.png',
      badge: '/icons/podung-192.png',
      tag: typeof data.tag === 'string' ? data.tag : 'podung-feeding',
      data: { url: target.href },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const target = new URL(
        event.notification.data?.url || '/ko/today',
        self.location.origin,
      );
      if (target.origin !== self.location.origin) return;
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const windowClient = windows.find(
        (client) => new URL(client.url).origin === target.origin,
      );
      if (windowClient) {
        await windowClient.navigate(target.href);
        await windowClient.focus();
      } else await self.clients.openWindow(target.href);
    })(),
  );
});
