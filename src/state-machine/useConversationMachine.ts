import { useEffect, useReducer, useRef } from 'react'
import { WebSpeechInputEngine } from '../adapters/speech-input/WebSpeechInputEngine.ts'
import type { SpeechInputEngine } from '../adapters/types.ts'
import { ClaudeStreamError, streamClaudeResponse, type ClaudeMessage } from '../api/claudeProxy.ts'
import { conversationReducer, initialConversationState } from './conversationReducer.ts'
import { createSilenceTimer } from './silenceTimer.ts'

// PRD 8장 비용 통제 원칙 "최근 N턴만 윈도잉" 의 N — 3으로 시작(사람 확인 후 결정, 실사용
// 테스트해보고 5로 올릴 수 있음을 전제로 함, docs/log/DECISIONS.md 참고). 1턴 = user+assistant
// 메시지 2개이므로 히스토리는 최대 N*2개 메시지만 유지한다.
const HISTORY_WINDOW_TURNS = 3

// 엔진을 팩토리로 주입받는다 — PRD 3장 검증 기준("mock 구현으로 교체해도 상태머신이 무변경으로
// 동작")을 그대로 만족하기 위함. 기본값은 실제 WebSpeechInputEngine. start/stop은 버튼 클릭 같은
// 이벤트 핸들러에서만 불리고 자식에게 안정적인 참조로 넘길 일이 없어(React.memo 대상 아님)
// useCallback으로 메모이즈하지 않는다 — 매 렌더 재생성돼도 비용이 없다.
export function useConversationMachine(engineFactory: () => SpeechInputEngine = () => new WebSpeechInputEngine()) {
  const [state, dispatch] = useReducer(conversationReducer, initialConversationState)
  const engineRef = useRef<SpeechInputEngine | null>(null)
  // 무음 타이머 콜백은 mount 시점에 딱 한 번 생성되는 클로저라 이후 렌더의 state를 못 본다
  // (React가 useRef 초기값 인자를 첫 렌더 이후엔 버림) — 그래서 "지금 사용자가 뭐라고
  // 말했는지"는 이 ref에 INTERIM_RESULT가 올 때마다 직접 갱신해서 읽는다(엔진/타이머 ref와
  // 동일한 이유).
  const transcriptRef = useRef('')
  // 대화 히스토리는 리듀서(상태머신) 밖에 둔다 — 리듀서는 "지금 화면이 어떤 상태인지"만 다루는
  // 순수 로직이고, "서버로 보낼 메시지 목록"은 그와 다른 관심사(비용 통제)라 분리했다. ref인
  // 이유: 매 턴 갱신되지만 그 자체로 리렌더를 유발할 필요가 없는 값이라서.
  const historyRef = useRef<ClaudeMessage[]>([])
  // 현재 진행 중인 LLM 스트리밍 요청을 취소할 수 있도록 보관 — 언마운트/stop() 시 정리한다.
  const activeStreamControllerRef = useRef<AbortController | null>(null)
  // handleSilenceTimeout은 함수 선언(hoisted)이라 여기서 미리 참조해도 된다 — 콜백을
  // useRef(createSilenceTimer(...)) 인자 자리에 인라인으로 두면 그 안의 ref 접근이 "렌더 중
  // ref 접근"으로 오인되는 린트 경고가 나서, start()/stop()과 동일하게 컴포넌트 스코프의
  // 일반 함수로 분리했다.
  const silenceTimerRef = useRef(createSilenceTimer(handleSilenceTimeout))

  // 실제 LLM 호출 — TEXT_SUBMITTED/SILENCE_TIMEOUT이 일어나는 그 자리에서 직접 호출한다
  // (state.status 변화를 useEffect로 관찰해서 트리거하지 않는다). 처음엔 useEffect(deps:
  // [state.status])로 만들었다가, 이 함수 안에서 dispatch({type: 'STREAM_STARTED'})가
  // status를 sending→streaming으로 바꾸는 순간 그 자체가 "의존성이 바뀜"이 되어 React가
  // 곧바로 해당 effect를 cleanup(→ 방금 만든 AbortController.abort())했다가 재실행하는
  // 자기 자신을 취소하는 버그가 실제로 재현됐다(Playwright로 net::ERR_ABORTED 확인) —
  // start()/stop()처럼 이벤트 발생 지점에서 직접 호출하는 기존 패턴으로 바꿔 해결.
  async function runSendCycle(userText: string) {
    dispatch({ type: 'STREAM_STARTED' })

    const controller = new AbortController()
    activeStreamControllerRef.current = controller

    let assistantText = ''
    try {
      const windowedHistory = historyRef.current.slice(-HISTORY_WINDOW_TURNS * 2)
      const requestMessages: ClaudeMessage[] = [...windowedHistory, { role: 'user', content: userText }]

      await streamClaudeResponse({
        messages: requestMessages,
        onTextDelta: (text) => {
          assistantText += text
          dispatch({ type: 'STREAM_DELTA', text })
        },
        signal: controller.signal,
      })

      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: userText },
        { role: 'assistant', content: assistantText },
      ]
      dispatch({ type: 'STREAM_DONE' })
    } catch (err) {
      // 언마운트/stop()으로 우리가 직접 abort()한 경우엔 에러로 취급하지 않는다 — 사용자에게
      // 보여줄 실패가 아니라 의도된 중단이다.
      if (controller.signal.aborted) return

      const error =
        err instanceof ClaudeStreamError
          ? { reason: err.reason, message: err.message }
          : { reason: 'unknown' as const, message: err instanceof Error ? err.message : String(err) }
      dispatch({ type: 'STREAM_ERROR', error })
    } finally {
      if (activeStreamControllerRef.current === controller) {
        activeStreamControllerRef.current = null
      }
    }
  }

  function handleSilenceTimeout() {
    dispatch({ type: 'SILENCE_TIMEOUT' })
    void runSendCycle(transcriptRef.current)
  }

  function start() {
    transcriptRef.current = ''
    dispatch({ type: 'START_LISTENING' })
    const engine = engineFactory()
    engineRef.current = engine
    engine.start(
      (text) => {
        transcriptRef.current = text
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
    activeStreamControllerRef.current?.abort()
    dispatch({ type: 'RESET' })
  }

  // "이어서 말하기" — 엔진은 건드리지 않는다. continuous 세션이 여전히 살아있어(sending 진입
  // 시 engine.stop()을 부르지 않음) 다시 말하면 브라우저가 알아서 인식을 이어간다.
  function resumeSpeaking() {
    dispatch({ type: 'RESUME_SPEAKING' })
  }

  // 텍스트 모드는 엔진(WebSpeechInputEngine)을 아예 쓰지 않는다 — 미지원 브라우저 폴백이므로
  // 애초에 start()를 부를 대상이 없다. 리듀서가 idle/listening/user_speaking에서만
  // TEXT_SUBMITTED를 받아들이는 것과 동일한 가드를 여기서도 반복한다 — 리듀서가 무시한
  // 이벤트인데 API 호출까지 나가면 안 되기 때문.
  function submitText(text: string) {
    dispatch({ type: 'TEXT_SUBMITTED', text })
    const trimmed = text.trim()
    if (trimmed === '') return
    if (state.status === 'idle' || state.status === 'listening' || state.status === 'user_speaking') {
      void runSendCycle(trimmed)
    }
  }

  useEffect(() => {
    // cleanup 시점에 engineRef.current/activeStreamControllerRef.current를 다시 읽는 게
    // 의도된 동작이다 — start()/runSendCycle()이 마운트 이후 언제든 새 값을 넣을 수 있으므로,
    // 언마운트 시점의 "현재" 값을 정리해야 한다(mount 시점 값을 미리 캡처하면 항상 null).
    return () => {
      silenceTimerRef.current.cancel()
      engineRef.current?.stop()
      activeStreamControllerRef.current?.abort()
    }
  }, [])

  return { state, start, stop, resumeSpeaking, submitText }
}
