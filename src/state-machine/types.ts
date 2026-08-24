import type { SpeechInputError } from '../adapters/types.ts'

// Day 4: LLM 스트리밍 어댑터(claudeProxy)가 생겨서 streaming을 추가한다. assistant_speaking은
// 이번에도 제외한다 — TTS(SpeechOutputEngine)가 Day 5에나 생기는데 지금 추가하면 "TTS 없이
// 즉시 통과"할지 "별도 대기 상태로 둘지"를 정할 근거가 없는 상태로 만들게 되어, streaming이
// 끝나면 바로 listening으로 돌아간다(사람 확인 후 결정, docs/log/DECISIONS.md 참고).
export type ConversationStatus = 'idle' | 'listening' | 'user_speaking' | 'sending' | 'streaming' | 'error'

export interface ConversationMachineState {
  status: ConversationStatus
  transcript: string
  // LLM 응답을 토큰 단위로 누적한 텍스트 — 사용자 발화(transcript)와 별개 필드로 둔다(같은
  // 필드를 재사용하면 "지금 이 텍스트가 사용자 말인지 AI 응답인지"를 상태(status)로만 추론해야
  // 해서 화면 쪽 코드가 더 복잡해진다).
  assistantText: string
  error: SpeechInputError | null
}

export type ConversationEvent =
  | { type: 'START_LISTENING' }
  | { type: 'INTERIM_RESULT'; text: string }
  | { type: 'SILENCE_TIMEOUT' }
  | { type: 'RESUME_SPEAKING' }
  | { type: 'TEXT_SUBMITTED'; text: string }
  | { type: 'ENGINE_ERROR'; error: SpeechInputError }
  | { type: 'STREAM_STARTED' }
  | { type: 'STREAM_DELTA'; text: string }
  | { type: 'STREAM_DONE' }
  | { type: 'STREAM_ERROR'; error: SpeechInputError }
  | { type: 'RESET' }
