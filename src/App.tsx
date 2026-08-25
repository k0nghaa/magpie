import { useState } from 'react'
import ConversationScreen from './components/ConversationScreen/ConversationScreen.tsx'
import NotificationSetup from './components/NotificationSetup/NotificationSetup.tsx'

type Screen = 'setup' | 'conversation'

// PRD 6장 화면 흐름 "[알림 설정 화면] → (지정 시각 도달) → [브라우저 알림] → [대화 화면]"의
// 실제 화면 전환. 라우터 라이브러리 없이 상태 하나로 두 화면 중 하나만 렌더링한다 — 이 PoC엔
// 화면이 둘뿐이고 URL 딥링크 요구사항도 없어 과설계로 판단(사람 확인 후 결정,
// docs/log/DECISIONS.md 참고). 실제 브라우저 알림 클릭(Service Worker `notificationclick`)을
// 이 상태에 연결하는 것은 이번 범위 밖 — SW↔페이지 메시징이 추가로 필요해 별도 작업으로 남김.
function App() {
  const [screen, setScreen] = useState<Screen>('setup')

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-medium">Magpie PoC</h1>
      {screen === 'setup' && <NotificationSetup onStartConversation={() => setScreen('conversation')} />}
      {screen === 'conversation' && <ConversationScreen onEnd={() => setScreen('setup')} />}
    </main>
  )
}

export default App
