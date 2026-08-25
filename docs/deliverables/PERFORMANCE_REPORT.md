# PERFORMANCE_REPORT.md — 성능·접근성 리포트

> Day 6에 수치를 채우고 Day 7에 최종 취합(엔진 교체 용이성 검증 포함)했다.

## Lighthouse

측정 대상: `NotificationSetup`(초기 화면), `npm run build` 산출물을 `vite preview`로 로컬
서빙(localhost, 네트워크 지연 없음) 후 Lighthouse CLI 1회 측정(`--only-categories=performance,accessibility`).
"전"은 코드 스플리팅 커밋(`e88d3e6`)의 부모 커밋(`72bcd87`)을 별도 git worktree에 체크아웃해
동일한 `performance.mark()` 계측 코드만 임시로 추가(커밋하지 않음)한 뒤 빌드해 측정했다 — 코드
스플리팅 여부 외 다른 조건은 동일.

| 항목 | 개선 전 | 개선 후 | 목표 |
|---|---|---|---|
| Performance | 100 | 100 | 90+ |
| Accessibility | 100 | 100 | 95+ |
| Total Blocking Time(참고) | 80 ms | 60 ms | - |
| First Contentful Paint(참고) | 1.3 s | 1.3 s | - |
| Largest Contentful Paint(참고) | 1.5 s | 1.5 s | - |
| Speed Index(참고) | 1.3 s | 1.3 s | - |

**정직한 평가**: 이 PoC는 초기 번들이 애초에 매우 작아서(200KB대) 전/후 모두 Performance/
Accessibility 점수가 이미 100/100으로 만점이라 점수 자체로는 개선이 드러나지 않는다.
Total Blocking Time만 80ms→60ms로 소폭 줄었고(전/후 각 1회 측정이라 노이즈 범위일 수 있음),
FCP/LCP/Speed Index는 로컬호스트 환경(네트워크 지연 없음)에서 초 단위로는 차이가 안 보였다.
즉 **점수/체감 지표로는 유의미한 개선을 주장하기 어렵다** — 이번 코드 스플리팅의 실질적
효과는 아래 "번들 크기" 절의 전송 바이트 감소(대화 화면 미진입 시 청크 자체를 안 받음)로
보는 게 정확하다. 원본 리포트: `docs/deliverables/lighthouse-raw/before.report.html`,
`docs/deliverables/lighthouse-raw/after.report.html`.

## 번들 크기 (코드 스플리팅 전/후)

`App.tsx`에서 `ConversationScreen`을 `React.lazy(() => import('./ConversationScreen.tsx'))`로
분리(`NotificationSetup` 진입 시 함께 로드되지 않도록). 측정: `npm run build` 산출물 기준.

| 항목 | 전 | 후 |
|---|---|---|
| 초기 번들 크기(`index-*.js`) | 207.92 kB (gzip 66.21 kB) | 196.21 kB (gzip 62.40 kB) |
| `ConversationScreen` 청크 분리 여부 | 미분리(초기 번들에 포함) | 분리됨 — `ConversationScreen-*.js` 11.94 kB (gzip 4.63 kB), 대화 화면 진입 시에만 로드 |

초기 번들에서 약 11.7 kB(gzip 3.8 kB)가 별도 청크로 빠져나갔다. `NotificationSetup`만 보는
사용자(대화 화면에 진입하지 않는 경우)는 이 청크를 아예 내려받지 않는다.

첨부: `rollup-plugin-visualizer` 트리맵 — `docs/deliverables/bundle-treemap-before.html`,
`docs/deliverables/bundle-treemap-after.html` (전/후 각 1개, 브라우저로 열어서 확인)

## 체감 첫 상호작용 (TTI / 커스텀 계측)

`performance.mark()` 계측 방식: `NotificationSetup`이 마운트되는 첫 `useEffect`에서
`performance.mark('notification-setup-interactive')`를 찍고,
`performance.measure('load-to-notification-setup-interactive', { start: 0, end: '...' })`로
네비게이션 타임 오리진(`start: 0`, PRD가 말하는 "로드 시작")부터의 경과 시간을 구한다
(`src/components/NotificationSetup/NotificationSetup.tsx`). Playwright로 매번 새
브라우저 컨텍스트(캐시 없음)를 열어 `npm run build` 산출물(`vite preview`, localhost)을
7회씩 로드해 `performance.getEntriesByName()`으로 수치를 읽었다. "전" 측정은 Lighthouse와
동일하게 git worktree로 격리한 코드 스플리팅 이전 커밋에 동일 계측 코드만 임시로 얹어 측정.

| 계측 지점 | 전 (7회, ms) | 후 (7회, ms) |
|---|---|---|
| 각 회차 | 55.5 / 56.6 / 57.1 / 58.7 / 59.9 / 68.1 / **557.2** | 56.3 / 56.9 / 59.3 / 60.5 / 72.0 / 84.1 / **154.9** |
| 중앙값 | **58.7 ms** | **60.5 ms** |

