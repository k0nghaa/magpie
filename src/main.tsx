import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import GalleryRoot from './GalleryRoot.tsx'
import { isGalleryRoute } from './isGalleryRoute.ts'

if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

// Day 6 상태 갤러리(docs/rules/PRD.md 6장, 축소 버전): 개발 모드에서만 `?gallery` 쿼리로
// 진입하는 디버그 라우트. `App` 안이 아니라 여기서 분기하는 이유는, `App`은 이미 다른 훅
// (useState/useEffect)을 쓰고 있어 그 훅들보다 앞에서 조건부로 return하면 Rules of Hooks를
// 어기게 되기 때문 — 아예 `App`을 렌더링 트리에 들어가기 전에 갈라놓는다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>{isGalleryRoute() ? <GalleryRoot /> : <App />}</StrictMode>,
)
