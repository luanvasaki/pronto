// Service worker mínimo — só o suficiente pra o navegador considerar o
// site instalável, mais os dois listeners de push notification abaixo.
// Sem estratégia de cache ainda; isso entra quando existir uma razão
// real (offline).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // todo pedido vai direto pra rede por enquanto
});

// Payload sempre é JSON — ver PushPayload em
// apps/backend/src/modules/push/send-push-notification.ts ({ title, body, url? }).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'Pronto';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});

// Foca uma aba já aberta na URL da notificação em vez de sempre abrir uma
// nova — evita empilhar abas quando a empresa já está com o painel aberto.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
