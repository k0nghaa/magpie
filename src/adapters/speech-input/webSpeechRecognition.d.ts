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
    // 실험적(Chrome 151+, MDN에 "Experimental" 명시, 호환성 표 비어 있음): 자연스러운 멈춤+문법
    // 구조를 근거로 마침표/쉼표/물음표 등을 자동 추론해 삽입. 미지원 브라우저에서는 존재하지
    // 않는 프로퍼티에 값을 대입하는 것뿐이라 에러 없이 무시된다.
    unspokenPunctuation?: boolean;
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
