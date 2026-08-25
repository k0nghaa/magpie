import type { ClaudeMessage } from '../../api/claudeProxy.ts'
import ChatBubble from './ChatBubble.tsx'

// PRD 6장 컴포넌트 목록: "user/assistant variant로 재사용". 완결된 과거 턴(messages)에 더해,
// 지금 진행 중인 턴(사용자가 말하는 중인 interim 텍스트 / AI가 스트리밍 중인 텍스트)도 마지막
// 말풍선으로 얹어 실시간으로 채워지는 걸 보여준다 — 별도 "로딩 말풍선" 없이 기존 ChatBubble
// 그대로 재사용.
interface ChatMessageListProps {
  messages: ClaudeMessage[]
  liveUserText?: string
  liveAssistantText?: string
}

function ChatMessageList({ messages, liveUserText, liveAssistantText }: ChatMessageListProps) {
  if (messages.length === 0 && !liveUserText && !liveAssistantText) return null

  return (
    <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
      {messages.map((message, index) => (
        <ChatBubble key={`${message.role}-${index}`} role={message.role} content={message.content} />
      ))}
      {liveUserText && <ChatBubble role="user" content={liveUserText} />}
      {liveAssistantText && <ChatBubble role="assistant" content={liveAssistantText} />}
    </div>
  )
}

export default ChatMessageList
