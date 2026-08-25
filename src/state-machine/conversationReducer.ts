import type { ConversationEvent, ConversationMachineState } from './types.ts'

export const initialConversationState: ConversationMachineState = {
  status: 'idle',
  transcript: '',
  assistantText: '',
  error: null,
}

// 불가능한 상태 조합을 원천 차단하는 지점: 각 이벤트는 그 이벤트가 실제로 의미를 갖는
// 상태에서만 반영되고, 그 외에는 무시(no-op)한다 — 예를 들어 'sending' 상태에서
// SILENCE_TIMEOUT이 다시 들어와도(타이머 정리가 늦어지는 경우 등) 상태가 깨지지 않는다.
export function conversationReducer(
  state: ConversationMachineState,
  event: ConversationEvent,
): ConversationMachineState {
  switch (event.type) {
    case 'START_LISTENING':
      if (state.status === 'idle' || state.status === 'error') {
        return { status: 'listening', transcript: '', assistantText: '', error: null }
      }
      return state

    // PRD 4장 Happy Path 3번 — 화면 진입 즉시, 사용자 조작 없이 AI가 먼저 인사말+질문을
    // 낸다. idle에서만 의미가 있다(세션당 한 번). STREAM_DONE과 동일한 목적지(assistant_speaking)
    // 로 보내 이후 흐름(TTS 재생 → ASSISTANT_SPEECH_DONE → listening, 마이크 자동 활성화)을
    // 그대로 재사용한다 — "고정 문구든 LLM 스트리밍이든 일단 assistant_speaking에 들어오면
    // 그 다음은 똑같다"는 것이 이 상태머신의 설계 의도(docs/log/DECISIONS.md 참고).
    case 'GREETING_STARTED':
      if (state.status === 'idle') {
        return { ...state, status: 'assistant_speaking', assistantText: event.text, transcript: '' }
      }
      return state

    case 'INTERIM_RESULT':
      if (state.status === 'listening' || state.status === 'user_speaking') {
        return { ...state, status: 'user_speaking', transcript: event.text }
      }
      return state

    case 'SILENCE_TIMEOUT':
      if (state.status === 'user_speaking') {
        return { ...state, status: 'sending' }
      }
      return state

    // "이어서 말하기" — 무음 오탐(사용자가 생각 중인데 끊겼다고 오판) 복구 안전장치.
    // user_speaking/sending에서만 의미가 있다(PRD 6장) — 다른 상태에서는 무시. transcript는
    // 그대로 보존한다: 엔진은 stop()된 적이 없어(continuous 세션이 계속 살아있음) 다시 말을
    // 이어가면 브라우저가 같은 세션의 누적 결과를 계속 보내주기 때문에, 여기서 지울 이유가 없다.
    case 'RESUME_SPEAKING':
      if (state.status === 'user_speaking' || state.status === 'sending') {
        return { ...state, status: 'listening' }
      }
      return state

    // 텍스트 모드: "전송" 클릭/Enter가 곧 턴 종료 신호라 무음 감지가 필요 없다(PRD 4장) —
    // 음성 모드의 SILENCE_TIMEOUT과 동일한 목적지(sending)로 바로 보낸다. 음성 인식 도중에도
    // 텍스트 폴백이 함께 쓰일 이유는 없지만, 방어적으로 listening/user_speaking에서도 허용한다.
    case 'TEXT_SUBMITTED':
      if (event.text.trim() === '') return state
      if (state.status === 'idle' || state.status === 'listening' || state.status === 'user_speaking') {
        return { status: 'sending', transcript: event.text, assistantText: '', error: null }
      }
      return state

    // LLM 스트리밍 시작 — sending에서만 의미가 있다. assistantText를 여기서 비워야 한다(이전
    // 턴의 응답이 남아있는 상태이므로, 그대로 두면 새 응답이 이전 응답 뒤에 이어붙는 것처럼 보임).
    case 'STREAM_STARTED':
      if (state.status === 'sending') {
        return { ...state, status: 'streaming', assistantText: '' }
      }
      return state

    // 토큰 단위 델타를 누적한다. streaming 상태에서만 의미가 있고, 그 외(예: 취소 후 늦게
    // 도착한 델타)는 무시 — 다른 이벤트들과 동일한 "불가능한 전이 차단" 원칙.
    case 'STREAM_DELTA':
      if (state.status === 'streaming') {
        return { ...state, assistantText: state.assistantText + event.text }
      }
      return state

    // 스트리밍 완료 → assistant_speaking으로 전이(PRD 6장 streaming → assistant_speaking →
    // listening). TTS 재생이 끝난 뒤에야 listening으로 복귀한다(ASSISTANT_SPEECH_DONE 참고).
    // transcript는 다음 사용자 턴을 위해 비운다.
    case 'STREAM_DONE':
      if (state.status === 'streaming') {
        return { ...state, status: 'assistant_speaking', transcript: '' }
      }
      return state

    // sending(연결 자체 실패)과 streaming(중간에 끊김) 양쪽에서 발생 가능.
    case 'STREAM_ERROR':
      if (state.status === 'sending' || state.status === 'streaming') {
        return { ...state, status: 'error', error: event.error }
      }
      return state

    // TTS 재생 종료 → listening 복귀(PRD 6장 assistant_speaking → listening). assistant_speaking
    // 에서만 의미가 있다 — 다른 상태에서는 무시(기존 원칙과 동일한 불가능한 전이 차단).
    case 'ASSISTANT_SPEECH_DONE':
      if (state.status === 'assistant_speaking') {
        return { ...state, status: 'listening' }
      }
      return state

    case 'ENGINE_ERROR':
      return { ...state, status: 'error', error: event.error }

    case 'RESET':
      return initialConversationState

    default:
      return state
  }
}
