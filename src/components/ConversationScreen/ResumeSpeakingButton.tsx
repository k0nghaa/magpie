import type { ConversationStatus } from '../../state-machine/types.ts'

// PRD 6장: "user_speaking/sending 상태에서 '이어서 말하기' 버튼 클릭 시 → listening으로 강제
// 복귀(오탐 복구)". 가시성 규칙을 컴포넌트 자체에 내장해 다른 상태에서는 아예 렌더링하지 않는다
// — 상태머신(conversationReducer)도 이 두 상태 밖에서는 RESUME_SPEAKING을 무시하지만, 버튼
// 자체가 안 보이는 것까지 이중으로 보장한다.
const VISIBLE_STATUSES: ReadonlySet<ConversationStatus> = new Set(['user_speaking', 'sending'])

interface ResumeSpeakingButtonProps {
  status: ConversationStatus
  onResume: () => void
}

function ResumeSpeakingButton({ status, onResume }: ResumeSpeakingButtonProps) {
  if (!VISIBLE_STATUSES.has(status)) {
    return null
  }

  return (
    <button
      type="button"
      onClick={onResume}
      className="rounded-md border border-neutral-400 px-4 py-2 text-sm text-neutral-700"
    >
      이어서 말하기
    </button>
  )
}

export default ResumeSpeakingButton
