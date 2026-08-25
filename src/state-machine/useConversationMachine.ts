import { useEffect, useReducer, useRef, useState } from 'react'
import { WebSpeechInputEngine } from '../adapters/speech-input/WebSpeechInputEngine.ts'
import { WebSpeechSynthesisEngine } from '../adapters/speech-output/WebSpeechSynthesisEngine.ts'
import type { SpeechInputEngine, SpeechOutputEngine } from '../adapters/types.ts'
import { ClaudeStreamError, streamClaudeResponse, type ClaudeMessage } from '../api/claudeProxy.ts'
import { conversationReducer, initialConversationState } from './conversationReducer.ts'
import { createSilenceTimer } from './silenceTimer.ts'

// PRD 8장 비용 통제 원칙 "최근 N턴만 윈도잉" 의 N — 3으로 시작(사람 확인 후 결정, 실사용
// 테스트해보고 5로 올릴 수 있음을 전제로 함, docs/log/DECISIONS.md 참고). 1턴 = user+assistant
// 메시지 2개이므로 히스토리는 최대 N*2개 메시지만 유지한다.
const HISTORY_WINDOW_TURNS = 3

// Day 5: 지금까지 system 프롬프트를 전혀 안 보내고 있었다(claudeProxy.ts/api/claude-stream.ts엔
// system 필드가 이미 있었는데 호출부에서 안 채워 넣은 상태) — 그 결과 Claude가 기본값대로 길고
// 목록/마크다운 위주의 "문서형" 답변을 했다. PRD 1장의 핵심 루프는 "아침 10분 스몰토크"이고,
// 이 응답을 TTS로 그대로 읽어주는 게 목표라 짧고 구어체인 응답이 UX상으로도, TTS 재생 안정성
// 상으로도(길수록 Chromium의 알려진 장문 재생 버그를 더 자주 건드림) 유리하다(사람 확인 후 결정).
const SYSTEM_PROMPT = `당신은 사용자와 아침에 짧게 스몰토크를 나누는 친근한 대화 상대입니다.
- 실제 대화처럼 1~3문장으로 짧고 자연스럽게 답합니다.
- 목록(-, 1. 2. 3.)이나 마크다운 서식을 쓰지 않습니다 — 이 텍스트는 음성으로 그대로 읽힙니다.
- 실시간 정보(날씨·뉴스 등)에 접근할 수 없으면 짧게만 인정하고 자연스럽게 다른 화제로 이어갑니다.
- 대화가 이어지도록 가끔 짧은 되물음을 섞습니다.`

