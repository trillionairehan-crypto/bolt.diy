다음 감사 영역: 배포

[완료] 미리보기/워크벤치 감사(사이클 19) — 파일 저장 후 미리보기 새로고침이 연결 끊긴 가짜 싱글턴을 호출해 매번 unhandled rejection + no-op이던 문제 수정, FileTree.tsx 예외 처리 토스트 6곳 영어 → 한국어 — (사이클 19)
[완료] 생성 감사(사이클 18, 2회차) — file 액션 filePath 누락 시 실행 큐 영구 정지 크래시 수정 — (사이클 18)
[완료] 온보딩 감사(사이클 17, 3회차) — PromptClarification.tsx `buildFinalPromptAndDirectives`가 앱별 동적 질문에서 "잘 모르겠어요"를 선택해도 고정 질문과 달리 무시하지 않고 "질문: 잘 모르겠어요" 문구를 그대로 생성 프롬프트에 추가하던 문제 → optionId==='unsure' 체크 추가 — (사이클 17)
[완료] 한국어 문구 감사(사이클 16) — ModelSelector.tsx 프로바이더/모델 검색 placeholder·aria-label·클리어 버튼, 무료/선택됨 배지 title, CodeBlock.tsx 복사 버튼 title이 영어로 하드코딩돼있던 문제 → 한국어로 번역 — (사이클 16)
[완료] Cloudflare 배포 API(api.cloudflare-deploy.ts)가 손상된 base64 파일 콘텐츠에 안내 없는 원시 500으로 크래시하던 문제 → try/catch로 감싸 친절한 한국어 400 응답 — (사이클 13)
[완료] GitHub/GitLab/Vercel/Netlify 배포 훅(useXDeploy)의 토스트/throw Error 문구가 CloudflareDeploy.client.tsx만 빼고 전부 영어 → 4개 파일 전부 한국어로 통일 — (사이클 12)
[완료] ExpoQrModal.tsx 안내 문구 3곳이 전부 영어(제목/설명/URL 없음 안내) → 한국어로 번역 — (사이클 11)
[완료] TerminalTabs.tsx 추가 터미널 탭 라벨 "Terminal {n}"이 영어 → "터미널 {n}"으로 번역 — (사이클 11)
[완료] Preview.tsx "새 창/탭에서 열기" 실패(팝업 차단/잘못된 URL/미리보기 없음) 시 콘솔 로그만 있고 사용자에게 아무 안내 없음 → toast.error 추가 — (사이클 11)
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
[완료] 법률 페이지(privacy/terms/LegalPageLayout) 링크 4곳이 하드코딩 #FF5330 라이트모드 코랄로 남아 다크모드 --accent와 어긋나던 문제 → var(--accent)로 통일 — (사이클 14)
[완료] 모바일 감사 2회차 — WebSearch.client.tsx/APIKeyManager.tsx 고정 w-[300px] 입력창, FileBreadcrumb.tsx min-w-[300px] 드롭다운(avoidCollisions=false와 겹쳐 화면 밖으로 밀릴 위험)이 375px 뷰포트에서 넘치던 문제 → w-[min(300px,calc(100vw-Nrem))] 패턴으로 수정 — (사이클 15)

## 참고 (큐 항목 아님)
- 사이클 12(감사 대상: 배포)에서 서브에이전트로 배포 표면 재검색, "GitHub/GitLab/Vercel/Netlify 배포 훅 double-click 레이스" 후보는 직접 코드 확인 결과 `DeployButton.tsx`가 5개 프로바이더 전부에 공유 `isDeploying` state로 버튼을 동시에 disabled 처리하고 있어 실질적 위험이 낮다고 판단(오탐에 가까움, 수정 안 함). 영어 토스트/에러 문구 4개 파일 전부는 실제 버그로 확인돼 수정·테스트·커밋함(`f7c5d57`). `VercelDeploymentLink.client.tsx`의 fetch 실패 무음 처리는 구조적 판단(에러 vs 미배포 구분 UX 설계 필요)이라 `OVERNIGHT5_IMPROVEMENTS.md`에 기록만 함.
- OVERNIGHT5_QUEUE.md 파일 자체가 유실되어 있어 한 사이클에 OVERNIGHT5_PROGRESS.md/BLOCKED.md/IMPROVEMENTS.md 및 git log를 근거로 재구성함. Phase 1(우선순위 수정 4건)은 모두 완료·커밋됨. 현재는 Phase 2(무한 검증 루프) 진행 중.
- app/routes/pricing.tsx에 커밋 안 된 실제 PortOne 결제 연동 변경(loader + requestPayment 호출)이 작업 트리에 계속 남아있음(사이클 6 기준 여전히 미커밋). 이 세션들이 만든 변경이 아니고, 실제 결제 SDK를 호출하는 미완성 기능(서버 측 재검증 TODO 미해결)이라 자동 세션이 임의로 커밋하거나 되돌리지 않고 그대로 둠. 아침에 사람이 직접 검토 필요.
- 사이클 5(감사 대상: 요금제/결제)에서 코드 수정 없이 감사만 진행 — 발견 사항은 전부 구조적(인증/티어 시스템 부재)이라 OVERNIGHT5_IMPROVEMENTS.md 항목 4로 기록. 자세한 내용은 PROGRESS.md 사이클 5 기록 참고.
- 사이클 6(감사 대상: 다크모드)에서 서브에이전트로 앱 전체 재검색, 이전 사이클들이 놓친 같은 버그 클래스(하드코딩 accent hex) 9곳(7개 파일)을 찾아 전부 수정·테스트 추가·커밋함(b204747). `app/utils/globalErrorRecovery.ts`의 React 트리 밖 크래시 카드는 판단 보류로 IMPROVEMENTS.md 항목 1에 남김(의도적 설계인지 불명확). `app/components/chat/StarterTemplates.tsx`는 프로덕션에서 도달 불가한 죽은 코드 경로로 확인되어 손 안 댐. `app/root.tsx`의 404 히어로는 의도된 고정 코랄로 재확인, 그대로 둠.
- 사이클 10(감사 대상: 생성)에서 서브에이전트로 액션 실행/파싱/스트리밍 표면 감사, 실제 크래시 버그(잘못된 `boltAction` 태그 → 어디서도 안 잡히는 throw → 채팅 전체 에러 화면) 발견해 수정·테스트 추가·커밋함(`d158d4b`). 나머지 4건(Supabase 실패 무음, 영어 에러 문구, 빌드 실패 중복 알림, cp/mv 죽은 검증 경고)은 IMPROVEMENTS.md 항목 9에 기록만 하고 손 안 댐.
