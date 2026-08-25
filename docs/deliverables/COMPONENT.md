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
| `ConversationScreen` | 상태머신 컨테이너 | 아직 미작성(Day 4+) — 지금은 `SpeechInputDemo`가 임시로 대체 |
| `ChatMessageList` / `ChatBubble` | user/assistant variant | |
| `TurnIndicator` | 현재 상태를 시각적+aria-live로 표시 | 자동 전환의 핵심 UX |
| `ResumeSpeakingButton` | 무음 오탐 시 복구용 (구현 완료, Day 3) | `user_speaking`/`sending`에서만 렌더링, 클릭 시 `listening` 복귀 |
| `TextInputFallback` | 음성 미지원 환경 자동 노출 (구현 완료, Day 3) | 전송 버튼/Enter가 턴 종료 신호, 무음 감지 로직 없음 |
| `StreamingIndicator` | 스트리밍 중 표시 (구현 완료, Day 4) | `sending`/`streaming`에서만 렌더링, 응답 대기와 토큰 수신 중 문구 구분 |
| `ErrorBanner` | 예외 상태 — API/네트워크 오류 (구현 완료, Day 4) | 에러 메시지 + "재시도"(idle로 복귀, 자동 재전송 아님) |
| `EmptyState` | 예외 상태 — 첫 진입 시 빈 화면 (구현 완료, Day 4) | `idle`에서만 렌더링 |

## 3. 상태관리 설계 근거

- **`useReducer`를 택한 이유**: PRD 6장이 "streaming이면서 동시에 listening" 같은 불가능한
  상태 조합을 원천 차단하라고 명시. 여러 `useState`로 관리하면 "지금 상태가 뭔지"를 여러 불리언의
  조합으로 추론해야 해서 불가능한 조합이 실수로 만들어지기 쉽다. `useReducer` + 단일
  `status` 필드(`ConversationStatus`)로 관리하면 "현재 상태에서 의미 없는 이벤트는 무시한다"는
  규칙을 각 이벤트 케이스 안에 명시적으로 적을 수 있어 원천 차단이 코드로 드러난다
  (`src/state-machine/conversationReducer.ts`의 각 `case`가 `if (state.status === ...)`로
  가드하는 방식).
- **구현된 상태(7개)**: `idle` / `listening` / `user_speaking` / `sending` / `streaming` /
  `assistant_speaking` / `error`. `streaming`은 Day 4에서, `assistant_speaking`은 Day 5에서
  TTS(`SpeechOutputEngine` → `WebSpeechSynthesisEngine`) 연동과 함께 추가했다 — 어댑터가 생기기
  전까지는 두 상태 모두 "실제로 도달·검증되지 않는 상태"가 되므로 미리 만들지 않고 어댑터가
  생기는 시점에 맞춰 추가했다(Day 3~5 공통 원칙, `docs/log/DECISIONS.md` 참고).
- **상태 다이어그램(현재 구현 범위)**:
  ```
  idle --START_LISTENING--> listening
  listening --INTERIM_RESULT--> user_speaking (transcript 갱신)
  user_speaking --INTERIM_RESULT--> user_speaking (transcript 갱신, 무음 타이머 리셋)
  user_speaking --SILENCE_TIMEOUT(~1.2초 무음)--> sending
  user_speaking --RESUME_SPEAKING(이어서 말하기)--> listening (transcript 보존)
  sending --RESUME_SPEAKING(이어서 말하기)--> listening (transcript 보존)
  (idle|listening|user_speaking) --TEXT_SUBMITTED(텍스트 전송/Enter)--> sending
  sending --STREAM_STARTED--> streaming
  streaming --STREAM_DELTA(반복)--> streaming (assistantText 누적)
  streaming --STREAM_DONE--> assistant_speaking (transcript 비움, 마이크는 훅에서 stop())
  assistant_speaking --ASSISTANT_SPEECH_DONE(TTS 재생 종료)--> listening (마이크 새 세션으로 재시작)
  (sending|streaming) --STREAM_ERROR--> error
  (모든 상태) --ENGINE_ERROR--> error
  error --START_LISTENING(재시도)--> listening
  (모든 상태) --RESET--> idle
  ```
  **참고**: `assistant_speaking`에서는 `INTERIM_RESULT`/`SILENCE_TIMEOUT`이 전부 무시된다 —
  리듀서 가드 차원에서도, 실제로도(마이크 엔진이 `stop()`되어 있어 이벤트 자체가 안 옴) 이중으로
  막혀 있다.
  **참고**: `sending`은 리듀서 레벨에서는 실제로 거치는 상태이지만(단위 테스트로 결정론적으로
  증명됨), `TEXT_SUBMITTED`/`SILENCE_TIMEOUT` 직후 같은 동기 흐름에서 곧바로 `STREAM_STARTED`가
  디스패치되어 React 18+의 자동 배칭이 `sending → streaming`을 한 커밋으로 묶는다 — 그래서
  화면에는 `sending`이 별도 프레임으로 안 보일 수 있다(버그 아님, 실행 근거는
  `docs/log/DEVLOG.md` Day 4 항목 참고).
