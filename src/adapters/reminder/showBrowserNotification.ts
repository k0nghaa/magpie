// SW의 showNotification()만 사용한다 — new Notification()은 거의 모든 모바일 브라우저에서
// TypeError를 던지기 때문에(MDN 명시), 데스크톱 전용 폴백 없이 이 경로 하나로 통일한다.
export async function showBrowserNotification(title: string, options?: NotificationOptions): Promise<void> {
  const registration = await navigator.serviceWorker.ready
  await registration.showNotification(title, options)
}
