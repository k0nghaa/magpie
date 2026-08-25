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
        // 이미 로드되어 있어 페이지의 message 리스너(App.tsx)가 준비돼 있으므로 postMessage로
        // 대화 화면 전환 신호를 바로 보낸다.
        await existing.focus()
        existing.postMessage({ type: 'OPEN_CONVERSATION' })
        return
      }
      // 새로 여는 탭은 아직 App이 마운트되지 않아 message 리스너가 없으므로(postMessage가
      // 도착 시점에 유실될 수 있음), URL 쿼리로 초기 화면을 직접 지정한다 — App.tsx가 mount 시
      // 이 쿼리를 읽어 처음부터 conversation 화면으로 렌더링한다.
      await self.clients.openWindow('/?screen=conversation')
    })(),
  )
})
