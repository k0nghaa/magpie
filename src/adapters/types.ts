// 브라우저(Web Speech API)와 향후 네이티브 엔진이 공통으로 매핑해야 하는 에러 taxonomy.
// 어댑터 구현체가 자기 플랫폼의 원본 에러 코드를 이 타입으로 번역해서 올린다 — 상위 로직이
// "SpeechRecognitionErrorCode" 같은 브라우저 전용 타입을 몰라도 되게 하기 위함(7장 어댑터 분리 원칙).
export type SpeechInputErrorReason =
  | 'unsupported'
  | 'permission-denied'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'unknown';

export interface SpeechInputError {
  reason: SpeechInputErrorReason;
  message?: string;
}

export interface SpeechInputEngine {
  start(
    onInterimResult: (text: string) => void,
    onSpeechEnd: () => void,
    onError: (error: SpeechInputError) => void,
  ): void;
  stop(): void;
}

export interface SpeechOutputEngine {
  speak(text: string, onEnd: () => void): void;
}

export interface ReminderEngine {
  schedule(time: Date, onFire: () => void): void;
}
