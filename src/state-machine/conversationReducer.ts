import type { ConversationEvent, ConversationMachineState } from './types.ts'

export const initialConversationState: ConversationMachineState = {
  status: 'idle',
  transcript: '',
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
        return { status: 'listening', transcript: '', error: null }
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
        return { status: 'sending', transcript: event.text, error: null }
      }
      return state

    case 'ENGINE_ERROR':
      return { status: 'error', transcript: state.transcript, error: event.error }

    case 'RESET':
      return initialConversationState

    default:
      return state
  }
}
