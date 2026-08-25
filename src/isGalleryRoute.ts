// Day 6 상태 갤러리 라우트 판별. main.tsx(컴포넌트 파일)에 두면 oxlint의
// react(only-export-components) 경고(Fast Refresh 대상 파일엔 컴포넌트 외 export를 두지 않는
// 게 규칙)가 떠서 별도 파일로 분리했다.
export function isGalleryRoute(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')
}
