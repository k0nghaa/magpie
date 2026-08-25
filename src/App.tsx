import { useEffect, useState } from 'react'
import ConversationScreen from './components/ConversationScreen/ConversationScreen.tsx'
import NotificationSetup from './components/NotificationSetup/NotificationSetup.tsx'

type Screen = 'setup' | 'conversation'

// PRD 6장 화면 흐름 "[알림 설정 화면] → (지정 시각 도달) → [브라우저 알림] → [대화 화면]"의
// 실제 화면 전환. 라우터 라이브러리 없이 상태 하나로 두 화면 중 하나만 렌더링한다 — 이 PoC엔
// 화면이 둘뿐이고 URL 딥링크 요구사항도 없어 과설계로 판단(사람 확인 후 결정,
// docs/log/DECISIONS.md 참고).
//
// 실제 브라우저 알림(OS 알림) 클릭 시 이 상태로 연결하는 것은 Service Worker↔페이지 메시징이
// 필요해 별도로 처리한다(2026-08-25 확인 후 구현, docs/log/DECISIONS.md 참고): 이미 열려있는
// 탭이면 SW가 `postMessage({type: 'OPEN_CONVERSATION'})`를 보내고(아래 message 리스너가 받음),
// 새 탭을 여는 경우엔 아직 이 리스너가 마운트되기 전이라 메시지가 유실될 수 있어 대신
// `src/sw.ts`가 `/?screen=conversation` URL로 열고 여기서 초기 화면을 그 쿼리로 결정한다.
function getInitialScreen(): Screen {
  return new URLSearchParams(window.location.search).get('screen') === 'conversation' ? 'conversation' : 'setup'
}

function App() {
  const [screen, setScreen] = useState<Screen>(getInitialScreen)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function handleMessage(event: MessageEvent) {
      if ((event.data as { type?: string } | undefined)?.type === 'OPEN_CONVERSATION') {
        setScreen('conversation')
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage)
  }, [])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-medium">Magpie PoC</h1>
      {screen === 'setup' && <NotificationSetup onStartConversation={() => setScreen('conversation')} />}
      {screen === 'conversation' && <ConversationScreen onEnd={() => setScreen('setup')} />}
    </main>
  )
}

export default App
