# COMPONENT.md — 컴포넌트 & 설계 문서

> 최종 제출용 문서지만 Day 7에 몰아서 쓰지 않는다. 컴포넌트/인터페이스를 만들 때마다
> 바로 이 문서에 근거를 추가한다.

## 1. 화면 흐름

```
[알림 설정 화면] → (지정 시각 도달) → [브라우저 알림] → [대화 화면]
```

## 2. 컴포넌트 목록

| 컴포넌트 | 역할 | 비고 |
|---|---|---|
| `NotificationSetup` | 시간 설정, 권한 요청, 권한 상태별 안내 | `input type="time"`, 시간값 localStorage 유지 |
| `ConversationScreen` | 상태머신 컨테이너 | |
| `ChatMessageList` / `ChatBubble` | user/assistant variant | |
| `TurnIndicator` | 현재 상태를 시각적+aria-live로 표시 | 자동 전환의 핵심 UX |
| `ResumeSpeakingButton` | 무음 오탐 시 복구용 | 상시 리스닝 구조에서 "오탐 복구+일시정지" 역할 |
| `TextInputFallback` | 음성 미지원 환경 자동 노출 | 전송 버튼이 턴 종료 신호 |
| `StreamingIndicator` | 스트리밍 중 표시 | |
| `ErrorBanner`, `EmptyState` | 예외 상태 | |

## 3. 상태관리 설계 근거

*(작성 예정 — `useReducer`를 택한 이유, 상태머신 다이어그램, 불가능한 상태 조합을 어떻게 차단했는지)*

## 4. 어댑터 분리 설계 근거

*(작성 예정 — `SpeechInputEngine`/`SpeechOutputEngine` 구현체는 Day 3에서 추가 작성)*

### `ReminderEngine` → `BrowserNotificationEngine` (Day 2)

- Day 1에서 정의한 시그니처(`schedule(time: Date, onFire: () => void): void`)를 그대로 구현.
  `stop()` 같은 퍼블릭 메서드를 추가하지 않고, 재호출 시 이전 `setTimeout`을 내부적으로
  교체하는 방식으로 처리 — 상위 코드가 인터페이스 이상의 것을 알 필요가 없게 유지.
- `schedule()`은 여전히 지정 시각에 `onFire` 콜백을 호출하는 타이머 역할만 한다. 실제 알림을
  그리는 로직(`showBrowserNotification`)은 별도 파일로 분리해 `onFire` 콜백 안에서 호출한다 —
  "타이머"와 "알림 표시"를 같은 클래스에 합치지 않음.

### 알림을 실제로 띄우는 방식: SW `showNotification()` vs 페이지의 `new Notification()`

- MDN 공식 문서에 `new Notification()`은 "거의 모든 모바일 브라우저에서 `TypeError`를 던진다"고
  명시돼 있음(모바일 탭이 백그라운드에서 거의 안 돈다는 이유로 브라우저 벤더가 의도적으로 막음,
  바뀔 계획 없음). 이 프로젝트는 반응형/모바일을 배제하지 않으므로, `new Notification()` 단독
  경로는 모바일에서 하드 크래시 위험이 있어 제외.
- 데스크톱 폴백(`new Notification()`)도 두지 않고 **SW의 `showNotification()` 하나로 통일**
  (`src/adapters/reminder/showBrowserNotification.ts`). 코드 경로를 하나로 유지하는 것이
  두 경로를 유지·테스트하는 것보다 이 PoC 스코프에 맞다고 판단, 사용자 확인 후 결정.
- SW 생명주기: `navigator.serviceWorker.ready`는 **`registration.active`가 존재하기만 하면**
  resolve된다(MDN 명시) — 이 페이지를 SW가 "제어(control)"하고 있을 필요는 없다. 즉 리로드 없이도
  등록 즉시 `showNotification()`을 쓸 수 있음. ("리로드해야 SW가 페이지를 제어한다"는 제약은
  `fetch` 가로채기/캐싱에만 해당하고, 이 프로젝트는 오프라인 캐싱을 안 쓰므로 무관.)
- SW는 `vite-plugin-pwa`의 `injectManifest` 전략으로 커스텀 소스(`src/sw.ts`)를 직접 작성.
  `generateSW` 기본 모드는 Workbox가 SW 전체를 자동 생성해 `notificationclick` 같은 커스텀
  이벤트 리스너를 넣을 방법이 없어서, PRD가 확정한 `vite-plugin-pwa`를 그대로 쓰면서도 커스텀
  로직을 넣을 수 있는 `injectManifest`를 선택. `injectManifest.globPatterns: []`로 프리캐시
  목록을 비워 오프라인 캐싱(비목표)은 만들지 않음 — 빌드 로그로 "precache 0 entries" 확인.
- SW의 역할은 "그 순간에 실제로 화면에 알림을 그려주는 통로"일 뿐, 브라우저가 완전히 닫힌 뒤
  스스로 깨어나 알림을 쏘는 게 아니다 — 리마인더는 여전히 페이지의 `setTimeout`(클라이언트
  타이머, `BrowserNotificationEngine`)으로 동작하므로 탭이 열려 있어야 fire된다. 완전 종료 후
  깨어나려면 Push API가 필요하고, 이는 PRD가 명시한 스트레치 목표(비목표)라 만들지 않음.
- 알림 클릭 시 동작은 SW의 `notificationclick` 이벤트에서 처리 — 열려 있는 클라이언트가 있으면
  포커스, 없으면 `clients.openWindow('/')`. 대화 화면(`ConversationScreen`)이 아직 없어서
  지금은 루트로만 이동하며, Day 3 이후 대화 화면이 생기면 그 경로로 갱신 필요 (`src/sw.ts` 참고).
- **권한 요청/상태 조회는 어댑터 인터페이스에 넣지 않음**: `ReminderEngine`에는 권한 관련 메서드가
  없다. `Notification.permission` 조회와 `Notification.requestPermission()` 호출은
  `NotificationSetup` 컴포넌트가 브라우저 API를 직접 사용해 처리한다 — Day 1에 확정된 인터페이스
  시그니처를 임의로 확장하지 않기 위한 선택. 네이티브 전환 시 권한 플로우 자체가 완전히 다른 API가
  될 가능성이 높아, 지금 시점에 억지로 추상화하면 오히려 잘못된 추상화가 될 위험이 있음.

### `showBrowserNotification()` 실패(reject) 처리