- **무음 타이머(~1.2초) 위치와 판단 기준(둘 다 사람 확인 후 결정)**:
  - 위치: `WebSpeechInputEngine`(어댑터) 내부가 아니라 로직 레이어
    (`src/state-machine/silenceTimer.ts` + 이를 사용하는 `useConversationMachine.ts`)에 둠 —
    타이머가 `onInterimResult` 콜백만 소비하는 순수 알고리즘이라 브라우저 API를 몰라도 되고,
    PRD 3장 "mock 구현으로 교체해도 상태머신이 무변경으로 동작" 기준과 정확히 부합하며, 네이티브
    전환 시(`RNVoiceInputEngine`)에도 그대로 재사용 가능하기 때문. 어댑터에 두면 "1.2초"라는
    제품 정책이 특정 플랫폼 구현체에 박혀 7장 어댑터 분리 원칙과 어긋난다.
  - 판단 기준: 브라우저 네이티브 `speechend` 이벤트가 아니라 커스텀 디바운스 타이머 사용 —
    `speechend`는 타이밍이 명세에 없고(PRD의 "~1.2초"를 보장 못 함) Safari에서는 신뢰도 자체가
    낮다고 지난 단계에서 확인했음. `onInterimResult`가 호출될 때마다 1200ms 타이머를 리셋하고,
    끝까지 리셋 없이 살아남으면 `SILENCE_TIMEOUT` 이벤트를 디스패치한다. `onSpeechEnd`(네이티브
    `speechend`)는 계속 전달만 받되 상태 전환 근거로는 쓰지 않고 참고용 로그로만 남긴다.
  - **알려진 리스크**: "텍스트가 안 바뀜"이 "실제로 말을 멈춤"과 완전히 같지는 않아 오탐(false
    cutoff) 가능성이 있다 — PRD 4장이 이미 이 리스크를 알고 "이어서 말하기" 버튼으로 완화하기로
    설계해뒀다(`ResumeSpeakingButton`, 아래 참고).
- **`ResumeSpeakingButton`(오탐 복구, Day 3)**: `user_speaking`/`sending`에서만 렌더링되도록
  가시성 규칙을 컴포넌트 자체에 내장(`VISIBLE_STATUSES`) — 리듀서가 다른 상태에서
  `RESUME_SPEAKING`을 무시하는 것과 별개로, 버튼이 애초에 안 보이는 것까지 이중으로 보장한다.
  클릭 시 `listening`으로 돌아가되 `transcript`는 지우지 않는다 — `WebSpeechInputEngine`은
  `sending` 진입 시점에도 `stop()`되지 않고 `continuous` 세션이 계속 살아있으므로(같은
  브라우저 인식 세션이 이어짐), 다시 말을 이어가면 브라우저가 알아서 누적 결과를 계속 준다.
  즉 "이어서 말하기"는 엔진을 재시작하지 않는 순수 상태머신 레벨의 UI 복구다.
- **`TextInputFallback`(음성 미지원 폴백, Day 3)**: `isSpeechInputSupported()`가 `false`일 때
  자동으로 노출되는 `<form>` 기반 텍스트 입력. `onSubmit`(전송 클릭 또는 Enter)이 곧
  `TEXT_SUBMITTED` 이벤트를 발생시켜 무음 타이머 없이 바로 `sending`으로 전환한다 — PRD 4장이
  명시한 "전송 버튼/Enter가 곧 턴 종료 신호이므로 무음 감지 로직이 필요 없다"는 설계를 그대로
  구현. `WebSpeechInputEngine`을 전혀 참조하지 않는다(미지원 폴백이므로 애초에 쓸 대상이 없음).
