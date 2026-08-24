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

    case 'ENGINE_ERROR':
      return { status: 'error', transcript: state.transcript, error: event.error }

    case 'RESET':
      return initialConversationState

    default:
      return state
  }
}
