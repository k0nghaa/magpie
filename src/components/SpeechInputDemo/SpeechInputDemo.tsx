import { isSpeechInputSupported } from '../../adapters/speech-input/WebSpeechInputEngine.ts'
import { useConversationMachine } from '../../state-machine/useConversationMachine.ts'
import ResumeSpeakingButton from '../ConversationScreen/ResumeSpeakingButton.tsx'
import TextInputFallback from '../ConversationScreen/TextInputFallback.tsx'

const STATUS_LABEL: Record<string, string> = {
  idle: '대기 중',
  listening: '듣는 중…',
  user_speaking: '발화 인식 중',
  sending: '전송 대기 상태 (LLM 연동은 Day 4 예정 — 아직 아무 것도 보내지 않음)',
  error: '오류',
}

// 임시 디버그 화면 — ConversationScreen(Day 4+: LLM 스트리밍, Day 5: TTS까지 통합)이 생기기 전까지
// useConversationMachine(WebSpeechInputEngine + 무음 타이머 + 상태머신)을 실제 브라우저에서 눈으로
// 확인하기 위한 용도. NotificationSetup을 Day 2에서 App.tsx에 임시로 붙였던 것과 같은 패턴.
function SpeechInputDemo() {
  const supported = isSpeechInputSupported()
  const { state, start, stop, resumeSpeaking, submitText } = useConversationMachine()

  const isActive = state.status !== 'idle' && state.status !== 'error'
  const isPermissionDenied = state.error?.reason === 'permission-denied'

  return (
    <section className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-200 p-6">
      <h2 className="text-sm font-medium">마이크 입력 테스트 (임시 디버그)</h2>

      {/* PRD 4장: 미지원 환경에서 텍스트 입력 모드가 자동으로 노출된다 — 별도 조작 없이 이 조건만으로 전환. */}
      {!supported && (
        <>
          <p aria-live="polite" className="text-sm text-neutral-600">
            이 브라우저는 연속 음성 인식을 지원하지 않습니다. 텍스트 입력 모드로 전환합니다.
          </p>
          <TextInputFallback onSubmit={submitText} />
        </>
      )}

      {supported && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={start}
            disabled={isActive}
            className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
          >
            마이크 테스트 시작
          </button>
          <button
            type="button"
            onClick={stop}
            disabled={!isActive}
            className="rounded-md border border-neutral-900 px-4 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
          >
            중지 / 초기화
          </button>
          <ResumeSpeakingButton status={state.status} onResume={resumeSpeaking} />
        </div>
      )}

      <p aria-live="polite" className="text-sm font-medium text-neutral-800">
        상태: {STATUS_LABEL[state.status]}
      </p>

      <p aria-live="polite" className="min-h-6 text-sm text-neutral-700">
        {state.transcript}
      </p>

      {isPermissionDenied && (
        <p aria-live="polite" className="text-sm text-neutral-600">
          마이크가 차단되었습니다. 브라우저 설정에서 직접 허용해야 합니다.
        </p>
      )}

      {state.error && !isPermissionDenied && (
        <p aria-live="polite" className="text-sm text-neutral-600">
          오류가 발생했습니다: {state.error.reason}
          {state.error.message ? ` (${state.error.message})` : ''}
        </p>
      )}
    </section>
  )
}

export default SpeechInputDemo
