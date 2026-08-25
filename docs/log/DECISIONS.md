# DECISIONS.md — 의사결정 기록 (ADR)

> 설계/스코프가 PRD와 다르게 바뀔 때마다 아래 형식으로 추가한다. 특히 PRD 11장
> "잘라낼 순서"가 발동되면 반드시 기록한다 — 발표 시 "트레이드오프를 이해하고
> 스코프를 조절한 근거"로 그대로 활용 가능.

## 형식

```
### [날짜] 제목

- 배경/문제:
- 검토한 대안:
- 결정:
- 이유:
- 영향받는 범위(코드/문서):
```

## 기록

### 2026-08-19 Tailwind CSS 메이저 버전 선택

- 배경/문제: CLAUDE.md/PRD 5장엔 "Tailwind CSS" 스택만 명시, v3/v4 버전은 미지정.
- 검토한 대안: v3(기존 방식, `tailwind.config.js`+`postcss.config.js`+`@tailwind base/components/utilities`) vs v4(`@tailwindcss/vite` 플러그인, `@import "tailwindcss"` 한 줄).
- 결정: v4 채택.
- 이유: 공식 최신 버전, 설정 파일이 더 단순해 1주일 PoC 타임라인에 유리. 사람에게 직접 확인받음.
- 영향받는 범위: `vite.config.ts`(플러그인 추가), `src/index.css`, `package.json` 의존성.

### 2026-08-19 `/api/claude-stream` `max_tokens` 하드 캡 값

- 배경/문제: CLAUDE.md 8장 "max_tokens로 응답 길이 상한"이라는 원칙만 있고 구체적 숫자는 미지정.
- 검토한 대안: 1024(짧은 대화 하이쿠형 대응) vs 512(더 저비용, 응답 잘릴 위험) vs 직접 다른 값 지정.
- 결정: 1024로 확정, 클라이언트가 더 큰 값을 보내도 서버가 강제로 clamp.
- 이유: 사람 확인받음(1024 추천안 채택). 매그파이 대화 턴 특성(짧은 회화 응답)에 충분하고 비용 리스크 낮음.
- 영향받는 범위: `api/claude-stream.ts`의 `MAX_TOKENS_CAP`.

### 2026-08-19 Haiku ↔ Sonnet 모델 전환 방식

- 배경/문제: PRD 5장/8장은 "개발·테스트는 haiku, 최종 데모 캡처는 sonnet-5로 전환"이라고만 되어 있고, 전환을 누가/어떻게 트리거하는지(클라이언트 요청값 vs 배포 설정)는 미지정. 처음엔 클라이언트가 매 요청마다 `model` 필드로 선택하는 방식으로 구현했었음.
- 검토한 대안: (A) 클라이언트가 요청 바디의 `model` 필드로 선택(allowlist로 제한), (B) 서버 환경변수(`CLAUDE_MODEL`)로만 고정, 클라이언트는 선택 불가.
- 결정: (B) 서버 환경변수 방식으로 변경.
- 이유: 사람 확인받음. PRD의 "전환"은 배포 시점에 사람이 바꾸는 스위치 개념에 더 가깝고, 클라이언트가 모델을 선택하게 하면 비용 통제 원칙(8장)과 충돌할 여지(프론트가 매번 비싼 sonnet-5를 요청할 수 있음)가 있음.
- 영향받는 범위: `api/claude-stream.ts`(모델 결정 로직), `env.example`(`CLAUDE_MODEL` 변수 문서화). 이후 `src/api/claudeProxy.ts`(클라이언트 호출부) 작성 시 요청 바디에 `model` 필드를 넣지 않아야 함.

### 2026-08-19 어댑터 인터페이스 파일 위치 (사람 확인 없이 결정 — 낮은 리스크 판단)

