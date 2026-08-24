// TypeScript의 lib.dom.d.ts에는 SpeechRecognitionEvent/SpeechRecognitionErrorEvent/
// SpeechRecognitionErrorCode 등 관련 타입은 있지만, 정작 SpeechRecognition 생성자 자체와
// Window.SpeechRecognition/webkitSpeechRecognition은 없다(비표준·구현체마다 접두사가 달라
// TC39/WHATWG 표준 lib에 포함되지 않음). 실제로 존재가 확인된 MDN 스펙만 최소한으로 선언한다.
export {};

declare global {
  interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: ((event: Event) => void) | null;
    onspeechend: ((event: Event) => void) | null;
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionStatic;
    webkitSpeechRecognition?: SpeechRecognitionStatic;
  }
}
