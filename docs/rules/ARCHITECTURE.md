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
type SpeechInputErrorReason =
  | 'unsupported'
  | 'permission-denied'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'unknown';

interface SpeechInputError {
  reason: SpeechInputErrorReason;
  message?: string;
}

interface SpeechInputEngine {
  start(
    onInterimResult: (text: string) => void,
    onSpeechEnd: () => void,
    onError: (error: SpeechInputError) => void,
  ): void;
  stop(): void;
}
interface SpeechOutputEngine {
  speak(text: string, onEnd: () => void): void;
}
interface ReminderEngine {
  schedule(time: Date, onFire: () => void): void;
}
```

- **Day 3 변경**: `SpeechInputEngine.start()`에 `onError` 콜백 추가(Day 1 시그니처에는 없었음).
  마이크 권한 거부·인식 에러를 상태머신에 알릴 방법이 원래 시그니처엔 없었고, 이를 발견하고
  사람 확인 후 확장 — 상세 근거는 `docs/log/DECISIONS.md` 2026-08-24 항목 참고. `SpeechInputError`는
  브라우저의 `SpeechRecognitionErrorCode`를 그대로 노출하지 않고 어댑터가 번역한 공통 타입 —
  네이티브 전환 시 다른 엔진도 같은 타입으로 매핑하면 상위 로직은 무변경.
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

## `WebSpeechInputEngine` — 브라우저 지원 현황 메모 (2026-08-24 MDN/caniuse/GitHub 이슈 확인)

- **feature detection 기준**: `window.SpeechRecognition ?? window.webkitSpeechRecognition` 생성자
  존재 여부만 체크(표준 방식). Safari(14.1+)도 생성자는 존재하므로 "지원함"으로 판정됨 — PRD
  4장이 예시로 든 "Safari 등 연속 인식 미지원"은 UA로 미리 걸러내지 않고, 실제 사용 중 발생하는
  런타임 에러/타임아웃으로만 대응(사람 확인 후 결정, `docs/log/DECISIONS.md` 참고).
- **Safari 알려진 버그**: `continuous: true`에서 마이크가 멈추지 않거나 `onresult`가 아예 안 오는
  사례가 다수 보고됨(WebKit/web-speech-api 이슈 트래커, Apple 커뮤니티 포럼). API 부재가 아니라
  런타임 버그이므로 feature-detection으로는 걸러지지 않는다.
- **Edge(Chromium) 지원 여부 논쟁 있음**: 이론상 Chrome과 동일 엔진이라 지원해야 하지만,
  `mdn/browser-compat-data#22126`(2024-01 제보, 2026-08 기준 아직 open)에 "생성자는 있지만
  실제로 결과를 안 준다"는 미해결 제보가 있음 — 표준 feature-detection으로는 잡히지 않는
  런타임 이슈라는 점을 인지해둔다.
- **Firefox**: 기본 비활성화(플래그로만 켜짐) — 사실상 일반 사용자 환경에서는 미지원 취급.
- 에러 매핑(`SpeechRecognitionErrorCode` → `SpeechInputErrorReason`)은 MDN
  `SpeechRecognitionErrorEvent/error` 문서의 enum(`not-allowed`, `service-not-allowed`,
  `audio-capture`, `network`, `no-speech`, `aborted` 등)을 그대로 근거로 사용.
- **자동화 환경의 한계**: Playwright가 번들하는 오픈소스 Chromium은 실제 음성으로
  `SpeechRecognition`을 끝까지 검증할 수 없다(추정: Google Chrome 정식 빌드 전용 음성인식
  인증키 부재). 합성 음성 WAV를 가짜 마이크 입력으로 흘려도 `onresult`/`onerror` 어느 쪽도
  안 옴 — 진짜 사람 음성 검증은 로컬 Chrome + 실제 마이크로만 가능(`docs/log/DEVLOG.md` Day 3
  참고).

## 무음 타이머(~1.2초) — 로직 레이어에 위치 (2026-08-24)

PRD 6장의 "무음 타이머(~1.2초) 기반 발화 종료 감지"는 로직 레이어(`src/state-machine/`)에
둔다 — `src/state-machine/silenceTimer.ts`(순수 디바운스 타이머, 브라우저 API 미참조)와
`src/state-machine/useConversationMachine.ts`(엔진+reducer+타이머 배선)로 분리했다. 판단
기준은 브라우저 네이티브 `speechend` 이벤트가 아니라 `onInterimResult` 콜백 기반 커스텀
디바운스로 결정 — 근거와 트레이드오프는 `docs/log/DECISIONS.md` 2026-08-24 항목, 상태
다이어그램은 `docs/deliverables/COMPONENT.md` 3장 참고.

## `claudeProxy.ts` — 서버 SSE 형식 확인 및 클라이언트 파싱 (Day 4, 2026-08-25)

