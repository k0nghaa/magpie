import type { SpeechInputEngine, SpeechInputError, SpeechInputErrorReason } from '../types.ts'

// 재시작(continuous 유지)을 시도하면 안 되는, 사용자 조치 없이는 재시도해도 같은 결과가
// 반복될 에러. 그 외(no-speech 등)는 "잠깐 조용했을 뿐"로 보고 계속 듣기를 유지한다.
const FATAL_ERROR_REASONS: ReadonlySet<SpeechInputErrorReason> = new Set([
  'permission-denied',
  'audio-capture',
  'network',
  'aborted',
])

function getSpeechRecognitionConstructor(): SpeechRecognitionStatic | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

// 브라우저(연속 인식용 SpeechRecognition 생성자)가 있는지만 확인한다. Safari처럼 생성자는
// 있지만 continuous 모드에서 런타임 버그가 있는 브라우저도 여기서는 "지원함"으로 판정한다 —
// 사람 확인 후 결정한 범위(docs/log/DECISIONS.md 참고): UA 스니핑으로 특정 브라우저를 미리
// 배제하지 않고, 표준 feature-detection만 사용한다.
export function isSpeechInputSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null
}

function mapErrorCode(code: SpeechRecognitionErrorCode): SpeechInputErrorReason {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission-denied'
    case 'no-speech':
      return 'no-speech'
    case 'audio-capture':
      return 'audio-capture'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    default:
      return 'unknown'
  }
}

export class WebSpeechInputEngine implements SpeechInputEngine {
  private recognition: SpeechRecognition | null = null
  private stoppedByCaller = false
  private canRestart = true

  start(
    onInterimResult: (text: string) => void,
    onSpeechEnd: () => void,
    onError: (error: SpeechInputError) => void,
  ): void {
    const Constructor = getSpeechRecognitionConstructor()
    if (!Constructor) {
      onError({ reason: 'unsupported', message: '이 브라우저는 연속 음성 인식을 지원하지 않습니다.' })
      return
    }

    this.stoppedByCaller = false
    this.canRestart = true

    const recognition = new Constructor()
    recognition.continuous = true
    recognition.interimResults = true
    // 실험적 기능(사람 확인 후 켬, docs/log/DECISIONS.md 참고) — "?" 같은 구두점을 자연스러운
    // 멈춤+문법 구조 기반으로 추론해 넣어준다. 미지원 브라우저에서는 존재하지 않는 프로퍼티에
    // 값을 대입하는 것뿐이라 조용히 무시된다(에러 없음).
    recognition.unspokenPunctuation = true

    recognition.onresult = (event) => {
      // 세션 시작(이번 start() 호출) 이후 누적된 전체 텍스트를 매번 통째로 넘긴다 — 호출자가
      // event.resultIndex 같은 브라우저 이벤트 구조를 몰라도 화면에 그대로 표시할 수 있게 하기 위함.
      let transcript = ''
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
      onInterimResult(transcript)
    }

    recognition.onspeechend = () => {
      onSpeechEnd()
    }

    recognition.onerror = (event) => {
      const reason = mapErrorCode(event.error)
      if (FATAL_ERROR_REASONS.has(reason)) {
        this.canRestart = false
      }
      onError({ reason, message: event.message || undefined })
    }

    // continuous:true여도 브라우저가 별도 안내 없이 세션을 끊을 수 있다(예: 장시간 무음).
    // 호출자가 stop()을 부르지 않았고 직전에 치명적 에러도 없었다면, "계속 듣기"라는 원래
    // 의도를 지키기 위해 같은 인스턴스에서 재시작한다.
    recognition.onend = () => {
      if (this.stoppedByCaller || !this.canRestart || this.recognition !== recognition) return
      recognition.start()
    }

    this.recognition = recognition
    recognition.start()
  }

  stop(): void {
    this.stoppedByCaller = true
    this.recognition?.stop()
    this.recognition = null
  }
}