- **`StreamingIndicator`(스트리밍 중 표시, Day 4)**: `sending`/`streaming`에서만 렌더링 —
  가시성 규칙을 컴포넌트 자체에 내장하는 `ResumeSpeakingButton`과 동일한 패턴. PRD 컴포넌트
  목록에 별도의 "로딩 표시" 컴포넌트가 없어서, 응답 대기(`sending`)와 토큰 수신(`streaming`)을
  문구만 다르게 하나의 컴포넌트로 묶었다.
- **`ErrorBanner`(에러 + 재시도, Day 4)**: `state.error`가 있을 때만 렌더링. "재시도"는 실패한
  요청을 자동으로 다시 보내지 않고 `useConversationMachine`의 기존 `stop()`(엔진 정지 + 스트림
  abort + `RESET`)을 그대로 재사용해 `idle`로만 되돌린다 — 사용자 모르게 API가 한 번 더 나가는
  것을 피하기 위한 선택(사람 확인 없이 결정, 낮은 리스크, `docs/log/DECISIONS.md` 참고).
- **`EmptyState`(빈 화면, Day 4)**: `status === 'idle'`일 때만 렌더링. 리듀서상 `idle`은 초기
  상태 또는 `RESET` 직후뿐이라 `transcript`/`assistantText`가 항상 비어 있으므로, 별도의
  "내용이 비었는지" prop 없이 `status`만으로 판단해도 충분하다.
- **엔진 의존성 주입**: `useConversationMachine(engineFactory)`가 엔진을 팩토리로 받는다(기본값
  `WebSpeechInputEngine`). PRD 3장의 "mock 구현으로 교체해도 상태머신이 무변경으로 동작하는지
  확인" 요구사항을 실제로 만족시키기 위한 설계 — 다른 `SpeechInputEngine` 구현체(mock, 나중엔
  `RNVoiceInputEngine`)를 넘기면 리듀서·타이머 코드는 그대로 재사용된다.
- **실제 실행 검증**:
  1. 순수 로직 결정론적 테스트(`npm run verify:silence-timer`,
     `scripts/verify-silence-timer-logic.ts`): reducer의 모든 상태 전이(정상 전이 + "불가능한
     전이 무시") 10개, 디바운스 타이머의 리셋/타임아웃/취소 동작 3개, 총 13개 케이스 모두 통과.
  2. Playwright(headless Chromium)로 브라우저 이벤트 타이밍까지 확인: 브라우저의 실제
     `SpeechRecognition` 이벤트 계약과 동일한 모양의 가짜 생성자를 주입해 "t=0ms, t=150ms에
     interim 결과 2번(발화 중) → 그 이후 완전한 침묵"을 재현 → 실제로 t≈1619ms(마지막 interim
     이후 1241ms)에 `sending` 상태로 전환됨을 확인(목표 1200ms 대비 오차 41ms, DOM
     polling/이벤트 루프 오버헤드 범위 내). 콘솔 에러 0건, 네이티브 `speechend`가 한 번도
     안 왔는데도(가짜 생성자가 이 이벤트를 안 냄) 정상적으로 sending 전환됨 — 커스텀 타이머가
     `speechend`에 의존하지 않는다는 설계 의도를 그대로 증명.
  3. **한계(정직하게 기록)**: Windows SAPI로 실제 음성 WAV(영어 문장 + 뒤에 진짜 무음 3초를
     이어붙임)를 만들어 Chromium의 `--use-file-for-fake-audio-capture` 플래그로 진짜 마이크
     입력처럼 흘려보내는 시도도 했으나, 10초 넘게 기다려도 `onresult`/`onerror` 어느 쪽도 오지
     않고 "듣는 중" 상태에 계속 머물렀다. Playwright가 번들하는 것은 오픈소스 Chromium이라
     Google Chrome 정식 빌드에만 있는 음성인식 서비스 인증키가 없어서일 가능성이 높다(Chrome의
     `SpeechRecognition`은 클라우드 기반 — 5장 기술스택 문서에도 명시된 사실). 즉 **진짜 사람이
     실제 마이크로 말하고 1.2초 멈췄을 때 자동 전송되는지는 이 자동화 환경 밖에서, 로컬 Chrome +
     실제 마이크로 직접 확인이 필요**하다 — 확인 절차는 DEVLOG.md Day 3 항목에 안내.
  4. `ResumeSpeakingButton`(Playwright, 가짜 `SpeechRecognition`으로 무음 오탐 재현): idle에서
     버튼 미노출 확인 → 시작 후 `user_speaking`/`sending` 양쪽에서 노출 확인 → 클릭 시
     `listening`으로 복귀하고 `transcript`가 보존됨을 확인 → 복귀 직후 버튼이 다시 숨겨짐을
     확인. 페이지 에러 0건.
  5. `TextInputFallback`(Playwright, `SpeechRecognition` 생성자를 `addInitScript`로 제거해
     미지원 재현): 마이크 UI가 아예 안 뜨고 텍스트 입력창이 자동 노출됨을 확인 → 빈 입력일 때
     전송 버튼 비활성화 → 입력 후 활성화 → Enter로 제출 시 `sending` 전환 및 transcript 반영,
     입력창 비워짐까지 확인. 페이지 에러 0건.
  6. **Day 3 DoD 4개 항목 최종 실행 검증(18개 체크 전부 PASS)**: 위 1~5의 개별 검증을 DoD
     체크리스트 관점에서 한 번 더 통합 실행 — 특히 오탐 복구는 "버튼 클릭 1회"에서 끝내지 않고
     복구 후 실제로 이어 말해서 두 번째 무음까지 다시 정상적으로 `sending`에 도달하는 "완주"
     시나리오까지 검증(1회성 눈속임이 아님을 확인). **검증 범위의 정직한 한계**: 이 모든
     자동화는 브라우저 이벤트 계약에 대한 코드 반응을 결정론적으로 증명할 뿐, "진짜 사람 음성
     인식 품질/체감 타이밍"은 증명하지 못한다(3번 항목에서 이미 확인한 자동화 환경의 근본
     한계). 그 부분은 사람이 직접 실기기로 확인한 "적당한 시간(1.2초) 뒤 자동 전송, 안정적"이라는
     보고가 유일한 real-world 근거이며, 별도 재확인 질문에도 "지금까지는 안정적이었다"는 답을
     받아 PRD 11장 스코프 축소(수동 버튼 방식)는 발동하지 않기로 함(사람 확인, 표본이 많지
     않으니 Day 6~7 데모 준비 중 추가 확인 권장).