- 배경/문제: ARCHITECTURE.md의 "폴더 구조 제안"은 구현체 파일 위치(`speech-input/WebSpeechInputEngine.ts` 등)만 제시하고, 인터페이스 타입 선언 자체를 어디에 둘지는 명시하지 않음. 이번 단계는 구현체 없이 타입만 정의하는 단계.
- 검토한 대안: (A) `src/adapters/types.ts` 단일 파일에 3개 인터페이스 모두 선언, (B) `speech-input/types.ts` 등 하위 폴더별로 분리.
- 결정: (A) 단일 파일.
- 이유: ARCHITECTURE.md 원문도 인터페이스 3개를 한 코드 블록에 묶어서 제시함. 구현체가 없는 지금 단계에서 폴더를 먼저 쪼개는 건 과설계. Day 3에서 구현체를 추가할 때 폴더 구조 제안대로 `speech-input/`, `speech-output/`, `reminder/` 하위에 구현 파일을 넣으면 됨 (필요하면 그때 타입도 같이 옮길 수 있음).
- 영향받는 범위: `src/adapters/types.ts`. 되돌리기 쉬움(파일 이동뿐이라 리스크 낮다고 판단해 사람에게 먼저 묻지 않음) — 이견 있으면 알려주면 바로 조정.

### 2026-08-24 `NotificationSetup` 세부 UI/저장 방식 3종

- 배경/문제: PRD 6장 컴포넌트 목록엔 `NotificationSetup`이 "시간 설정, 권한 요청, 권한 상태별 안내"라고만 되어 있고, (1) 시간 입력 UI 형태, (2) 알림 시간 값의 저장 방식(새로고침 후 유지 여부), (3) `BrowserNotificationEngine.schedule()`이 이번 단계에서 실제 `new Notification()`까지 생성해야 하는지는 명시돼 있지 않음.
- 검토한 대안: (1) `<input type="time">` vs 시/분 개별 `<select>` vs 자유 텍스트 입력. (2) `localStorage` vs `sessionStorage`(브라우저 재시작 시 소실) vs 컴포넌트 로컬 state만(새로고침 시 초기화). (3) `schedule()`이 타이머+실제 알림 생성까지 담당 vs 타이머만 담당(알림 생성은 다음 단계).
- 결정: (1) `<input type="time">`. (2) `localStorage`. (3) 타이머만 담당, 실제 알림 생성은 다음 단계로 분리.
- 이유: 사람 확인받음. (1) 네이티브 컴포넌트라 접근성 구현이 따로 필요 없고 이 PoC 스코프에서 커스텀 스타일링이 우선순위가 아님. (2) "새로고침 후에도 유지"가 요구사항이면 브라우저 재시작까지 견디는 저장소는 `localStorage`뿐(Zustand persist를 쓰더라도 내부적으로 동일). (3) "타이머"와 "알림 표시"를 분리해두면 어댑터 인터페이스가 최소 책임만 지고, 실제 표시 방식(SW vs 페이지)을 나중에 따로 결정할 수 있음.
- 영향받는 범위: `src/components/NotificationSetup/NotificationSetup.tsx`, `src/adapters/reminder/BrowserNotificationEngine.ts`.

### 2026-08-24 알림을 실제로 그리는 방식: SW `showNotification()` 단일 경로

- 배경/문제: PRD 5장/7장은 "Notification API + Service Worker"를 세트로 확정 스택에 넣었지만, 실제 호출 방식(페이지에서 직접 `new Notification()` vs SW의 `registration.showNotification()`)은 명시돼 있지 않음.
- 검토한 대안: (A) SW `showNotification()`만 사용. (B) 데스크톱은 `new Notification()` 직접 사용, SW가 준비돼 있을 때만 `showNotification()`으로 폴백(MDN 예제 패턴).
- 결정: (A).
- 이유: 사람 확인받음. MDN 공식 문서에 `new Notification()`은 "거의 모든 모바일 브라우저에서 `TypeError`를 던진다"고 명시돼 있고(모바일 페이지가 백그라운드에서 거의 안 돈다는 이유로 벤더가 의도적으로 막음, 바뀔 계획 없음), 이 프로젝트는 반응형/모바일을 배제하지 않음. 코드 경로 하나만 유지·테스트하는 게 두 경로를 유지하는 것보다 PoC 스코프에 맞음.
- 영향받는 범위: `src/adapters/reminder/showBrowserNotification.ts`.

### 2026-08-24 Service Worker 구축 전략: `vite-plugin-pwa`의 `injectManifest` (+ 매니페스트 미생성) — 사람 확인 없이 결정

- 배경/문제: PRD 5장은 "서비스워커 등록·매니페스트 관리는 `vite-plugin-pwa`로 단순화"라고만 되어 있고, 어떤 전략(`generateSW` 자동 생성 vs `injectManifest` 커스텀 SW)을 쓸지, PWA 설치용 매니페스트(아이콘 등)를 실제로 생성할지는 명시돼 있지 않음.
- 검토한 대안: (A) `generateSW`(Workbox가 SW를 자동 생성, 오프라인 캐싱 기본 포함) vs (B) `injectManifest`(커스텀 SW 소스 직접 작성, 프리캐시 목록은 옵션으로 제어).
- 결정: (B) `injectManifest`, `injectManifest.globPatterns: []`(오프라인 캐싱 없음), `manifest: false`(PWA 설치용 매니페스트/아이콘 미생성).
- 이유: `generateSW`는 Workbox가 SW 파일 전체를 자동 생성해서 우리가 필요한 `notificationclick` 커스텀 이벤트 리스너를 넣을 방법이 없음. 오프라인 캐싱과 PWA 설치(아이콘)는 PRD의 목표/비목표 어디에도 없고 이번 요청(SW 등록+알림 표시)과 무관해서 스코프를 넓히지 않기로 판단. 리스크가 낮고(되돌리기 쉬움, `strategies` 옵션 하나로 전환 가능) `vite-plugin-pwa` 자체는 PRD가 이미 확정한 도구라 스택 이탈이 아니라고 보고 사람에게 먼저 묻지 않았음 — 이견 있으면 알려주면 바로 조정.
- 영향받는 범위: `vite.config.ts`(`VitePWA` 옵션), `src/sw.ts`, `tsconfig.sw.json`.

### 2026-08-24 "지금 시작하기" 버튼 동작 (ConversationScreen 부재)

- 배경/문제: PRD 4장 예외 시나리오는 "알림 권한 거부/미지원 브라우저 → 대체 안내 문구 + 수동 '지금 시작하기' 버튼 제공"이라고 되어 있는데, 그 버튼이 이동해야 할 `ConversationScreen`이 아직 없음(Day 3+ 예정).
- 검토한 대안: (A) 버튼을 두고 클릭 시 "대화 화면은 아직 준비 중입니다" 같은 확인 문구만 `aria-live`로 표시. (B) 이번 단계에는 버튼 없이 안내 문구만 두고, 버튼 자체는 `ConversationScreen`이 생기는 Day 3+에 함께 추가.
- 결정: (A).
- 이유: 사람 확인받음. PRD가 요구한 버튼 자체는 지금 만들어 두고, 실제로 갈 곳이 없다는 사실은 숨기지 않고 문구로 명시 — 나중에 존재하지 않는 화면으로 조용히 이동하는 "가짜 완료"를 만들지 않기 위함.
- 영향받는 범위: `src/components/NotificationSetup/NotificationSetup.tsx`(`handleStartNow`, `START_NOW_PLACEHOLDER`). Day 3+에서 `ConversationScreen` 라우팅이 생기면 실제 네비게이션으로 교체 필요.

### 2026-08-24 `showBrowserNotification()` reject 처리 수준

- 배경/문제: `showBrowserNotification()`이 실패(예: 예약 시점엔 `granted`였는데 발사 시점 사이에 브라우저 알림 권한이 바뀐 경우, MDN 명세상 `registration.showNotification()`이 reject)할 수 있는데, 기존 코드(`void showBrowserNotification(...)`)는 이 reject를 아무도 받지 않아 unhandled promise rejection이 됐다. PRD 4장 예외 시나리오 목록엔 이 케이스가 명시돼 있지 않지만, PRD 2장 목표("모든 예외 상태가 UI로 명시적으로 처리된다")를 근거로 스코프 확장이 아니라 기존 목표를 마저 채우는 것으로 판단.
- 검토한 대안: (A) 콘솔 로그만 남기고 화면엔 아무 신호 없음. (B) 콘솔 로그 + 실패 시점에 `Notification.permission`을 다시 읽어 `permission` state 재동기화 — 권한이 실제로 바뀌었다면 이미 있는 차단 안내/"지금 시작하기" UI가 새 코드 없이 자동으로 뜸. (C) 원인 불문하고 항상 새로운 "표시 실패" 배너를 노출(재시도 여지 있는 별도 UI).
- 결정: (B).
- 이유: 사람 확인받음(재시도 로직은 이 PoC 스코프에서 과하다는 점엔 이견 없었음). (A)는 PRD 목표("모든 예외 상태가 UI로 명시적으로 처리된다")에 못 미침. (C)는 원인과 무관하게 항상 별도 UI를 노출해 과설계. (B)는 가장 현실적인 실패 원인(권한 변경)에 대해서는 이미 만들어둔 예외 시나리오 UI를 재사용해 새 코드 없이 해결하고, 그 외 드문 원인은 콘솔 로그로 충분하다고 판단.
- 영향받는 범위: `src/components/NotificationSetup/NotificationSetup.tsx`(`getCurrentPermission`, `onFire` 콜백의 `.catch()`).

