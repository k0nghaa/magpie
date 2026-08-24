/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// 오프라인 캐싱은 이번 스프린트 비목표라 프리캐시 목록은 비워둔다 (vite.config.ts injectManifest.globPatterns: []).
// 이 SW의 유일한 역할은 (1) showNotification()이 모바일에서도 동작하게 하고 (2) 알림 클릭 시 앱으로 포커스 이동.
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = clients[0]
      if (existing) {
        await existing.focus()
        return
      }
      await self.clients.openWindow('/')
    })(),
  )
})
