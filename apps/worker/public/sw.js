// Service worker mínimo — só o suficiente pra o navegador considerar o
// site instalável. Sem estratégia de cache ainda; isso entra quando
// existir uma razão real (offline, push notification).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // todo pedido vai direto pra rede por enquanto
});