### 2026-08-24 `SpeechInputEngine.start()`에 `onError` 콜백 추가 (Day 1 시그니처 변경)

- 배경/문제: Day 1에 확정된 시그니처(`start(onInterimResult, onSpeechEnd): void`)에는 에러를
  상위에 알릴 방법이 없다. 그런데 Day 3에서 실제로 구현해보니 마이크 권한 거부(`not-allowed`),
  인식 서비스 차단(`service-not-allowed`), 오디오 캡처 실패, 네트워크 오류 등은 상태머신이
  "정상적으로 말이 끝남"(`onSpeechEnd`)과 구분해서 알아야 하는 정보다(PRD 6장의 "어느 상태든
  실패 → error → (재시도) → listening" 전환과 직결). 시그니처를 임의로 바꾸지 않고 먼저 확인.
- 검토한 대안: (A) `onError` 콜백 추가로 시그니처 확장. (B) 시그니처 유지, 에러 시에도
  `onSpeechEnd`만 호출(상태머신이 에러와 정상 종료를 구분 못 함). (C) 이번 단계는 구현체만
  만들고 에러 전파 설계는 다음 단계로 미룸.
- 결정: (A).
- 이유: 사람 확인받음. PRD가 이미 "에러 → error 상태"라는 명확한 요구사항을 갖고 있어서(B)는
  요구사항 미달. 에러 정보를 담는 타입(`SpeechInputError` / `SpeechInputErrorReason`)은 브라우저의
  `SpeechRecognitionErrorCode`를 그대로 노출하지 않고 어댑터가 번역한 값만 노출 — 7장 어댑터
  분리 원칙(로직 레이어가 어댑터 구현체를 몰라야 함)을 그대로 유지.
- 영향받는 범위: `src/adapters/types.ts`(`SpeechInputEngine`/`SpeechInputError`/`SpeechInputErrorReason`
  신설), `docs/rules/PRD.md` 7장, `docs/rules/ARCHITECTURE.md` 인터페이스 계약, 향후 상태머신
  구현 시 `onError` 처리 필요.

### 2026-08-24 `WebSpeechInputEngine` feature detection 기준: 생성자 존재 여부만 체크 (UA 스니핑 안 함)

- 배경/문제: PRD 4장은 "연속 음성인식 미지원 브라우저(Safari 등)"를 텍스트 폴백 대상으로 명시한다.
  그런데 실제로 확인해보니(MDN, WebKit/web-speech-api 이슈, Apple 커뮤니티 포럼) Safari는
  `webkitSpeechRecognition` 생성자 자체는 존재하고, `continuous: true`에서 마이크가 멈추지
  않거나 결과가 아예 안 오는 **런타임 버그**만 있다 — API 부재가 아니다. PRD 문구를 문자 그대로
  따르려면 UA 스니핑으로 Safari를 미리 배제해야 하는데, 이는 표준 feature-detection과 다른
  접근이라 임의로 정하지 않고 확인.
- 검토한 대안: (A) 표준 방식 — 생성자 존재 여부만 체크, Safari도 "지원함"으로 판정하고 실제
  시도. (B) PRD 문구대로 — 생성자 체크에 더해 Safari를 UA로 감지해 강제로 "미지원" 처리.
- 결정: (A).
- 이유: 사람 확인받음. UA 스니핑은 브리틀하고(Safari 버전마다 실제 버그 유무가 다를 수 있고,
  Apple이 버그를 고치면 근거 없이 계속 차단하게 됨) 안티패턴으로 알려져 있음. 또한 Edge(Chromium)도
  이론상 지원해야 하지만 실제 동작에 대한 논쟁(`mdn/browser-compat-data#22126`, 미해결)이 있어,
  "이름으로 브라우저를 판별"하는 접근 자체가 이번 생태계에서 신뢰하기 어렵다고 판단.
- 영향받는 범위: `src/adapters/speech-input/WebSpeechInputEngine.ts`(`isSpeechInputSupported`).
  **알려진 한계**: Safari/Edge에서 생성자는 있지만 런타임에 조용히 실패하는 경우, 이번 단계
  범위(feature detection)로는 못 잡는다 — 무음 타이머·재시도 로직을 만드는 다음 단계에서 실제
  브라우저로 재검증 필요 (`docs/rules/ARCHITECTURE.md`의 `WebSpeechInputEngine` 메모 참고).

### 2026-08-24 무음 타이머(~1.2초) 로직의 위치: 로직 레이어(상태머신을 감싸는 hook)

- 배경/문제: ARCHITECTURE.md는 "무음 감지 후 턴 전환 규칙"을 로직 레이어로 분류해뒀지만,
  "무음을 측정하는 타이머" 자체를 어디에 둘지는 명시돼 있지 않았다. `WebSpeechInputEngine`
  내부(어댑터)에 둘 수도 있고, 상태머신 쪽(로직 레이어)에 둘 수도 있어 임의로 정하지 않고 확인.
- 검토한 대안: (A) 로직 레이어 — `onInterimResult` 콜백만 소비하는 순수 디바운스 타이머를
  상태머신을 감싸는 hook(`useConversationMachine`)에 둠. (B) `WebSpeechInputEngine` 내부 —
  엔진이 직접 1.2초를 알고 타이밍을 결정.
- 결정: (A).
- 이유: 사람 확인받음. 타이머가 브라우저 API를 전혀 참조하지 않는 순수 알고리즘이라
  로직 레이어에 두는 게 자연스럽고, PRD 3장 "mock 구현으로 교체해도 상태머신이 무변경으로
  동작" 검증 기준과 정확히 부합(mock 엔진이 `onInterimResult`만 호출해주면 그대로 재사용/
  테스트 가능). "1.2초"라는 제품 UX 상수가 특정 플랫폼 어댑터에 박히지 않아 네이티브 전환
  시(`RNVoiceInputEngine`)에도 동일 로직 재사용 가능.
