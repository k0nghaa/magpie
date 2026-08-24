# DEVLOG.md — 일자별 작업 기록

> 매일 작업이 끝나면 해당 Day 항목을 채운다. "AI에게 뭘 시켰는지 / 뭐가 끝났는지 / DoD 통과 여부"를
> 남겨두면 발표 자료 및 회고에 그대로 쓸 수 있다.

## Day 1 — 설계 & 셋업

- 요청 내용:
  1. React + Vite + TypeScript 프로젝트 초기 셋업, Tailwind CSS 설정, `src/adapters`·`src/state-machine`·`src/components`·`src/api` 폴더 구조 확보, `.gitignore` 점검
  2. ARCHITECTURE.md에 정의된 `SpeechInputEngine`/`SpeechOutputEngine`/`ReminderEngine` 인터페이스 타입만 정의 (구현체 없음)
  3. Vercel Serverless Function(`api/claude-stream.ts`)으로 Anthropic Messages API `stream: true` 프록시 + SSE 중계 구현, API 키 미노출 자체 점검
  4. 로컬에서 실제 Claude API 스트리밍 응답이 콘솔에 청크 단위로 찍히는지 실행 검증
- 완료 사항:
  - Vite + React + TS 스캐폴딩, Tailwind v4(`@tailwindcss/vite`) 적용, 템플릿 데모 잔재 제거
  - `src/state-machine`, `src/components`, `src/api` 빈 폴더 확보
  - `.gitignore`에 `.env`류 및 `.omc/`(OMC 런타임 상태) 추가
  - `src/adapters/types.ts`에 어댑터 인터페이스 3종 정의 (ARCHITECTURE.md 원문 그대로, 시그니처 변경 없음)
  - `api/claude-stream.ts` 작성: `@anthropic-ai/sdk`의 `messages.stream()` 사용, raw SSE 이벤트를 그대로 `data: ...\n\n`로 중계. API 키는 `process.env.ANTHROPIC_API_KEY`로만 읽음(`VITE_` 접두사 미사용) → 프론트 번들에 노출되지 않음을 `vite build` 결과(번들 크기 불변, 190.49kB)로 확인
  - 모델은 클라이언트가 아니라 서버 환경변수 `CLAUDE_MODEL`로만 전환(기본값 `claude-haiku-4-5`), `max_tokens` 1024 하드 캡, 시스템 프롬프트에 `cache_control: ephemeral` 적용 (CLAUDE.md 8장 비용 통제 원칙 반영)
  - `scripts/verify-claude-stream.ts` 작성: 로컬 HTTP 서버에 `api/claude-stream.ts` 핸들러를 그대로 얹어 실제 Anthropic API로 스트리밍 요청 → 응답을 타임스탬프와 함께 콘솔에 출력하는 검증 스크립트 (`npm run verify:stream`)
  - 실제 실행 결과 (2026-08-19, 로컬):
    ```
    응답 상태: 200 OK
    [+863ms] chunk #1 (663 bytes)
    [+864ms] chunk #2 (101 bytes)
    [+1141ms] chunk #3 (215 bytes)
    [+1149ms] chunk #4 (246 bytes)
    [+1152ms] chunk #5 (14 bytes)
    조립된 최종 응답: "바다가 파란 이유는 물이 빨간색 빛을 흡수하고 파란색 빛을 반사하기 때문입니다."
    총 청크 5개, 총 소요 1152ms
    ```
    → 여러 청크가 시간차를 두고 도착 (863ms → 1152ms) = 진짜 스트리밍 확인, 버퍼링된 단일 응답 아님
- DoD 체크: [x] 로컬에서 프록시 통해 Claude API 스트리밍 응답 콘솔 확인
- 이슈/메모:
  - 로컬 검증에 Vercel CLI(`vercel dev`) 대신 Node `http` 서버로 핸들러를 직접 감싸는 방식 사용 (계정 연동 없이 실제 API 키만으로 검증 가능하게 하려는 목적, 핸들러 코드 자체는 배포용 `api/claude-stream.ts`와 동일)
  - `src/api/claudeProxy.ts`(클라이언트 호출부, ARCHITECTURE.md 폴더 구조 제안)는 아직 미작성 — Day 4(LLM 스트리밍 화면 연동) 때 작업
  - `SpeechInputEngine` 등 어댑터 구현체(`WebSpeechInputEngine` 등)는 Day 3에서 작업

