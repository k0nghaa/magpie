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

### 2026-08-25 Day 5: `assistant_speaking` 상태 추가 (Day 4 결정 뒤집음)

- 배경/문제: Day 4에서 "TTS 어댑터가 없어 `assistant_speaking`을 이번엔 제외"로 결정했었는데
  (위 2026-08-25 Day 4 항목), Day 5에서 `WebSpeechSynthesisEngine`이 생겨 그 전제가 사라졌다.
- 결정: `streaming --STREAM_DONE--> assistant_speaking --ASSISTANT_SPEECH_DONE--> listening`으로
  확장. `STREAM_DONE`의 목적지를 `listening`에서 `assistant_speaking`으로 바꾸고, 새 이벤트
  `ASSISTANT_SPEECH_DONE`을 추가.
- 이유: PRD 6장 원안 그대로. Day 4 결정문의 "아직 안 생긴 어댑터를 위해 상태만 미리 만들지
  않는다"는 원칙과 정확히 반대 상황(이제 어댑터가 생겼다)이라 자연스럽게 뒤집힘.
- 영향받는 범위: `src/state-machine/types.ts`, `conversationReducer.ts`,
  `scripts/verify-silence-timer-logic.ts`(회귀 케이스 추가).

### 2026-08-25 Day 5: 마이크 mute를 새 인터페이스 메서드 없이 기존 `stop()`/`start()` 재호출로 구현

- 배경/문제: TTS 재생 중 마이크가 자기 음성을 인식하는 에코를 막아야 한다(PRD 4장). 일반적인
  구현은 `SpeechInputEngine`에 `pause()`/`resume()` 메서드를 추가하는 것이지만, 사람이 먼저
  "Day 1 인터페이스 시그니처 변경 없이, 기존 `stop()`/`start()` 재호출만으로 하라"고 스코프를
  확정해서 시작함(대안 검토 없이 확정 지시).
- 결정: `assistant_speaking` 진입 시 `engineRef.current?.stop()` → TTS 재생 → `onEnd`에서
  `engineFactory()`로 **새 엔진 인스턴스**를 만들어 `start()` — 직전 continuous 세션을 이어받지
  않고 항상 새 세션으로 마이크가 재개된다.
- 이유: 사람이 이미 확정한 스코프. 부수 효과(새 세션이라 `transcript`도 함께 초기화됨)는
  다음 사용자 턴이 시작되는 시점이라 문제 없다고 판단.
- 영향받는 범위: `src/state-machine/useConversationMachine.ts`(`beginListeningEngine`,
  `playAssistantSpeech`).

### 2026-08-25 Day 5: `WebSpeechSynthesisEngine`에 인터페이스 밖 `cancel()` 메서드 추가 (사람 확인 없이 결정)

- 배경/문제: 수동 "중지/초기화" 버튼을 누르거나 언마운트될 때, TTS가 재생 중이면 즉시 멈춰야
  한다. 그런데 Day 1 `SpeechOutputEngine` 인터페이스엔 `speak(text, onEnd)`만 있고 취소 메서드가
  없다 — 인터페이스를 확장할지, 인터페이스 밖의 구현체 전용 메서드로 둘지 선택 필요.
- 검토한 대안: (A) `SpeechOutputEngine` 인터페이스에 `cancel()`을 추가(mock 구현체도 전부 이
  메서드를 가져야 함). (B) `WebSpeechSynthesisEngine` 클래스에만 `cancel()`을 추가하고,
  호출부는 `(engine as SpeechOutputEngine & { cancel?(): void })`로 옵셔널하게만 호출.
- 결정: (B).
- 이유: 사람 확인 없이 결정(낮은 리스크, 되돌리기 쉬움) — 이번 작업 지시 자체가 "Day 1 인터페이스
  시그니처 변경 없음"이었고, `cancel()`은 재생 중 취소라는 부가 기능이라 인터페이스 계약(모든
  구현체가 지켜야 할 최소 계약)에 넣을 필요가 없다고 판단. 옵셔널 체이닝으로 구현체가 없으면
  조용히 넘어가 mock 구현체에 부담을 주지 않는다.