- 영향받는 범위: `src/state-machine/silenceTimer.ts`(순수 타이머), `src/state-machine/useConversationMachine.ts`
  (엔진 + reducer + 타이머 배선). `WebSpeechInputEngine`은 변경 없음.

### 2026-08-24 무음(=발화 종료) 판단 기준: 커스텀 디바운스 타이머 (브라우저 네이티브 `speechend` 미사용)

- 배경/문제: `WebSpeechInputEngine`은 이미 브라우저의 네이티브 `speechend` 이벤트를
  `onSpeechEnd`로 전달하고 있어, 이를 그대로 "무음 감지" 신호로 쓸 수도 있었다. 하지만 MDN에
  `speechend`의 정확한 타이밍이 명시돼 있지 않고(PRD가 요구하는 "~1.2초"를 보장 못 함),
  Safari에서는 이 이벤트 자체가 신뢰 안 된다는 것을 지난 단계에서 확인했었다 — 무엇을 "무음"의
  근거로 삼을지 임의로 정하지 않고 확인.
- 검토한 대안: (A) 커스텀 디바운스 — `onInterimResult`가 호출될 때마다 1200ms 타이머를 리셋,
  타이머가 끝까지 살아남으면 무음으로 판단. (B) 브라우저 네이티브 `speechend` 이벤트를 그대로
  무음 신호로 사용.
- 결정: (A).
- 이유: 사람 확인받음. PRD가 명시한 구체적 수치(~1.2초)를 지킬 수 있는 유일한 방법이고,
  브라우저/엔진 구현 편차(Safari 버그, Edge 지원 논쟁)를 전부 우회한다. "텍스트가 안 바뀜"이
  "실제로 말을 멈춤"과 완전히 같지 않아 오탐(false cutoff) 가능성은 있지만, 이는 PRD 4장이
  이미 알고 있고 "이어서 말하기" 버튼(다음 단계 범위)으로 완화하기로 설계된 리스크임.