## Day 2 — 알림 플로우

- 요청 내용:
  1. `NotificationSetup` 컴포넌트 — 알림 시간 설정 UI (시간 입력 + 알림 권한 요청 버튼)
  2. `ReminderEngine` 인터페이스(Day 1 정의)의 실제 구현체 `BrowserNotificationEngine`
  - 이번 단계에서는 Service Worker 등록·실제 알림 발사 로직은 제외 (다음 단계로 이월)
- 완료 사항:
  - `src/components/NotificationSetup/NotificationSetup.tsx`: `input type="time"`(기본값 09:00,
    `localStorage` 키 `magpie:notification-time`으로 유지) + 알림 권한 요청 버튼. `Notification.permission`
    상태(`granted`/`denied`/`default`/`unsupported`)별 안내 문구를 `aria-live="polite"`로 노출.
    `App.tsx`에 임시로 렌더링해 눈으로 확인 가능하게 연결.
  - `src/adapters/reminder/BrowserNotificationEngine.ts`: Day 1 시그니처
    (`schedule(time: Date, onFire: () => void): void`) 그대로 구현. 내부적으로 `setTimeout` 기반
    타이머만 담당하고, 재호출 시 이전 타이머를 교체. 시그니처 변경 없음.
  - 설계 결정 3가지(시간 입력 UI 형태, 시간값 저장 방식, `schedule()`의 이번 단계 책임 범위)는
    PRD/ARCHITECTURE.md에 명시되지 않아 임의로 정하지 않고 사용자에게 확인 후 진행
    (`input type="time"` / `localStorage` / 타이머만 구현, 알림 발사는 다음 단계).
  - Notification API 권한 동작(퍼미션 값 3종, 시크릿 컨텍스트 요구, 사용자 제스처 필요, `denied` 시
    재프롬프트 없음)은 MDN(`Notification.requestPermission()`, `Notification.permission`) 공식 문서로
    직접 확인.
  - Playwright(headless Chromium)로 dev 서버 실제 렌더링 검증: 시간 입력 기본값/변경/새로고침 후
    유지, 권한 `denied`/`unsupported` 분기 문구, 콘솔 에러 없음을 확인. 단, headless Chromium은
    `context.grantPermissions(['notifications'])`로도 `Notification.permission`이 항상 `denied`로
    보고되는 환경 제약이 있어 `granted` 분기는 코드 리뷰로만 확인 (headless 환경 자체의 한계, 컴포넌트
    로직 문제 아님).
- DoD 체크: [x] 임의 시각 지정 후 실제 알림 표시 [x] 권한 거부 시 대체 문구 노출

### 후속 — Service Worker 등록 & 실제 알림 표시 연결

- 요청 내용: Service Worker를 등록하고 클라이언트 타이머로 지정 시각이 되면 실제로
  `Notification`이 표시되도록 `NotificationSetup`/`BrowserNotificationEngine`과 연결.
  SW 기반 알림과 페이지 직접 알림의 차이를 확인 후 방식 결정, 브라우저 완전 종료 후 푸시(비목표)는
  만들지 않기.
