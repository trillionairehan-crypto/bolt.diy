다음 감사 영역: 생성

[완료] ChatBox.tsx 전송 버튼이 공백만 입력해도 활성화(input.length 기준) → trim 기준으로 수정 — aff3c5c
[완료] PromptClarification.tsx "바로 만들기"/"만들기" 더블탭 시 onComplete(→generateNewApp) 중복 호출 가능 → completedRef 가드 추가 — aff3c5c
[완료] PromptClarification.tsx "바로 만들기"/"직접 입력할게요" 버튼 터치 타겟이 32~36px로 44px 미만 → min-h-11로 수정 — aff3c5c
[완료] PromptClarification.tsx 직접입력 인풋이 IME 조합 중 Enter로 오submit 가능 → isComposing 가드 추가 — aff3c5c
[완료] BaseChat.tsx 3단계 안내 배지가 다크모드에서도 라이트모드 고정 #FF5330 사용 → var(--accent)/var(--on-accent)로 수정 — aff3c5c
[완료] 설정 모달(ControlPanel.tsx) w-[1200px] 고정 → 모바일 뷰포트 오버플로 — 7800fa8
[완료] Design Palette 다이얼로그(ColorSchemeDialog.tsx) min-w-[480px]가 max-w-[90vw] 무력화 → 모바일 오버플로 — 7800fa8
[완료] Preview.tsx 창 크기 드롭다운 하드코딩 색상 — ccafd7d
[완료] Workbench.client.tsx 저장 동기화 드롭다운 하드코딩 색상 — a89d0ee
[완료] bolt-elements-*-dark 죽은 토큰 참조 정리 (ui/12개 파일) — f06ca52
[완료] bolt-elements-*-dark 죽은 토큰 참조 정리 (GitHub/GitLab 배포 다이얼로그) — 6d88330
[완료] Phase2 사이클1(온보딩) PromptClarification.tsx #FF5330 하드코딩 → var(--accent) — 4769e51
[완료] Phase2 사이클2(생성) Artifact.tsx/Messages.client.tsx #FF5330 하드코딩 → var(--accent) — 5858f4c
[완료] Phase2 사이클3(미리보기/워크벤치) FileTree.tsx 선택 파일 좌측 보더 #FF5330 하드코딩 → var(--accent) — 0a7fc9d
[완료] Phase2 사이클4(배포) GitHubDeploymentDialog.tsx/GitLabDeploymentDialog.tsx #FF5330/#E44A28 하드코딩 → var(--accent)/var(--on-accent)/var(--accent-hover) — cf6f6d9
[완료] Phase2 사이클6(다크모드) ChatBox/Slider/APIKeyManager/ModelSelector/Menu.client/HistoryItem/ChatErrorBoundary/root.tsx 하드코딩 accent hex → var(--accent) 계열 — b204747
[손절] CORALRED_NEW_METERING 메터링 버그 — 코드 수정은 이미 준비돼 있으나 DB 마이그레이션(RUN-1-metering.sql) 미적용 확인 전에 플래그를 켜면 로그인 사용자 전체 생성 차단 장애 위험. 사람이 먼저 Supabase에 마이그레이션 적용 후 재시도 필요 (자세한 내용 OVERNIGHT5_BLOCKED.md)

## 참고 (큐 항목 아님)
- OVERNIGHT5_QUEUE.md 파일 자체가 유실되어 있어 한 사이클에 OVERNIGHT5_PROGRESS.md/BLOCKED.md/IMPROVEMENTS.md 및 git log를 근거로 재구성함. Phase 1(우선순위 수정 4건)은 모두 완료·커밋됨. 현재는 Phase 2(무한 검증 루프) 진행 중.
- app/routes/pricing.tsx에 커밋 안 된 실제 PortOne 결제 연동 변경(loader + requestPayment 호출)이 작업 트리에 계속 남아있음(사이클 6 기준 여전히 미커밋). 이 세션들이 만든 변경이 아니고, 실제 결제 SDK를 호출하는 미완성 기능(서버 측 재검증 TODO 미해결)이라 자동 세션이 임의로 커밋하거나 되돌리지 않고 그대로 둠. 아침에 사람이 직접 검토 필요.
- 사이클 5(감사 대상: 요금제/결제)에서 코드 수정 없이 감사만 진행 — 발견 사항은 전부 구조적(인증/티어 시스템 부재)이라 OVERNIGHT5_IMPROVEMENTS.md 항목 4로 기록. 자세한 내용은 PROGRESS.md 사이클 5 기록 참고.
- 사이클 6(감사 대상: 다크모드)에서 서브에이전트로 앱 전체 재검색, 이전 사이클들이 놓친 같은 버그 클래스(하드코딩 accent hex) 9곳(7개 파일)을 찾아 전부 수정·테스트 추가·커밋함(b204747). `app/utils/globalErrorRecovery.ts`의 React 트리 밖 크래시 카드는 판단 보류로 IMPROVEMENTS.md 항목 1에 남김(의도적 설계인지 불명확). `app/components/chat/StarterTemplates.tsx`는 프로덕션에서 도달 불가한 죽은 코드 경로로 확인되어 손 안 댐. `app/root.tsx`의 404 히어로는 의도된 고정 코랄로 재확인, 그대로 둠.
