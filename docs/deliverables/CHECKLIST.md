# CHECKLIST.md — 최종 산출물 체크리스트

> PRD 12장을 그대로 가져온 진행 상태 트래킹용 문서. 완료되는 대로 체크한다.

- [x] 동작하는 웹앱 (배포 링크): https://magpie-five-iota.vercel.app (GitHub↔Vercel 자동 배포 연동 확인, 알림 클릭→대화 화면 자동 전환 포함 실배포본 검증 완료 — docs/log/DEVLOG.md Day 7 참고)
- [x] 상태 갤러리 디버그 라우트 (핵심 상태 6종 축소 버전, `docs/deliverables/COMPONENT.md` 6장)
- [x] 컴포넌트 문서 (`docs/deliverables/COMPONENT.md`, 9장 "알려진 한계" 포함 Day 7 최종 취합)
- [x] 성능·접근성 리포트 (`docs/deliverables/PERFORMANCE_REPORT.md`, 엔진 교체 용이성 검증 포함 Day 7 최종 취합)
- [ ] 데모 녹화 5종 — 아직 미완료, 사람이 직접 녹화 필요
  - [ ] 알림 → 자동 턴테이킹 3~5턴 전체 사이클
  - [ ] 오탐 발생 후 "이어서 말하기" 복구
  - [ ] 마이크 미지원/거부 시 텍스트 폴백
  - [ ] Network 탭 청크 단위 스트리밍 증빙
  - [ ] 스크린리더 상태 변화 시연
- [x] MVP/스트레치 스코프 분리 근거 설명 (발표용, `docs/deliverables/COMPONENT.md` 7장 + `docs/log/DECISIONS.md` 참고)
- [x] 비용 최적화 전략 설명 (윈도잉/캐싱/모델 라우팅, `docs/deliverables/COMPONENT.md` 4장 + `api/claude-stream.ts`의 CLAUDE_MODEL 화이트리스트 참고)
- [x] 플랫폼 어댑터 분리 설계 근거 설명 (발표용, `docs/deliverables/COMPONENT.md` 5장 + `docs/rules/ARCHITECTURE.md` 참고)
