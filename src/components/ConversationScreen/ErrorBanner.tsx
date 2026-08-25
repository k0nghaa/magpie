import type { SpeechInputError } from '../../adapters/types.ts'

// PRD 4장 예외 시나리오: "네트워크 끊김/API 오류 → 재시도 버튼, 에러 메시지". reason별 문구는
// 기존에 있던 permission-denied 특수 케이스(Day 2/3에서 검증된 문구)를 그대로 가져오고, 그 외
// (Day 4에서 새로 생긴 LLM 스트리밍 실패 포함)는 reason/message를 그대로 노출한다.
function describeError(error: SpeechInputError): string {
  if (error.reason === 'permission-denied') {
    return '마이크가 차단되었습니다. 브라우저 설정에서 직접 허용해야 합니다.'
  }
  return `오류가 발생했습니다: ${error.reason}${error.message ? ` (${error.message})` : ''}`
}

interface ErrorBannerProps {
  error: SpeechInputError
  onRetry: () => void
}

// "재시도"는 실패했던 요청을 자동으로 다시 보내지 않는다 — 상태머신을 idle로 되돌리기만 한다
// (사람 확인 없이 결정, 낮은 리스크: docs/log/DECISIONS.md 참고). 이유: 자동 재전송은 비용 통제
// 원칙(PRD 8장)과 부딪힐 수 있고, "실패한 요청을 몰래 한 번 더 보낸다"는 동작을 사용자 모르게
// 만드는 것보다, idle로 돌아가 사용자가 마이크를 다시 시작하거나 텍스트를 다시 입력하게 하는 쪽이
// 더 명시적이다.
function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      <p>{describeError(error)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md border border-red-800 px-3 py-1 text-red-800"
      >
        재시도
      </button>
    </div>
  )
}

export default ErrorBanner
