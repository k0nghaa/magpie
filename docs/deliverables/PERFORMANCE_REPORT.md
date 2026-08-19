# PERFORMANCE_REPORT.md — 성능·접근성 리포트

> Day 6에 수치를 채운다. 표 틀만 미리 준비해둔다.

## Lighthouse

| 항목 | 개선 전 | 개선 후 | 목표 |
|---|---|---|---|
| Performance | | | 90+ |
| Accessibility | | | 95+ |

## 번들 크기 (코드 스플리팅 전/후)

| 항목 | 전 | 후 |
|---|---|---|
| 초기 번들 크기 | | |
| `ConversationScreen` 청크 분리 여부 | | |

첨부: `rollup-plugin-visualizer` 트리맵 스크린샷 (전/후 각 1장)

## 체감 첫 상호작용 (TTI / 커스텀 계측)

| 계측 지점 | 전 | 후 |
|---|---|---|
| "로드 시작" ~ "설정 화면 상호작용 가능 시점" | | |

`performance.mark()` 계측 방식 메모: 

## 접근성 수동 점검

- [ ] 키보드만으로 전체 플로우 조작 가능
- [ ] 스크린리더로 상태 변화(`aria-live`) 인지 가능
- [ ] 명도 대비 확인
- [ ] 음성 미지원 브라우저(Safari 등)에서 텍스트 모드 자동 전환 확인

## 엔진 교체 용이성 검증

mock `SpeechInputEngine`/`SpeechOutputEngine`/`ReminderEngine`으로 교체 시
상태머신이 무변경으로 동작하는지: 
