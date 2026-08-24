// PRD 6장의 "무음 타이머(~1.2초)"를 브라우저/엔진 구현체와 무관하게 우리가 직접 보장하기 위한
// 순수 디바운스 타이머. onInterimResult가 호출될 때마다 reset()을 불러 타이머를 되감고,
// timeoutMs 동안 reset()이 다시 호출되지 않으면 "무음이 지속됐다"고 보고 onTimeout을 부른다.
// 브라우저 API를 전혀 참조하지 않으므로 어떤 SpeechInputEngine 구현체(mock 포함)와도 그대로
// 동작한다 (사람 확인 후 결정한 설계, docs/log/DECISIONS.md 참고).
export const SILENCE_TIMEOUT_MS = 1200

export interface SilenceTimer {
  reset(): void
  cancel(): void
}

export function createSilenceTimer(onTimeout: () => void, timeoutMs: number = SILENCE_TIMEOUT_MS): SilenceTimer {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  function reset(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(onTimeout, timeoutMs)
  }

  function cancel(): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return { reset, cancel }
}
