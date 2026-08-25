import type { ConversationStatus } from '../../state-machine/types.ts'

// PRD 4장 예외 시나리오: "첫 진입 시 대화 없음(빈 화면) → 온보딩성 안내 문구". 리듀서 상
// status가 'idle'인 경우는 초기 상태(initialConversationState)이거나 RESET 직후뿐이고, 두
// 경우 모두 transcript/assistantText가 항상 비어 있다(conversationReducer.ts 참고) — 그래서
// status만으로 "지금 대화 내용이 하나도 없다"를 판단할 수 있다.
interface EmptyStateProps {
  status: ConversationStatus
}

function EmptyState({ status }: EmptyStateProps) {
  if (status !== 'idle') return null

  return (
    <p className="text-sm text-neutral-500">
      아직 대화가 없습니다. 마이크로 말하거나 텍스트를 입력해서 대화를 시작해보세요.
    </p>
  )
}

export default EmptyState