## 4. LLM 스트리밍 연동 설계 근거

`claudeProxy.ts`는 "상태관리"도 아니고 PRD 7장이 정의한 3개 어댑터(`SpeechInputEngine`/
`SpeechOutputEngine`/`ReminderEngine`)도 아닌 별도 관심사(LLM 프록시 클라이언트 — ARCHITECTURE.md
분류상 로직 레이어)라 독립된 장으로 둔다.

- **`claudeProxy.ts`의 역할과 경계**: `api/claude-stream.ts`(Vercel Serverless Function)가
  내려주는 SSE 형식(Anthropic SDK 원본 이벤트를 `data: {...}\n\n`로 중계, `[DONE]`으로 종료)에
  맞춰 fetch+`ReadableStream` 파싱만 담당한다. `ANTHROPIC_API_KEY`는 존재조차 참조하지 않아
  "API 키는 서버만 다룬다"는 경계(PRD 5장)를 그대로 지킨다. 형식 확인 방법과 파싱 구현 상세는
  `docs/rules/ARCHITECTURE.md` 참고.
- **에러 타입 재사용**: `ClaudeStreamError`는 별도 taxonomy를 새로 만들지 않고 `SpeechInputError`
  를 그대로 구현한다 — `ConversationMachineState.error` 슬롯 하나로 마이크/LLM 에러를 함께
  다루기 위함(근거: `docs/log/DECISIONS.md`).
- **스트리밍 트리거는 이벤트 발생 지점에서 직접 호출**: `state.status === 'sending'`을
  `useEffect`로 감지해 트리거하면, 그 안의 `dispatch(STREAM_STARTED)`가 자기 자신의 의존성을
  바꿔 React가 effect를 cleanup(→ 방금 만든 요청을 abort)했다가 재실행하는 자기 취소 문제가
  생긴다. `start()`/`stop()`과 동일하게 `SILENCE_TIMEOUT`/`TEXT_SUBMITTED`가 발생하는 자리에서
  직접 `runSendCycle()`을 호출하는 방식으로 설계했다(원인 분석은 `docs/rules/ARCHITECTURE.md`
  참고).
- **대화 히스토리 윈도잉**: 상태머신(리듀서) 밖, `useConversationMachine`의 `historyRef`에 최근
  대화를 쌓아두고 매 전송마다 최근 `HISTORY_WINDOW_TURNS`(=3턴)만 슬라이스해 요청에 포함한다
  (PRD 8장 비용 통제 원칙). 리듀서가 아니라 hook에 둔 이유: "지금 화면 상태가 뭔지"(상태머신의
  책임)와 "서버로 보낼 메시지 목록"(비용 통제 관심사)은 서로 다른 관심사라서 분리했다. N=3의
  근거는 `docs/log/DECISIONS.md` 참고.
- **system 프롬프트(Day 5 추가)**: `api/claude-stream.ts`/`claudeProxy.ts`는 처음부터 `system`
  필드를 지원했지만 Day 4까지는 호출부가 채워 보낸 적이 없어 Claude가 기본값대로 목록/마크다운
  위주의 긴 답변을 했다. `useConversationMachine.ts`의 `SYSTEM_PROMPT` 상수로 "1~3문장, 목록/
  마크다운 금지, 짧은 되물음"을 지시해 PRD 1장의 "아침 10분 스몰토크" 톤에 맞춘다 — 부수적으로
  서버의 프롬프트 캐싱 경로(`cache_control: ephemeral`)도 이때 처음 실제로 쓰이게 됐다. 배경은
  `docs/log/DECISIONS.md` 2026-08-25 항목 참고.

## 5. 어댑터 분리 설계 근거

### `SpeechInputEngine` → `WebSpeechInputEngine` (Day 3)

- **인터페이스 변경**: Day 1 시그니처(`start(onInterimResult, onSpeechEnd)`)에는 에러를 상위에
  알릴 방법이 없었다. 실제 구현 중 발견해 사람 확인 후 `onError` 콜백을 추가했다
  (`docs/log/DECISIONS.md` 2026-08-24 참고). `SpeechInputError`는 브라우저의
  `SpeechRecognitionErrorCode`를 그대로 노출하지 않고 `SpeechInputErrorReason`(예:
  `permission-denied`, `no-speech`, `audio-capture`, `network`)으로 번역해서 올린다 — 상위
  상태머신이 브라우저 전용 타입을 몰라도 되게 하기 위함(7장 어댑터 분리 원칙).
- **feature detection**: `window.SpeechRecognition ?? window.webkitSpeechRecognition` 생성자
  존재 여부만 체크(`isSpeechInputSupported()`). Safari는 생성자가 존재해 "지원함"으로 판정되며,
  이는 UA 스니핑을 피하기 위한 의도된 선택 — 실제로는 Safari의 `continuous` 모드에 런타임 버그가
  있다는 걸 알지만(MDN/WebKit 이슈 트래커로 확인), API 부재와 런타임 버그는 다른 문제라고 보고
  표준 feature-detection만 쓰기로 사람 확인 후 결정(`docs/log/DECISIONS.md` 참고).
- **구두점 자동 추론(`unspokenPunctuation`, 실험적 기능, 사람 확인 후 결정)**: 사용자가 실기기
  테스트 중 "말끝을 올려 질문해도 '?'가 안 붙는다"고 지적 → 확인해보니 Web Speech API 자체가
  기본적으로 구두점 없는 텍스트만 주고, Chrome 151+에 추가된 `unspokenPunctuation`(MDN
  "Experimental", 기본값 `false`)을 켜야 마침표/쉼표/물음표를 추론해서 넣어준다는 걸 확인.
  `recognition.unspokenPunctuation = true`로 활성화. 미지원 브라우저에서는 존재하지 않는
  프로퍼티 대입이라 에러 없이 무시됨. **알려진 불확실성**: 공식 explainer는 "자연스러운 멈춤 +
  문법 구조" 기반이라고만 설명 — 억양(피치)만으로 의문문을 판별하는지는 근거를 못 찾아 100%
  기대한 대로 물음표가 붙는다고 보장하지 않는다.
  **실기기 확인 결과**: 켜도 실제 크롬에서는 "?"가 붙지 않음을 확인 — 이 Experimental
  기능이 기대만큼 동작하지 않는 사례. 중요도가 낮다고 판단(사람 확인)해 더 파고들지 않고
  코드는 그대로 둠(무해한 설정이라 되돌릴 이유 없음).
