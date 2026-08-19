# DEVLOG.md — 일자별 작업 기록

> 매일 작업이 끝나면 해당 Day 항목을 채운다. "AI에게 뭘 시켰는지 / 뭐가 끝났는지 / DoD 통과 여부"를
> 남겨두면 발표 자료 및 회고에 그대로 쓸 수 있다.

## Day 1 — 설계 & 셋업

- 요청 내용:
  1. React + Vite + TypeScript 프로젝트 초기 셋업, Tailwind CSS 설정, `src/adapters`·`src/state-machine`·`src/components`·`src/api` 폴더 구조 확보, `.gitignore` 점검
  2. ARCHITECTURE.md에 정의된 `SpeechInputEngine`/`SpeechOutputEngine`/`ReminderEngine` 인터페이스 타입만 정의 (구현체 없음)
  3. Vercel Serverless Function(`api/claude-stream.ts`)으로 Anthropic Messages API `stream: true` 프록시 + SSE 중계 구현, API 키 미노출 자체 점검
  4. 로컬에서 실제 Claude API 스트리밍 응답이 콘솔에 청크 단위로 찍히는지 실행 검증
- 완료 사항:
  - Vite + React + TS 스캐폴딩, Tailwind v4(`@tailwindcss/vite`) 적용, 템플릿 데모 잔재 제거
  - `src/adapters`, `src/state-machine`, `src/components`, `src/api` 빈 폴더 확보
  - `.gitignore`에 `.env`류 및 `.omc/`(OMC 런타임 상태) 추가
  - `src/adapters/types.ts`에 어댑터 인터페이스 3종 정의 (ARCHITECTURE.md 원문 그대로, 시그니처 변경 없음)
  - `api/claude-stream.ts` 작성: `@anthropic-ai/sdk`의 `messages.stream()` 사용, raw SSE 이벤트를 그대로 `data: ...\n\n`로 중계. API 키는 `process.env.ANTHROPIC_API_KEY`로만 읽음(`VITE_` 접두사 미사용) → 프론트 번들에 노출되지 않음을 `vite build` 결과(번들 크기 불변, 190.49kB)로 확인
  - 모델은 클라이언트가 아니라 서버 환경변수 `CLAUDE_MODEL`로만 전환(기본값 `claude-haiku-4-5`), `max_tokens` 1024 하드 캡, 시스템 프롬프트에 `cache_control: ephemeral` 적용 (CLAUDE.md 8장 비용 통제 원칙 반영)
  - `scripts/verify-claude-stream.ts` 작성: 로컬 HTTP 서버에 `api/claude-stream.ts` 핸들러를 그대로 얹어 실제 Anthropic API로 스트리밍 요청 → 응답을 타임스탬프와 함께 콘솔에 출력하는 검증 스크립트 (`npm run verify:stream`)
  - 실제 실행 결과 (2026-08-19, 로컬):
    ```
    응답 상태: 200 OK
    [+863ms] chunk #1 (663 bytes)
    [+864ms] chunk #2 (101 bytes)
    [+1141ms] chunk #3 (215 bytes)
    [+1149ms] chunk #4 (246 bytes)
    [+1152ms] chunk #5 (14 bytes)
    조립된 최종 응답: "바다가 파란 이유는 물이 빨간색 빛을 흡수하고 파란색 빛을 반사하기 때문입니다."
    총 청크 5개, 총 소요 1152ms
    ```
    → 여러 청크가 시간차를 두고 도착 (863ms → 1152ms) = 진짜 스트리밍 확인, 버퍼링된 단일 응답 아님
- DoD 체크: [x] 로컬에서 프록시 통해 Claude API 스트리밍 응답 콘솔 확인
- 이슈/메모:
  - 로컬 검증에 Vercel CLI(`vercel dev`) 대신 Node `http` 서버로 핸들러를 직접 감싸는 방식 사용 (계정 연동 없이 실제 API 키만으로 검증 가능하게 하려는 목적, 핸들러 코드 자체는 배포용 `api/claude-stream.ts`와 동일)
  - `src/api/claudeProxy.ts`(클라이언트 호출부, ARCHITECTURE.md 폴더 구조 제안)는 아직 미작성 — Day 4(LLM 스트리밍 화면 연동) 때 작업
  - `SpeechInputEngine` 등 어댑터 구현체(`WebSpeechInputEngine` 등)는 Day 3에서 작업

## Day 2 — 알림 플로우

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] 임의 시각 지정 후 실제 알림 표시 [ ] 권한 거부 시 대체 문구 노출
- 이슈/메모:

## Day 3 — 음성 입력 & 자동 턴 감지

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] 실시간 인식 텍스트 반영 [ ] 무음 시 자동 전송 [ ] 오탐 복구 버튼 동작 [ ] 미지원 환경 텍스트 폴백
- 이슈/메모:

## Day 4 — LLM 스트리밍

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] 마이크/텍스트 입력 → 실제 스트리밍 렌더링 확인
- 이슈/메모:

## Day 5 — TTS & 자동 사이클 완성

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] Happy Path 3턴 이상 클릭 없이 자동 반복 완주
- 이슈/메모:

## Day 6 — 성능 & 접근성

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] Lighthouse 전/후 [ ] 번들 트리맵 전/후 [ ] TTI 계측 전/후 [ ] 상태 갤러리 라우트 확인
- 이슈/메모:

## Day 7 — 문서화 & 마무리

- 요청 내용:
- 완료 사항:
- DoD 체크: [ ] 산출물 3종 + 데모 녹화 5종 준비 완료
- 이슈/메모:
