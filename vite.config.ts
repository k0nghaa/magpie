import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  server: {
    // Vercel Serverless Function(api/claude-stream.ts)은 `vite dev`가 직접 서빙하지 못한다 —
    // 로컬 개발 중엔 `npm run dev:api`(scripts/dev-api-server.ts)로 띄운 상주 서버로 중계한다.
    // Vercel 계정 연동 없이 로컬에서 실제 스트리밍을 확인하기 위한 선택(2026-08-25, 사람 확인,
    // docs/log/DECISIONS.md 참고) — 실제 배포 시엔 Vercel이 같은 경로를 자체적으로 서빙하므로
    // 이 proxy는 무관해진다.
    proxy: {
      "/api": "http://localhost:3301",
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 오프라인 캐싱/설치형 PWA는 비목표 — SW는 Notification 표시용으로만 사용 (docs/rules/PRD.md 2장)
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: [],
      },
      manifest: false,
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
    // Day 6 성능 작업: 코드 스플리팅 전/후 번들 트리맵 비교용 (docs/rules/PRD.md 6장).
    // `npm run build`마다 dist/bundle-stats.html로 트리맵을 생성한다 — 전/후 캡처 후
    // docs/deliverables/bundle-treemap-{before,after}.html로 복사해 보존한다.
    visualizer({
      filename: 'dist/bundle-stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
})
