# PERFORMANCE_REPORT.md — 성능·접근성 리포트

> Day 6에 수치를 채운다. 표 틀만 미리 준비해둔다.

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

- [ ] 키보드만으로 전체 플로우 조작 가능
- [ ] 스크린리더로 상태 변화(`aria-live`) 인지 가능
- [ ] 명도 대비 확인
- [ ] 음성 미지원 브라우저(Safari 등)에서 텍스트 모드 자동 전환 확인

## 엔진 교체 용이성 검증

mock `SpeechInputEngine`/`SpeechOutputEngine`/`ReminderEngine`으로 교체 시
상태머신이 무변경으로 동작하는지: 
