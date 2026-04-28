// GarageBase Service Worker — upravlja push notifikacije

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// Ko prispe push notifikacija
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body,
    icon: '/android-chrome-512x512.png',
    badge: '/android-chrome-192x192.png',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    data: {
      url: data.url || '/opomniki'
    },
    actions: [
      { action: 'odpri', title: '📋 Odpri' },
      { action: 'zapri', title: '✕ Zapri' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Ko uporabnik klikne na notifikacijo
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'zapri') return

  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  )
})