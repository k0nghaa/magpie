import type { ConversationStatus } from '../../state-machine/types.ts'

// PRD 6장 컴포넌트 목록: "현재 상태(듣는 중/생각 중/말하는 중)를 시각적+aria-live로 표시,
// 자동 전환의 핵심 UX 요소". 상태 전환이 사용자 클릭 없이 자동으로 일어나므로 스크린리더에
// 알리는 게 핵심이고, 아이콘/시각 효과는 이 작업 범위 밖(사람 확인 후 결정)이라 텍스트만 둔다.
const STATUS_LABEL: Record<ConversationStatus, string> = {
  idle: '대기 중',
  listening: '듣는 중…',
  user_speaking: '발화 인식 중…',
  sending: '전송 중…',
  streaming: 'AI가 생각하는 중…',
  assistant_speaking: 'AI가 말하는 중… (마이크 꺼짐)',
  error: '오류',
}

interface TurnIndicatorProps {
  status: ConversationStatus
}

function TurnIndicator({ status }: TurnIndicatorProps) {
  return (
    <p aria-live="polite" className="text-sm font-medium text-neutral-800">
      {STATUS_LABEL[status]}
    </p>
  )
}

export default TurnIndicator