- **서버가 실제로 내려주는 형식(추측 아니라 `api/claude-stream.ts` 코드를 직접 읽어 확인)**:
  Anthropic SDK `messages.stream()`이 내는 원본 `MessageStreamEvent`를 그대로
  `data: {...}\n\n`로 중계하고, 스트림이 끝나면 `data: [DONE]\n\n`을, 서버 쪽에서 에러가 나면
  `data: {"type":"error","message":"..."}\n\n`을 보낸다(`res.write` 직접 호출, 가공 없음).
  클라이언트가 관심 있는 이벤트는 `content_block_delta`이고, 그중 `delta.type === 'text_delta'`
  일 때만 `delta.text`가 실제 응답 텍스트다.
- **fetch + ReadableStream 파싱(MDN "Using readable streams" 기준)**: `response.body.getReader()`
  + `TextDecoder({stream: true})`로 청크를 읽는다. fetch가 잘라주는 청크 경계가 SSE 이벤트
  경계(`\n\n`)와 일치한다는 보장이 없어(MDN에 그런 보장 없음), 완결되지 않은 마지막 조각을
  buffer에 남겨뒀다가 다음 청크와 이어붙이는 버퍼링이 필요하다 — 이 버퍼링 없이 짜면 이벤트
  JSON이 청크 경계에서 잘려 파싱이 실패하는 경우가 실제로 재현된다(`verify:claude-proxy`
  스크립트가 7자 단위로 강제로 잘라 이 케이스를 결정론적으로 검증).
- **`[DONE]` 없이 스트림이 끝나는 경우**: 서버는 정상 종료 시 항상 마지막에 `[DONE]`을 쓴다.
  reader가 `done: true`를 반환했는데 `[DONE]`을 받은 적이 없다면 네트워크가 중간에 끊긴 것으로
  보고 `network` 사유의 에러를 던진다(PRD 4장 "네트워크 끊김" 예외 시나리오 대응).
- **AbortController로 취소한 경우**: `ClaudeStreamError`로 감싸지 않고 그대로(브라우저의
  `DOMException('AbortError')`) 던진다 — 호출자(`useConversationMachine`)가 "사용자에게 보여줄
  진짜 실패"와 "우리가 의도적으로 중단시킨 것"을 구분할 수 있어야 하기 때문.

### 발견한 버그: `useEffect(deps: [state.status])`로 스트리밍을 트리거하면 자기 자신을 취소한다

- 처음에는 `state.status === 'sending'`이 되는 순간을 `useEffect`로 감지해서 LLM 호출을
  트리거하도록 짰다. 그런데 이 effect 안에서 `dispatch({type: 'STREAM_STARTED'})`를 호출하는
  순간 `status`가 `sending → streaming`으로 바뀌고, 이 effect의 의존성 배열이 정확히
  `[state.status]`이므로 React가 "의존성이 바뀌었다"고 판단해 **직전 effect의 cleanup(즉 방금
  만든 `AbortController.abort()`)을 곧바로 실행한 뒤 effect를 다시 돈다** — 방금 시작한 fetch를
  스스로 취소해버리는 자기 참조적 버그였다.
- Playwright로 실제 브라우저에서 재현: 텍스트를 입력해 전송하면 `POST /api/claude-stream`
  요청이 나가긴 하지만 곧바로 `net::ERR_ABORTED`가 찍히고, 화면은 "AI 응답 스트리밍 중…"에서
  영원히 멈췄다(`STREAM_ERROR`/`STREAM_DONE` 둘 다 디스패치되지 않아 상태가 고착).
- **수정**: `useEffect`로 상태 변화를 관찰해서 부수효과를 트리거하는 방식을 버리고,
  `start()`/`stop()`/`submitText()`가 이미 쓰고 있던 기존 패턴 — "이벤트가 발생하는 바로 그
  자리에서 직접 함수를 호출"하는 방식으로 바꿨다. `SILENCE_TIMEOUT`은 무음 타이머 콜백
  (`handleSilenceTimeout`)에서, `TEXT_SUBMITTED`는 `submitText()`에서 각각 직접
  `runSendCycle()`을 호출한다. 이러면 `state.status`를 의존성으로 건 effect 자체가 없어서
  자기 자신을 취소할 여지가 사라진다.
- **교훈**: React 함수형 컴포넌트에서 "이 상태가 되면 부수효과를 실행"을 `useEffect`로 구현할
  때, 그 부수효과가 같은 effect의 의존성 값 자체를 바꾼다면 반드시 이 자기 참조 재실행 문제를
  의심해야 한다. 이번처럼 "이벤트 핸들러에서 직접 호출"이 가능한 경우엔 그쪽이 더 안전하다.

## 설계 변경 이력

설계가 바뀌면 이유와 함께 아래에 추가하고, 중요한 트레이드오프는 `docs/log/DECISIONS.md`에도 남긴다.

- (예시) YYYY-MM-DD: ...
- 2026-08-25 (Day 4): `assistant_speaking` 상태는 이번에도 보류(TTS 어댑터가 Day 5에 생김,
  `docs/log/DECISIONS.md` 참고), `streaming`은 추가. 히스토리 윈도잉 N=3턴.
  `useEffect` 기반 스트리밍 트리거를 이벤트-발생-지점 직접 호출 방식으로 교체(위 버그 참고).
