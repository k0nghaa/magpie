import { useEffect } from 'react'
import type { ClaudeMessage } from '../../api/claudeProxy.ts'
import type { ConversationStatus } from '../../state-machine/types.ts'
import type { SpeechInputError } from '../../adapters/types.ts'
import ChatMessageList from '../ConversationScreen/ChatMessageList.tsx'
import EmptyState from '../ConversationScreen/EmptyState.tsx'
import ErrorBanner from '../ConversationScreen/ErrorBanner.tsx'
import ResumeSpeakingButton from '../ConversationScreen/ResumeSpeakingButton.tsx'
import StreamingIndicator from '../ConversationScreen/StreamingIndicator.tsx'
import TurnIndicator from '../ConversationScreen/TurnIndicator.tsx'
import NotificationSetup from '../NotificationSetup/NotificationSetup.tsx'

// Day 6 상태 갤러리(축소 버전, docs/rules/PRD.md 6장 + docs/log/DECISIONS.md 참고).
//
// 왜 7개 상태 중 user_speaking/sending을 뺐는가: 이 둘은 실제 사용 흐름에서 "찰나에 지나가는"
// 전이 상태다(user_speaking은 사용자가 말하는 동안, sending은 요청을 보내고 첫 응답을 기다리는
// 아주 짧은 순간만 유지). 시각적으로는 각각 TurnIndicator 라벨 한 줄만 다를 뿐 레이아웃은
// listening/streaming과 사실상 동일해서, 축소된 시간 예산 안에서 별도 카드로 만들어도 얻는
// 증빙 가치가 낮다고 판단했다 — 라벨 문구 자체는 TurnIndicator.tsx의 STATUS_LABEL에서 이미
// 코드로 확인 가능.
//
// 왜 idle과 empty를 한 카드로 합쳤는가: EmptyState.tsx의 설계상 status가 'idle'이면 항상
// transcript/messages가 비어 있다(초기 상태이거나 RESET 직후뿐이라서) — 즉 이 앱에서
// "idle"과 "대화 없음(빈 화면)"은 같은 순간에 함께 나타나는 동일한 화면이라 인위적으로
// 다른 모습으로 쪼개 보여주는 건 정직하지 않다고 판단했다.
//
// 이 컴포넌트는 실제 상태머신(useConversationMachine)이나 어댑터를 전혀 거치지 않고, 화면에
// 쓰이는 프레젠테이션 컴포넌트에 손으로 만든 상태 값을 직접 주입해 "강제 렌더링"한다(PRD 6장
// 표현 그대로). ConversationScreen.tsx의 레이아웃을 그대로 옮겨 적은 것이라, 그쪽 레이아웃이
// 바뀌면 이 파일도 같이 갱신해야 한다 — 프로덕션 코드가 아니라 개발 모드 전용 디버그 라우트라
// 자동 동기화 장치 없이 이 정도 유지보수 부담은 감수하기로 결정.
interface MockConversationCardProps {
  status: ConversationStatus
  messages?: ClaudeMessage[]
  liveUserText?: string
  liveAssistantText?: string
  error?: SpeechInputError | null
}

function MockConversationCard({
  status,
  messages = [],
  liveUserText,
  liveAssistantText,
  error = null,
}: MockConversationCardProps) {
  const isActive = status !== 'idle' && status !== 'error'

  return (
    <section className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-200 p-6">
      <TurnIndicator status={status} />
      <EmptyState status={status} />
      <ChatMessageList messages={messages} liveUserText={liveUserText} liveAssistantText={liveAssistantText} />
      <StreamingIndicator status={status} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isActive}
          className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          대화 시작
        </button>
        <button type="button" className="rounded-md border border-neutral-900 px-4 py-2 text-neutral-900">
          대화 종료
        </button>
        <ResumeSpeakingButton status={status} onResume={() => {}} />
      </div>
      {error && <ErrorBanner error={error} onRetry={() => {}} />}
    </section>
  )
}

const GREETING = '좋은 아침이에요! 오늘 기분은 좀 어때요?'
const USER_TURN: ClaudeMessage = { role: 'user', content: '저는 요즘 아침마다 커피를 마셔요.' }
const ASSISTANT_REPLY = '그거 좋네요! 어떤 원두를 좋아하세요? 저는 산미 있는 원두를 좋아해요.'

// NotificationSetup은 브라우저 Notification.permission을 직접 읽는다(props로 주입받지 않음).
// "권한거부" 카드 하나를 실제 컴포넌트로 강제 렌더링하기 위해, 이 갤러리가 마운트돼 있는 동안만
// 전역 Notification.permission을 'denied'로 오버라이드한다 — 마크업을 따로 복제해 만들지
// 않고 실제 컴포넌트를 그대로 보여주기 위한 개발 전용 트릭(언마운트 시 원상복구).
function useForceNotificationPermissionDenied() {
  useEffect(() => {
    if (!('Notification' in window)) return
    const original = Object.getOwnPropertyDescriptor(Notification, 'permission')
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => 'denied' })
    return () => {
      if (original) Object.defineProperty(Notification, 'permission', original)
    }
  }, [])
}

function StateGallery() {
  useForceNotificationPermissionDenied()

  return (
    <div className="flex w-full flex-col items-center gap-8 p-6">
      <h1 className="text-2xl font-medium">상태 갤러리 (개발 모드 전용)</h1>
      <p className="max-w-2xl text-center text-sm text-neutral-600">
        핵심 상태 위주로 축소한 디버그 라우트. <code>ConversationScreen</code>의 7개 상태 중
        찰나에 지나가는 user_speaking/sending은 제외했고, idle과 empty는 이 앱에서 항상 같은
        화면이라 한 카드로 합쳤다.
      </p>

      <div className="flex flex-wrap justify-center gap-6">
        <GalleryCard title="idle / empty (빈 화면)">
          <MockConversationCard status="idle" />
        </GalleryCard>

        <GalleryCard title="listening">
          <MockConversationCard status="listening" messages={[{ role: 'assistant', content: GREETING }]} />
        </GalleryCard>

        <GalleryCard title="streaming">
          <MockConversationCard
            status="streaming"
            messages={[{ role: 'assistant', content: GREETING }, USER_TURN]}
            liveAssistantText="그거 좋네요! 어떤 원두를"
          />
        </GalleryCard>

        <GalleryCard title="assistant_speaking">
          <MockConversationCard
            status="assistant_speaking"
            messages={[{ role: 'assistant', content: GREETING }, USER_TURN, { role: 'assistant', content: ASSISTANT_REPLY }]}
          />
        </GalleryCard>

        <GalleryCard title="error">
          <MockConversationCard
            status="error"
            messages={[{ role: 'assistant', content: GREETING }, USER_TURN]}
            error={{ reason: 'network', message: '응답을 받아오지 못했습니다.' }}
          />
        </GalleryCard>

        <GalleryCard title="권한거부 (NotificationSetup)">
          <NotificationSetup onStartConversation={() => {}} />
        </GalleryCard>
      </div>
    </div>
  )
}

function GalleryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium text-neutral-500">{title}</span>
      {children}
    </div>
  )
}

export default StateGallery
