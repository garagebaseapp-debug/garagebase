// GarageBase service worker for push notifications and basic offline support.

const STATIC_CACHE = 'garagebase-static-v14'
const OFFLINE_FALLBACK_URL = '/domov'
const APP_NAVIGATION_URLS = [
  '/',
  OFFLINE_FALLBACK_URL,
  '/garaza',
  '/gorivo',
  '/servis',
  '/stroski-garaza',
  '/opomniki',
  '/vec',
]
const STATIC_ASSETS = [
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/notification-badge.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.allSettled([...STATIC_ASSETS, ...APP_NAVIGATION_URLS].map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => clients.claim())
  )
})

function safeInternalUrl(value, fallback) {
  try {
    const target = new URL(value || fallback, self.location.origin)
    if (target.origin !== self.location.origin) return fallback
    return `${target.pathname}${target.search}${target.hash}` || fallback
  } catch {
    return fallback
  }
}

function isStaticRequest(requestUrl, request) {
  if (requestUrl.origin !== self.location.origin) return false
  if (requestUrl.pathname.startsWith('/api/')) return false
  if (request.destination && ['style', 'script', 'worker', 'image', 'font', 'manifest'].includes(request.destination)) return true
  return /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(requestUrl.pathname)
}

function isWarmCacheUrl(url) {
  if (!url || url.origin !== self.location.origin) return false
  if (url.pathname.startsWith('/api/')) return false
  if (url.pathname.startsWith('/_next/static/')) return true
  return /\.(?:css|js|mjs|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)
}

function shouldPreferNetwork(request) {
  return request.destination && ['style', 'script', 'worker', 'manifest'].includes(request.destination)
}

function navigationCacheKey(requestUrl) {
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) return OFFLINE_FALLBACK_URL
  return `${requestUrl.pathname}${requestUrl.search}${requestUrl.hash}` || OFFLINE_FALLBACK_URL
}

async function cacheUrls(urls) {
  const cache = await caches.open(STATIC_CACHE)
  const sameOriginUrls = (urls || [])
    .map((url) => {
      try { return new URL(url, self.location.origin) } catch { return null }
    })
    .filter(isWarmCacheUrl)
    .map((url) => `${url.pathname}${url.search}${url.hash}`)

  await Promise.allSettled([...new Set(sameOriginUrls)].map((url) => cache.add(url)))
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const requestUrl = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('text/html')) {
            const clone = response.clone()
            const cacheKey = navigationCacheKey(requestUrl)
            caches.open(STATIC_CACHE).then((cache) => cache.put(cacheKey, clone))
          }
        }
        return response
      }).catch(async () => {
        const cachedPage = await caches.match(navigationCacheKey(requestUrl))
        const cachedDomov = await caches.match(OFFLINE_FALLBACK_URL)
        return cachedPage || cachedDomov || caches.match('/') || Response.error()
      })
    )
    return
  }

  if (!isStaticRequest(requestUrl, request)) return

  if (shouldPreferNetwork(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error()))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => cached)
      return cached || fresh
    })
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const url = safeInternalUrl(data.url, '/opomniki')

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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'GARAGEBASE_CACHE_URLS') {
    event.waitUntil(cacheUrls(event.data.urls || []))
    return
  }

  if (event.data?.type !== 'GARAGEBASE_TEST_NOTIFICATION') return

  const data = event.data
  event.waitUntil(
    self.registration.showNotification(data.title || 'GarageBase test', {
      body: data.body || 'Obvestila na tej napravi delujejo.',
      icon: data.icon || '/android-chrome-192x192.png',
      badge: data.badge || '/notification-badge.png',
      tag: 'garagebase-local-test',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      data: { url: safeInternalUrl(data.url, '/nastavitve') },
      actions: [
        { action: 'odpri', title: 'Odpri' },
        { action: 'zapri', title: 'Zapri' }
      ]
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'zapri') return

  const url = safeInternalUrl(event.notification.data?.url, '/opomniki')
  event.waitUntil(clients.openWindow(url))
})