**정직한 평가**: 중앙값 기준 "후"(60.5ms)가 "전"(58.7ms)보다 오히려 1.8ms 더 크다 — 즉 이
지표에서는 개선을 주장할 수 없고, 두 값 모두 측정 노이즈(각 7회 중 1회는 550ms/155ms로 튀는
콜드스타트성 이상치가 있었음, 브라우저 프로세스/OS 스케줄링 영향으로 추정) 범위 안에서
사실상 동일하다고 보는 게 정확하다. 이유를 짚어보면: `NotificationSetup`이 상호작용
가능해지는 시점은 이 컴포넌트 자신의 렌더 완료 시점이지 `ConversationScreen` 코드 로딩
여부와 무관하다 — 스플리팅 전에도 두 컴포넌트가 "같은 번들에 같이 들어있을 뿐" `App`이
마운트 시 두 컴포넌트를 함께 파싱은 하지만 `ConversationScreen`을 실행(렌더)하지는 않으므로,
빠지는 건 약 12KB의 JS 파싱 비용뿐이고 이는 로컬 환경에서 이 정도 규모 앱 기준
수십 밀리초 단위 노이즈에 묻힌다. **즉 코드 스플리팅의 실질 이득은 "설정 화면이 얼마나
빨리 상호작용 가능해지는가"가 아니라 "대화 화면에 안 들어가면 그 코드를 아예 안 받는다"는
전송량 감소(번들 크기 절 참고)이며, 이 프로젝트 규모에서는 그 이상의 체감 성능 개선을
과장해서 보고하지 않는다.

## 접근성 수동 점검

상세 방법/결과는 `docs/deliverables/COMPONENT.md` 8장 참고 — 여기서는 요약만.

- [x] 키보드만으로 전체 플로우 조작 가능 — 마이크 경로/텍스트 폴백 경로 둘 다 `Tab`/`Enter`만으로
      완주 확인, 키보드 트랩 없음.
- [x] 스크린리더로 상태 변화(`aria-live`) 인지 가능 — 실제 음성 출력을 들은 것은 아니고 DOM의
      `[aria-live]`/`[role="alert"]` 텍스트를 상태별로 확인(정직한 한계 기록). 7개 상태 모두
      의도한 문구 확인. 사소한 발견 사항 1건(오류 상태에서 안내가 살짝 중복) — 낮은 우선순위로
      보고만 하고 수정 안 함.
- [x] 명도 대비 확인 — `axe-core`(WCAG2A+AA) 자동 검사, 위반 0건.
- [x] 음성 미지원 브라우저(Safari 등)에서 텍스트 모드 자동 전환 확인 — `SpeechRecognition` 생성자
      제거 재현으로 확인(Day 3 검증 + 이번 키보드 시나리오에서 재확인).

## 엔진 교체 용이성 검증 (Day 7)

PRD 3장 검증 기준: "mock 구현으로 교체해도 상태머신이 무변경으로 동작하는지 확인". 이 항목은
Day 3~6 어디에서도 실제로 실행된 적이 없어(코드상 `engineFactory` 의존성 주입 설계만 있고
실행 기록 없음) Day 7에 뒤늦게 채운다.

- **방법**: `useConversationMachine(engineFactory, ttsEngineFactory)`에 브라우저 API를 전혀
  참조하지 않는 최소 mock `SpeechInputEngine`/`SpeechOutputEngine`을 주입하고, 실제
  `react-dom/client` 렌더링(headless Chrome)으로 상태 전이를 관찰했다. 임시 하니스로
  작성해 실행 후 삭제(커밋하지 않음) — `scripts/verify-*.ts`처럼 상시 보관하기엔 React 렌더링이
  필요해 무게가 안 맞는다고 판단.
- **검증 결과(7개 항목 모두 통과)**:
  ```
  PASS: greet() 직후 idle → assistant_speaking
  PASS: greet() 문구가 mock TTS.speak()에 그대로 전달됨
  PASS: mock TTS 인스턴스 1개 생성됨
  PASS: TTS onEnd → assistant_speaking → listening
  PASS: TTS onEnd 이후 mock STT.start() 1회 호출됨(beginListeningEngine)
  PASS: mock STT interim 결과 → listening → user_speaking, transcript 반영
  PASS: 무음 타이머(1.2초) 경과 → user_speaking → sending(즉시 streaming/error로 배칭·전이될 수 있음, API 서버 미기동 환경)
  ```
- **결론**: `WebSpeechInputEngine`/`WebSpeechSynthesisEngine` 구현체를 전혀 참조하지 않는
  mock으로 교체해도 상태머신(리듀서, 무음 타이머, `greet`/`start`/`playAssistantSpeech` 흐름)이
  코드 변경 없이 그대로 동작함을 확인 — PRD 3장 요구사항 충족.
- **정직한 한계**: (1) 이 검증은 `SpeechInputEngine`/`SpeechOutputEngine` 두 어댑터만 다룬다.
  `ReminderEngine`(`BrowserNotificationEngine`)은 `NotificationSetup`이 직접 소유하고
  상태머신과 결합돼 있지 않아(어댑터 분리 원칙상 애초에 결합될 이유가 없음) 이 항목의 검증
  대상이 아니다. (2) 무음 타이머가 `sending`을 트리거한 직후 `runSendCycle()`이 실제 API로
  fetch를 보내는데, 이 하니스는 `dev:api` 서버를 띄우지 않은 채 실행해 곧바로
  `STREAM_ERROR`(`error`)로 이어졌다 — 이는 mock 엔진과 무관한 예상된 동작이고("무음 타이머가
  mock STT 엔진만으로 정상적으로 `sending`을 트리거했다"는 사실 자체가 이 검증의 목적), 실제
  스트리밍 파싱은 `verify:stream`/`verify:claude-proxy`가 별도로 담당한다.
