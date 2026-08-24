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