- `registration.showNotification()`은 항상 성공하지 않는다 — 대표적으로 "`schedule()` 예약
  시점엔 권한이 `granted`였는데, 탭이 열려있는 동안 사용자가 브라우저 설정에서 알림을 꺼서
  발사 시점엔 권한이 없어진 경우" MDN 명세상 reject한다. PRD 4장 예외 시나리오 목록에는 이
  케이스가 명시돼 있지 않지만, PRD 2장 목표("로딩·에러·빈 화면·권한거부 등 모든 예외 상태가
  UI로 명시적으로 처리된다")는 이 실패도 커버해야 한다고 판단 — 사용자 확인 후 아래 방식으로
  결정 (`docs/log/DECISIONS.md` 참고).
- `NotificationSetup`의 `onFire` 콜백에서 `showBrowserNotification(...).catch(...)`로 반드시
  받는다. 이전엔 `void showBrowserNotification(...)`로 프로미스를 그냥 버려서, reject 시
  unhandled promise rejection이 되고 사용자에게 아무 신호도 안 갔음 — 이번에 고침.
- `catch` 안에서 하는 일은 두 가지뿐: (1) `console.error`로 로그, (2)
  `Notification.permission`을 다시 읽어 `permission` state를 재동기화. 재시도 로직은 넣지
  않음(이 PoC 스코프에서는 과함, 사용자도 동의).
- 재동기화가 핵심 트릭이다 — 실패 원인이 실제로 권한 변경이었다면, 이미 만들어둔 차단 안내
  문구 + "지금 시작하기" 버튼(바로 위 예외 시나리오 대응 UI)이 **새 UI 코드 없이 그대로**
  뜬다. 권한이 여전히 `granted`인 채로 다른 이유로 실패한 드문 경우엔 화면은 안 바뀌고
  콘솔 로그만 남는다 — 이 경우까지 별도 에러 배너를 만드는 건 과설계로 판단해 안 함.
- 실제 실행 검증: headed Chromium에서 `ServiceWorkerRegistration.prototype.showNotification`을
  reject하도록 바꿔치기하고 동시에 `Notification.permission`을 `denied`로 바꿔 "예약 후 권한이
  바뀐 상황"을 재현 → `window.addEventListener('unhandledrejection', ...)`로 잡힌 게 0건,
  `console.error`에 정확한 메시지가 남고, 화면이 자동으로 차단 안내 + "지금 시작하기" 버튼으로
  전환되는 것을 확인.

### `NotificationSetup` 설계 근거

- 시간 입력은 `<input type="time">` 채택 — 네이티브 컴포넌트라 접근성(키보드 조작, 라벨 연결)을
  별도 구현할 필요가 없고, 완전한 커스텀 스타일링은 이번 PoC 스코프에서 우선순위가 아니라고 판단.
- 알림 시간 값은 `localStorage`에 저장해 새로고침 후에도 유지. 값이 하나뿐이고 현재 이 컴포넌트만
  사용하므로 Zustand/Context 같은 전역 스토어 대신 컴포넌트 로컬 state + `localStorage` 동기화로
  단순하게 구현. 다른 화면에서도 이 값이 필요해지면 전역 상태로 승격 검토.
- 권한 상태는 `granted`/`denied`/`default`/`unsupported` 4가지로 분기해 `aria-live="polite"`
  영역에 안내 문구를 노출. `denied` 상태에서는 브라우저가 재프롬프트를 띄우지 않는다는 MDN 명세에
  따라 버튼을 비활성화하고 "브라우저 설정에서 직접 허용" 안내로 대체.
- 권한이 `granted`이고 시간값이 있을 때, `useMemo`로 "다음 발생 시각"(오늘 그 시각이 이미
  지났으면 내일)을 계산해 `BrowserNotificationEngine.schedule()`에 넘기고 화면에도
  "다음 알림 예정: …"으로 노출 — 테스트/디버깅 시 실제로 언제 울릴지 눈으로 바로 확인 가능.
  **알려진 제한**: 한 번 fire되면 다음 날 것을 자동으로 다시 예약하지 않음(매일 반복 알림은
  아직 미구현). 이번 단계 요청 범위가 "지정 시각에 1번 표시"였고, 매일 반복은 범위 밖이라
  임의로 만들지 않음 — 필요해지면 확인 후 추가.
- **예외 시나리오(PRD 4장) 대응**: 권한 `denied` 또는 `unsupported`일 때(`isBlocked`) 대체
  안내 문구 아래에 "지금 시작하기" 버튼을 노출. 클릭하면 `ConversationScreen`으로 이동하는 대신
  "대화 화면은 아직 준비 중입니다 (Day 3에서 연결 예정)"라는 확인 문구만 `aria-live`로 띄운다 —
  `ConversationScreen`이 아직 없는 상태에서 실제로 가지도 않는 화면으로 이동하는 척(가짜 완료)을
  만들지 않기 위한 선택, 사용자 확인 후 결정 (`docs/log/DECISIONS.md` 참고). Day 3+에서
  `ConversationScreen`이 생기면 `handleStartNow`를 실제 네비게이션으로 교체해야 함.

## 5. 상태 갤러리 라우트

- 링크/경로: 
- 커버하는 상태 목록: idle / listening / streaming / error / empty / 권한거부 등

## 6. MVP vs 스트레치 스코프 판단 근거

*(작성 예정 — 실제로 무엇을 자르거나 유지했는지, `docs/log/DECISIONS.md` 링크)*
