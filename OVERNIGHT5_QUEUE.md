다음 감사 영역: 미리보기/워크벤치

[완료] Preview.tsx 창 크기 드롭다운 하드코딩 색상 — ccafd7d
[완료] Workbench.client.tsx 저장 동기화 드롭다운 하드코딩 색상 — a89d0ee
[완료] bolt-elements-*-dark 죽은 토큰 참조 정리 (ui/12개 파일) — f06ca52
[완료] bolt-elements-*-dark 죽은 토큰 참조 정리 (GitHub/GitLab 배포 다이얼로그) — 6d88330
[완료] Phase2 사이클1(온보딩) PromptClarification.tsx #FF5330 하드코딩 → var(--accent) — 4769e51
[완료] Phase2 사이클2(생성) Artifact.tsx/Messages.client.tsx #FF5330 하드코딩 → var(--accent) — 5858f4c
[손절] CORALRED_NEW_METERING 메터링 버그 — 코드 수정은 이미 준비돼 있으나 DB 마이그레이션(RUN-1-metering.sql) 미적용 확인 전에 플래그를 켜면 로그인 사용자 전체 생성 차단 장애 위험. 사람이 먼저 Supabase에 마이그레이션 적용 후 재시도 필요 (자세한 내용 OVERNIGHT5_BLOCKED.md)

## 참고 (큐 항목 아님)
- OVERNIGHT5_QUEUE.md 파일 자체가 유실되어 있어 이번 사이클에 OVERNIGHT5_PROGRESS.md/BLOCKED.md/IMPROVEMENTS.md 및 git log를 근거로 재구성함. Phase 1(우선순위 수정 4건)은 모두 완료·커밋됨. 현재는 Phase 2(무한 검증 루프) 진행 중이며 다음 감사 영역은 로테이션상 미리보기/워크벤치.
- app/routes/pricing.tsx에 커밋 안 된 실제 PortOne 결제 연동 변경(loader + requestPayment 호출)이 작업 트리에 남아있음. 이 세션이 만든 변경이 아니고(OVERNIGHT5_IMPROVEMENTS.md가 이미 이 파일을 "수정 금지 파일"로 기록해둔 시점에도 존재), 실제 결제 SDK를 호출하는 미완성 기능(서버 측 재검증 TODO 미해결)이라 자동 세션이 임의로 커밋하거나 되돌리지 않고 그대로 둠. 아침에 사람이 직접 검토 필요.
