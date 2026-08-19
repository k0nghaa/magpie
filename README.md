# 매그파이 (magpie) PoC

아침 10분 AI 회화 앱 — "알림 → 대화 시작 → LLM 스트리밍 대화" 코어 루프만 검증하는 7일 PoC.

## 상세 기획

- 전체 기획: [`docs/rules/PRD.md`](docs/rules/PRD.md)
- 설계 원칙(상태머신/어댑터 분리): [`docs/rules/ARCHITECTURE.md`](docs/rules/ARCHITECTURE.md)
- 컴포넌트 문서: [`docs/deliverables/COMPONENT.md`](docs/deliverables/COMPONENT.md)
- 성능·접근성 리포트: [`docs/deliverables/PERFORMANCE_REPORT.md`](docs/deliverables/PERFORMANCE_REPORT.md)

## 기술 스택

React + Vite + TypeScript / Tailwind CSS / Anthropic Messages API(SSE) /
Web Speech API(STT/TTS) / Notification API + Service Worker

## 실행 방법

```bash
npm install
npm run dev
```

환경변수는 `.env.example` 참고 (Anthropic API 키는 Vercel Serverless Function에서만 사용, 프론트 노출 금지).

## 배포 링크

*(작성 예정)*

## 데모

*(작성 예정 — 데모 영상/스크린샷 링크)*

## 상태 갤러리

개발 모드에서 `/debug/states` (경로는 구현 후 확정) — 모든 UI 상태를 한 화면에서 확인 가능.