- **`onInterimResult` 콜백 값**: 브라우저의 `SpeechRecognitionEvent.results`는
  `resultIndex`부터의 "변경분"만 담고 있지만, 매번 세션 시작 이후 누적된 전체 텍스트를 조립해서
  통째로 넘긴다 — 호출자가 브라우저 이벤트의 인덱싱 구조를 몰라도 화면에 그대로 표시할 수 있게
  하기 위한 선택(구현 세부사항, 인터페이스 시그니처와 무관해 임의로 결정).
- **`onSpeechEnd` ↔ 브라우저 `speechend` 이벤트 매핑**: PRD 6장의 "무음 타이머(~1.2초) 기반
  발화 종료 감지"는 이번 단계 범위 밖(다음 단계에서 별도로 구현 예정)이라, 지금은 브라우저의
  네이티브 `speechend` 이벤트를 그대로 전달만 한다. **알려진 불확실성**: `continuous: true`
  모드에서 `speechend`가 발화당 몇 번, 정확히 몇 초의 무음 후에 발생하는지는 MDN에 명시돼 있지
  않고 브라우저마다 다를 수 있어, 다음 단계(커스텀 무음 타이머 구현)에서 실제 브라우저로 타이밍을
  다시 실측해야 한다.
- **continuous 세션 자동 재시작**: `continuous: true`여도 브라우저가 예고 없이 세션을 끊을 수
  있다(장시간 무음 등, 브라우저별 동작). `stop()`을 호출한 적이 없고 직전 에러가 치명적이지
  않았다면(`no-speech`만 재시작 허용, `permission-denied`/`audio-capture`/`network`/`aborted`는
  재시작 안 함) 같은 인스턴스에서 `recognition.start()`를 다시 불러 "계속 듣기" 의도를 지킨다 —
  `continuous: true`를 요청한 이상 필요한 동작이라고 판단해 별도 확인 없이 구현, 근거는 여기 기록.
- **마이크 권한 플로우**: `SpeechInputEngine`엔 별도 권한 요청 메서드가 없다(Day 1부터 없었고
  이번에도 추가하지 않음) — Web Speech API 자체가 `recognition.start()` 호출 시 브라우저가
  필요하면 알아서 권한 프롬프트를 띄우는 구조라, `NotificationSetup`의 `Notification.requestPermission()`과
  달리 별도 "요청" API가 없다. 권한 상태(허용/거부)는 `start()` 이후 `onerror`의
  `not-allowed`/`service-not-allowed` → `permission-denied`로만 알 수 있다.
- **실제 실행 검증**: Playwright(headless Chromium)로 (1) `webkitSpeechRecognition` 생성자
  존재 확인, (2) 생성자를 제거한 뒤 재로드 시 미지원 안내 문구 노출 + 시작 버튼 미노출, (3)
  `context.grantPermissions(['microphone'])` + fake device로 정상 listening 진입(실제 발화
  인식은 headless 환경 특성상 검증 불가, 에러 없이 listening 상태 진입까지만 확인), (4) 브라우저의
  실제 마이크 권한 다이얼로그는 headless 환경에서 응답 없이 무한 대기하는 제약이 있어(Day 2의
  `Notification.permission` headless 제약과 같은 종류) `SpeechRecognitionErrorEvent`와 동일한
  모양의 가짜 생성자를 주입해 `not-allowed`/`service-not-allowed`(차단 안내 노출) /
  `audio-capture`/`network`(에러 배너 노출, 재시작 안 함) / `no-speech`(재시작 허용) 5가지
  에러 경로를 모두 확인, (5) 시작/중지 버튼 상태 토글 및 정상 종료 확인. 콘솔 unhandled error 없음.
  `npx tsc -b`, `npm run lint` 모두 통과.
- **임시 디버그 UI**: `src/components/SpeechInputDemo/SpeechInputDemo.tsx`를 `App.tsx`에 임시로
  붙여 눈으로 확인 가능하게 함(Day 2의 `NotificationSetup` 임시 배치와 같은 패턴).
  `ConversationScreen`이 생기면 이 데모는 제거하고 실제 화면으로 통합 필요.

### `SpeechOutputEngine` → `WebSpeechSynthesisEngine` (Day 5)

- **Day 1 시그니처 그대로 구현**: `speak(text: string, onEnd: () => void): void`. 이번 작업은
  "마이크 mute용 새 인터페이스 메서드를 추가하지 말 것"이라는 스코프 제약이 있어, TTS 쪽
  인터페이스도 확장하지 않고 그대로 구현했다.
