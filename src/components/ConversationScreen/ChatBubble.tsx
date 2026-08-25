// PRD 6장 컴포넌트 목록: "user/assistant variant로 재사용". 이 프로젝트에서 돋보여야 하는 건
// 음성 상호작용(자동 턴테이킹, TTS)이지 채팅 UI 비주얼이 아니라서, 색/정렬로 구분만 하고 그
// 이상(그림자, 애니메이션, 세밀한 타이포그래피)은 넣지 않는다(사람 확인 후 결정한 스코프).
interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
}

function ChatBubble({ role, content }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <p
      className={`max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm ${
        isUser ? 'self-end bg-neutral-900 text-white' : 'self-start bg-neutral-100 text-neutral-900'
      }`}
    >
      {content}
    </p>
  )
}

export default ChatBubble
