self.addEventListener('push', event => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { notification: { body: event.data.text() } }; }
  const notice = payload.notification || payload.data || {};
  event.waitUntil(self.registration.showNotification(notice.title || 'MeroKotha', {
    body: notice.body || 'You have a new update.',
    icon: '/favicon.ico',
    data: { url: payload.data?.chatId ? `/chat/${encodeURIComponent(payload.data.chatId)}` : '/dashboard?tab=chats' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/dashboard?tab=chats', self.location.origin);
  event.waitUntil(clients.openWindow(url.href));
});
