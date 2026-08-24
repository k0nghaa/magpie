import type { ReminderEngine } from '../types.ts'

export class BrowserNotificationEngine implements ReminderEngine {
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  schedule(time: Date, onFire: () => void): void {
    // 재호출 시 이전 타이머가 남아있으면 onFire가 중복 호출되므로 항상 교체한다.
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId)
    }

    const delay = Math.max(time.getTime() - Date.now(), 0)
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null
      onFire()
    }, delay)
  }
}