- 영향받는 범위: `src/state-machine/silenceTimer.ts`, `src/state-machine/useConversationMachine.ts`.
  `onSpeechEnd`(네이티브 `speechend`)는 계속 전달만 받되 상태 전환에는 쓰지 않고 참고용
  콘솔 로그로만 남김.

### 2026-08-24 대화 상태머신(`useReducer`) 범위: 오늘 실제로 쓰이는 5개 상태만 구현

- 배경/문제: PRD 6장은 assistant_speaking/listening/user_speaking/sending/streaming/error
  6개 상태를 정의하지만, streaming(LLM 응답 수신)과 assistant_speaking(TTS 재생)은 아직
  어댑터(LLM 스트리밍 클라이언트는 Day 4, `SpeechOutputEngine` 구현체는 Day 5)가 없어 지금
  만들면 실제로 도달·테스트되지 않는 상태가 된다 — 상태머신을 이번 단계에서 얼마나 만들지
  임의로 정하지 않고 확인.
- 검토한 대안: (A) 오늘 실제로 배선되는 상태만 — idle/listening/user_speaking/sending/error
  5개. (B) PRD 6장 6개 상태 타입을 지금 다 정의해두고, streaming/assistant_speaking은 타입만
  있고 실제로 도달하지 않는 상태로 남김.
- 결정: (A).
- 이유: 사람 확인받음. CLAUDE.md의 "No half-finished implementations"·"design for hypothetical
  future requirements 금지" 원칙에 부합 — 지금 당장 아무도 못 보내는 상태를 미리 만들어두는
  건 미완성 코드를 완성된 것처럼 남겨두는 것과 같다고 판단. Day 4(LLM 스트리밍)에서 sending →
  streaming, Day 5(TTS)에서 streaming → assistant_speaking → listening을 추가할 때
  `conversationReducer`를 확장하면 됨 — reducer는 이벤트별 switch 구조라 상태 추가가
  기존 케이스에 영향을 주지 않음.
- 영향받는 범위: `src/state-machine/types.ts`(`ConversationStatus`), `src/state-machine/conversationReducer.ts`.
  Day 4~5에서 상태/이벤트 추가 예정.

### 2026-08-24 `unspokenPunctuation`(실험적 구두점 추론) 활성화

- 배경/문제: 실기기로 무음 타이머를 테스트하던 중, 말끝을 올려 질문으로 말해도 인식 텍스트에
  "?"가 안 붙는다는 걸 발견. 확인해보니 Web Speech API의 `SpeechRecognition`에
  `unspokenPunctuation`이라는 속성이 있고(Chrome 151+, MDN에 "Experimental"로 표시, 호환성
  표는 비어 있음), 기본값이 `false`라서 우리가 켜지 않는 한 구두점이 전혀 안 붙는다는 걸 확인.
  GitHub explainer(`WebAudio/web-speech-api`)엔 "자연스러운 멈춤 + 문법 구조" 기반이라고만
  나와 있고, 억양(피치)을 직접 분석한다는 근거는 못 찾음 — 확실치 않은 부분은 과장하지 않고
  사람에게 그대로 전달한 뒤 켤지 확인.
- 검토한 대안: (A) `recognition.unspokenPunctuation = true`로 켠다. (B) 안 켠다(PRD가 구두점
  추론을 요구한 적 없어 범위 밖으로 볼 수도 있음).
- 결정: (A).
- 이유: 사람 확인받음. 미지원 브라우저에서 존재하지 않는 프로퍼티에 값을 대입하는 것뿐이라
  에러 없이 조용히 무시되는 안전한 설정이라 리스크가 낮음. 다만 Experimental 기능이라 물음표가
  기대만큼 안 잡힐 수 있다는 점은 사람에게 미리 전달함.
- 영향받는 범위: `src/adapters/speech-input/WebSpeechInputEngine.ts`(`recognition.unspokenPunctuation
  = true`), `src/adapters/speech-input/webSpeechRecognition.d.ts`(타입 선언 추가).
