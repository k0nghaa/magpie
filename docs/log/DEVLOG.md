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

### 후속 — 예외 시나리오 처리 & Day 2 DoD 최종 검증 (2026-08-24)

- 요청 내용: PRD 4장 예외 시나리오 중 알림 관련 항목("알림 권한 거부 또는 미지원 브라우저 →
  대체 안내 문구 + 수동 '지금 시작하기' 버튼") 구현, Day 2 DoD 2개 항목을 실제로 실행해서
  스크린샷/실행 결과로 검증, 완료 시 DEVLOG/COMPONENT/DECISIONS 문서화.
- 완료 사항:
  - `NotificationSetup`에 "지금 시작하기" 버튼 추가 — 권한이 `denied`이거나 `unsupported`일 때
    (`isBlocked`) 대체 안내 문구 아래에 노출. `ConversationScreen`이 아직 없어서, 클릭하면
    실제 이동 대신 "대화 화면은 아직 준비 중입니다 (Day 3에서 연결 예정)" 확인 문구를
    `aria-live`로 표시 — 존재하지 않는 화면으로 이동하는 척하지 않기로 사용자 확인 후 결정
    (`docs/log/DECISIONS.md` 참고).
  - **DoD ① "임의 시각 지정 후 실제 알림 표시" 재검증**: headed Chromium에서 알림 시간을
    "지금+1분"으로 설정 → SW `activated` 확인 → 지정 시각(예: 오후 1:35:00)에 정확히
    `ServiceWorkerRegistration.prototype.showNotification`이 올바른 제목/본문으로 호출됨을
    로그로 확인. 동시에 PowerShell로 데스크톱 전체를 캡처해, 실제 Windows 토스트 알림
    ("오늘의 회화, 준비되셨나요? / 지금 대화를 시작해보세요.")이 화면 우하단에 뜬 순간을
    스크린샷으로 확보(이전 SW 연결 단계에서 1차 확인, 이번에 예외 시나리오 코드 변경 후 회귀
    없음을 재확인).
  - **DoD ② "권한 거부 시 대체 문구 노출" 검증**: Chromium을 `--deny-permission-prompts`
    플래그로 띄워 실제 권한 거부 상태를 재현(그냥 CDP `grantPermissions`로 흉내내는 게 아니라
    브라우저가 실제로 거부하도록 만드는 플래그) → "알림 권한 요청" 클릭 → "알림이
    차단되었습니다. 브라우저 설정에서 직접 허용해야 합니다." 문구와 "지금 시작하기" 버튼이
    함께 노출되는 것을 스크린샷으로 확인 → 버튼 클릭 → "대화 화면은 아직 준비 중입니다
    (Day 3에서 연결 예정)" 확인 문구까지 정상 표시됨을 스크린샷으로 확인. 콘솔 에러 없음.
  - `npx tsc -b`, `npm run lint` 모두 통과.
- DoD 체크: [x] 임의 시각 지정 후 실제 알림 표시 (재검증 완료) [x] 권한 거부 시 대체 문구 노출
  (실제 거부 상태 재현으로 검증 완료) → **Day 2 DoD 전체 통과**.
- 이슈/메모:
  - "지금 시작하기" 버튼은 아직 placeholder 문구만 표시 — `ConversationScreen`이 생기면
    (Day 3+) 실제 네비게이션으로 교체 필요 (`COMPONENT.md`, `DECISIONS.md`에도 동일하게 기록).

### 후속 — `showBrowserNotification()` 실패(reject) 처리 (2026-08-24)

- 요청 내용: `NotificationSetup.tsx`에서 `void showBrowserNotification(...)`로 호출해
  reject를 아무도 안 받아 unhandled promise rejection이 나는 문제 발견. PRD 4장 예외
  시나리오에 명시된 범위가 아니라 스코프 확장인지 먼저 판단하고, 처리 방식(콘솔 로그만 /
  사용자 노출 / 재시도)을 제안한 뒤 확인받고 진행.
- 완료 사항:
  - 스코프 판단: PRD 4장에는 이 케이스가 없지만, PRD 2장 목표("모든 예외 상태가 UI로
    명시적으로 처리된다")를 근거로 스코프 확장이 아니라 기존 목표를 마저 채우는 것으로 판단.
    콘솔 로그만 남기는 안 / 콘솔 로그+권한 재동기화 안 / 항상 새 에러 배너 노출 안 3가지를
    제시하고 사용자 확인 후 "콘솔 로그 + 권한 상태 재동기화"로 결정
    (`docs/log/DECISIONS.md` 참고).
  - `NotificationSetup.tsx`: `onFire` 콜백에서 `showBrowserNotification(...).catch(...)`로
    반드시 받도록 수정. `catch`에서 `console.error`로 로그를 남기고, `Notification.permission`을
    다시 읽어 `permission` state를 재동기화(`getInitialPermission` → `getCurrentPermission`으로
    이름 변경, 초기값 계산과 실패 후 재동기화 양쪽에서 재사용). 재시도 로직은 넣지 않음.
  - 재동기화의 효과: 실패 원인이 "예약 후 권한이 실제로 바뀜"이었던 경우, 이미 만들어둔
    차단 안내 문구 + "지금 시작하기" 버튼(직전 예외 시나리오 대응 UI)이 새 코드 없이 자동으로
    뜬다 — 별도의 "표시 실패" 배너를 새로 만들지 않음.
  - **실제 실행 검증**: headed Chromium에서 `ServiceWorkerRegistration.prototype.showNotification`을
    reject하도록 바꿔치고 동시에 `Notification.permission`을 `denied`로 바꿔 "예약 후 권한
    변경" 상황을 재현 → `window.addEventListener('unhandledrejection', ...)`로 캡처된 게 0건,
    `console.error`에 `"알림 표시 실패: Error: simulated: permission revoked before fire"`가
    정확히 기록됨, 화면이 자동으로 "알림이 차단되었습니다..." 안내 + "지금 시작하기" 버튼으로
    전환되는 것을 스크린샷으로 확인. `npx tsc -b`, `npm run lint` 모두 통과.
- DoD 체크: 해당 없음(Day 2 DoD 자체는 이전 항목에서 이미 통과 — 이번은 그 이후 발견된
  버그 수정).
- 이슈/메모:
  - 권한이 그대로 `granted`인 채로 다른 원인(예: SW 일시적 오류)으로 실패하는 드문 경우엔
    화면엔 변화가 없고 콘솔 로그만 남는다 — 이 PoC 스코프에서는 의도된 동작.

## Day 3 — 음성 입력 & 자동 턴 감지

### 1차 — `WebSpeechInputEngine` 구현체 + feature detection + 마이크 권한 플로우 (2026-08-24)

- 요청 내용: Day 3 전체 범위 중 3가지만 우선 진행 — (1) `SpeechInputEngine`(Day 1 정의)의
  실제 구현체 `WebSpeechInputEngine`(Web Speech API, `continuous: true`), (2) 연속 음성인식
  feature detection → 미지원 시 텍스트 모드 폴백 "판단 로직"만(텍스트 입력 UI 자체는 제외),
  (3) 마이크 권한 요청/허용/거부 플로우. 무음 타이머(~1.2초) 기반 자동 전송, 오탐 복구 버튼은
  이번 요청 범위 밖(다음 단계).
- 완료 사항:
  - 코드 작성 전 Web Speech API의 브라우저 지원 현황을 MDN(`SpeechRecognition`, `continuous`,
    `speechend`/`end` 이벤트, `SpeechRecognitionErrorEvent/error`), caniuse, GitHub 이슈
    (`mdn/browser-compat-data#22126`)로 직접 확인 — 오래된/추측성 정보에 기대지 않음. 확인
    결과는 `docs/rules/ARCHITECTURE.md`의 `WebSpeechInputEngine` 메모에 정리.
  - **인터페이스 확장(Day 1 시그니처 변경, 사람 확인 후 결정)**: `SpeechInputEngine.start()`에
    `onError` 콜백 추가. 마이크 권한 거부·인식 에러를 상태머신에 알릴 방법이 원래 시그니처엔
    없었음. `SpeechInputError`/`SpeechInputErrorReason` 타입 신설(`src/adapters/types.ts`) —
    브라우저의 `SpeechRecognitionErrorCode`를 그대로 노출하지 않고 어댑터가 번역.
  - **feature detection 기준(사람 확인 후 결정)**: `window.SpeechRecognition ??
    window.webkitSpeechRecognition` 생성자 존재 여부만 체크(표준 방식, UA 스니핑 안 함).
    Safari도 생성자가 있어 "지원함"으로 판정되며, `continuous` 모드의 실제 런타임 버그는 이번
    단계 범위 밖으로 남김(근거: `docs/log/DECISIONS.md`).
  - `src/adapters/speech-input/webSpeechRecognition.d.ts`: TypeScript `lib.dom.d.ts`에
    `SpeechRecognition` 생성자 자체와 `Window.webkitSpeechRecognition`이 없어(관련 이벤트/에러
    타입만 있음) 최소한의 ambient 타입 선언 추가.
  - `src/adapters/speech-input/WebSpeechInputEngine.ts`: `continuous: true` + `interimResults:
    true`로 연동, `onresult`는 세션 누적 전체 텍스트를 `onInterimResult`로 전달, `onspeechend`를
    `onSpeechEnd`로 그대로 전달, `onerror`는 브라우저 에러 코드를 `SpeechInputErrorReason`으로
    번역해 `onError`로 전달. `continuous: true` 세션이 예고 없이 끊겨도(`onend`) `stop()`을
    부른 적 없고 직전 에러가 치명적이지 않으면(`no-speech`만 재시작 허용) 같은 인스턴스로
    재시작 — "계속 듣기" 의도를 지키기 위한 구현 세부사항(자세한 근거는 COMPONENT.md).
  - `src/components/SpeechInputDemo/SpeechInputDemo.tsx`: 실제 브라우저 확인용 임시 디버그
    컴포넌트(`App.tsx`에 임시 배치, Day 2의 `NotificationSetup` 패턴과 동일). 시작/중지 버튼,
    실시간 인식 텍스트, 미지원/권한거부/기타 에러 안내를 `aria-live`로 노출.
  - **실제 실행 검증(Playwright, headless Chromium)**: (1) `webkitSpeechRecognition` 생성자
    존재 및 데모 렌더링 확인, (2) 생성자를 초기화 스크립트로 제거한 뒤 재로드 → 미지원 안내
    문구 노출 + 시작 버튼 미노출 확인, (3) `context.grantPermissions(['microphone'])` +
    `--use-fake-device-for-media-stream`으로 정상 listening 진입(에러 없음) 확인, (4) 브라우저의
    실제 마이크 권한 다이얼로그가 headless 환경에서 응답 없이 무한 대기하는 제약을 발견(Day 2의
    `Notification.permission` headless 제약과 같은 종류) → `SpeechRecognitionErrorEvent`와
    동일한 모양의 가짜 생성자를 주입해 `not-allowed`/`service-not-allowed`(차단 안내 노출),
    `audio-capture`/`network`(에러 배너 노출 후 재시작 안 함), `no-speech`(재시작 허용) 경로를
    모두 확인, (5) 시작/중지 버튼 상태 토글과 정상 종료(잔여 "듣는 중" 텍스트 없음) 확인. 콘솔
    unhandled pageerror 0건. `npx tsc -b`, `npm run lint` 모두 통과.
- DoD 체크: [x] 미지원 환경 텍스트 폴백 판단 로직 (텍스트 입력 UI는 다음 단계) [x] 마이크
  권한 허용/거부 플로우 동작 확인 — [ ] 실시간 인식 텍스트 반영(엔진 자체는 구현·검증했으나
  headless 환경 특성상 실제 음성으로 인식 텍스트가 채워지는 것까지는 확인 못 함, 로컬 실기기
  마이크로 재확인 권장) [ ] 무음 시 자동 전송, [ ] 오탐 복구 버튼 — 다음 단계 범위.
- 이슈/메모:
  - Safari(생성자는 있으나 `continuous` 런타임 버그)와 Edge(지원 여부 자체가 논쟁 중,
    `mdn/browser-compat-data#22126` 미해결)는 feature detection으로 걸러지지 않는다 — 다음
    단계(무음 타이머·재시도 로직)에서 실기기로 재검증 필요.
  - `onSpeechEnd`는 지금 브라우저 네이티브 `speechend` 이벤트를 그대로 전달만 함.
    `continuous: true`에서 발화당 정확히 몇 초 무음 후 발생하는지는 MDN에 명시돼 있지 않아,
    다음 단계의 커스텀 무음 타이머(~1.2초) 구현 시 실제 타이밍을 다시 실측해야 함.
  - `SpeechInputDemo`는 임시 디버그 컴포넌트 — `ConversationScreen`이 생기면 제거하고 실제
    화면으로 통합 필요.

### 2차 — 무음 타이머(~1.2초) 기반 발화 종료 감지 → `sending` 전환 (2026-08-24)

- 요청 내용: PRD 6장 상태머신(`listening → user_speaking → sending`)에 무음 타이머(~1.2초)를
  연결. 코드 작성 전 (1) 이 로직을 로직 레이어/어댑터 중 어디에 둘지, (2) 무음 판단을 커스텀
  타이머로 할지 브라우저 네이티브 이벤트로 할지 트레이드오프를 먼저 설명하고 확인받기.
- 완료 사항:
  - **사람 확인 후 결정한 것 3가지** (근거는 `docs/log/DECISIONS.md` 참고):
    1. 위치: 로직 레이어(`useConversationMachine` hook) — `WebSpeechInputEngine` 내부 아님.
    2. 무음 판단: `onInterimResult` 기반 커스텀 디바운스(1200ms) — 브라우저 네이티브
       `speechend` 이벤트 아님.
    3. 상태머신 범위: 오늘 실제로 쓰이는 5개 상태만(`idle`/`listening`/`user_speaking`/
       `sending`/`error`) — `assistant_speaking`/`streaming`은 어댑터가 생기는 Day 4~5에 추가.
  - `src/state-machine/types.ts`: `ConversationStatus`/`ConversationMachineState`/
    `ConversationEvent` 타입 신설.
  - `src/state-machine/conversationReducer.ts`: 순수 리듀서. 각 이벤트가 의미를 갖는 상태에서만
    반영되고 그 외엔 무시하는 방식으로 불가능한 상태 조합을 원천 차단(예: `sending`에서
    `SILENCE_TIMEOUT` 재수신 무시).
  - `src/state-machine/silenceTimer.ts`: 브라우저 API를 전혀 참조하지 않는 순수 디바운스
    타이머(`SILENCE_TIMEOUT_MS = 1200`). `reset()`이 호출될 때마다 타이머를 되감고, 끝까지
    살아남으면 `onTimeout` 호출.
  - `src/state-machine/useConversationMachine.ts`: `SpeechInputEngine`(팩토리로 주입, 기본값
    `WebSpeechInputEngine`) + 리듀서 + 무음 타이머를 배선하는 hook. `onInterimResult`마다
    타이머 리셋, 타이머가 울면 `SILENCE_TIMEOUT` 디스패치, 엔진 에러 시 타이머 취소 후
    `ENGINE_ERROR` 디스패치. 네이티브 `onSpeechEnd`(=`speechend`)는 참고용 로그만 남기고 상태
    전환에는 미사용(사람 확인 후 결정).
  - `src/components/SpeechInputDemo/SpeechInputDemo.tsx`를 새 hook을 쓰도록 교체 — 현재
    상태(`idle`/듣는 중/발화 인식 중/전송 대기/오류)를 `aria-live`로 실시간 노출해 사람이
    직접 확인할 수 있게 함.
  - `scripts/verify-silence-timer-logic.ts`(`npm run verify:silence-timer`로 커밋된 검증
    스크립트, Day 1의 `verify:stream` 패턴과 동일): 리듀서의 정상 전이 6개 + 불가능한 전이
    무시 2개 + 에러/재시도/리셋 2개, 디바운스 타이머의 리셋/타임아웃/취소 3개 — 총 13개 케이스
    실제 실행 결과 모두 PASS.
  - Playwright(headless Chromium)로 브라우저 이벤트 타이밍 검증: `SpeechRecognition`과 동일한
    모양의 가짜 생성자로 "t=0ms·150ms에 interim 결과 2번 → 이후 완전한 침묵"을 재현 →
    마지막 interim 이후 1241ms 뒤(목표 1200ms, 오차 41ms — DOM polling 오버헤드 범위 내)에
    `sending` 상태로 전환됨을 실측. 네이티브 `speechend`가 한 번도 안 왔는데도 정상 전환돼
    "커스텀 타이머가 `speechend`에 의존하지 않는다"는 설계를 그대로 증명. 콘솔 에러 0건.
  - **실기기 마이크 테스트 시도와 한계(정직하게 기록)**: Windows SAPI로 실제 영어 음성 WAV를
    합성하고 뒤에 진짜 무음 3초를 이어붙여 Chromium의 `--use-file-for-fake-audio-capture`로
    진짜 마이크처럼 흘려보내는 자동화 테스트도 시도했다. 10초 넘게 기다려도 `onresult`도
    `onerror`도 오지 않고 "듣는 중"에 멈춰 있었다 — Playwright가 번들하는 오픈소스 Chromium에는
    Google Chrome 정식 빌드 전용 음성인식 인증키가 없어서일 가능성이 높다(Chrome의
    `SpeechRecognition`은 클라우드 기반, PRD 5장에도 명시된 사실). 즉 **이 부분은 자동화로
    끝까지 검증할 수 없었고, 사람이 로컬 Chrome + 실제 마이크로 직접 확인해야 한다.**
  - `npx tsc -b`, `npm run lint` 모두 통과.
- DoD 체크: [x] 무음 시 자동 전송(로직 검증 완료, 실기기 마이크 확인은 아래 절차로 직접 확인
  필요) [ ] 오탐 복구 버튼 — 여전히 다음 단계 범위(이번 요청에 포함 안 됨).
- **실기기 확인 절차(직접 해봐야 하는 부분)**:
  1. `npm run dev`로 로컬 서버 실행 후 브라우저(Chrome 권장)로 열기.
  2. "마이크 입력 테스트" 섹션에서 "마이크 테스트 시작" 클릭 → 마이크 권한 허용.
  3. 아무 말이나 하고, 화면에 "발화 인식 중" 상태와 실시간 인식 텍스트가 뜨는지 확인.
  4. 말을 멈추고 1.2초 정도 기다렸을 때 상태가 "전송 대기 상태 (LLM 연동은 Day 4 예정)"로
     자동으로 바뀌는지 확인(아직 실제로 어디 전송되진 않음 — Day 4에서 연결 예정).
  5. 너무 빨리(1.2초 전에) 전환되거나 반대로 한참 안 바뀌면 오탐/지연 문제이니 알려주면
     타이밍 값이나 판단 기준을 다시 조정.
- 이슈/메모:
  - "이어서 말하기"(오탐 복구) 버튼은 여전히 미구현 — 커스텀 디바운스 방식의 알려진 리스크
    (뜸 들이다 오탐)를 완화하는 안전장치라 다음으로 미루면 안 될 수도 있음, 필요 시 알려주면
    바로 진행.
  - `sending`은 지금 종착점(더 이상 진행 안 함) — Day 4에서 LLM 스트리밍이 붙으면
    `sending → streaming → assistant_speaking → listening`을 `conversationReducer`에 추가.

### 3차 — 구두점(물음표 등) 자동 추론 활성화 (2026-08-24)

- 요청 내용: 실기기 테스트 중 사용자가 "말끝을 올려 질문으로 말해도 '?'를 못 알아듣냐"고
  질문 → 추측하지 않고 확인 후 답변, 활성화 여부 확인받고 진행.
- 완료 사항:
  - 확인 결과: Web Speech API `SpeechRecognition`에 `unspokenPunctuation` 속성이 있음
    (Chrome 151+, MDN "Experimental" 표시, 호환성 표 비어 있음). 기본값 `false` — 켜지 않으면
    구두점이 전혀 안 붙는다는 게 원인이었음. GitHub explainer는 "자연스러운 멈춤 + 문법 구조"
    기반이라고만 설명하고, 억양(피치) 직접 분석 여부는 근거를 못 찾아 사람에게 그대로 전달.
  - 사람 확인 후 `recognition.unspokenPunctuation = true`로 활성화(`WebSpeechInputEngine.ts`).
    `webSpeechRecognition.d.ts`에 타입 선언 추가. 미지원 브라우저에서는 존재하지 않는
    프로퍼티 대입이라 에러 없이 무시됨.
  - `npx tsc -b`, `npm run lint` 모두 통과.
- DoD 체크: 해당 없음(Day 3 DoD 자체에는 없는 항목, 사용자 질문에서 파생된 개선).
- 이슈/메모: Experimental 기능이라 "?"가 기대만큼 항상 붙는다고 보장 못 함 — 실기기에서 계속
  안 붙으면 알려달라고 안내함.
- **실기기 재확인(2026-08-24, 사람이 직접 크롬에서 테스트)**: 켜도 실제로 "?"가 안 붙는 것을
  확인. 중요도가 낮다고 판단(사람 확인)해 더 파고들지 않고 여기서 종료 — 코드는 무해하므로
  그대로 둠.

### 4차 — `ResumeSpeakingButton`(오탐 복구) + `TextInputFallback`(텍스트 폴백) (2026-08-24)

- 요청 내용: (1) 무음 오탐 시 "이어서 말하기"로 `listening` 강제 복귀시키는
  `ResumeSpeakingButton`(PRD 4장·6장), `user_speaking`/`sending`에서만 노출되는지 상태머신과
  정확히 연결해서 확인. (2) feature detection 미지원 시 자동 노출되는 `TextInputFallback`
  (PRD 4장, 전송/Enter가 턴 종료 신호라 무음 감지 불필요). 미지원 상황 재현 방법이 불확실하면
  지어내지 말고 모른다고 말할 것.
- 완료 사항:
  - `src/state-machine/types.ts`/`conversationReducer.ts`에 이벤트 2개 추가:
    - `RESUME_SPEAKING`: `user_speaking`/`sending`에서만 `listening`으로 전이, 그 외 무시.
      `transcript`는 보존(엔진이 `sending` 진입 시에도 `stop()`되지 않아 continuous 세션이
      계속 살아있으므로, 다시 말하면 브라우저가 알아서 누적 인식을 이어감 — 지우면 오히려
      손해).
    - `TEXT_SUBMITTED`: `idle`/`listening`/`user_speaking`에서 무음 타이머 없이 바로
      `sending`으로 전이(PRD 4장 "전송이 곧 턴 종료 신호"). 공백만 있는 제출은 무시.
  - `src/state-machine/useConversationMachine.ts`: `resumeSpeaking()`/`submitText(text)` 함수
    노출. `resumeSpeaking`은 엔진을 건드리지 않음(위 이유), `submitText`는
    `WebSpeechInputEngine`을 아예 참조하지 않음(텍스트 폴백은 애초에 엔진을 쓸 이유가 없음).
  - `src/components/ConversationScreen/ResumeSpeakingButton.tsx`: 가시성 규칙
    (`user_speaking`/`sending`에서만 렌더링)을 컴포넌트 자체에 내장 — 리듀서의 상태 가드와
    별개로 버튼이 애초에 안 보이는 것까지 이중 보장.
  - `src/components/ConversationScreen/TextInputFallback.tsx`: `<form onSubmit>` 하나로
    "전송 클릭"과 "Enter"를 동시에 처리(HTML 폼의 기본 동작을 그대로 이용 — 별도 keydown
    핸들러 불필요). 빈/공백 입력은 제출 버튼 비활성화 + 제출 시에도 무시(이중 방어).
  - `SpeechInputDemo.tsx`에 두 컴포넌트 배선: 미지원이면 `TextInputFallback`, 지원하면 마이크
    UI 옆에 `ResumeSpeakingButton` 추가.
  - `scripts/verify-silence-timer-logic.ts`에 새 이벤트 케이스 8개 추가(총 21개 검증) — 전부
    PASS(`npm run verify:silence-timer`).
  - **Playwright 실제 실행 검증**:
    1. `ResumeSpeakingButton`: 가짜 `SpeechRecognition`으로 "발화 1번 → 침묵"을 재현해 무음
       오탐을 만든 뒤 — idle에서 버튼 미노출 → `user_speaking`/`sending` 양쪽에서 노출 →
       클릭 시 `listening` 복귀 + transcript 보존 확인 → 복귀 직후 버튼 다시 숨겨짐 확인.
    2. `TextInputFallback`: `addInitScript`로 `SpeechRecognition`/`webkitSpeechRecognition`
       생성자를 제거해 미지원 상황을 재현(Day 3 1차에서 이미 검증에 썼던 것과 동일한 기법) →
       마이크 UI 자체가 안 뜨고 텍스트 입력창이 자동 노출 → 빈 입력 시 전송 버튼 비활성화 →
       입력 후 활성화 → Enter 제출로 `sending` 전환 + transcript 반영 + 입력창 초기화까지 확인.
    둘 다 페이지 에러 0건.
  - `npx tsc -b`, `npm run lint` 모두 통과(기존과 동일한 무해한 경고 1건만 유지).
- DoD 체크: [x] 오탐 복구 버튼 동작(`user_speaking`/`sending`에서만 노출 확인) [x] 미지원 환경
  텍스트 폴백 UI 완성(Day 3 1차에선 판단 로직만이었는데 이번에 실제 UI까지 완성) → **Day 3
  DoD 전체 항목 충족**.
- **브라우저 devtools로 미지원 상황을 직접 재현하는 방법(정확히 확인된 것만 안내)**:
  1. 크롬에서 개발자 도구(F12) → Console 탭 이동.
  2. `delete window.SpeechRecognition; delete window.webkitSpeechRecognition;` 입력 후 Enter.
  3. 페이지를 새로고침하면 `isSpeechInputSupported()`가 `false`를 반환해 텍스트 입력 모드로
     자동 전환됨을 확인할 수 있음(이 프로젝트가 실제로 Playwright 자동화 검증에도 쓴 것과 동일한
     방법 — 지어낸 방법이 아님). `delete`가 안 먹으면(어떤 브라우저는 내장 전역을 `delete` 못
     하게 막기도 함) `Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined })`
     로 대체 가능(다만 이건 이번에 직접 테스트하지 않아 100% 보장은 못 함 — 첫 번째 `delete`
     방법이 안 될 때만 시도해보길 권장).
- 이슈/메모:
  - `ResumeSpeakingButton`이 상태를 `listening`으로 되돌린 뒤, 사용자가 다시 아무 말도 안 하고
    한참 있으면 그냥 `listening`에 계속 머문다(추가 타임아웃 없음) — PRD에도 이 경우의 처리가
    명시돼 있지 않아 임의로 만들지 않음.
  - `TextInputFallback`은 제출 후 `sending`에서 더 진행 안 함(Day 4 LLM 연동 전까지 공통된
    "다음 상태 없음" 제약, 음성 모드와 동일).

### 5차 — Day 3 DoD 4개 항목 실행 검증 및 최종 마감 (2026-08-24)

- 요청 내용: Day 3 DoD 4개 항목을 "될 것 같다"로 넘기지 말고 하나씩 실제로 실행해서 결과로
  보여줄 것. 무음 감지가 실제로 불안정하면(자주 오탐/미전송) 억지로 맞추지 말고 있는 그대로
  보고하고, 필요하면 PRD 11장 "잘라낼 순서 1번"(자동 턴테이킹 → 수동 버튼 방식) 스코프 축소를
  상의.
- 검증 방법과 그 한계(정직하게 구분):
  - **자동화로 검증한 것**: 브라우저 `SpeechRecognition`의 실제 이벤트 계약과 동일한 모양의
    가짜 생성자를 Playwright로 주입해, 우리 코드(엔진→상태머신→화면)가 그 이벤트에 정확히
    반응하는지를 결정론적으로 확인. 이는 "코드가 맞게 짜였는지"를 증명하는 것이지 "진짜 사람
    음성 인식 품질/타이밍 체감"을 증명하는 게 아니다 — 그 부분은 자동화로 검증 불가능함을
    이전 단계에서도 이미 확인한 바 있음(Chromium 오픈소스 빌드의 음성인식 인증키 부재).
  - **실제 사람 체감(유일한 real-world 데이터)**: 사람이 직접 로컬 Chrome + 실제 마이크로
    테스트한 결과 "말 멈추고 적당한 시간(1.2초) 뒤 자동으로 전송 대기 상태 전환됨, 좋음"으로
    확인(앞선 턴에서 보고받음). 이번 요청에 대한 재확인 질문에도 "지금까지는 안정적이었다"는
    답변을 받음 — 오탐/미전송 사례 보고 없음.
- 완료 사항(Playwright 자동화 실행 결과, 총 18개 체크 전부 PASS):
  1. **실시간 텍스트 반영**: 인터림 결과를 4단계로 나눠 주입(`안`→`안녕`→`안녕하`→`안녕하세요`)
     → 화면에 3단계 이상 순차 갱신되고 최종적으로 `안녕하세요`가 반영됨을 확인.
  2. **무음 시 자동 전송**: 마지막 인터림 이후 1232.5ms 뒤 `sending` 전환(목표 1200ms, 오차
     32.5ms — Playwright의 DOM polling/이벤트 루프 오버헤드 범위 내).
  3. **오탐 복구(핵심 검증 — 1회성이 아니라 완주까지 확인)**: (a) 발화 중 버튼 노출 → (b) 무음
     오탐으로 `sending` 진입 재현 → (c) `sending`에서도 버튼 계속 노출 → (d) 클릭 시 `listening`
     복귀 + transcript 보존(`"음... 그러니까"`가 안 지워짐) + 엔진 인스턴스가 재생성되지
     않음(같은 continuous 세션 유지, 인스턴스 카운트 1 유지) → (e) **보강 검증**: 복구 후 실제로
     이어 말하면 다시 `user_speaking`으로 전환되고, 두 번째 무음 뒤 다시 `sending`으로 정확히
     진입하며 이어붙인 전체 문장(`"음... 그러니까 오늘 저녁에 뭐 먹을까?"`)이 그대로 반영됨 —
     버튼이 한 번 눌러보고 끝나는 눈속임이 아니라 실제 대화 흐름을 완주할 수 있음을 확인.
  4. **미지원 환경 텍스트 폴백**: `SpeechRecognition`/`webkitSpeechRecognition` 생성자를 제거해
     재현 → 마이크 UI 미노출 + 텍스트 입력창 자동 노출 → Enter 제출로 무음 감지 없이 즉시
     `sending` 전환 확인.
  - 페이지 에러(unhandled) 0건, 전 항목에서 공통 확인.
- **스코프 조정 여부**: 없음. 자동 턴테이킹(무음 타이머 기반) 방식을 그대로 유지 — 사람이
  직접 사용해본 결과와 이번 재확인 질문 모두 불안정 사례가 없어 PRD 11장 "잘라낼 순서 1번"
  (수동 버튼 방식으로 축소)을 발동할 근거가 없다고 판단(사람 확인). 별도 `DECISIONS.md` 기록은
  생략 — "축소하지 않고 유지"는 설계 변경이 아니라 기존 설계의 확인이므로.
- DoD 체크: **[x] 실시간 인식 텍스트 반영 [x] 무음 시 자동 전송 [x] 오탐 복구 버튼 동작(완주까지
  확인) [x] 미지원 환경 텍스트 폴백 → Day 3 DoD 4개 항목 전체 통과.**
- 이슈/메모: 이번 검증은 표본이 많지 않다(사람의 실사용 1~2회 + 결정론적 자동화 테스트) —
  Day 6~7 데모 녹화·발표 준비 과정에서 더 다양한 발화 패턴(긴 문장, 여러 번 뜸 들이기 등)으로
  한 번 더 확인해보는 걸 권장.

## Day 4 — LLM 스트리밍

- 요청 내용: (1) `src/api/claudeProxy.ts` — `api/claude-stream.ts`(Day 1에 검증된 서버 프록시)를
  호출하는 클라이언트 함수. 서버 코드를 직접 읽어 실제 SSE 형식을 확인한 뒤 그 형식에 맞춰
  파싱(추측 금지). (2) 상태머신에 `sending → streaming → listening` 추가 — `assistant_speaking`
  처리 방식은 임의로 정하지 말고 먼저 확인. (3) 대화 히스토리 윈도잉(PRD 8장) — N을 임의로
  정하지 말고 제안 후 확인. 이번 단계는 `SpeechInputDemo`(임시 디버그 컴포넌트)를 확장하는
  선에서만 진행하고 `ChatMessageList`/`ChatBubble` 등 정식 UI는 Day 5로 미룸.
- 완료 사항:
  - **사람 확인 후 결정한 것 3가지**(근거는 `docs/log/DECISIONS.md` 2026-08-25 항목들 참고):
    1. `assistant_speaking`은 이번에도 제외 — TTS 어댑터(Day 5)가 없어 지금 추가하면 미완성
       상태가 됨. `streaming → listening`으로 직결.
    2. 히스토리 윈도잉 N = 3턴(메시지 6개)으로 시작, 실사용해보고 5턴으로 조정 가능하게
       `HISTORY_WINDOW_TURNS` 상수 하나로 분리.
    3. 로컬 개발 중 `/api/claude-stream` 연결 방식 — Vercel 계정 연동(`vercel dev`)은 실제
       배포 시점(Day 6~7)으로 미루고, 지금은 Day 1의 `verify-claude-stream.ts` 패턴을 재사용한
       상주형 로컬 서버(`scripts/dev-api-server.ts`) + `vite.config.ts`의 `server.proxy`로 우회.
  - `src/api/claudeProxy.ts`: `api/claude-stream.ts`를 직접 읽어 확인한 형식(Anthropic SDK 원본
    이벤트를 그대로 `data: {...}\n\n`로 중계, `[DONE]`으로 종료, 에러 시
    `data: {"type":"error",...}`)에 맞춰 fetch+`ReadableStream`으로 SSE 파싱(MDN "Using readable
    streams" 기준, 청크 경계 버퍼링 포함). `[DONE]` 없이 스트림이 끊기면 네트워크 에러로 처리.
    `AbortController`로 취소한 경우는 `ClaudeStreamError`로 감싸지 않고 그대로 전달.
  - `src/state-machine/types.ts`/`conversationReducer.ts`: `streaming` 상태와
    `STREAM_STARTED`/`STREAM_DELTA`/`STREAM_DONE`/`STREAM_ERROR` 이벤트 추가.
    `assistantText` 필드 신설(사용자 발화 `transcript`와 분리).
  - `src/state-machine/useConversationMachine.ts`: 최근 대화를 `historyRef`에 쌓아두고 매 전송마다
    최근 3턴만 슬라이스해 `claudeProxy`를 호출하는 `runSendCycle()` 추가.
    **버그 발견 및 수정**: 처음엔 `useEffect(deps: [state.status])`로 "`sending` 진입"을 감지해
    스트리밍을 트리거했는데, 그 안의 `dispatch(STREAM_STARTED)`가 `status`를 바꾸는 순간 React가
    같은 effect를 cleanup(→ 방금 만든 `AbortController.abort()`)했다가 재실행해 방금 보낸 요청을
    스스로 취소하는 버그였다(Playwright로 `net::ERR_ABORTED` 실제 확인). `start()`/`stop()`과
    동일한 기존 패턴(이벤트 발생 지점에서 직접 함수 호출)으로 바꿔 해결 — 상세 원인은
    `docs/rules/ARCHITECTURE.md` 참고.
  - `src/components/SpeechInputDemo/SpeechInputDemo.tsx`: AI 응답을 `aria-live`로 노출하는
    임시 표시 영역 추가(정식 `ChatMessageList`/`ChatBubble`은 Day 5에서 `ConversationScreen`과
    함께 조립 예정, 이번엔 만들지 않음).
  - `scripts/dev-api-server.ts`(신규, 배포 대상 아님): `api/claude-stream.ts` 핸들러를 상주
    Node 서버로 감싸 로컬 개발 중 실제 Claude API 스트리밍을 확인할 수 있게 함.
    `vite.config.ts`에 `/api → localhost:3301` proxy 추가, `package.json`에 `dev:api` 스크립트
    추가.
  - `scripts/verify-claude-proxy-parsing.ts`(신규, `npm run verify:claude-proxy`): 가짜
    fetch/ReadableStream을 주입해 SSE 파싱을 결정론적으로 검증 — 청크가 이벤트 JSON 한복판에서
    잘리는 경우, 서버 에러 이벤트, HTTP 레벨 실패, `[DONE]` 없이 끊긴 경우, `AbortError` 전달
    방식까지 5개 시나리오 8개 체크 전부 PASS.
  - **실제 실행 검증(Playwright + 실제 Claude API, 로컬 프록시 경유)**:
    1. 텍스트 입력 경로: 미지원 브라우저 재현(Day 3와 동일 기법) 후 텍스트 전송 →
       `sending`/`streaming`을 거쳐 실제 Claude 응답이 화면에 반영되고 `listening`으로 복귀
       확인. AI 응답 문단이 한 번에 나타나지 않고 서로 다른 타임스탬프(+125ms, +1033ms,
       +1238ms)에 걸쳐 점진적으로 길어지는 것을 실측 — 통짜 응답이 아니라 진짜 토큰 스트리밍임을
       확인.
    2. 마이크 경로: Day 3에서 검증에 쓴 것과 동일한 가짜 `SpeechRecognition` 생성자로 "발화 후
       침묵"을 재현 → 무음 1.2초 뒤 자동으로 `sending/streaming` 전환 → 실제 Claude 응답
       스트리밍까지 완주 확인(응답 예: "바다가 파란 것은 주로 두 가지 이유 때문입니다: ...").
       페이지 에러 0건.
    3. `npm run verify:silence-timer`(Day 3 회귀 스위트, 21개 케이스) 재실행 — 전부 PASS, 기존
       5개 상태 전이 회귀 없음 확인.
    4. API 키 미노출 자체 점검: `src/` 코드 전체에서 `ANTHROPIC_API_KEY`/`apiKey` 참조 없음(클라
       이언트는 `/api/claude-stream`만 호출), `npm run build` 산출물(`dist/`)에 실제 키 값과
       `sk-ant-` 패턴 둘 다 없음을 grep으로 확인.
    5. `npx tsc -b`, `npm run lint` 통과. 새 경고 1건 추가(`useConversationMachine.ts`의
       `useRef(createSilenceTimer(handleSilenceTimeout))`를 "렌더 중 ref 접근"으로 오탐 —
       `createSilenceTimer`가 콜백을 `setTimeout` 안에서만 부른다는 걸 코드로 확인해 정적 분석
       오탐으로 판단, 기존 1건과 같은 기준으로 주석 남기고 유지) — 기존 1건과 합쳐 총 2건.
- DoD 체크: **[x] 마이크/텍스트 입력 → 실제 Claude 응답이 타이핑되듯 스트리밍 렌더링 (양쪽
  경로 모두 실제 API로 확인 완료)**.
- 이슈/메모:
  - `ChatMessageList`/`ChatBubble` 등 정식 채팅 UI는 이번에 만들지 않음 — `SpeechInputDemo`가
    여전히 임시 디버그 컴포넌트 역할. Day 5에서 `ConversationScreen`과 함께 정식 조립 예정.
  - `stop()`(중지/초기화) 및 언마운트 시 진행 중인 스트리밍 요청도 `AbortController`로 취소하게
    해뒀다(비용 통제 차원 — 화면을 벗어나도 API 호출이 배경에서 계속 도는 낭비를 막음).
  - "이어서 말하기" 버튼을 `sending` 상태에서 누르는 경우, 이론적으로는 이미 나간 API 요청을
    취소하지 않고 응답을 버리기만 한다 — 다만 `STREAM_STARTED` 디스패치가 `sending → streaming`
    으로 사실상 동기적으로 바뀌어(같은 자바스크립트 태스크 안에서 처리) 사람이 버튼을 누를 수
    있는 시점엔 이미 `streaming`으로 넘어가 있어 버튼 자체가 안 보인다(가시성 규칙이
    `user_speaking`/`sending`에서만 노출). 실질적으로 발생하기 어려운 경계 케이스라 이번엔 별도
    취소 로직을 추가하지 않음.

### 후속 — `StreamingIndicator`/`ErrorBanner`/`EmptyState` 완성 (2026-08-25)

- 요청 내용: PRD 6장 컴포넌트 목록·Day 4 "로딩·에러·빈 화면 컴포넌트 완성"에 따라 세 컴포넌트
  신설. 스트리밍 연동을 `SpeechInputDemo`에 최소한으로 배선. 네트워크 끊김 재현 방법이 불확실하면
  지어내지 말고 검증된 방법만 사용.
- 완료 사항:
  - `src/components/ConversationScreen/StreamingIndicator.tsx`(신규): `sending`/`streaming`에서만
    노출, 응답 대기/토큰 수신 중 문구를 구분.
  - `src/components/ConversationScreen/ErrorBanner.tsx`(신규): 에러 메시지 + "재시도" 버튼.
    "재시도"는 실패한 요청을 자동으로 다시 보내지 않고 `stop()`(기존 함수 재사용)으로 idle까지만
    되돌린다(사람 확인 없이 결정, 낮은 리스크, `docs/log/DECISIONS.md` 참고).
  - `src/components/ConversationScreen/EmptyState.tsx`(신규): `idle`에서만 노출.
  - `SpeechInputDemo.tsx`: 기존 ad-hoc 에러 문구 두 벌(권한거부/일반 에러)을 `ErrorBanner` 하나로
    통합, `EmptyState`/`StreamingIndicator` 배선.
  - **부수적으로 발견한 버그**: 텍스트 폴백 모드에서 LLM 스트리밍이 실패해 `error` 상태가 되면,
    리듀서가 `error`에서의 `TEXT_SUBMITTED`를 무시해(불가능한 전이 차단) 사용자가 다시 입력해도
    복구할 방법이 전혀 없었다 — `ErrorBanner`의 재시도 버튼이 idle로 되돌려 함께 해결.
  - **`claudeProxy.ts` 에러 분류 보정**: `page.route().abort()`로 네트워크 끊김을 재현하는 과정에서,
    순수 `fetch()` 실패(Response를 아예 못 받는 경우, TypeError)가 `network`가 아니라 `unknown`
    으로 잘못 분류되던 것을 발견 — `fetch()` 호출을 try/catch로 감싸 `AbortError`는 그대로
    통과시키고 나머지는 `network` 사유로 매핑하도록 수정. `scripts/verify-claude-proxy-parsing.ts`
    에 회귀 케이스 추가(총 6개 시나리오).
  - **실제 실행 검증(Playwright)**: (1) 첫 진입 시 `EmptyState` 노출 확인. (2) 네트워크 끊김은
    Playwright 공식 API `page.route(url, route => route.abort())`로 재현(브라우저 devtools
    오프라인 토글을 코드로 결정론적으로 재현하는 공식 방법) → `ErrorBanner` 노출 + 사유가
    정확히 `network`로 분류됨을 확인. (3) 재시도 클릭 → idle 복귀, `EmptyState` 재노출 확인.
    (4) `page.unroute()`로 네트워크 복구 후 재입력 → 실제 Claude 스트리밍 응답까지 정상 완주
    (자동 재전송이 아니라 사용자가 직접 재시도한 것임을 확인). (5) `StreamingIndicator` 문구가
    `sending`/`streaming` 동안 정상 노출됨을 확인. (6) 마이크 경로(Day 3와 동일한 가짜
    `SpeechRecognition`)도 회귀 없이 정상 동작 재확인. 전 과정 페이지 에러 0건.
  - `npm run verify:claude-proxy`(6개 시나리오), `npm run verify:silence-timer`(21개 케이스)
    모두 PASS. `npx tsc -b`, `npm run lint` 통과(경고는 기존 2건과 동일, 신규 없음). 프로덕션
    빌드(`dist/`)에 API 키 미노출 재확인.
- DoD 체크: 해당 없음(Day 4 DoD 자체는 이미 통과 — 이번은 Day 4 지시사항 중 남아 있던
  "로딩·에러·빈 화면 컴포넌트 완성" 항목을 마저 채운 후속 작업).
- 이슈/메모:
  - `TextInputFallback`은 `error` 상태에서도 폼 자체는 그대로 보인다 — 제출해도 리듀서가
    무시(no-op)할 뿐 에러가 나거나 이상 동작하진 않는다. 입력을 아예 비활성화하는 것까지는
    이번 범위 밖으로 판단(과설계 방지) — 필요하면 알려주면 추가.

### 후속 — Day 4 DoD 실행 검증 (2026-08-25)

- 요청 내용: Day 4 DoD("마이크/텍스트 입력 → 실제 Claude 응답이 타이핑되듯 스트리밍 렌더링")를
  "될 것 같다"로 넘어가지 말고 실제 실행 결과(콘솔 로그/스크린샷/자동화 테스트)로 증명. 마이크
  경로는 Day 3처럼 자동화 가능한 부분과 실기기가 필요한 부분을 정직하게 구분.
- 검증 방법과 그 한계(정직하게 구분, Day 3와 동일한 원칙):
  - **자동화로 검증한 것**: 로컬 API 서버(`dev-api-server.ts`, 실제 Anthropic API 키 사용) +
    Vite dev 서버를 실제로 띄우고, Playwright로 브라우저를 조작해 실제 네트워크 요청이
    `/api/claude-stream` → 로컬 프록시 → Anthropic API로 나가고 실제 응답이 돌아오는 전 과정을
    확인. 페이지 안에 `MutationObserver`를 심어 Node 쪽 폴링 주기에 좌우되지 않는, React가 실제로
    DOM에 커밋한 모든 변화를 `performance.now()` 타임스탬프와 함께 기록(외부 폴링보다 엄격한
    증거 — 짧게 지나가는 상태도 폴링 주기 때문에 놓치는 일이 없음).
  - **텍스트 입력 경로**: 마이크 없이 끝까지 자동화로 검증 가능(미지원 브라우저 재현 →
    `TextInputFallback` 사용). **실제 실행 결과**:
    ```
    t=0ms    status="상태: 대기 중"
    t=112ms  status="상태: AI 응답 스트리밍 중…" aiTextLength=4
    t=752ms  aiTextLength=5
    t=1061ms aiTextLength=43
    t=1379ms aiTextLength=95
    t=1636ms aiTextLength=135
    t=1644ms status="상태: 듣는 중…" aiTextLength=135
    ```
    AI 응답 텍스트 길이가 5회에 걸쳐 4→5→43→95→135자로 단조 증가(되감기 없음) — 통짜 응답이
    아니라 진짜 토큰 단위 스트리밍이라는 직접 증거. 최종 응답("# 야외 활동 추천 1. 산책이나
    등산...")이 화면에 정확히 반영되고 `listening`으로 자동 복귀. 스크린샷 3장(초기
    EmptyState/스트리밍 중/완료 후) 확보, 콘솔 페이지 에러 0건.
  - **마이크 입력 경로**: Day 3와 동일한 가짜 `SpeechRecognition` 생성자(실제 브라우저 이벤트
    계약과 동일한 모양)로 "발화 2회 → 침묵"을 재현. **실제 실행 결과**:
    ```
    t=75ms   status="상태: 듣는 중…"
    t=79ms   status="상태: 발화 인식 중"
    t=229ms  status="상태: 발화 인식 중"          ← 마지막 interim
    t=1432ms status="상태: AI 응답 스트리밍 중…" aiTextLength=4   ← 무음 1203ms 후 진입(목표 1200ms)
    t=2096ms ~ t=3846ms: aiTextLength 5→42→66→105→141→182→204로 단조 증가
    t=3858ms status="상태: 듣는 중…"
    ```
    무음 타이머가 정확히 목표 시간(~1.2초) 근처에서 작동해 `sending/streaming`으로 진입했고,
    AI 응답이 9단계에 걸쳐 점진적으로 채워진 뒤 자동으로 `listening` 복귀. 스크린샷 4장(초기/
    발화 인식 중/스트리밍 중/완료 후) 확보, 콘솔 페이지 에러 0건.
  - **흥미로운 발견 — `sending` 상태가 화면(DOM)에는 별도 프레임으로 안 보임**: 텍스트/마이크
    경로 둘 다, `TEXT_SUBMITTED`(또는 `SILENCE_TIMEOUT`) 디스패치 직후 같은 동기 실행 흐름
    안에서 곧바로 `STREAM_STARTED`가 디스패치돼 `sending → streaming`이 일어난다. React
    18+의 자동 배칭(automatic batching)이 이 두 상태 업데이트를 하나의 커밋으로 묶어버려서,
    `sending` 상태는 화면에 한 프레임도 그려지지 않고 곧장 `streaming`으로 넘어간다. **버그
    아님** — `sending` 전이 자체는 `npm run verify:silence-timer`의 리듀서 단위 테스트
    ("idle에서 TEXT_SUBMITTED → 바로 sending, transcript 반영" 등)로 이미 결정론적으로
    증명돼 있고, 로직은 정확히 의도대로 동작한다. 단지 사람 눈에 "전송 중…" 문구가 보일 새 없이
    바로 "스트리밍 중…"으로 바뀌는 것뿐 — 오히려 응답이 그만큼 빠르다는 뜻이라 UX상으로도
    문제 없음.
  - **자동화로 검증할 수 없는 것(정직하게 명시, Day 3와 동일한 환경 제약)**: 위 마이크 경로
    검증은 "우리 코드가 브라우저의 `SpeechRecognition` 이벤트 계약에 정확히 반응하는지"를
    증명할 뿐, "진짜 사람이 진짜 마이크로 말했을 때"의 인식 품질·무음 판단 체감까지는 증명하지
    못한다. Playwright가 번들하는 오픈소스 Chromium에는 Google 정식 빌드 전용 음성인식 인증키가
    없어 실제 음성 입력 자체를 자동화로 재현할 수 없다는 사실이 Day 3에서 이미 확인됐고
    (`docs/rules/ARCHITECTURE.md` 참고), 이번에도 동일하게 적용된다.
- **실기기 확인 절차(사람이 직접 해야 하는 부분, Day 3와 같은 형식)**:
  1. 터미널 2개를 연다. 하나에 `npm run dev:api`(로컬 API 서버, `.env`에 `ANTHROPIC_API_KEY`
     필요), 다른 하나에 `npm run dev`(Vite 앱)를 실행한다.
  2. Chrome으로 `http://localhost:5173`(또는 표시된 포트)을 연다.
  3. "마이크 테스트 시작" 클릭 → 마이크 권한 허용.
  4. 아무 문장이나 말해본다 — "발화 인식 중" 상태와 실시간 인식 텍스트가 화면에 뜨는지 확인.
  5. 말을 멈추고 1.2초 정도 기다린다 — 상태가 "전송 중…"을 (아마 순식간에 지나쳐) "AI 응답
     스트리밍 중…"으로 자동 전환되고, 그 아래 "AI: " 문단에 실제 Claude 응답이 한 글자씩
     타이핑되듯 채워지는지 확인한다. 다 끝나면 자동으로 "듣는 중…"으로 돌아와야 한다.
  6. (선택) 크롬 개발자도구 Network 탭에서 `claude-stream` 요청을 선택해 응답이 청크 단위로
     여러 번에 걸쳐 들어오는지 확인하면 더 확실한 증빙이 된다(Day 7 데모 녹화에도 필요한 화면).
  7. 이상하게 느껴지면(응답이 한 번에 통째로 나타나거나, 멈추거나, 에러가 뜨면) 그대로 알려주면
     원인을 파고든다 — 절대 "될 것 같다"로 넘어가지 않는다.
- DoD 체크: **[x] 마이크/텍스트 입력 → 실제 Claude 응답이 타이핑되듯 스트리밍 렌더링 —
  MutationObserver 기반 타임라인 + 스크린샷으로 재확인 완료. 다만 실제 사람 음성 인식 품질/
  체감은 위 절차대로 사람이 직접 확인 필요(자동화 환경의 근본적 한계, Day 3와 동일).**
- 이슈/메모:
  - 검증에 쓴 스크린샷·타임라인 로그는 세션 스크래치패드에만 남아 있고 저장소에는 커밋하지
    않음(바이너리 산출물, 재현 가능한 검증 스크립트가 근거로 충분하다고 판단).

## Day 5 — TTS & 자동 사이클 완성

- 요청 내용: (1) `SpeechOutputEngine`(Day 1 정의: `speak(text, onEnd)`)의 구현체
  `WebSpeechSynthesisEngine`. (2) 상태머신에 `assistant_speaking` 추가:
  `streaming → assistant_speaking → listening`, 기존 회귀 테스트(`verify:silence-timer`,
  `verify:claude-proxy`) 무회귀 확인. (3) `assistant_speaking` 진입 시 마이크
  `stop()`(mute) → TTS 재생 → `onEnd`에서 `start()` 재호출(마이크 재개, 새 세션 정상) — 마이크
  pause/resume용 새 인터페이스 메서드는 추가하지 않고 기존 `stop()`/`start()` 재호출로만
  구현(Day 1 인터페이스 시그니처 변경 없음, 사람이 미리 확정한 스코프). 시간 제한 조건: 반복
  디버깅이 필요해지면 무리하지 말고 바로 상황 보고 후 PRD 11장 잘라낼 순서 2번(TTS 제거) 여부
  상의하기로 함.
- 완료 사항:
  - `src/adapters/speech-output/WebSpeechSynthesisEngine.ts`(신규): Day 1 시그니처 그대로
    구현. 재생 실패(`utterance.onerror`)도 `onEnd`로 처리(인터페이스에 `onError`가 없어 재생
    사이클이 영원히 멈추지 않게 하기 위함). 인터페이스 밖에 `cancel()`을 추가해 수동
    중지/언마운트 시 재생 중인 음성을 즉시 멈출 수 있게 함(`canceledByCaller` 플래그로 이
    경우엔 `onEnd`를 다시 안 부름 — `WebSpeechInputEngine.stoppedByCaller`와 동일한 패턴).
    `SpeechSynthesis.speak()`/`cancel()`/`SpeechSynthesisUtterance` 이벤트(`end`/`error`)와
    `error` 사유(`canceled`/`interrupted` 등)는 MDN(`SpeechSynthesis.speak`,
    `SpeechSynthesis.cancel`, `SpeechSynthesisUtterance`, `SpeechSynthesisErrorEvent.error`)
    문서로 직접 확인 후 구현(추측 없음).
  - `src/state-machine/types.ts`/`conversationReducer.ts`: `ConversationStatus`에
    `assistant_speaking` 추가, `STREAM_DONE`의 목적지를 `listening`에서
    `assistant_speaking`으로 변경, 새 이벤트 `ASSISTANT_SPEECH_DONE`(`assistant_speaking →
    listening`) 추가. `assistant_speaking`에서 `INTERIM_RESULT`/`SILENCE_TIMEOUT`은 기존
    가드 패턴 그대로 무시됨(불가능한 전이 차단).
  - `src/state-machine/useConversationMachine.ts`: `start()`의 마이크 기동 로직을
    `beginListeningEngine()`으로 추출(재사용을 위함). `playAssistantSpeech(text)` 신설 —
    `engineRef.current?.stop()`으로 마이크를 먼저 끄고, 빈 응답이면 TTS 없이 바로
    `beginListeningEngine()`, 아니면 `ttsEngineFactory()`로 TTS 엔진을 만들어 재생 후
    `onEnd`에서 `ASSISTANT_SPEECH_DONE` 디스패치 + `beginListeningEngine()`(새 세션으로
    마이크 재개). `cancelTtsPlayback()`을 `stop()`/언마운트 cleanup에도 배선해 재생 중인
    TTS를 정리.
  - `scripts/verify-silence-timer-logic.ts`: `streaming → assistant_speaking →
    listening` 전이, `assistant_speaking`에서 `INTERIM_RESULT`/`SILENCE_TIMEOUT` 무시,
    `ASSISTANT_SPEECH_DONE`이 다른 상태(listening/idle)에서 무시되는지까지 8개 케이스 추가
    (총 26개) — 전부 PASS.
  - `src/components/ConversationScreen/StreamingIndicator.tsx`,
    `src/components/SpeechInputDemo/SpeechInputDemo.tsx`: `assistant_speaking` 상태 문구
    ("AI가 말하는 중… (마이크 꺼짐)") 추가 — PRD 6장 "재생 중 마이크 mute + 시각 표시" 요구사항.
  - **실제 브라우저 검증 중 발견한 문제와 해결**: 헤디드 Chrome + 실제 Claude API로 전체 사이클을
    검증하다가, TTS 재생이 종종 끝나지 않고(`speechSynthesis.speaking=true`인 채로 아무 이벤트
    없이 멈춤) 마이크가 영영 안 켜지는 문제를 발견했다. 원인 추적 결과 Chromium의 알려진 버그
    (이슈 41294170/679437, "장문 재생 시 약 15초 후 멈춤")로 확인. 표준 우회법(주기적
    `resume()` 호출)을 추가했으나 14초 간격으로는 이 환경에서 못 막았고, 격리 테스트에서는
    5초 간격이 효과가 있었음(재현성 자체는 다소 불안정). 사람에게 있는 그대로 상황을 보고했고
    (시간 제한 조건 충족), 사람이 "회화 앱인데 응답이 길고 스몰토크처럼 안 느껴진다"는 진짜
    원인을 짚어줘 — 확인해보니 `claudeProxy.ts`/`api/claude-stream.ts`가 처음부터 `system`
    필드를 지원했는데 Day 4까지 호출부가 한 번도 채워 보낸 적이 없어 Claude가 기본값대로 긴
    목록형 답변을 하고 있었다. `useConversationMachine.ts`에 `SYSTEM_PROMPT`(1~3문장, 목록/
    마크다운 금지, 짧은 되물음)를 추가해 `streamClaudeResponse`에 전달 — 부수적으로 서버의
    프롬프트 캐싱 경로(`cache_control: ephemeral`)도 이때 처음 실제로 쓰이게 됨. 응답이 짧아진
    뒤 재검증한 3턴 모두 TTS가 끝까지 재생되고 정상적으로 `listening`에 복귀함을 확인(아래).
  - `npm run verify:silence-timer`(26개 케이스), `npm run verify:claude-proxy`(6개 시나리오),
    `npx tsc -b`, `npm run lint`(기존과 동일한 무해 경고 2건, 신규 없음), `npm run build` 모두
    통과.
  - **실제 실행 검증(Playwright + 실제 로컬 API 서버 + 실제 Claude API + 실제 헤디드 Chrome,
    마이크만 Day 3/4와 동일한 방식의 가짜 `SpeechRecognition`으로 재현, TTS는 실제 브라우저
    `speechSynthesis` 그대로 사용)**: 3턴("안녕 오늘 기분 어때?" → "나는 오늘 날씨가 좋아서
    기분 좋아" → "고마워 오늘 대화 즐거웠어")을 사용자 클릭 없이 자동으로 완주.
    - 마이크 mute 확인: 각 턴마다 `assistant_speaking` 진입 시점에 정확히 `recognition.stop()`
      호출 기록, TTS 종료 시점에 새 `SpeechRecognition` 인스턴스가 `constructed`+`start`되는
      것을 타임라인으로 확인(인스턴스 누적 개수 1→2→3→4, 매 턴 새 세션).
    - 실제 TTS 재생 확인: `window.speechSynthesis.speak()`가 실제 Claude 응답 텍스트로
      호출되고, 실제 `utterance.onstart`가 발생(예: 66자 응답 → 202ms 뒤 시작, 11.7초 뒤
      `utterance.onend`)한 뒤 정확히 `listening`으로 자동 복귀.
    - 3턴 모두 위 사이클을 반복해 PRD Day 5 DoD("전체 Happy Path가 사용자 클릭 없이 자동으로
      3턴 이상 반복 완주")를 충족.
    - 페이지 에러(unhandled) 0건.
- DoD 체크: **[x] Happy Path 3턴 이상 클릭 없이 자동 반복 완주 — 실제 Claude API + 실제
  `speechSynthesis` + 가짜 마이크 입력으로 검증 완료.** (주의: 이 시점엔 아직
  `ConversationScreen`/자동 인사말/수동 종료 버튼이 없어 `SpeechInputDemo`로 사이클 반복성만
  확인한 것 — PRD가 말하는 "Happy Path **1→9 전체**" 최종 검증은 이 문서 뒷부분의 "Day 5 DoD
  최종 검증(전체 Happy Path 1→9)" 항목 참고.)
- 이슈/메모:
  - **남아있는 리스크(정직하게 기록)**: Chromium 장문 재생 버그 자체는 완전히 해결되지 않았다
    — 응답을 짧게 유도해 발생 확률을 낮췄고 `resume()` 워크어라운드도 넣어뒀지만, 우연히 아주
    긴 응답이 나오면 여전히 재현될 수 있다. 이번 검증(3턴)은 표본이 적어, Day 6~7 데모 준비
    중 더 다양한 대화(여러 번 주고받기)로 한 번 더 확인해보는 걸 권장.
    - **자동화로 검증할 수 없는 것(Day 3~4와 동일한 환경 제약)**: 실제 음성으로 말했을 때 TTS
      소리가 사람 귀에 자연스럽게 들리는지, 재생 중 실제 마이크에 대고 말했을 때 진짜로
      에코가 안 잡히는지는 이 자동화 환경(오픈소스 Chromium 음성인식 인증키 부재)에서는
      끝까지 증명 못 한다 — 로컬 Chrome + 실제 마이크로 사람이 직접 확인 필요.
  - `unspokenPunctuation` 등 기존 이슈와 무관하게, 이번 system 프롬프트 추가로 응답 톤이
    Day 4까지의 "설명형"에서 "대화형"으로 바뀌었다 — Day 4의 실제 실행 검증 로그(문서형 긴
    답변 예시)와 비교하면 차이가 뚜렷하다.

### 후속 — `SpeechInputDemo` 제거, `ConversationScreen` 정식 조립 (2026-08-25)

- 요청 내용: PRD 6장 컴포넌트 목록대로 `ConversationScreen`을 조립하고 임시 디버그
  컴포넌트(`SpeechInputDemo`)를 제거. 이 화면에서 돋보여야 하는 건 음성 상호작용(자동
  턴테이킹, TTS)이지 채팅 UI 비주얼이 아니므로, `ChatMessageList`/`ChatBubble`은 색/정렬
  구분만, `TurnIndicator`는 텍스트+`aria-live`만 하고 그 이상(그림자·애니메이션·아이콘 등)은
  만들지 말 것. 기존 `ResumeSpeakingButton`/`TextInputFallback`/`StreamingIndicator`/
  `ErrorBanner`/`EmptyState`는 스타일 변경 없이 재배치만.
- 완료 사항:
  - `src/components/ConversationScreen/ChatBubble.tsx`(신규): user/assistant를 배경색+정렬로만
    구분(요청대로 그 이상 스타일링 없음).
  - `src/components/ConversationScreen/ChatMessageList.tsx`(신규): 완결된 과거 턴 목록 +
    진행 중인 턴(사용자 interim 텍스트 / AI 스트리밍 텍스트)을 마지막 말풍선으로 함께 렌더링.
  - `src/components/ConversationScreen/TurnIndicator.tsx`(신규): 상태별 문구 + `aria-live`만.
  - `src/state-machine/useConversationMachine.ts`: 화면 표시용 `messages` state 신설(기존
    비용 통제용 `historyRef`를 그대로 미러링하되 윈도잉 없이 세션 전체를 보여줌). `stop()`
    (대화 종료)에서 `historyRef`/`messages`를 함께 비움.
  - `src/components/ConversationScreen/ConversationScreen.tsx`(신규): 위 컴포넌트 + 기존
    `ResumeSpeakingButton`/`TextInputFallback`/`StreamingIndicator`/`ErrorBanner`/`EmptyState`를
    조립. 버튼 문구를 디버그용("마이크 테스트 시작"/"중지 초기화")에서 실제 화면용("대화
    시작"/"대화 종료")으로 변경.
  - `src/App.tsx`: `SpeechInputDemo` 대신 `ConversationScreen` 렌더링.
  - `src/components/SpeechInputDemo/`(디렉터리 전체 삭제).
  - `npm run verify:silence-timer`(26개), `npm run verify:claude-proxy`(6개), `npx tsc -b`,
    `npm run lint`(기존과 동일한 무해 경고 2건, 신규 없음), `npm run build` 모두 통과.
  - **실제 실행 검증(Playwright, 실제 로컬 API 서버 + 실제 Claude API + 실제 헤디드 Chrome,
    마이크만 가짜 `SpeechRecognition`)**: `SpeechInputDemo` 잔재 없음 확인 → "대화 시작" 클릭
    시 `listening` 전환 → 가짜 발화로 `user_speaking` 전환 + 실시간 유저 말풍선 노출 확인 →
    무음 → `sending → streaming → assistant_speaking → listening` 전체 사이클을 실제 Claude
    응답으로 완주, 완결된 말풍선 2개(user: "안녕 테스트야" / assistant: 실제 Claude 응답) 노출
    확인 → "대화 종료" 클릭 시 `EmptyState` 재노출 + 말풍선 리스트 초기화 확인. 페이지 에러
    0건.
- DoD 체크: 해당 없음(Day 5 정식 DoD는 이전 항목에서 이미 통과 — 이번은 PRD 6장 컴포넌트
  목록을 채우는 후속 작업).
- 이슈/메모: 없음.

### 후속 — PRD 4장 Happy Path 3번(자동 인사말)/9번(수동 종료) 구현 (2026-08-25)

- 요청 내용: (1) `ConversationScreen` 진입 즉시 사용자 입력 없이 AI가 먼저 인사말+질문을
  자동 출력 — 이번엔 실시간 LLM 생성이 아니라 고정 문구 중 무작위 선택(속도/재현성 우선,
  사람 확인 완료). 이 첫 메시지도 대화 히스토리(윈도잉 3턴)에 정상 반영되어야 함. (2) 수동
  종료 버튼 — 종료 후 이동 위치는 PRD에 명시가 없어 임의로 정하지 않고 확인.
- **사람 확인 후 결정한 것**(트레이드오프 설명 후 확인받음, 근거는 `docs/log/DECISIONS.md`
  2026-08-25 항목들 참고):
  1. 종료 후 이동: App.tsx에 `screen: 'setup' | 'conversation'` 전환 상태를 신설해 설정
     화면으로 복귀. 지금까지 두 화면을 항상 같이 렌더링하던 임시 구조를 실제 화면 전환으로
     교체 — `NotificationSetup`의 "지금 시작하기"(Day 2 placeholder)도 이번에 실제 연결.
- 완료 사항:
  - `src/state-machine/types.ts`/`conversationReducer.ts`: `GREETING_STARTED` 이벤트 추가
    (`idle → assistant_speaking`, `assistantText`에 인사말 반영). `STREAM_DONE`과 동일한
    목적지로 보내 이후 흐름(TTS 재생 → `ASSISTANT_SPEECH_DONE` → listening, 마이크 자동 활성화)
    을 그대로 재사용.
  - `src/state-machine/useConversationMachine.ts`: `FIXED_GREETINGS`(5개 고정 문구) + `greet()`
    신설 — historyRef/messages에 먼저 반영(다음 턴 API 호출 문맥 포함) → `GREETING_STARTED`
    디스패치 → 기존 `playAssistantSpeech()` 재사용(마이크 mute 없음-상태이므로 no-op, TTS
    재생, 종료 후 마이크 자동 시작). `hasGreetedRef`로 세션당 1회만 실행되게 가드.
  - `src/components/ConversationScreen/ConversationScreen.tsx`: 마운트 시 `greet()` 자동
    호출, `onEnd` prop 신설(종료 시 `stop()` + `onEnd()` 호출). "대화 종료" 버튼은 상태와
    무관하게 항상 활성화로 변경(화면을 나가는 버튼이 됐으므로, 사람 확인 없이 결정한 낮은
    리스크 판단).
  - `src/components/NotificationSetup/NotificationSetup.tsx`: placeholder 문구
    (`START_NOW_PLACEHOLDER`) 제거, "지금 시작하기" 클릭 시 새 `onStartConversation` prop 호출.
  - `src/App.tsx`: `screen` state 신설, `setup`/`conversation` 중 하나만 렌더링.
  - `scripts/verify-silence-timer-logic.ts`: `GREETING_STARTED` 관련 3개 케이스 추가(idle에서
    반영, `ASSISTANT_SPEECH_DONE`으로 listening 복귀, idle이 아닌 상태에서 무시) — 총 29개 케이스
    전부 PASS.
  - **실제 브라우저 검증 중 발견해 함께 고친 버그 2건(둘 다 사람 확인 없이 결정, 낮은 리스크,
    `docs/log/DECISIONS.md` 참고)**:
    1. React 18 StrictMode(개발 모드)가 마운트 effect를 "실행 → 즉시 가짜 cleanup → 재실행"으로
       두 번 도는데, `greet()`를 effect 안에서 동기 호출하면 TTS가 막 시작된 직후 그 가짜
       cleanup이 `cancelTtsPlayback()`을 실행해 재생을 `interrupted` 에러로 끊어버리고, 이후
       `hasGreetedRef` 가드 때문에 재시도도 안 돼 화면이 `assistant_speaking`에 영원히 멈추는
       버그를 실제로 재현·확인. `useEffect` 안에서 `setTimeout(() => greet(), 0)` + cleanup에서
       `clearTimeout`으로 한 틱 미뤄 해결 — 가짜 cleanup이 예약된 타이머를 취소시키고, "진짜"
       두 번째 마운트에서 예약된 타이머만 살아남아 정확히 한 번 실행된다.
    2. `beginListeningEngine()`이 음성 미지원 여부를 확인하지 않아, 텍스트 폴백 모드에서도 TTS가
       끝날 때마다 마이크 엔진을 시작하려다 `unsupported` 에러로 `error` 상태에 튕기는 잠재
       버그가 Day 5부터 있었음(Day 5 검증은 가짜 `SpeechRecognition`으로 "지원함"을 재현해서
       이 경로를 안 건드려 못 잡음) — `isSpeechInputSupported()` 가드 추가로 수정.
    3. **디자인 버그(사람 확인 없이 수정)**: `assistant_speaking` 상태에서 "실시간 말풍선"
       (`liveAssistantText`)이 이미 `messages`에 반영된 같은 응답을 한 번 더 그려 말풍선이
       중복 노출되고 있었다 — Day 5 검증 땐 이 구간을 지나쳐서(듣기 상태 도달 후에만 확인)
       못 잡았던 것. `assistant_speaking`을 `liveAssistantText` 조건에서 제외해 해결
       (`streaming`에서만 실시간 표시, `assistant_speaking` 진입 시점엔 이미 `messages`가
       최종본을 갖고 있음).
  - `npm run verify:silence-timer`(29개), `npm run verify:claude-proxy`(6개), `npx tsc -b`,
    `npm run lint`(기존과 동일한 무해 경고 2건, 신규 없음), `npm run build` 모두 통과.
  - **실제 실행 검증(Playwright, `--deny-permission-prompts`로 알림 권한 거부 재현 + 실제
    로컬 API 서버 + 실제 Claude API + 실제 헤디드 Chrome, 마이크만 가짜 `SpeechRecognition`)**:
    1. 초기 진입 시 설정 화면(`NotificationSetup`)만 보임 → 알림 권한 요청 클릭 → 실제 거부
       재현 → "지금 시작하기" 노출 → 클릭 시 대화 화면으로 전환(설정 화면 텍스트는 사라짐).
    2. 대화 화면 진입 직후 사용자 조작 없이 곧바로 `assistant_speaking`(마이크 꺼짐)으로
       시작, 실제 `speechSynthesis.speak()`가 고정 인사말로 호출되고 실제 `start`/`end`
       이벤트까지 발생(4.7초 후 재생 완료) → 자동으로 `listening` 전환 + 마이크 자동 시작
       (Happy Path 3~4번) 확인. 인사말 말풍선 1개만 노출(중복 없음).
    3. 가짜 발화 주입 → 실제 Claude 응답까지 정상 완주, 두 번째 AI 응답이 "방금 네가 먼저
       인사해줬지"라는 사용자 말에 "아, 맞다!"로 반응 — 고정 인사말이 실제로 히스토리
       윈도잉에 포함되어 다음 턴 문맥으로 전달됐음을 응답 내용으로 확인. 최종 말풍선 3개
       (인사말/사용자/AI 응답) 정확히 노출.
    4. "대화 종료" 클릭 → 설정 화면으로 복귀 확인(대화 화면 텍스트 사라짐, Happy Path 9번).
    5. 재진입("지금 시작하기" 재클릭) → 이전 대화 내역 없이 새로운 무작위 인사말 1개로 다시
       시작함을 확인(재마운트마다 새 세션).
    페이지 에러 0건.
- DoD 체크: 해당 없음(Day N 정식 DoD 항목은 아니고 PRD 4장 Happy Path 3/9번을 채우는 후속
  작업). **PRD 4장 Happy Path 3번·9번 모두 실제 실행으로 확인 완료.**
- 이슈/메모:
  - 실제 브라우저 알림(OS 알림) 클릭 시 이 화면 전환 상태로 연결하는 것은 이번 범위 밖 —
    Service Worker↔페이지 메시징이 추가로 필요해 `src/sw.ts`의 `notificationclick`은 여전히
    루트만 연다(기존에도 알려진 제한, Day 7 전까지 필요시 확인).
  - 고정 인사말 방식은 이번 스프린트 한정 스코프 — 추후 매번 LLM에게 실시간으로 인사말/질문을
    생성하도록 전환 예정(`docs/log/DECISIONS.md` 참고, `GREETING_STARTED` 이벤트는 그대로
    재사용 가능하도록 설계해둠).

### 후속 — Day 5 DoD 최종 검증: 전체 Happy Path 1→9 (TTS 포함, 2026-08-25)

- 요청 내용: Day 5 DoD "전체 Happy Path(1→9)가 사용자 클릭 없이 자동으로 3턴 이상 반복
  완주"를 지금까지 조립된 실제 화면(`ConversationScreen` + 자동 인사말 + TTS + 수동 종료
  버튼)을 다 합쳐서 최종 검증. TTS는 이번 스프린트에서 컷하지 않고 그대로 포함해서 검증(PRD
  11장 잘라낼 순서 2번은 발동하지 않음). 자동화 가능한 부분과 실기기가 필요한 부분을 Day 3~4
  처럼 정직하게 구분하고, 최소 3턴이 사람 개입 없이 이어지는지 확인.
- **TTS 진행 결과**: 포함 유지. Day 5 본 작업에서 Chromium 장문 재생 정지 버그를 겪었지만
  `resume()` 워크어라운드 + system 프롬프트로 응답을 짧게 유도해 해결했고(위 항목들 참고),
  이후 "TTS 재생/마이크 자동 mute·재시작 흐름 자연스러움 재점검"(같은 날 후속)에서 `lang`
  지정·`resume()` 가드까지 추가로 다듬었다. **PRD 11장 잘라낼 순서 2번(TTS 제거)은 발동한 적
  없음** — TTS는 Day 5 최종 산출물에 그대로 살아있다.
- 검증 방법: 실제 로컬 API 서버(`dev-api-server.ts`, 실제 Anthropic API 키) + 실제 Vite dev
  서버 + 실제 헤디드 Chrome의 진짜 `speechSynthesis`. 마이크만 Day 3~5와 동일한 방식의 가짜
  `SpeechRecognition`(실제 브라우저 이벤트 계약과 동일한 모양)으로 재현 — 자동화로는 여기까지가
  한계라는 걸 Day 3에서 이미 확인했음(오픈소스 Chromium에 Google 정식 음성인식 인증키 없음).
- 완료 사항(Playwright 자동화 실행 결과, 전 과정 사용자 클릭 없이 자동 진행 — 클릭은 진입 시
  "지금 시작하기" 1회와 마지막 "대화 종료" 1회뿐):
  1. **Happy Path 1~2**(설정 화면, 알림)는 Day 2에서 이미 검증됨 — 이번엔 알림 권한 거부 재현
     → "지금 시작하기" 노출까지만 재확인.
  2. **Happy Path 3~4**(자동 인사말 + TTS + 마이크 자동 활성화)": "지금 시작하기" 클릭 직후
     추가 클릭 없이 곧바로 `assistant_speaking`(마이크 꺼짐) 진입 확인 → TTS 재생 종료 후
     자동으로 `listening` 전환 확인.
  3. **Happy Path 5~8**(발화→무음→스트리밍→TTS→재청취) 사이클을 **4턴 연속**(최소 요구 3턴을
     초과) 자동 반복: 매 턴 `user_speaking` → `streaming`/`assistant_speaking` → `listening`
     전환을 전부 확인, 4턴 전부 성공(중간에 끊긴 턴 없음).
  4. 대화 히스토리(`ChatMessageList`)에 인사말 1개 + 사용자/AI 4턴(8개) = 총 9개 말풍선이
     정확히 쌓임을 확인 — AI 응답 내용도 이전 턴을 실제로 참조("충분한 수면이 정말 다르긴
     해요", "산책하면서 머리도 맑아지고" 등)해 히스토리 윈도잉이 매 턴 정상 동작함을 재확인.
  5. **Happy Path 9**(수동 종료): "대화 종료" 클릭 → 설정 화면(`NotificationSetup`)으로 정상
     복귀.
  6. TTS 재생 5회(인사말 1 + 응답 4) 전부 `speak()`→`start()`→`end()` 정상 완주, TTS 에러 0건,
     페이지/콘솔 에러 0건.
  7. `npm run verify:silence-timer`(29개), `npm run verify:claude-proxy`(6개), `npx tsc -b`,
     `npm run lint`(기존과 동일한 무해 경고 2건, 신규 없음) 모두 사전 확인 후 진행.
- **자동화로 검증한 것 vs 사람이 확인해야 하는 것(정직하게 구분, Day 3~4와 동일한 원칙)**:
  - 자동화로 검증: 상태머신이 브라우저 이벤트 계약에 정확히 반응하는지(마이크 mute/재시작
    타이밍, TTS 재생 성공, 히스토리 누적, 화면 전환), 실제 Claude API 왕복이 4턴 연속 끊김
    없이 이어지는지, 페이지 레벨 에러가 없는지 — 이 모든 게 **결정론적으로 재현 가능한
    증거**로 확인됨.
  - 사람이 실기기로 확인해야 하는 것(자동화 환경의 근본 한계, 이번에도 동일): 진짜 사람 음성을
    마이크로 인식하는 품질/타이밍 체감, TTS 소리가 실제로 자연스럽게 들리는지, 재생 중 실제
    마이크에 대고 말했을 때 진짜로 에코가 안 잡히는지. 자동화가 증명하는 건 "코드가 브라우저
    API 계약대로 정확히 동작한다"는 것이지 "사람이 들었을 때 자연스럽다"는 것이 아니다.
- DoD 체크: **[x] 전체 Happy Path(1→9)가 사용자 클릭 없이 자동으로 3턴 이상(4턴) 반복
  완주 — TTS 포함, 실제 Claude API + 실제 `speechSynthesis`로 확인 완료. Day 5 DoD 최종
  통과.**
- 이슈/메모:
  - 실기기(로컬 Chrome + 실제 마이크)로 3~4턴 이상 대화해보며 최종 확인하는 걸 Day 6~7 데모
    준비 전 한 번 더 권장 — 이번 자동화 검증의 표본(4턴, 1회 실행)이 아주 많지는 않음.

- 요청 내용: Day 6~7 본작업 전에, `api/claude-stream.ts`를 실제 Vercel에 배포했을 때도 로컬과
  동일하게 진짜 스트리밍(청크 단위 시간차 도착)이 되는지만 선행 확인. 전체 프론트엔드 배포·
  최종 정리는 이번 범위 밖. 버퍼링되면 Vercel 공식 문서로 원인(Edge Runtime 필요 여부 등)을
  확인하고, 막히면 무리하지 말고 바로 보고.
- 완료 사항:
  - `main` 기준 새 브랜치(`day6/vercel-stream-verify`) 생성.
  - Vercel CLI 로그인(사용자가 직접 `vercel login` 수행) → `vercel link`로 프로젝트를
    `leekyeonghas-projects` 팀 스코프에 연결(신규 프로젝트 `leekyeonghas-projects/magpie` 생성).
    GitHub 저장소 자동 연동은 권한 문제로 실패했으나 CLI 배포 자체에는 영향 없음.
  - `.env`의 `ANTHROPIC_API_KEY`를 Vercel 프로젝트의 Production/Preview 환경변수로 등록
    (`vercel env add`, Sensitive 타입). `CLAUDE_MODEL`은 기본값(`claude-haiku-4-5`)을 그대로 써서
    별도 설정 안 함(CLAUDE.md 8장 "반복 테스트는 Haiku로" 원칙과 일치).
  - `vercel deploy`로 배포(첫 배포라 Vercel이 자동으로 production에 배정 —
    `https://magpie-five-iota.vercel.app`).
  - 배포된 URL의 `/api/claude-stream`에 직접 요청을 보내 청크 도착 시각을 기록하는 검증
    스크립트(Day 1 `scripts/verify-claude-stream.ts`와 동일한 방식, 원격 URL만 인자로 받도록
    수정한 임시 스크립트, 저장소에는 커밋하지 않음)를 세션 스크래치패드에 작성해 실행.
  - **실제 실행 결과**:
    ```
    Response status: 200 OK
    Headers: content-type=text/event-stream
    [+1078ms] chunk #1 (647 bytes)
    [+1375ms] chunk #2 (265 bytes)
    [+1717ms] chunk #3 (258 bytes)
    [+2033ms] chunk #4 (245 bytes)
    [+2358ms] chunk #5 (238 bytes)
    [+2664ms] chunk #6 (231 bytes)
    [+3054ms] chunk #7 (262 bytes)
    [+3341ms] chunk #8 (184 bytes)
    [+3612ms] chunk #9 (273 bytes)
    [+3927ms] chunk #10 (198 bytes)
    [+4246ms] chunk #11 (224 bytes)
    [+4559ms] chunk #12 (208 bytes)
    [+4731ms] chunk #13 (148 bytes)
    [+4741ms] chunk #14 (263 bytes)
    [+4742ms] chunk #15 (45 bytes)
    총 청크 15개, 총 소요 4743ms
    ```
    15개 청크가 약 4.7초에 걸쳐 250~350ms 간격으로 순차 도착 — 한 번에 통짜로 오는 버퍼링이
    아니라 로컬(Day 1)에서 본 것과 동일한 패턴의 실제 스트리밍임을 확인.
  - 결론: 별도의 Edge Runtime 전환이나 추가 설정 없이, 기본 Vercel Node.js 서버리스 함수
    설정(`@vercel/node` 타입, `vercel.json` 없음) 그대로 프로덕션에서도 진짜 스트리밍이 동작함.
    Vercel 공식 문서 확인 절차(버퍼링 원인 조사)는 필요 없었음 — 버퍼링 자체가 발생하지 않음.
- DoD 체크: 해당 없음(Day N 정식 DoD 항목이 아니라 Day 6~7 전 선행 인프라 확인).
- 이슈/메모:
  - GitHub 저장소(`k0nghaa/magpie`) ↔ Vercel 프로젝트 자동 연동이 권한 문제로 실패한 상태 —
    Day 6~7에 실제 최종 배포/데모 링크를 확정할 때 다시 확인 필요(현재는 CLI로 직접
    `vercel deploy`하는 방식만 검증됨).
  - 이번 배포는 API 함수 하나의 스트리밍 동작 확인이 목적이라 프론트엔드 정식 배포용 설정
    (커스텀 도메인, GitHub 연동을 통한 자동 배포 등)은 다루지 않음 — Day 7 최종 정리 때 필요.

## 음성 상호작용 자연스러움 폴리싱 — TTS 재생/마이크 자동 mute·재시작 흐름 재점검 (2026-08-25)

- 요청 내용: 이 프로젝트에서 돋보여야 할 건 텍스트 UI가 아니라 음성 상호작용의 자연스러움 —
  ① 스트리밍 종료 후 TTS 시작까지 부자연스러운 텀이 있는지, ② 재생 중 문장이 끊기는 느낌이
  있는지, ③ TTS 종료 후 듣기 상태 전환이 바로 되는지 아니면 어색한 텀이 있는지 실제 브라우저에서
  3~4턴 이상 반복 재생해보며 점검하고, 문제가 있으면 원인을 찾아 고칠 것. 상태머신 구조 변경/
  새 인터페이스가 필요할 정도로 커지면 먼저 알리기로 함.
- 점검 방법: 실제 로컬 API 서버 + 실제 Claude API + 실제 헤디드 Chrome의 진짜
  `speechSynthesis`(마이크만 가짜 `SpeechRecognition`)로 인사말 포함 5턴을 연속 실행하며,
  `speechSynthesis.speak()`/`utterance.boundary`/`utterance.end`/마이크 `start()`/`stop()`을
  `performance.now()`와 함께 계측하는 정밀 타임라인을 수집(Day 4의 MutationObserver 타임라인과
  같은 취지, 더 세분화됨).
- 완료 사항(실측 결과 요약):
  1. **①스트리밍 종료→TTS 시작**: `STREAM_DONE`/`GREETING_STARTED` 디스패치와 `speak()` 호출이
     같은 동기 흐름 안에 있어 코드 레벨 지연은 0ms. 실측 로그: `mic:stop`(마이크 mute 시점)
     →다음 `speak-called`까지 5턴 모두 정확히 0ms.
  2. **②재생 중 끊김**: `utterance.boundary` 이벤트 간격이 어절 길이에 따라 자연스럽게
     300~1400ms 사이를 오가며 고르게 이어짐 — 이상 정지·재시작·에러 신호 없음. 5턴(최장 발화
     10.57초) 전부 `onerror` 0건.
  3. **③TTS 종료→마이크 재개**: `utterance.end`와 마이크 `start()`의 실측 간격이 5턴 모두
     0~1ms — `ASSISTANT_SPEECH_DONE` 디스패치 후 `beginListeningEngine()`이 같은 동기 흐름에서
     바로 실행되기 때문.
  4. 다만 **세션 첫 발화(인사말)에서만** `speak()` 호출~실제 재생 시작 사이에 16~91ms 수준의
     콜드스타트가 있음을 확인(이후 턴은 16~22ms로 더 줄어듦). `speechSynthesis.getVoices()`를
     모듈 로드 시점에 미리 호출해 "예열"하면 줄어들지 시도해봤으나, 이 환경은 `getVoices()`가
     항상 빈 배열을 반환해 실측상 개선 효과가 없어(91ms ≈ 기존과 동일 수준) 되돌림 — 효과
     없는 코드를 "고쳤다"고 남겨두지 않기 위함. 100ms 미만·1회성이라 사람이 체감하기 어려운
     수준으로 판단, 더 파고들지 않기로 함.
  5. **실제로 적용한 개선 2가지**(둘 다 사람 확인 없이 결정, 낮은 리스크):
     - `SpeechSynthesisUtterance.lang = 'ko-KR'` 명시 — 기존엔 빈 문자열로 방치돼 있었음(MDN
       권장: 발음/음성 선택 정확도를 위해 lang을 지정할 것). 이 환경은 `getVoices()`가 항상
       비어 JS에서 특정 보이스를 고를 순 없지만, lang 힌트 자체는 그대로 엔진에 전달된다.
     - Chromium 장문 재생 버그 우회용 `resume()` 워크어라운드(Day 5)를 `speechSynthesis.paused`
       일 때만 호출하도록 가드(`resumeIfPaused`) — 재생 중 호출도 MDN상 안전한 조건부 동작이고
       실측(6~10.5초 재생 중 최소 1회 이상 호출됨)으로도 이상 없었지만, 불필요한 호출을 남길
       이유가 없어 방어적으로 정리.
  - `npx tsc -b`, `npm run lint`(기존과 동일한 무해 경고 2건, 신규 없음), `npm run verify:silence-timer`,
    `npm run verify:claude-proxy`, `npm run build` 모두 통과.
- DoD 체크: 해당 없음(Day N 정식 DoD 항목이 아니라 기존 구현의 품질 재점검).
- 이슈/메모:
  - **자동화로 검증할 수 없는 것(정직하게 기록, Day 3~5와 동일한 한계)**: 실제 사람 귀로 듣는
    음질/자연스러움 자체와, 진짜 마이크가 물리적으로 재활성화되는 실제 지연(테스트는 가짜
    `SpeechRecognition`이라 `start()` 호출이 즉시 응답 — 실제 OS 오디오 캡처 재시작 시간은
    측정 불가)은 이 환경에서 증명하지 못한다. 코드 레벨 지연이 전부 0ms에 가깝다는 점,
    Chromium 버그(15초 정지) 재현이 5턴 내내 없었다는 점은 "기술적으로 매끄럽다"는 근거이지
    "사람이 들었을 때 자연스럽다"는 근거는 아니다 — 사람이 로컬 Chrome + 실제 마이크로 3~4턴
    직접 들어보고 확인하는 걸 권장.
  - 상태머신 구조 변경이나 새 인터페이스 추가는 필요하지 않았음(사전에 약속한 에스컬레이션
    조건 발동 안 함).

## Day 6 — 성능 & 접근성

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] Lighthouse 전/후 [ ] 번들 트리맵 전/후 [ ] TTI 계측 전/후 [ ] 상태 갤러리 라우트 확인
- 이슈/메모:
  - (성능 작업 착수 전 선행 수정) Vercel 배포본 실사용 테스트 중 "알림 클릭해도 대화 화면으로
    안 넘어감" 발견 → 원인은 새 버그가 아니라 Day 3 결정 항목에서 범위 밖으로 남겨뒀던
    SW↔페이지 메시징 미구현. 사람 확인 후 지금 구현(`src/sw.ts`, `src/App.tsx`) —
    자세한 내용은 `docs/log/DECISIONS.md` 2026-08-25 "SW↔페이지 메시징으로..." 항목 참고.

## Day 7 — 문서화 & 마무리

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] 산출물 3종 + 데모 녹화 5종 준비 완료
- 이슈/메모:
