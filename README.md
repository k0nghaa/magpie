# 매그파이 (magpie) PoC

"알림 → 대화 시작 → LLM과 스트리밍 자연스러운 대화"라는 단 하나의 코어 루프만 검증하는
7일짜리 PoC. 지정 시각에 브라우저 알림이 오고, 클릭하면 대화 화면으로 들어가 AI가 먼저
인사말을 건넨 뒤 음성(또는 텍스트)으로 자동 턴테이킹 대화가 이어진다 — 마이크 버튼을 누를
필요 없이, 말이 끝나면(~1.2초 무음) 자동으로 전송되고 AI 응답이 토큰 단위로 스트리밍되며
동시에 TTS로 재생된다. 프론트엔드 캠프 과제 제출용이며 회원가입/결제/학습 기록 등은 비목표다
(상세는 아래 PRD 링크의 2장 참고).

## 상세 기획

- 전체 기획: [`docs/rules/PRD.md`](docs/rules/PRD.md)
- 설계 원칙(상태머신/어댑터 분리): [`docs/rules/ARCHITECTURE.md`](docs/rules/ARCHITECTURE.md)
- 컴포넌트 문서: [`docs/deliverables/COMPONENT.md`](docs/deliverables/COMPONENT.md)
- 성능·접근성 리포트: [`docs/deliverables/PERFORMANCE_REPORT.md`](docs/deliverables/PERFORMANCE_REPORT.md)
- 작업 기록 / 설계 변경 이력: [`docs/log/DEVLOG.md`](docs/log/DEVLOG.md) / [`docs/log/DECISIONS.md`](docs/log/DECISIONS.md)

## 기술 스택

- **프레임워크**: React 19 + Vite + TypeScript, Tailwind CSS
- **상태관리**: 대화 화면은 `useReducer` 기반 상태머신(불가능한 상태 조합 원천 차단)
- **LLM 연동**: Anthropic Messages API, `stream: true`(SSE) — Vercel Serverless
  Function(`api/claude-stream.ts`) 뒤로 프록시해 API 키를 프론트에 노출하지 않음
- **음성**: Web Speech API — STT(`webkitSpeechRecognition`, 미지원 시 텍스트 모드 자동
  폴백) / TTS(`SpeechSynthesis`)
- **알림**: Notification API + Service Worker(`vite-plugin-pwa`, `injectManifest`), 클라이언트
  타이머 기반
- **번들 분석**: `rollup-plugin-visualizer`
- **모델**: 개발/테스트는 `claude-haiku-4-5`(기본값), 최종 데모/리포트 캡처는
  `CLAUDE_MODEL=claude-sonnet-5` 환경변수로 전환

플랫폼 종속 API(Web Speech, Notification)는 전부 `SpeechInputEngine`/`SpeechOutputEngine`/
`ReminderEngine` 인터페이스 뒤에 캡슐화돼 있다 — 근거와 mock 교체 검증은
[`docs/deliverables/COMPONENT.md`](docs/deliverables/COMPONENT.md) 5장 참고.

## 실행 방법

Vercel Serverless Function(`api/claude-stream.ts`)은 `vite dev`가 직접 서빙하지 못하므로,
**로컬 개발은 터미널 2개**가 필요하다(Vercel 계정 연동 없이 검증하기 위한 선택, 근거는
`docs/log/DECISIONS.md` 참고).

```bash
npm install
cp .env.example .env   # ANTHROPIC_API_KEY 채우기

# 터미널 1 — Claude 스트리밍 프록시(로컬 API 서버, :3301)
npm run dev:api

# 터미널 2 — Vite 개발 서버(:5173, /api 요청은 vite.config.ts가 :3301로 프록시)
npm run dev
```

그 외 스크립트: `npm run build`(타입체크+빌드), `npm run lint`, `npm run verify:silence-timer` /
`verify:claude-proxy` / `verify:stream`(브라우저 없이 도는 순수 로직·API 형식 검증).

## 배포 링크

**https://magpie-five-iota.vercel.app**

GitHub↔Vercel 연동이 돼 있어 `main` push마다 자동 배포된다. 알림 클릭 → 대화 화면 자동 전환을
포함해 실배포본 기준으로 직접 접속 검증 완료(`docs/log/DEVLOG.md` Day 7 항목 참고).

## 데모

*(녹화 예정 — 준비되는 대로 링크 추가: ① 알림→자동 턴테이킹 3~5턴 사이클 ② 오탐 후 "이어서
말하기" 복구 ③ 마이크 미지원/거부 시 텍스트 폴백 ④ Network 탭 청크 단위 스트리밍 증빙
⑤ 스크린리더 상태 변화 시연 — 목록은 `docs/deliverables/CHECKLIST.md` 참고)*

## 상태 갤러리

`npm run dev`로 로컬에서 `http://localhost:5173/?gallery=1` — `idle/listening/streaming/
assistant_speaking/error/권한거부` 6개 핵심 상태를 한 화면에 강제 렌더링해 모아본다
(`import.meta.env.DEV` 가드로 프로덕션 빌드에는 포함되지 않는 개발 전용 디버그 라우트,
`docs/deliverables/COMPONENT.md` 6장 참고).
