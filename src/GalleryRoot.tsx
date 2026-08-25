import { lazy, Suspense } from 'react'

// main.tsx(엔트리 파일, export 없음)에 lazy 컴포넌트를 직접 두면 oxlint의
// react(only-export-components) 경고가 뜬다 — 컴포넌트 하나를 온전히 export하는 파일로 분리.
const StateGallery = lazy(() => import('./components/StateGallery/StateGallery.tsx'))

function GalleryRoot() {
  return (
    <Suspense fallback={<p aria-live="polite">상태 갤러리를 불러오는 중...</p>}>
      <StateGallery />
    </Suspense>
  )
}

export default GalleryRoot
