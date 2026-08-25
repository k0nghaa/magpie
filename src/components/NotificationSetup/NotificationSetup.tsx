import { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserNotificationEngine } from '../../adapters/reminder/BrowserNotificationEngine.ts'
import { showBrowserNotification } from '../../adapters/reminder/showBrowserNotification.ts'

const STORAGE_KEY = 'magpie:notification-time'
const DEFAULT_TIME = '09:00'
const REMINDER_TITLE = '오늘의 회화, 준비되셨나요?'

type PermissionState = NotificationPermission | 'unsupported'

function getInitialTime(): string {
  return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TIME
}

function getCurrentPermission(): PermissionState {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

// "HH:mm"을 오늘 그 시각으로 변환하되, 이미 지났으면 내일로 넘긴다 (알림은 항상 미래 시각이어야 함).
function getNextOccurrence(hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number)
  const next = new Date()
  next.setHours(hours, minutes, 0, 0)
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

interface NotificationSetupProps {
  // "지금 시작하기"(권한 거부/미지원 시 대체 진입로) 클릭 시 호출 — ConversationScreen이 없던
  // 시절엔 준비 중 안내 문구만 띄웠지만(placeholder), 이제 실제 화면이 생겨 App.tsx의 화면
  // 전환 상태로 연결한다(docs/log/DECISIONS.md 참고).
  onStartConversation: () => void
}

function NotificationSetup({ onStartConversation }: NotificationSetupProps) {
  const [time, setTime] = useState(getInitialTime)
  const [permission, setPermission] = useState<PermissionState>(getCurrentPermission)
  const engineRef = useRef<BrowserNotificationEngine | null>(null)
  if (engineRef.current === null) {
    engineRef.current = new BrowserNotificationEngine()
  }

  /**
   *  "재호출될 수 있는 상황"의 실제 트리거는 시간 입력 변경과 권한 허용 전환
   */
  const nextOccurrence = useMemo(
    () => (permission === 'granted' ? getNextOccurrence(time) : null),
    [time, permission],
  )

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, time)
  }, [time])

  useEffect(() => {
    if (!nextOccurrence) return
    engineRef.current?.schedule(nextOccurrence, () => {
      showBrowserNotification(REMINDER_TITLE, {
        body: '지금 대화를 시작해보세요.',
        tag: 'magpie-daily-reminder',
      }).catch((error: unknown) => {
        // 예약 시점엔 granted였는데 발사 시점 사이에 브라우저 알림 권한이 바뀐 경우가
        // 가장 현실적인 원인. 실제로 바뀌었다면 아래 재동기화로 기존 차단 안내/
        // "지금 시작하기" UI가 새 코드 없이 그대로 뜬다. 안 바뀐 채로 실패한 드문
        // 경우는 콘솔 로그만 남긴다 (이 PoC 스코프에서는 재시도까지는 과함).
        console.error('알림 표시 실패:', error)
        setPermission(getCurrentPermission())
      })
    })
  }, [nextOccurrence])

  async function handleRequestPermission() {
    if (!('Notification' in window)) return
    // requestPermission()은 사용자 클릭(제스처) 핸들러 안에서 호출해야 브라우저가 프롬프트를 띄운다.
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  const isUnsupported = permission === 'unsupported'
  const isGranted = permission === 'granted'
  const isDenied = permission === 'denied'
  const isBlocked = isUnsupported || isDenied

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

        {nextOccurrence && (
          <p aria-live="polite" className="text-sm text-neutral-500">
            다음 알림 예정: {nextOccurrence.toLocaleString('ko-KR')}
          </p>
        )}

        {isBlocked && (
          <button
            type="button"
            onClick={onStartConversation}
            className="rounded-md border border-neutral-900 px-4 py-2 text-neutral-900"
          >
            지금 시작하기
          </button>
        )}
      </div>
    </section>
  )
}

export default NotificationSetup
