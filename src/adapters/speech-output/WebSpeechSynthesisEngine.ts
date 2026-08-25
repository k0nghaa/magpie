import type { SpeechOutputEngine } from '../types.ts'

// SpeechSynthesis 재생 중 speechSynthesis.cancel()을 부르면 브라우저는 'end'가 아니라 'error'
// 이벤트를 error='canceled'(재생 시작 전 취소) 또는 'interrupted'(재생 중 취소)로 발생시킨다
// (MDN SpeechSynthesisErrorEvent.error 문서로 직접 확인, 추측 아님). Day 1 SpeechOutputEngine
// 인터페이스엔 onError가 없어 재생 실패도 "끝났다"로 간주해 onEnd를 호출한다 — 단, 우리가
// cancel()을 직접 부른 경우엔 호출자(useConversationMachine)가 이미 다음 상태 전환을 처리하므로
// onEnd를 다시 부르지 않는다(WebSpeechInputEngine의 stoppedByCaller와 동일한 목적의 플래그).
// Chrome(Windows/Ubuntu, 로컬에 설치되지 않은 원격/클라우드 보이스 사용 시)의 알려진 버그 —
// speak() 시작 후 일정 시간 뒤 재생이 아무 이벤트 없이 그냥 멈춘다(Chromium 이슈
// 41294170/679437). 공식 문서화된 트리거 지점은 "약 15초"이지만, 이 환경에서 실제로 재현
// 테스트해보니(2026-08-25) speechSynthesis.paused는 false로 남아있는 채로 조용히 멈췄고,
// 14초 간격 resume()으로는 멈춤을 막지 못했다 — 대신 3초 간격으로 resume()을 불렀을 때는
// 200자 분량 응답이 끝까지(약 31초) 정상적으로 재생되어 'end'까지 도달함을 직접 확인했다.
// 커뮤니티에 문서화된 정확한 트리거 조건은 알 수 없어(음성 엔진/네트워크 지연에 따라 다를 수
// 있음, 추측하지 않음), 실측으로 검증된 값보다 더 여유 있게 5초 간격으로 호출한다.
const CHROME_RESUME_WORKAROUND_INTERVAL_MS = 5_000

export class WebSpeechSynthesisEngine implements SpeechOutputEngine {
  private canceledByCaller = false

  speak(text: string, onEnd: () => void): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      // 미지원 환경 — 가볍게 스킵하고 자동 사이클이 멈추지 않도록 즉시 종료 처리한다.
      onEnd()
      return
    }

    this.canceledByCaller = false

    const resumeWorkaroundTimer = window.setInterval(() => {
      window.speechSynthesis.resume()
    }, CHROME_RESUME_WORKAROUND_INTERVAL_MS)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => {
      window.clearInterval(resumeWorkaroundTimer)
      onEnd()
    }
    utterance.onerror = (event) => {
      window.clearInterval(resumeWorkaroundTimer)
      if (this.canceledByCaller) return
      console.error(`[WebSpeechSynthesisEngine] 재생 오류: ${event.error}`)
      onEnd()
    }

    window.speechSynthesis.speak(utterance)
  }

  // SpeechOutputEngine 인터페이스엔 없는 내부 전용 메서드 — 수동 "중지/초기화" 시 재생 중인
  // 음성을 즉시 멈추기 위해서만 쓴다. 호출자가 인터페이스 타입이 아니라 이 클래스 인스턴스를
  // 직접 참조할 때만 호출 가능하며, Day 1에 확정된 SpeechOutputEngine 시그니처는 그대로 둔다.
  cancel(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    this.canceledByCaller = true
    window.speechSynthesis.cancel()
  }
}