- **실기기 재확인 결과(2026-08-24, 사람이 직접 크롬에서 테스트)**: 켜도 실제로는 "?"가 안
  붙음 — 우려했던 대로 Experimental 기능이 기대만큼 동작하지 않는 사례로 확인됨. 중요도가
  낮다고 판단해(사람 확인) 코드는 그대로 두고(무해한 설정이라 되돌릴 이유 없음) 더 이상 파고들지
  않기로 함.

### 2026-08-25 Day 4: `assistant_speaking` 상태를 이번 단계에서 제외

- 배경/문제: PRD 6장 상태머신은 `streaming → assistant_speaking → listening`인데, TTS
  (`SpeechOutputEngine`)는 Day 5에나 생긴다. `assistant_speaking`을 이번에 만들면 "TTS 없이
  즉시 통과시킬지, 별도로 대기시킬지"를 정할 근거 자체가 없는 상태가 된다.
- 검토한 대안: (A) 이번엔 만들지 않고 `streaming → listening`으로 직결(Day 5에서 TTS 어댑터가
  생길 때 `assistant_speaking`을 끼워 넣는다). (B) `assistant_speaking`을 미리 추가하되 TTS 없이
  즉시(동기적으로) `listening`으로 통과시킨다(Day 5엔 "즉시 통과"를 "TTS onEnd 대기"로 바꾸기만
  하면 됨).
- 결정: (A).
- 이유: 사람 확인받음(Day 3에서 `assistant_speaking`/`streaming`을 함께 보류했던 것과 같은
  논리 — 아직 안 생긴 어댑터를 위해 상태만 미리 만들면 실제로 도달·검증되지 않는 상태가 된다).
- 영향받는 범위: `src/state-machine/types.ts`(`ConversationStatus`), `conversationReducer.ts`
  (`STREAM_DONE`이 바로 `listening`으로 전이).

### 2026-08-25 Day 4: 대화 히스토리 윈도잉 N = 3턴

