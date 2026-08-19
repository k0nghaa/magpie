# CLAUDE.md — 매그파이 PoC 프로젝트 지시서

> 이 문서는 레포 **루트**에 위치해야 하며, Claude Code가 세션 시작 시 자동으로 읽는 파일입니다.
> 여기엔 매일 필요한 핵심 규칙만 짧게 요약합니다. 상세 내용은 아래 "상세 문서" 섹션의 파일을
> 필요할 때 열어서 참고하세요 (매번 전부 읽을 필요 없음).

## 상세 문서 (필요할 때만 열어서 참고)

- 그날의 작업 지시(Day N 섹션 전체): `docs/rules/PRD.md`
- 어댑터 분리·상태머신 설계 상세: `docs/rules/ARCHITECTURE.md`
- 오늘까지의 작업 기록: `docs/log/DEVLOG.md`
- 설계 변경/스코프 축소 결정 이력: `docs/log/DECISIONS.md`
- 컴포넌트 설계 문서: `docs/deliverables/COMPONENT.md`
- 성능·접근성 리포트: `docs/deliverables/PERFORMANCE_REPORT.md`
- 최종 산출물 체크리스트: `docs/deliverables/CHECKLIST.md`

작업 지시를 받을 때 "Day N 작업해줘"처럼 어떤 문서가 필요한지 애매하면, 위 목록에서
관련 있어 보이는 파일을 먼저 열어 확인한 뒤 작업을 시작합니다.

## 프로젝트 한 줄 요약

"알림 → 대화 시작 → LLM과 스트리밍 자연스러운 대화" 라는 **단 하나의 코어 루프**만 검증하는
7일짜리 PoC. 프론트엔드 캠프 과제 제출용. 전체 앱이 아님.

## 반드시 지킬 비목표 (Non-goals) — 임의로 만들지 말 것

- 회원가입/로그인/사용자 계정
- 결제, 구독 로직
- 대화 히스토리 영구 저장, 학습 통계/대시보드
- 네이티브 앱 배포 (웹앱 한정)
- 브라우저 완전 종료 후 오는 푸시 알림 (스트레치 목표로만 취급)
- 실제 회화 학습 커리큘럼 설계

## 확정 기술 스택 (임의 변경 금지, 변경 시 PRD 5장·7장 함께 수정)

- React + Vite + TypeScript
- 상태관리: 대화 화면은 `useReducer` 기반 상태머신 / 전역 설정은 Zustand 또는 Context
- Tailwind CSS
- Anthropic Messages API, `stream: true` (SSE)
- API 키는 Vercel Serverless Function 뒤로 프록시 — **프론트에 절대 노출 금지**
- STT: Web Speech API (`webkitSpeechRecognition`), 미지원 시 텍스트 모드 자동 폴백
- TTS: Web Speech API (`SpeechSynthesis`)
- 알림: Notification API + Service Worker (`vite-plugin-pwa`), 클라이언트 타이머 기반
- 번들 분석: `rollup-plugin-visualizer`
- 모델: 개발/테스트는 `claude-haiku-4-5`, 최종 데모/리포트 캡처는 `claude-sonnet-5`

## 대화 화면 상태머신 (요약 — 상세는 PRD 6장)

```
assistant_speaking → (TTS 종료) → listening
listening → user_speaking → (무음 1.2초 or 텍스트 전송) → sending
sending → streaming → assistant_speaking → listening (반복)
어느 상태든 실패 → error → (재시도) → listening
안전장치: user_speaking/sending 중 "이어서 말하기" 클릭 → listening 강제 복귀
```

`useReducer`로 구현하여 불가능한 상태 조합(예: streaming이면서 동시에 listening)을 원천 차단.
상태 전환은 자동 발생하므로 각 상태 진입 시 `aria-live`로 스크린리더에 알릴 것.

## 어댑터 분리 원칙 (PRD 7장) — 절대 로직과 섞지 말 것

로직 레이어(재사용)와 어댑터 레이어(교체 대상)를 분리한다. 새 기능을 짤 때 아래 인터페이스 뒤에
브라우저 API를 캡슐화할 것:

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
// 이번 주 구현체: WebSpeechInputEngine, WebSpeechSynthesisEngine, BrowserNotificationEngine
```

상태머신, 무음 감지 후 턴 전환 규칙, LLM 스트리밍 파싱 로직은 어댑터 구현체를 몰라야 한다.

## 비용 통제 원칙 (PRD 8장)

1. 대화 히스토리 전체 재전송 금지 — 최근 N턴만 윈도잉
2. 시스템 프롬프트는 프롬프트 캐싱 적용
3. `max_tokens`로 응답 길이 상한
4. 반복 테스트는 Haiku로

## 작업 방식

1. 매일 그날의 PRD Day 섹션 + 이 문서를 함께 컨텍스트로 제공받는다.
2. 작업 중 설계 변경/스코프 축소가 필요하면 임의로 진행하지 말고 먼저 알린다 →
   사람이 확인 후 `docs/log/DECISIONS.md`에 기록.
3. 컴포넌트를 만들 때마다 `docs/deliverables/COMPONENT.md`에 설계 근거를 바로 추가한다 (Day 7에 몰아쓰지 않는다).
4. 그날 작업이 끝나면 `docs/log/DEVLOG.md`의 해당 Day 항목을 채운다.