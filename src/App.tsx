import NotificationSetup from './components/NotificationSetup/NotificationSetup.tsx'
import SpeechInputDemo from './components/SpeechInputDemo/SpeechInputDemo.tsx'

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-medium">Magpie PoC</h1>
      <NotificationSetup />
      <SpeechInputDemo />
    </main>
  )
}

export default App
