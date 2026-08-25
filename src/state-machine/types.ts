import type { SpeechInputError } from '../adapters/types.ts'

// Day 4: LLM 스트리밍 어댑터(claudeProxy)가 생겨서 streaming을 추가했다. Day 5: TTS
// 어댑터(WebSpeechSynthesisEngine)가 생겨 assistant_speaking을 추가한다 — streaming 완료 후
// 응답을 다 읽어줄 때까지 마이크가 꺼져 있는 상태(PRD 6장)를 명시적으로 표현한다.
export type ConversationStatus =
  | 'idle'
  | 'listening'
  | 'user_speaking'
  | 'sending'
  | 'streaming'
  | 'assistant_speaking'
  | 'error'

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
  | { type: 'ASSISTANT_SPEECH_DONE' }
  | { type: 'RESET' }
