// GarageBase service worker for push notifications.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const url = data.url || '/opomniki'

  const options = {
    body: data.body,
    icon: data.icon || '/android-chrome-192x192.png',
    badge: data.badge || '/notification-badge.png',
    image: data.image,
    tag: data.tag || 'garagebase-opomnik',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: { url },
    actions: [
      { action: 'odpri', title: 'Odpri' },
      { action: 'zapri', title: 'Zapri' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'GarageBase', options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'zapri') return

  const url = event.notification.data?.url || '/opomniki'
  event.waitUntil(clients.openWindow(url))
})
