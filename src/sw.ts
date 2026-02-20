/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Navigate fallback for SPA
self.addEventListener('fetch', () => {})

// When user taps a notification — focus the app or open it
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = '/challenge-tracker/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes('/challenge-tracker/') && 'focus' in client) {
            return (client as WindowClient).focus()
          }
        }
        return self.clients.openWindow(target)
      }),
  )
})
