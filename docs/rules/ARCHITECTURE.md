# ARCHITECTURE.md — 설계 원칙 상세 

> PRD 7장의 확장판. 이 문서는 코드가 쌓이면서 계속 업데이트하고,
> 최종적으로 `docs/deliverables/COMPONENT.md` 작성 시 근거 자료로 재사용한다.

## 왜 레이어를 나누는가

이번 기능은 추후 네이티브 앱 전환(Web Speech API, Notification API 교체)을 염두에 두고 설계한다. 

| 층 | 내용 | 이식성 |
|---|---|---|
| 로직 레이어 | 대화 상태머신, 무음 감지 후 턴 전환 규칙, LLM 프롬프트/스트리밍 파싱, "오탐 시 수동 복구 버튼" UX 판단 | 플랫폼 무관, 그대로 유지 |
| 어댑터 레이어 | Web Speech API(STT), `SpeechSynthesis`(TTS), `Notification`/Service Worker | 네이티브 전환 시 교체 대상 |

## 인터페이스 계약

```tsx
interface SpeechInputEngine {
  start(onInterimResult: (text: string) => void, onSpeechEnd: () => void): void;
  stop(): void;
}
interface SpeechOutputEngine {
  speak(text: string, onEnd: () => void): void;
}
interface ReminderEngine {
  schedule(time: Date, onFire: () => void): void;
}
```

- 이번 주 구현체: `WebSpeechInputEngine`, `WebSpeechSynthesisEngine`, `BrowserNotificationEngine`
- 네이티브 전환 시: `RNVoiceInputEngine`, `RNTTSEngine`, `ExpoNotificationEngine` (상위 상태머신 무변경)

**검증 기준**: mock 구현으로 교체해도 상태머신이 무변경으로 동작해야 한다 (PRD 3장 성공 기준 중 하나).

## 폴더 구조 제안 (코드 작성 시 참고)

```
src/
  adapters/
    speech-input/WebSpeechInputEngine.ts
    speech-output/WebSpeechSynthesisEngine.ts
    reminder/BrowserNotificationEngine.ts
  state-machine/
    conversationReducer.ts       # useReducer 상태머신 로직
    types.ts                     # 상태/이벤트 타입 정의
  components/
    NotificationSetup/
    ConversationScreen/
      ChatMessageList.tsx
      ChatBubble.tsx
      TurnIndicator.tsx
      ResumeSpeakingButton.tsx
      TextInputFallback.tsx
      StreamingIndicator.tsx
      ErrorBanner.tsx
      EmptyState.tsx
  api/
    claudeProxy.ts               # Vercel Serverless Function 호출 클라이언트
api/
  claude-stream.ts               # Vercel Serverless Function (SSE 중계, API 키 보호)
```

## 마이그레이션 유의사항 (기록만, 지금 처리 안 해도 됨)

- 알림은 네이티브 전환 시 오히려 유리해진다 — `expo-notifications`로 앱 종료 후에도
  진짜 예약 알림이 가능해서 웹의 "포그라운드 제약"이 사라진다.
- 웹의 `fetch` + `ReadableStream` 스트리밍을 React Native 기본 `fetch`는 지원하지 않는다 —
  네이티브 전환 시 `react-native-sse` 등 별도 라이브러리 필요.
- UI 레이어(React DOM/Tailwind)는 네이티브 전환 시 어차피 다시 작성해야 한다 —
  어댑터 분리로도 피할 수 없는 부분이며, 이번 주 이관 대상은 로직/파이프라인/판단 근거에 한정.

## 설계 변경 이력

설계가 바뀌면 이유와 함께 아래에 추가하고, 중요한 트레이드오프는 `docs/log/DECISIONS.md`에도 남긴다.

- (예시) YYYY-MM-DD: ...