- 배경/문제: PRD 8장 "최근 N턴만 윈도잉"이라는 원칙만 있고 N의 구체적 숫자는 미지정.
- 검토한 대안: 3턴(메시지 6개) vs 5턴(메시지 10개).
- 결정: 3턴로 시작, 실사용 테스트해보고 필요하면 5턴으로 올리기로 함(사람이 명시적으로 "일단
  3턴으로 여러 번 테스트해보고 추후 5턴 변경 가능하냐"고 확인 후 결정).
- 이유: 짧은 회화 데모 특성상 3턴이면 최근 맥락은 충분히 유지되고, 비용 통제(PRD 8장) 원칙에
  가장 유리한 하한값. `HISTORY_WINDOW_TURNS` 상수 하나만 바꾸면 되도록 구현해 변경 비용을
  낮춰둠.
- 영향받는 범위: `src/state-machine/useConversationMachine.ts`(`HISTORY_WINDOW_TURNS` 상수).

### 2026-08-25 Day 4: 로컬 개발 중 `/api/claude-stream` 연결 방식 — Vite proxy + 로컬 서버 스크립트

- 배경/문제: `npm run dev`(Vite)는 `api/claude-stream.ts`(Vercel Serverless Function)를 직접
  서빙하지 못한다. 실제 브라우저에서 스트리밍을 확인하려면 이 경로를 어떻게든 연결해야 하는데,
  Day 1에서 "Vercel 계정 연동 없이 검증"이라는 원칙을 이미 세워둔 상태였다.
- 검토한 대안: (A) Day 1의 `verify-claude-stream.ts` 패턴을 재사용해 상주형 로컬 서버
  (`scripts/dev-api-server.ts`)를 띄우고 `vite.config.ts`의 `server.proxy`로 `/api`를 그쪽으로
  중계 — 새 도구 설치 없음, 터미널 2개 필요. (B) Vercel CLI(`vercel dev`) 도입 — 공식 도구지만
  Vercel 계정 로그인/프로젝트 연동이 지금 당장 필요해짐. (C) 로직만 결정론적으로 검증하고 브라우저
  실연결은 배포 시점으로 미룸 — 이번 Day의 목표("실제로 스트리밍이 되는지 확인") 자체를 못 채움.
- 결정: (A).
- 이유: 사람 확인받음. Day 1에서 이미 세운 "계정 연동은 실제 배포 시점(Day 6~7)에만"이라는
  원칙과 일관되고, 새 의존성이 없으며, `api/claude-stream.ts`는 이미 Vercel 파일 규칙을 그대로
  따르고 있어 로컬 개발 방식과 무관하게 나중 배포에 영향이 없다.
- 영향받는 범위: `scripts/dev-api-server.ts`(신규, 배포 대상 아님), `vite.config.ts`
  (`server.proxy`), `package.json`(`dev:api` 스크립트).

### 2026-08-25 Day 4: LLM 스트리밍 에러도 `SpeechInputError` 타입 재사용

- 배경/문제: `claudeProxy.ts`의 스트리밍 실패(네트워크 끊김, 서버 에러 이벤트, HTTP 실패)를
  상태머신에 알릴 때 쓸 에러 타입이 필요했다. `ConversationMachineState.error`는 이미
  `SpeechInputError | null` 하나뿐이다.
- 검토한 대안: (A) `SpeechInputError`를 그대로 재사용(`ClaudeStreamError`가 이 인터페이스를
  구현). (B) `LlmStreamError`라는 별도 타입을 새로 만들고 `state.error`를 유니온 타입으로 확장.
- 결정: (A).
- 이유: 사람 확인 없이 결정(낮은 리스크로 판단) — `SpeechInputErrorReason`에 이미 이 목적에
  맞는 `'network'`/`'unknown'`/`'aborted'`가 있어 새 taxonomy가 필요하지 않았고, `state.error`를
  유니온으로 쪼개면 화면 쪽에서 "이게 마이크 에러인지 LLM 에러인지"를 매번 구분해야 해서 이번
  단계(임시 디버그 UI)엔 과함. 되돌리기 쉬운 결정이라 이견 있으면 바로 조정 가능.
- 영향받는 범위: `src/api/claudeProxy.ts`(`ClaudeStreamError` 클래스).

### 2026-08-25 `ErrorBanner`의 "재시도" 동작 — 자동 재전송 없이 idle로만 복귀

- 배경/문제: PRD 4장 "네트워크 끊김/API 오류 → 재시도 버튼, 에러 메시지"에서 "재시도"가 (A)
  실패했던 요청을 자동으로 다시 보내는 것인지, (B) 상태머신을 정상 상태로 되돌려 사용자가 직접
  다시 시도하게 하는 것인지 명시돼 있지 않음.
- 검토한 대안: (A) 마지막으로 실패한 사용자 메시지를 기억해뒀다가 재시도 클릭 시 자동 재전송.
  (B) `stop()`(엔진/스트림 정리 + `RESET` 디스패치)을 그대로 재사용해 idle로만 되돌리고, 마이크는
  "마이크 테스트 시작"을, 텍스트는 다시 입력해서 사용자가 직접 재전송.
- 결정: (B).
- 이유: 사람 확인 없이 결정(낮은 리스크, 되돌리기 쉬움) — 자동 재전송은 사용자가 모르는 사이에
  API 호출이 한 번 더 나가는 것이라 비용 통제 원칙(PRD 8장)과 "무슨 일이 일어나는지 명시적으로
  보여준다"는 프로젝트 기조에 안 맞다고 판단. `stop()`이 이미 엔진 정지/스트림 abort/RESET을
  전부 처리해주고 있어 재사용만으로 충분했음.
- 영향받는 범위: `src/components/ConversationScreen/ErrorBanner.tsx`(`onRetry` prop),
  `src/components/SpeechInputDemo/SpeechInputDemo.tsx`(`onRetry={stop}`).
- **부수적으로 발견해 함께 고친 버그**: 텍스트 폴백 모드에서 LLM 스트리밍 에러가 나 `error`
  상태가 되면, 리듀서가 `error` 상태에서의 `TEXT_SUBMITTED`를 무시하도록 되어 있어(불가능한
  전이 차단 규칙) 사용자가 다시 입력해도 아무 반응이 없었다 — 복구 수단이 전무했던 잠재
  버그. `ErrorBanner`의 재시도 버튼이 `stop()`으로 idle로 되돌려 이 경로를 함께 복구함.