- **재생 실패도 `onEnd`로 처리**: 인터페이스에 `onError`가 없어, `SpeechSynthesisUtterance`의
  `error` 이벤트(예: `synthesis-failed`, `voice-unavailable` — MDN
  `SpeechSynthesisErrorEvent.error`로 확인)도 `onEnd`를 호출해 "일단 끝난 것"으로 취급한다 —
  그래야 재생 실패가 자동 사이클을 영원히 멈추게 하지 않는다.
- **인터페이스 밖 `cancel()`**: 수동 "중지/초기화" 시 재생 중인 음성을 즉시 멈추기 위한
  구현체 전용 메서드(호출자가 `WebSpeechSynthesisEngine` 인스턴스를 직접 참조할 때만 씀).
  `SpeechOutputEngine` 인터페이스엔 없음 — 근거는 `docs/log/DECISIONS.md` 참고.
  `cancel()` 호출 시 브라우저는 `end`가 아니라 `error`(사유 `canceled`/`interrupted`)를 내는데
  (MDN `SpeechSynthesisErrorEvent.error`로 직접 확인, 추측 아님), `canceledByCaller` 플래그로
  이 경우엔 `onEnd`를 다시 부르지 않는다 — 호출자(`useConversationMachine`)가 이미 다음 상태
  전환을 처리했기 때문(`WebSpeechInputEngine`의 `stoppedByCaller`와 동일한 패턴).
- **Chromium 장문 재생 버그 우회**: 실제 브라우저 검증 중 Claude 응답(150자 이상)을 재생하면
  `speechSynthesis.speaking=true`인 채로 아무 이벤트 없이 멈추고 `onend`가 영원히 안 오는
  현상을 발견 — Chromium 공식 이슈(41294170/679437, "약 15초 후 멈춤")로 확인된 버그였다.
  재생 중 5초 간격으로 `speechSynthesis.resume()`을 호출하는 워크어라운드를 넣었다(공식 해결책
  없음, 커뮤니티 문서화된 유일한 우회법). 이 환경에서 실측해보니 14초 간격으로는 못 막았고
  5초 간격에서는 재현되지 않았다 — 근본적으로는 system 프롬프트로 응답 길이 자체를 줄인 것이
  더 크게 기여했다(아래, `docs/log/DECISIONS.md` 참고).
- **마이크 mute 배선**: `assistant_speaking` 진입 시(`useConversationMachine.playAssistantSpeech`)
  마이크(`SpeechInputEngine`)의 `stop()`을 먼저 부르고, TTS `onEnd`에서 `engineFactory()`로 새
  인스턴스를 만들어 `start()` — 새 인터페이스 메서드(pause/resume) 없이 기존 `stop()`/`start()`
  재호출만으로 mute를 구현(사람이 확정한 스코프, `docs/log/DECISIONS.md` 참고). 재개된 마이크는
  직전 continuous 세션을 이어받지 않고 항상 새 세션으로 시작된다(의도된 동작).
- **미지원 환경 폴백**: `'speechSynthesis' in window`가 아니면 `onEnd()`를 즉시 호출해 스킵 —
  TTS가 없어도 자동 사이클이 멈추지 않는다(텍스트 스트리밍은 이미 다 됐으니 TTS만 건너뜀).
- **실제 실행 검증(Playwright + 실제 Claude API + 실제 헤디드 Chrome, 페이크 마이크만 주입)**:
  마이크 mute(엔진 `stop()`/`start()` 타임라인), 실제 `speechSynthesis.speak()` 호출과 실제
  `utterance.onstart`/`onend` 타이밍, 3턴 연속 자동 사이클(`assistant_speaking → listening` →
  새 마이크 인스턴스 재시작 확인)을 모두 실제 브라우저 실행 결과로 확인. 응답 길이를 짧게 바꾼
  뒤(아래 system 프롬프트) 3턴 모두 TTS가 끝까지 재생되고 정상적으로 `listening`에 복귀함을
  확인.

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

## 6. 상태 갤러리 라우트

- 링크/경로: 
- 커버하는 상태 목록: idle / listening / streaming / error / empty / 권한거부 등

## 7. MVP vs 스트레치 스코프 판단 근거

*(작성 예정 — 실제로 무엇을 자르거나 유지했는지, `docs/log/DECISIONS.md` 링크)*
