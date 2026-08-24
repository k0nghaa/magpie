import { useEffect, useReducer, useRef } from 'react'
import { WebSpeechInputEngine } from '../adapters/speech-input/WebSpeechInputEngine.ts'
import type { SpeechInputEngine } from '../adapters/types.ts'
import { conversationReducer, initialConversationState } from './conversationReducer.ts'
import { createSilenceTimer } from './silenceTimer.ts'

// 엔진을 팩토리로 주입받는다 — PRD 3장 검증 기준("mock 구현으로 교체해도 상태머신이 무변경으로
// 동작")을 그대로 만족하기 위함. 기본값은 실제 WebSpeechInputEngine. start/stop은 버튼 클릭 같은
// 이벤트 핸들러에서만 불리고 자식에게 안정적인 참조로 넘길 일이 없어(React.memo 대상 아님)
// useCallback으로 메모이즈하지 않는다 — 매 렌더 재생성돼도 비용이 없다.
export function useConversationMachine(engineFactory: () => SpeechInputEngine = () => new WebSpeechInputEngine()) {
  const [state, dispatch] = useReducer(conversationReducer, initialConversationState)
  const engineRef = useRef<SpeechInputEngine | null>(null)
  const silenceTimerRef = useRef(createSilenceTimer(() => dispatch({ type: 'SILENCE_TIMEOUT' })))

  function start() {
    dispatch({ type: 'START_LISTENING' })
    const engine = engineFactory()
    engineRef.current = engine
    engine.start(
      (text) => {
        dispatch({ type: 'INTERIM_RESULT', text })
        silenceTimerRef.current.reset()
      },
      () => {
        // 브라우저 네이티브 speechend는 타이밍이 보장되지 않고 브라우저마다 신뢰도가 달라
        // (Safari 등) 무음 판단의 근거로 쓰지 않기로 결정했다(사람 확인 후, docs/log/DECISIONS.md
        // 참고) — "~1.2초"는 위 커스텀 디바운스 타이머가 전담한다. 여기서는 확인용 로그만 남긴다.
        console.log('[useConversationMachine] 브라우저 speechend 수신(참고용, 상태 전환엔 미사용)')
      },
      (error) => {
        silenceTimerRef.current.cancel()
        dispatch({ type: 'ENGINE_ERROR', error })
      },
    )
  }

  function stop() {
    silenceTimerRef.current.cancel()
    engineRef.current?.stop()
    engineRef.current = null
    dispatch({ type: 'RESET' })
  }

  useEffect(() => {
    // cleanup 시점에 engineRef.current를 다시 읽는 게 의도된 동작이다 — start()가 마운트
    // 이후 언제든 새 엔진을 넣을 수 있으므로, 언마운트 시점의 "현재" 엔진을 멈춰야 한다
    // (mount 시점 값을 미리 캡처하면 항상 null이라 아무것도 못 멈춘다).
    return () => {
      silenceTimerRef.current.cancel()
      engineRef.current?.stop()
    }
  }, [])

  return { state, start, stop }
}
