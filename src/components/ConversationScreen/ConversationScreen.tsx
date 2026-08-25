import { useEffect } from 'react'
import { isSpeechInputSupported } from '../../adapters/speech-input/WebSpeechInputEngine.ts'
import { useConversationMachine } from '../../state-machine/useConversationMachine.ts'
import ChatMessageList from './ChatMessageList.tsx'
import EmptyState from './EmptyState.tsx'
import ErrorBanner from './ErrorBanner.tsx'
import ResumeSpeakingButton from './ResumeSpeakingButton.tsx'
import StreamingIndicator from './StreamingIndicator.tsx'
import TextInputFallback from './TextInputFallback.tsx'
import TurnIndicator from './TurnIndicator.tsx'

// PRD 6장 상태머신 컨테이너. 이 화면에서 돋보여야 하는 건 음성 상호작용(자동 턴테이킹, TTS)이지
// 채팅 UI 비주얼이 아니라서(사람 확인 후 결정한 스코프), 기존에 검증 완료된 하위 컴포넌트
// (ResumeSpeakingButton/TextInputFallback/StreamingIndicator/ErrorBanner/EmptyState)는 스타일
// 변경 없이 그대로 재배치만 한다.
interface ConversationScreenProps {
  // PRD 4장 Happy Path 9번 "수동 종료 버튼으로 세션을 마친다" 이후 어디로 갈지는 PRD에 명시가
  // 없어 사람 확인 후 결정 — 설정 화면으로 돌아간다(App.tsx의 화면 전환 상태, DECISIONS.md 참고).
  onEnd: () => void
}

function ConversationScreen({ onEnd }: ConversationScreenProps) {
  const supported = isSpeechInputSupported()
  const { state, start, stop, resumeSpeaking, submitText, messages, greet } = useConversationMachine()

  // PRD 4장 Happy Path 3번 — 화면 진입 즉시, 사용자 조작 없이 AI가 먼저 인사말+질문을 낸다.
  // setTimeout(0)으로 한 틱 미루는 이유(실제로 겪은 버그, 추측 아님): React 18 StrictMode(개발
  // 모드)는 마운트 effect를 "실행 → 즉시 cleanup(가짜 언마운트) → 재실행"으로 두 번 돌린다.
  // greet()를 effect 안에서 동기 호출하면, TTS가 막 speak()를 부른 직후 그 가짜 cleanup이
  // useConversationMachine의 언마운트 정리(`cancelTtsPlayback`)를 실행해 재생을
  // `interrupted` 에러로 즉시 끊어버린다 — 그 뒤론 hasGreetedRef 가드 때문에 다시 인사말을
  // 시도하지도 않아 화면이 assistant_speaking에 영원히 멈춘다(실제 재현·확인함). setTimeout으로
  // 미루면 그 사이 예약된 타이머가 cleanup 시 취소되고, "진짜" 두 번째 마운트에서 새로 예약된
  // 타이머만 살아남아 안전하게 한 번 실행된다.
  useEffect(() => {
    const timer = setTimeout(() => greet(), 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만 실행 의도(greet 자체의 ref 가드로 중복 실행은 이미 막힘)
  }, [])

  const isActive = state.status !== 'idle' && state.status !== 'error'
  const liveUserText = state.status === 'user_speaking' ? state.transcript : undefined
  // assistant_speaking은 포함하지 않는다 — STREAM_DONE/GREETING_STARTED 시점에 이미 messages에
  // 반영돼 있어서(useConversationMachine 참고), 여기서도 보여주면 같은 말풍선이 두 번(messages
  // 목록 + 이 실시간 말풍선) 나온다(실제 재현으로 발견한 버그, DECISIONS.md 참고).
  const liveAssistantText = state.status === 'streaming' ? state.assistantText : undefined

  function handleEnd() {
    stop()
    onEnd()
  }

  return (
    <section className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-200 p-6">
      <TurnIndicator status={state.status} />

      <EmptyState status={state.status} />

      <ChatMessageList messages={messages} liveUserText={liveUserText} liveAssistantText={liveAssistantText} />

      <StreamingIndicator status={state.status} />

      {/* PRD 4장: 음성 미지원 환경에서 텍스트 입력 모드가 자동으로 노출된다. */}
      {!supported && <TextInputFallback onSubmit={submitText} />}

      <div className="flex gap-2">
        {supported && (
          <button
            type="button"
            onClick={start}
            disabled={isActive}
            className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            대화 시작
          </button>
        )}
        {/* PRD 4장 Happy Path 9번: 수동 종료는 상태와 무관하게 항상 가능해야 한다(화면을 벗어나는
            버튼이므로 isActive로 막지 않음, 사람 확인 없이 결정한 낮은 리스크 판단). */}
        <button
          type="button"
          onClick={handleEnd}
          className="rounded-md border border-neutral-900 px-4 py-2 text-neutral-900"
        >
          대화 종료
        </button>
        {supported && <ResumeSpeakingButton status={state.status} onResume={resumeSpeaking} />}
      </div>

      {/* 재시도는 실패한 요청을 자동으로 다시 보내지 않고 idle로 되돌리기만 한다 — stop()이
          엔진/스트림 정리까지 함께 해줘서 그대로 재사용(ErrorBanner.tsx 상단 주석 참고). */}
      {state.error && <ErrorBanner error={state.error} onRetry={stop} />}
    </section>
  )
}

export default ConversationScreen
