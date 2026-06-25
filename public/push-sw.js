// Imported by the generated Workbox service worker (see vite.config.ts
// workbox.importScripts). Handles incoming Web Push reminders and clicks.

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} }
  catch (e) { data = { body: event.data ? event.data.text() : '' } }
  const title = data.title || 'TAURUS Notifications'
  const options = {
    body: data.body || '',
    icon: data.icon || '/taurus-01.svg',
    badge: '/taurus-01.svg',
    tag: data.tag,
    data: { url: data.url || '/itinerary' },
    vibrate: [80, 40, 80],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/itinerary'
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of all) {
      if ('focus' in c) { try { await c.navigate(url) } catch (e) { /* ignore */ } return c.focus() }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url)
  })())
})