- 완료 사항:
  - `vite-plugin-pwa`(+`workbox-precaching`) 도입. `injectManifest` 전략으로 커스텀 SW
    (`src/sw.ts`) 작성 — `generateSW`(Workbox 자동 생성)는 `notificationclick` 같은 커스텀
    이벤트 리스너를 넣을 방법이 없어서 제외. `injectManifest.globPatterns: []`로 오프라인
    프리캐시 없음(비목표), `manifest: false`로 PWA 설치용 매니페스트/아이콘도 이번엔 생성하지
    않음(요청 범위 밖, 아이콘 자산 없음).
  - SW 전용 `tsconfig.sw.json` 신설(`WebWorker` lib) — 기존 `tsconfig.app.json`(`DOM` lib)과
    전역 타입이 충돌하지 않게 분리, 루트 `tsconfig.json`의 project reference에 추가. 기존
    `tsconfig.node.json`/`tsconfig.api.json` 분리 패턴을 그대로 따름.
  - `src/adapters/reminder/showBrowserNotification.ts`: `navigator.serviceWorker.ready` 대기 후
    `registration.showNotification()` 호출. `BrowserNotificationEngine`은 여전히 타이머만
    담당하고, 실제 표시는 이 헬퍼가 `onFire` 콜백 안에서 수행 (역할 분리 유지).
  - `NotificationSetup`: 시간/권한이 `granted`로 바뀔 때마다 "다음 발생 시각"(오늘 지났으면
    내일)을 계산해 스케줄하고 화면에 "다음 알림 예정: …"으로 노출.
  - `src/main.tsx`에서 `virtual:pwa-register`의 `registerSW({ immediate: true })`로 SW 등록.
  - **설계 결정**: SW의 `showNotification()`만 사용, 페이지의 `new Notification()`은 안 씀 —
    MDN에 "`new Notification()`은 거의 모든 모바일 브라우저에서 TypeError"라고 명시돼 있어
    데스크톱 폴백 없이 단일 경로로 통일하기로 사용자 확인 후 결정.
  - **실제 실행 검증 (2026-08-24)**: Playwright로 headed Chromium을 띄우고
    `context.grantPermissions(['notifications'])`로 권한을 준 뒤(이 환경에서는 headed 모드에서
    `Notification.permission`이 정상적으로 `granted`, SW도 `activated`로 확인됨 — headless
    모드에서 보였던 "항상 denied" 제약과 다름), 알림 시간을 "지금+1분"으로 설정 → 약 65초 대기 →
    `ServiceWorkerRegistration.prototype.showNotification`이 정확한 시각·내용으로 호출됨을
    확인. 동시에 PowerShell로 실제 데스크톱 화면을 캡처해 Windows 토스트 알림
    ("오늘의 회화, 준비되셨나요? / 지금 대화를 시작해보세요.")이 실제로 화면에 뜨는 것을 직접 확인.
  - `npm run build`로 injectManifest 파이프라인 정상 동작 확인 (`precache 0 entries`, `dist/sw.js`
    생성). `inlineDynamicImports is deprecated` 경고가 뜨는데, 우리가 직접 설정한 옵션이 아니라
    `vite-plugin-pwa`가 내부적으로 SW를 빌드할 때 쓰는 rollup 옵션이 최신 vite/rollup 버전에서
    이름이 바뀐 것 — 빌드는 정상 완료되므로 무해한 경고로 판단, 플러그인 업데이트로 해결될 사안.
- 이슈/메모:
  - 매일 반복 알림(다음날 재예약)은 아직 미구현 — 이번 요청 범위가 "지정 시각 1회 표시"였음.
  - SW의 `notificationclick` 핸들러는 지금 루트(`/`)만 열도록 되어 있음 — `ConversationScreen`이
    생기면(Day 3~) 그 경로로 갱신 필요.

## Day 3 — 음성 입력 & 자동 턴 감지

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] 실시간 인식 텍스트 반영 [ ] 무음 시 자동 전송 [ ] 오탐 복구 버튼 동작 [ ] 미지원 환경 텍스트 폴백
- 이슈/메모:

## Day 4 — LLM 스트리밍

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] 마이크/텍스트 입력 → 실제 스트리밍 렌더링 확인
- 이슈/메모:

## Day 5 — TTS & 자동 사이클 완성

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] Happy Path 3턴 이상 클릭 없이 자동 반복 완주
- 이슈/메모:

## Day 6 — 성능 & 접근성

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] Lighthouse 전/후 [ ] 번들 트리맵 전/후 [ ] TTI 계측 전/후 [ ] 상태 갤러리 라우트 확인
- 이슈/메모:

## Day 7 — 문서화 & 마무리

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] 산출물 3종 + 데모 녹화 5종 준비 완료
- 이슈/메모:
