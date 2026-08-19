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
| `NotificationSetup` | 시간 설정, 권한 요청, 권한 상태별 안내 | |
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

*(작성 예정 — `docs/rules/ARCHITECTURE.md` 참고하여 왜 이 인터페이스로 나눴는지, 실제 구현체 요약)*

## 5. 상태 갤러리 라우트

- 링크/경로: 
- 커버하는 상태 목록: idle / listening / streaming / error / empty / 권한거부 등

## 6. MVP vs 스트레치 스코프 판단 근거

*(작성 예정 — 실제로 무엇을 자르거나 유지했는지, `docs/log/DECISIONS.md` 링크)*
