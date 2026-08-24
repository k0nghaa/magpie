import { useRef, useState } from 'react'
import { WebSpeechInputEngine, isSpeechInputSupported } from '../../adapters/speech-input/WebSpeechInputEngine.ts'
import type { SpeechInputError } from '../../adapters/types.ts'

// 임시 디버그 화면 — ConversationScreen(Day 3 잔여 범위: 무음 타이머+자동 전송, Day 4+: 상태머신
// 통합)이 생기기 전까지 WebSpeechInputEngine의 feature-detection/권한 플로우를 실제 브라우저에서
// 눈으로 확인하기 위한 용도. NotificationSetup을 Day 2에서 App.tsx에 임시로 붙였던 것과 같은 패턴.
function SpeechInputDemo() {
  const supported = isSpeechInputSupported()
  const engineRef = useRef<WebSpeechInputEngine | null>(null)
  if (engineRef.current === null) {
    engineRef.current = new WebSpeechInputEngine()
  }

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<SpeechInputError | null>(null)

  function handleStart() {
    setError(null)
    setTranscript('')
    setIsListening(true)
    engineRef.current?.start(
      (text) => setTranscript(text),
      () => {
        // 무음 타이머(~1.2초) 기반 자동 전송은 Day 3의 남은 범위 — 여기서는 엔진이 speechend를
        // 실제로 콜백하는지만 로그로 확인한다.
        console.log('[SpeechInputDemo] onSpeechEnd 호출됨')
      },
      (nextError) => {
        setError(nextError)
        if (nextError.reason === 'permission-denied' || nextError.reason === 'unsupported') {
          setIsListening(false)
        }
      },
    )
  }

  function handleStop() {
    engineRef.current?.stop()
    setIsListening(false)
  }

  const isPermissionDenied = error?.reason === 'permission-denied'

  return (
    <section className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-neutral-200 p-6">
      <h2 className="text-sm font-medium">마이크 입력 테스트 (임시 디버그)</h2>

      {!supported && (
        <p aria-live="polite" className="text-sm text-neutral-600">
          이 브라우저는 연속 음성 인식을 지원하지 않습니다. 텍스트 입력 모드로 전환해야 합니다.
        </p>
      )}

      {supported && (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStart}
              disabled={isListening}
              className="rounded-md bg-neutral-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
            >
              마이크 테스트 시작
            </button>
            <button
              type="button"
              onClick={handleStop}
              disabled={!isListening}
              className="rounded-md border border-neutral-900 px-4 py-2 text-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
            >
              중지
            </button>
          </div>

          <p aria-live="polite" className="min-h-6 text-sm text-neutral-700">
            {transcript || (isListening ? '듣는 중…' : '')}
          </p>

          {isPermissionDenied && (
            <p aria-live="polite" className="text-sm text-neutral-600">
              마이크가 차단되었습니다. 브라우저 설정에서 직접 허용해야 합니다.
            </p>
          )}

          {error && !isPermissionDenied && (
            <p aria-live="polite" className="text-sm text-neutral-600">
              오류가 발생했습니다: {error.reason}
              {error.message ? ` (${error.message})` : ''}
            </p>
          )}
        </>
      )}
    </section>
  )
}

export default SpeechInputDemo
