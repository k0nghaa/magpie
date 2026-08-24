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
