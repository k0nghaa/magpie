import type { SpeechInputError } from '../adapters/types.ts'

// 오늘 실제로 배선되는 상태만 정의한다. PRD 6장의 assistant_speaking/streaming은 TTS/LLM
// 어댑터(Day 4~5)가 아직 없어 지금 만들면 미완성 상태가 되므로, 그 어댑터가 생길 때 함께 추가한다
// (사람 확인 후 결정, docs/log/DECISIONS.md 참고).
export type ConversationStatus = 'idle' | 'listening' | 'user_speaking' | 'sending' | 'error'

export interface ConversationMachineState {
  status: ConversationStatus
  transcript: string
  error: SpeechInputError | null
}

export type ConversationEvent =
  | { type: 'START_LISTENING' }
  | { type: 'INTERIM_RESULT'; text: string }
  | { type: 'SILENCE_TIMEOUT' }
  | { type: 'RESUME_SPEAKING' }
  | { type: 'TEXT_SUBMITTED'; text: string }
  | { type: 'ENGINE_ERROR'; error: SpeechInputError }
  | { type: 'RESET' }