- 영향받는 범위: `src/adapters/speech-output/WebSpeechSynthesisEngine.ts`(`cancel()`),
  `src/state-machine/useConversationMachine.ts`(`cancelTtsPlayback()`).

### 2026-08-25 Day 5: LLM에 system 프롬프트 추가 (스몰토크 스타일 강제) — 사람 지시로 결정

- 배경/문제: Day 5 실제 브라우저 검증 중, TTS 재생이 종종 끝나지 않고 멈추는 문제를 발견했다.
  원인을 추적해보니 Chromium의 알려진 버그(이슈 41294170/679437, "약 15초 후 장문 재생이
  아무 이벤트 없이 멈춤")였고, 표준 우회법(주기적 `resume()` 호출)을 적용해도 이 환경에서는
  간헐적으로만 효과가 있었다. 근본 원인을 더 파보니 애초에 `claudeProxy.ts`/`api/claude-stream.ts`
  둘 다 `system` 필드를 이미 지원하는데 호출부(`useConversationMachine.ts`)가 한 번도 채워
  보낸 적이 없어서, Claude가 기본값대로 목록·마크다운 위주의 긴 "문서형" 답변을 하고 있었다.
  사람에게 상황을 그대로 보고했더니 "회화 앱인데 응답이 길고 회화처럼 안 느껴진다, 스몰토크
  위주로 짧게 갔으면 좋겠다"는 지시를 받음.
- 결정: `SYSTEM_PROMPT` 상수(1~3문장, 목록/마크다운 금지, 실시간 정보 모름을 짧게 인정, 가끔
  되물음)를 만들어 `streamClaudeResponse` 호출 시 `system`으로 전달.
- 이유: 사람 지시. PRD 1장의 핵심 루프("아침 10분 스몰토크")와도 정확히 일치하고, 응답이
  짧아지면 TTS 재생 시간도 줄어 위 Chromium 버그를 실질적으로 덜 건드리게 되는 부수 효과도
  확인(실제 재검증: 66자/53자/42자 응답 3턴 모두 TTS 끝까지 재생 후 정상적으로 `listening`
  복귀). 다만 이 버그 자체가 완전히 해결된 것은 아니고(짧아서 안 걸릴 확률이 낮아졌을 뿐),
  아주 긴 응답이 우연히 나오면 여전히 재현될 수 있다는 점은 남아있는 리스크로 기록.
- 영향받는 범위: `src/state-machine/useConversationMachine.ts`(`SYSTEM_PROMPT`,
  `runSendCycle`의 `streamClaudeResponse` 호출). 부수 효과: 지금까지 미사용이었던 서버의
  프롬프트 캐싱 경로(`api/claude-stream.ts`의 `cache_control: ephemeral`)가 이번에 처음으로
  실제 사용됨(CLAUDE.md 8장 비용 통제 원칙 2번).

### 2026-08-25 PRD 4장 Happy Path 3번: 첫 인사말을 고정 문구로 (LLM 실시간 생성은 추후 전환)

- 배경/문제: PRD 4장 Happy Path 3번은 "대화 화면 진입, 인사말과 첫 질문이 스트리밍 텍스트 +
  TTS 음성으로 자동 출력된다"고만 되어 있고, 이 첫 메시지를 매번 LLM에 실시간으로 생성시킬지,
  고정된 문구 풀에서 고를지는 명시돼 있지 않다.
- 검토한 대안: (A) 화면 진입 시마다 LLM에 "인사말+질문 하나 만들어줘" 요청을 보내 실시간
  생성. (B) 미리 준비한 고정 문구 몇 개 중 하나를 무작위로 선택.
- 결정: (B), **이번 스프린트 한정 스코프**. 이번 스프린트 이후(PoC 범위 밖) 매번 LLM에게
  실시간으로 인사말/질문을 생성하도록 전환할 예정.
- 이유: 사람 확인받음(속도/재현성 우선). (A)는 화면 진입마다 추가 API 호출과 지연이 생기고,
  데모/테스트 때마다 다른 문구가 나와 재현성이 떨어진다. (B)는 즉시 표시 가능하고 결정론적이라
  데모·자동화 검증 모두에 유리하다. 고정 문구라도 `SYSTEM_PROMPT`와 같은 톤(1~3문장, 목록/
  마크다운 없음)으로 맞춰 두면 이후 (A)로 전환할 때 위화감이 없다.
- 영향받는 범위: `src/state-machine/useConversationMachine.ts`(`FIXED_GREETINGS`, `greet()`),
  `src/state-machine/types.ts`/`conversationReducer.ts`(`GREETING_STARTED` 이벤트,
  `idle → assistant_speaking` 전이 추가). **되돌릴 때 변경 범위**: `greet()`의 문구 선택 부분만
  실제 `streamClaudeResponse` 호출로 바꾸면 되고, 상태머신/`ConversationScreen`은 무변경
  (`GREETING_STARTED`를 실시간 생성 완료 시점에 그대로 재사용 가능).

### 2026-08-25 PRD 4장 Happy Path 9번: 종료 후 이동 — App.tsx에 화면 전환 상태 추가

- 배경/문제: "수동 종료 버튼으로 세션을 마친다"고만 되어 있고 종료 후 어디로 가는지는
  PRD에 없다. 게다가 지금까지 `App.tsx`는 `NotificationSetup`과 `ConversationScreen`을 항상
  같이 렌더링하고 있어(Day 2부터 이어진 임시 배치 방식), 실제 화면 전환/라우팅 자체가 없었다.
- 검토한 대안: (A) `App.tsx`에 `useState<'setup'|'conversation'>` 화면 전환 상태를 추가해 한
  번에 한 화면만 렌더링. 종료 시 `setup`으로 복귀, `NotificationSetup`의 "지금 시작하기"·
  대화 화면 진입 시 `conversation`으로 전환. (B) 지금 구조를 유지하고 "종료"는 대화 상태만
  `idle`로 리셋(화면 이동 없음).
  트레이드오프를 사람에게 설명(재진입=재마운트이므로 Happy Path 3번의 "화면 진입 시 자동
  인사말"과도 자연스럽게 맞물린다는 점, (B)는 화면 이동이라는 개념 자체가 없어져 이번 요청의
  취지를 못 채운다는 점)한 뒤 확인받음.
- 결정: (A).
- 이유: 사람 확인받음(트레이드오프 설명 후 (A) 선택). 라우터 라이브러리 없이 상태 하나로
  충분하다고 판단(URL 딥링크 요구사항 없음, 화면 2개뿐) — 과설계 방지. 부수적으로
  `NotificationSetup`의 "지금 시작하기" placeholder(Day 2 결정, "Day 3+에서 실제 네비게이션으로
  교체 필요"로 이미 예고돼 있었음)도 이번에 실제 연결로 교체.
- 영향받는 범위: `src/App.tsx`(`screen` state), `src/components/NotificationSetup/NotificationSetup.tsx`
  (`onStartConversation` prop, `START_NOW_PLACEHOLDER` 제거), `src/components/ConversationScreen/ConversationScreen.tsx`
  (`onEnd` prop). **범위 밖으로 남긴 것**: 실제 브라우저 알림(OS 알림) 클릭 시 이 화면 전환
  상태로 연결하는 것은 Service Worker↔페이지 메시징이 추가로 필요해 이번엔 포함하지 않음
  (`src/sw.ts`의 `notificationclick`은 여전히 루트만 엶 — 기존에도 알려진 제한).

### 2026-08-25 SW↔페이지 메시징으로 "알림 클릭 → 대화 화면 자동 진입" 연결 (위 항목의 범위 밖 사유 해소)

- 배경/문제: Vercel 배포본에서 실사용 테스트 중 발견 — 지정 시각에 브라우저 알림은 뜨지만
  클릭해도 대화 화면으로 넘어가지 않음(PRD 4장 Happy Path 3번 미충족). 원인은 바로 위 항목에서
  범위 밖으로 남긴 대로 `src/sw.ts`의 `notificationclick`이 탭 focus/openWindow만 하고
  `App.tsx`의 화면 상태(`screen`)로 신호를 보내지 않기 때문— 새 버그가 아니라 이미 알고
  있던 미구현 항목.
- 검토한 대안: (A) 지금 구현 (B) Day 6~7 축소 스코프에 없던 항목이므로 이번엔 스킵하고 성능
  작업 먼저 진행 (C) 기록만 남기고 결정은 나중으로. 세 가지를 사람에게 제시.
- 결정: (A). 사람 확인받음 — PRD 4장 핵심 Happy Path에 해당해 성능 작업보다 먼저 고침.
- 구현: 이미 열려 있는 탭엔 SW가 `existing.postMessage({type: 'OPEN_CONVERSATION'})`을 보내고
  `App.tsx`가 `navigator.serviceWorker`의 `message` 이벤트로 받아 `setScreen('conversation')`.
  새로 여는 탭은 아직 페이지의 message 리스너가 마운트되기 전이라 postMessage가 유실될 수 있어
  대신 `self.clients.openWindow('/?screen=conversation')`으로 열고, `App.tsx`가 mount 시
  `URLSearchParams`로 이 쿼리를 읽어 초기 화면을 바로 `conversation`으로 결정.
- 검증: `vite build`(tsc 포함, SW injectManifest 빌드 포함) 통과. `vite preview` + Playwright로
  두 경로 모두 실행 확인 — ①`/?screen=conversation` 직접 진입 시 setup 화면 없이 대화 화면만
  렌더 ②setup 화면에서 SW `message` 이벤트(`OPEN_CONVERSATION`) 수신 시 대화 화면으로 전환.
- 영향받는 범위: `src/sw.ts`(`notificationclick`), `src/App.tsx`(`getInitialScreen()`,
  `message` 리스너 추가).

### 2026-08-25 `beginListeningEngine()`에 `isSpeechInputSupported()` 가드 추가 — 부수 발견 버그 수정

- 배경/문제: Happy Path 3번(자동 인사말) 구현 중 발견 — 인사말이든 일반 응답이든 TTS 재생이
  끝나면(`playAssistantSpeech`의 `onEnd`) 항상 `beginListeningEngine()`을 호출해 마이크를
  재시작하려 했는데, 이 함수는 브라우저가 음성 인식을 지원하는지 확인하지 않았다. 즉 텍스트
  폴백 모드(미지원 브라우저)에서도 TTS가 끝날 때마다 `WebSpeechInputEngine.start()`가 불려
  즉시 `unsupported` 에러를 내고 상태가 `error`로 튕기는 잠재 버그가 Day 5 때부터 있었다(Day 5
  검증은 가짜 `SpeechRecognition`으로 "지원함"을 재현했기 때문에 이 경로를 안 건드려 못 잡았음).
- 결정: `beginListeningEngine()` 맨 앞에 `if (!isSpeechInputSupported()) return` 가드 추가.
- 이유: 사람 확인 없이 결정(명백한 버그 수정, 낮은 리스크) — 텍스트 폴백 모드는
  `TextInputFallback`의 제출이 곧 다음 턴 트리거라 마이크 엔진이 애초에 필요 없고, 상태는
  이미 호출자가 `listening`으로 전환해둔 상태라 이 가드만 추가해도 아무 부작용이 없다.
- 영향받는 범위: `src/state-machine/useConversationMachine.ts`(`beginListeningEngine`).

### 2026-08-25 "대화 종료" 버튼을 상태와 무관하게 항상 활성화 — 사람 확인 없이 결정

- 배경/문제: 화면 전환이 생기면서 "대화 종료" 버튼이 단순 상태 리셋이 아니라 "화면을 완전히
  나가는" 버튼이 됐다. 기존엔 `isActive`(status가 idle/error가 아닐 때)에서만 활성화됐는데,
  이 규칙을 그대로 두면 인사말이 나오기 전(아직 idle)이나 에러 상태에서는 화면을 나갈 방법이
  없어진다.
- 결정: `disabled` 조건 제거, 항상 클릭 가능하게 변경.
- 이유: 사람 확인 없이 결정(낮은 리스크, 되돌리기 쉬움) — "화면을 나가는" 버튼은 대화가
  진행 중이든 아니든 항상 눌릴 수 있어야 자연스럽다고 판단. `stop()`은 idle 상태에서 불려도
  안전(이미 비어있는 걸 다시 정리할 뿐).
- 영향받는 범위: `src/components/ConversationScreen/ConversationScreen.tsx`(종료 버튼).

### 2026-08-25 TTS `lang`/언어 스코프 명확화: 지금은 "테스트 편의상 한국어", PRD 목표는 다국어

- 배경/문제: TTS 폴리싱 작업 중 `utterance.lang = 'ko-KR'`을 하드코딩했는데, PRD/CLAUDE.md
  어디에도 "이 앱이 한국어 전용"이라고 명시된 적은 없다 — "아침 스몰토크로 회화 연습"이라는
  목적만 고정돼 있을 뿐, 실제 제품 목표는 영어 → 일본어 → 스페인어 → 한국어(외국인 대상) 순으로
  지원 언어를 늘려가는 것이었다. 지금 한국어로 개발/테스트하는 건 음성 스트리밍 파이프라인
  자체(STT→LLM→TTS 왕복)를 검증하기 편해서 택한 임시 선택이지, "한국어 전용"이라는 스코프
  결정이 내려진 적은 없었다 — 문서화가 안 돼 있으면 이후 작업자가 `ko-KR` 하드코딩을 영구
  설계로 오해할 위험이 있어 기록해둔다.
  - **참고**: 이번 항목은 사람이 "임의로 정하지 말고 확인해달라"고 요청한 결정 사항이 아니라,
    이미 사람이 갖고 있던 제품 목표를 뒤늦게 문서로 옮겨 적은 것 — 새로 결정한 내용은 없음.
- 결정: 없음(스코프 변경 아님) — 다만 다국어 전환 시 함께 바꿔야 할 지점을 코드 주석과 여기에
  남겨 대비해둔다: (1) `WebSpeechSynthesisEngine.ts`의 `utterance.lang`, (2)
  `useConversationMachine.ts`의 `SYSTEM_PROMPT`/`FIXED_GREETINGS`(전부 한국어 문자열), (3)
  `WebSpeechInputEngine.ts`의 STT `SpeechRecognition.lang`(지금은 브라우저 기본값에 맡겨져
  있어 이것도 명시적으로 맞춰야 함). 이 PoC 스코프(1주일)에서는 다국어 지원 자체를 구현하지
  않고, 위 지점들을 한곳에서 관리하는 설정값으로 뽑아내는 리팩터링도 하지 않는다 — 지금은
  "언젠가 다국어로 갈 것"이라는 사실만 기록해두는 선에서 그친다.
- 영향받는 범위: 문서만(`docs/rules/PRD.md`/`ARCHITECTURE.md`는 아직 변경하지 않음 — 다국어
  지원이 실제 작업으로 들어올 때 그쪽에도 반영 필요).

### 2026-08-25 Day 6~7 스코프 축소 (시간 제약 4시간, 6시간→4시간 재조정 반영)

- 배경/문제: Day 6~7에 남은 총 작업 시간이 처음 6시간으로 제한되었다가, 이후 4시간으로
  다시 줄어듦. PRD 6장 원문대로면 Day 6은 코드 스플리팅 전/후 번들 트리맵, Lighthouse
  Performance/Accessibility 리포트, TTI 계측값을 각각 "전/후" 비교로 확보하고
  idle/listening/streaming/error/empty/권한거부 등 7개 상태를 모두 갤러리로 구현해야 하고,
  Day 7은 데모 녹화 5종 + 컴포넌트 문서 + 성능·접근성 리포트 + README를 새로 작성해야
  한다 — 이 전부를 4시간 안에 원문 그대로 완주하는 건 비현실적.
- 검토한 대안: (A) PRD 11장 "잘라낼 순서"를 그대로 적용해 자동 턴테이킹→수동 버튼, TTS
  제거 등 핵심 기능 자체를 축소, (B) 기능은 그대로 두고 Day 6 계측·문서화 작업의 "횟수"와
  "범위"만 축소, (C) Day 6/7을 원문 그대로 진행하되 완주하지 못한 항목은 미완료로 남김.
  6시간 기준으로 (B)를 채택한 뒤, 4시간으로 재조정되면서 항목별 소요시간을 다시 추정함 —
  Day 6(코드 스플리팅 15분 + 번들 트리맵 전/후 15분 + TTI 계측 전/후 20분 + Lighthouse
  전/후 25분 + 접근성 빠른 점검 15분 + 상태 갤러리 핵심 상태 30분 ≈ 2시간) + Day 7(데모
  녹화 5종 50~75분 + 컴포넌트 문서 링크 10분 + 성능·접근성 리포트 취합 15분 + README
  20분 ≈ 1.5~2시간) = 합계 3.5~4시간. 여유가 0에 가까워 Lighthouse 재측정이나 코드
  스플리팅 중 버그 하나만 생겨도 바로 초과되는 구조 — 가장 변동성이 큰 항목은 데모 녹화
  5종. 이에 대해 데모 녹화를 3종으로 축소해 여유 확보 / 5종 유지하고 초과 리스크 감수 /
  녹화는 유지하고 Day 6 계측 쪽을 더 압축, 세 가지를 사람에게 제시해 확인받음.
- 결정: (B) 채택 + 데모 녹화 축소. 세부적으로: Day 6은 Lighthouse/번들 트리맵/TTI 계측을
  각각 전/후 1회씩만 빠르게 확보(반복 측정·재측정 없음), 상태 갤러리는 7개 상태 전부가
  아니라 핵심 상태 위주로 축소해서 구현. Day 7은 새 자료를 조사·작성하는 대신 기존
  `DEVLOG.md`/`COMPONENT.md`/`DECISIONS.md`에 이미 쌓인 내용을 취합·정리하는 방식으로
  진행. 데모 녹화는 PRD가 요구하는 5종이 아니라 ① 자동 턴테이킹 3~5턴 전체 사이클,
  ② 크롬 개발자도구 Network 탭 스트리밍 청크 증빙, ③ 마이크 미지원/거부 시 텍스트 폴백,
  3종만 녹화한다. 오탐 발생 후 "이어서 말하기" 복구 장면, 스크린리더 시연 장면은 이번
  녹화 스코프에서 제외한다(기능 자체는 유지 — 코드/동작은 그대로 두고 별도 영상 증빙만
  생략).
- 이유: 사람이 명시적으로 요청한 시간 제약(최종 4시간) 안에서 핵심 루프(알림→대화 시작→
  스트리밍 응답)의 완성도를 해치지 않으면서 현실적으로 끝낼 수 있는 방법. 기능 축소
  (대안 A)는 이미 Day 5까지 완성한 자동 턴테이킹/TTS 사이클을 되돌리는 것이라 손실이 더 크고,
  원문 그대로 진행(대안 C)은 시간 내 완주가 불가능해 미완료 산출물만 남긴다. 5종 녹화가
  4시간 예산에서 가장 변동성 큰 항목이라 여기를 줄이는 게 다른 계측 작업(Lighthouse/TTI/
  번들)의 정확성을 희생하지 않고 여유를 만드는 가장 리스크 낮은 방법 — 사람이 권장안으로
  직접 선택함.
- 영향받는 범위: 앞으로 Day 6/7 관련 모든 작업 판단 기준. 이 결정은 `docs/rules/PRD.md` 6장/
  7장 원문보다 우선 적용한다 — PRD 원문은 참고용으로 남겨두되, 실제 작업 범위는 이 항목
  기준으로 판단한다. Day 7 데모 자료 수집 항목, `docs/deliverables/CHECKLIST.md`의 "데모
  녹화 5종" 항목(발표 시 3종만 첨부하고 사유를 이 문서로 링크). 오탐 복구/스크린리더 관련
  기능 코드는 변경하지 않음 — 녹화 증빙만 생략.

### 2026-08-25 Day 6: 상태 갤러리 디버그 라우트 — 7개 상태가 아니라 6개 카드로 축소

- 배경/문제: PRD 6장 원문은 상태 갤러리가 "idle/listening/streaming/error/empty/권한거부 등
  모든 상태"를 다 보여주길 요구하고, 위 "Day 6~7 스코프 축소" 결정도 "7개 상태 전부가 아니라
  핵심 상태 위주로 축소해서 구현"이라고만 방향을 정해뒀을 뿐 구체적으로 어떤 상태를 뺄지는
  정하지 않았다. 실제로 만들면서 두 가지를 결정해야 했다: (1) `ConversationStatus` 7개
  (`idle`/`listening`/`user_speaking`/`sending`/`streaming`/`assistant_speaking`/`error`) 중
  일부를 뺄지, (2) PRD가 별도로 언급한 "empty"를 "idle"과 다른 카드로 만들지.
- 검토한 대안:
  1. (상태 선정) (A) 7개 상태 모두 카드로 만든다. (B) `user_speaking`/`sending`을 빼고
     5개만 만든다 — 실사용 흐름에서 찰나에 지나가는 전이 상태라, 시간 예산 안에서 만들어도
     증빙 가치가 낮다고 판단.
  2. (idle vs empty) (A) `idle` 카드와 `empty` 카드를 시각적으로 다르게 두 개 만든다(PRD 문구를
     문자 그대로 따름). (B) 한 카드로 합친다 — `EmptyState.tsx` 설계상 `status === 'idle'`이면
     항상 `messages`/`transcript`가 비어 있어서(초기 상태이거나 `RESET` 직후뿐), 이 앱에서
     "idle"과 "대화 없음(빈 화면)"은 실제로 항상 동시에 나타나는 같은 화면이다.
- 결정: 1번은 (B), 2번은 (B). 최종 카드 6개: `idle/empty(빈 화면)`, `listening`, `streaming`,
  `assistant_speaking`, `error`, `권한거부(NotificationSetup)`.
- 이유: 사람 확인받음("user_speaking, sending은 전환 찰나의 상태라 생략해도 무방하다고
  판단되면 그렇게 하고, 판단 근거를 알려달라"는 요청에 따라 판단 근거를 함께 제시하고 그대로
  채택됨). `user_speaking`/`sending`을 빼도 그 상태의 `TurnIndicator` 라벨 문구 자체는 코드
  (`STATUS_LABEL`)로 바로 확인 가능하고, 실제 키보드 접근성 검증 과정에서 `user_speaking`
  상태("발화 인식 중…")가 실제로 정상 동작함을 별도로 재확인했다(`docs/deliverables/
  COMPONENT.md` 8장 참고). idle/empty를 합친 것은 실제로 다른 UI가 없는데 인위적으로 다르게
  보여주는 것이 정직하지 않다고 판단한 것 — 스코프 축소가 아니라 정확성의 문제로 봄.
- 영향받는 범위: `src/components/StateGallery/StateGallery.tsx`(신규),
  `src/GalleryRoot.tsx`(신규), `src/isGalleryRoute.ts`(신규), `src/main.tsx`(라우트 분기),
  `docs/deliverables/COMPONENT.md` 6장(상세 근거), `docs/deliverables/CHECKLIST.md`("상태
  갤러리 디버그 라우트" 항목 체크).
