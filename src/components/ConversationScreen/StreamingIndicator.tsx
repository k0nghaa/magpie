import type { ConversationStatus } from '../../state-machine/types.ts'

// PRD 6장 컴포넌트 목록: "스트리밍 중 표시". sending(응답 요청을 보내고 첫 토큰을 기다리는 중)과
// streaming(토큰이 도착하는 중) 둘 다 "지금 AI 쪽 작업이 진행 중"이라는 같은 의미라서 하나의
// 컴포넌트로 묶는다 — PRD 컴포넌트 목록에 별도 "로딩 표시" 컴포넌트가 없는 이유이기도 하다.
// 가시성 규칙을 컴포넌트 자체에 내장하는 방식은 ResumeSpeakingButton과 동일.
const LABEL: Partial<Record<ConversationStatus, string>> = {
  sending: 'Claude에게 응답을 요청하는 중…',
  streaming: 'AI 응답을 스트리밍으로 받는 중…',
}

interface StreamingIndicatorProps {
  status: ConversationStatus
}

function StreamingIndicator({ status }: StreamingIndicatorProps) {
  const label = LABEL[status]
  if (!label) return null

  return (
    <p aria-live="polite" className="text-sm text-neutral-500">
      {label}
    </p>
  )
}

export default StreamingIndicator
