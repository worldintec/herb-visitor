// この Service Worker が扱うのは通知だけ。fetch ハンドラは置いていないので、
// 応答は何もキャッシュしていない。
//
// 将来 fetch ハンドラを足して応答をキャッシュするなら、
// /api/visitor-notes/*/photo は必ず除外すること。
// マイノートの写真は非公開で、キャッシュに入ると端末に残り、
// ログアウトしたあとでも取り出せてしまう。

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || 'ハーブ園ガイド';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
