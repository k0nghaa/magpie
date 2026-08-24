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
- **이번 단계에서 의도적으로 뺀 것**: `schedule()`은 지정 시각에 `onFire` 콜백을 호출하는
  타이머 역할만 한다. 콜백 안에서 실제로 `new Notification(...)`을 만들어 화면에 띄우는 로직과
  Service Worker 등록은 다음 단계로 미룸 (사용자 확인 후 결정, `docs/log/DECISIONS.md` 참고).
- **권한 요청/상태 조회는 어댑터 인터페이스에 넣지 않음**: `ReminderEngine`에는 권한 관련 메서드가
  없다. `Notification.permission` 조회와 `Notification.requestPermission()` 호출은
  `NotificationSetup` 컴포넌트가 브라우저 API를 직접 사용해 처리한다 — Day 1에 확정된 인터페이스
  시그니처를 임의로 확장하지 않기 위한 선택. 네이티브 전환 시 권한 플로우 자체가 완전히 다른 API가
  될 가능성이 높아, 지금 시점에 억지로 추상화하면 오히려 잘못된 추상화가 될 위험이 있음.

### `NotificationSetup` 설계 근거

- 시간 입력은 `<input type="time">` 채택 — 네이티브 컴포넌트라 접근성(키보드 조작, 라벨 연결)을
  별도 구현할 필요가 없고, 완전한 커스텀 스타일링은 이번 PoC 스코프에서 우선순위가 아니라고 판단.
- 알림 시간 값은 `localStorage`에 저장해 새로고침 후에도 유지. 값이 하나뿐이고 현재 이 컴포넌트만
  사용하므로 Zustand/Context 같은 전역 스토어 대신 컴포넌트 로컬 state + `localStorage` 동기화로
  단순하게 구현. 다른 화면에서도 이 값이 필요해지면 전역 상태로 승격 검토.
- 권한 상태는 `granted`/`denied`/`default`/`unsupported` 4가지로 분기해 `aria-live="polite"`
  영역에 안내 문구를 노출. `denied` 상태에서는 브라우저가 재프롬프트를 띄우지 않는다는 MDN 명세에
  따라 버튼을 비활성화하고 "브라우저 설정에서 직접 허용" 안내로 대체.

## 5. 상태 갤러리 라우트

- 링크/경로: 
- 커버하는 상태 목록: idle / listening / streaming / error / empty / 권한거부 등

## 6. MVP vs 스트레치 스코프 판단 근거

*(작성 예정 — 실제로 무엇을 자르거나 유지했는지, `docs/log/DECISIONS.md` 링크)*
