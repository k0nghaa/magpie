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
function ConversationScreen() {
  const supported = isSpeechInputSupported()
  const { state, start, stop, resumeSpeaking, submitText, messages } = useConversationMachine()

  const isActive = state.status !== 'idle' && state.status !== 'error'
  const liveUserText = state.status === 'user_speaking' ? state.transcript : undefined
  const liveAssistantText =
    state.status === 'streaming' || state.status === 'assistant_speaking' ? state.assistantText : undefined

  return (
    <section className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-200 p-6">
      <TurnIndicator status={state.status} />

      <EmptyState status={state.status} />

      <ChatMessageList messages={messages} liveUserText={liveUserText} liveAssistantText={liveAssistantText} />

      <StreamingIndicator status={state.status} />

      {/* PRD 4장: 음성 미지원 환경에서 텍스트 입력 모드가 자동으로 노출된다. */}
      {!supported && <TextInputFallback onSubmit={submitText} />}

      {supported && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={start}
            disabled={isActive}
            className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            대화 시작
          </button>
          <button
            type="button"
            onClick={stop}
            disabled={!isActive}
            className="rounded-md border border-neutral-900 px-4 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
          >
            대화 종료
          </button>
          <ResumeSpeakingButton status={state.status} onResume={resumeSpeaking} />
        </div>
      )}

      {/* 재시도는 실패한 요청을 자동으로 다시 보내지 않고 idle로 되돌리기만 한다 — stop()이
          엔진/스트림 정리까지 함께 해줘서 그대로 재사용(ErrorBanner.tsx 상단 주석 참고). */}
      {state.error && <ErrorBanner error={state.error} onRetry={stop} />}
    </section>
  )
}

export default ConversationScreen
