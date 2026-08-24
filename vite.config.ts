import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
  ],
})