// 엔진을 팩토리로 주입받는다 — PRD 3장 검증 기준("mock 구현으로 교체해도 상태머신이 무변경으로
// 동작")을 그대로 만족하기 위함. 기본값은 실제 WebSpeechInputEngine. start/stop은 버튼 클릭 같은
// 이벤트 핸들러에서만 불리고 자식에게 안정적인 참조로 넘길 일이 없어(React.memo 대상 아님)
// useCallback으로 메모이즈하지 않는다 — 매 렌더 재생성돼도 비용이 없다.
export function useConversationMachine(
  engineFactory: () => SpeechInputEngine = () => new WebSpeechInputEngine(),
  ttsEngineFactory: () => SpeechOutputEngine = () => new WebSpeechSynthesisEngine(),
) {
  const [state, dispatch] = useReducer(conversationReducer, initialConversationState)
  const engineRef = useRef<SpeechInputEngine | null>(null)
  // 현재 재생 중인 TTS 엔진 인스턴스 — 수동 중지/언마운트 시 재생을 즉시 멈추기 위해 보관한다.
  const ttsEngineRef = useRef<SpeechOutputEngine | null>(null)
  // 무음 타이머 콜백은 mount 시점에 딱 한 번 생성되는 클로저라 이후 렌더의 state를 못 본다
  // (React가 useRef 초기값 인자를 첫 렌더 이후엔 버림) — 그래서 "지금 사용자가 뭐라고
  // 말했는지"는 이 ref에 INTERIM_RESULT가 올 때마다 직접 갱신해서 읽는다(엔진/타이머 ref와
  // 동일한 이유).
  const transcriptRef = useRef('')
  // 대화 히스토리는 리듀서(상태머신) 밖에 둔다 — 리듀서는 "지금 화면이 어떤 상태인지"만 다루는
  // 순수 로직이고, "서버로 보낼 메시지 목록"은 그와 다른 관심사(비용 통제)라 분리했다. ref인
  // 이유: 매 턴 갱신되지만 그 자체로 리렌더를 유발할 필요가 없는 값이라서.
  const historyRef = useRef<ClaudeMessage[]>([])
  // 화면 표시용 — historyRef와 값은 같지만(같은 배열을 그대로 공유) ref라 리렌더를 안 일으켜서
  // 화면에 보여주려면 별도 state가 필요하다. ConversationScreen의 ChatMessageList가 쓴다.
  const [messages, setMessages] = useState<ClaudeMessage[]>([])
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
        system: SYSTEM_PROMPT,
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
      setMessages(historyRef.current)
      dispatch({ type: 'STREAM_DONE' })
      playAssistantSpeech(assistantText)
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

  // start()와 "TTS 재생 종료 후 마이크 재개" 양쪽에서 쓰는 공통 로직 — 새 엔진 인스턴스를 만들어
  // 리스닝을 시작한다. 항상 새 세션으로 시작되는 것이 의도된 동작이다(직전 continuous 세션을
  // 이어받지 않음 — PRD 4장 "재생 종료 시 인식기 재개"는 세션 보존을 요구하지 않음, 사람 확인
  // 후 결정한 이번 스코프: Day 1 SpeechInputEngine에 pause/resume 메서드를 새로 추가하지 않고
  // 기존 stop()/start() 재호출만으로 mute를 구현하기로 함).
  function beginListeningEngine() {
    transcriptRef.current = ''
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

  // assistant_speaking 진입 시 호출 — 먼저 마이크를 끄고(에코 방지, PRD 4장 예외 시나리오) TTS를
  // 재생한 뒤, 재생이 끝나면(onEnd) listening으로 복귀하며 마이크를 다시 켠다.
  function playAssistantSpeech(text: string) {
    engineRef.current?.stop()
    engineRef.current = null

    // 스트리밍 응답이 비어있는 드문 경우(예: 빈 델타만 도착) — 재생할 내용이 없으므로 TTS를
    // 건너뛰고 바로 listening으로 복귀한다. speak('')의 동작은 MDN에 명시돼 있지 않아 호출
    // 자체를 하지 않는 쪽을 택함(추측성 동작에 기대지 않기 위함).
    if (text.trim() === '') {
      dispatch({ type: 'ASSISTANT_SPEECH_DONE' })
      beginListeningEngine()
      return
    }

    const ttsEngine = ttsEngineFactory()
    ttsEngineRef.current = ttsEngine
    ttsEngine.speak(text, () => {
      // 그 사이 stop()으로 이미 취소된 재생이면(ttsEngineRef가 다른 값으로 바뀌었거나 비었으면)
      // 여기서 다시 상태를 되돌리지 않는다 — stop()이 이미 RESET을 처리했다.
      if (ttsEngineRef.current !== ttsEngine) return
      ttsEngineRef.current = null
      dispatch({ type: 'ASSISTANT_SPEECH_DONE' })
      beginListeningEngine()
    })
  }

  function start() {
    dispatch({ type: 'START_LISTENING' })
    beginListeningEngine()
  }

  // SpeechOutputEngine 인터페이스(Day 1)엔 cancel()이 없다 — 재생 중 수동 중지를 위한 내부
  // 전용 메서드라 어댑터 구현체에 있을 때만 옵셔널하게 호출한다(구현체가 없거나 mock이면 그냥
  // 넘어감, 인터페이스 시그니처 변경 없이 처리).
  function cancelTtsPlayback() {
    const ttsEngine = ttsEngineRef.current as (SpeechOutputEngine & { cancel?: () => void }) | null
    ttsEngine?.cancel?.()
    ttsEngineRef.current = null
  }

  function stop() {
    silenceTimerRef.current.cancel()
    engineRef.current?.stop()
    engineRef.current = null
    activeStreamControllerRef.current?.abort()
    cancelTtsPlayback()
    historyRef.current = []
    setMessages([])
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
      cancelTtsPlayback()
    }
  }, [])

  return { state, start, stop, resumeSpeaking, submitText, messages }
}
