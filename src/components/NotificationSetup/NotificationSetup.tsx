import { useEffect, useState } from 'react'

const STORAGE_KEY = 'magpie:notification-time'
const DEFAULT_TIME = '09:00'

type PermissionState = NotificationPermission | 'unsupported'

function getInitialTime(): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TIME
}

function getInitialPermission(): PermissionState {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

function NotificationSetup() {
  const [time, setTime] = useState(getInitialTime)
  const [permission, setPermission] = useState<PermissionState>(getInitialPermission)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, time)
  }, [time])

  async function handleRequestPermission() {
    if (!('Notification' in window)) return
    // requestPermission()은 사용자 클릭(제스처) 핸들러 안에서 호출해야 브라우저가 프롬프트를 띄운다.
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  const isUnsupported = permission === 'unsupported'
  const isGranted = permission === 'granted'
  const isDenied = permission === 'denied'

  return (
    <section className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-200 p-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="notification-time" className="text-sm font-medium">
          알림 시간
        </label>
        <input
          id="notification-time"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleRequestPermission}
          disabled={isUnsupported || isGranted || isDenied}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          알림 권한 요청
        </button>

        <p aria-live="polite" className="text-sm text-neutral-600">
          {isUnsupported && '이 브라우저는 알림을 지원하지 않습니다.'}
          {permission === 'default' && '알림을 받으려면 권한을 허용해 주세요.'}
          {isGranted && '알림이 허용되었습니다.'}
          {isDenied && '알림이 차단되었습니다. 브라우저 설정에서 직접 허용해야 합니다.'}
        </p>
      </div>
    </section>
  )
}

export default NotificationSetup
