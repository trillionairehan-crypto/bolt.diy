다음 감사 영역: 한국어 문구

[완료] 모바일 감사(사이클 46, 9회차) — Header.tsx의 chat.started 헤더에서 ChatDescription을 감싸는 flex-1 제목 span에 min-w-0이 없어 truncate가 flex 행에서 실제로 작동 안 하던 문제(flex 아이템 기본 min-width:auto 때문에 긴 채팅 제목이 있으면 span이 축소되지 않고 내용 폭을 그대로 차지, index.scss의 전역 overflow-x: hidden이 스크롤바 대신 조용히 클리핑을 일으켜 좁은 화면에서 오른쪽 테마 토글/배포 버튼이 화면 밖으로 밀려 눌리지 않게 됨) → min-w-0 추가, headerMobileOverflowAudit.spec.ts에 회귀 테스트 1건 추가 — (사이클 46)
[완료] 다크모드 감사(사이클 45, 8회차) — NetlifyTab.tsx/NetlifyConnection.tsx의 배포 URL 링크 4곳이 uno.config.ts에 정의된 적 없는 죽은 토큰(bolt-elements-link-text/-textHover)을 써서 라이트 모드는 상속색 폴백, 다크 모드는 hover 변화 없음이던 문제(사이클 14 IMPROVEMENTS 항목 13에서 발견만 되고 범위 초과로 보류됐던 항목) → 같은 파일 아이콘이 이미 쓰던 실제 정의된 토큰 text-bolt-elements-item-contentAccent로 통일, darkModeAccentAudit.spec.ts 신규 4건 — (사이클 45)
[완료] 요금제/결제 감사(사이클 44, 7회차) — Chat.client.tsx의 generateNewApp()이 checkGenerationsAllowed() 통과 직후 recordGenerationUsed()로 무료 생성 크레딧을 먼저 차감하고 setFakeLoading(true)를 띄운 뒤 selectStarterTemplate()를 호출하는데, 이 함수 내부의 fetch('/api/llmcall')와 response.json()이 어떤 try/catch도 없이 그대로 throw했고, 상위 호출부(handleClarificationComplete)도 await/catch 없는 fire-and-forget이라 예외가 unhandled rejection이 되어 fakeLoading이 영영 안 풀리고 채팅 화면이 무한 로딩으로 멈추던 문제(autoSelectTemplate 기본값 true라 모든 신규 사용자의 기본 생성 흐름에서 재현) → 기존에 LLM 파싱 실패 시 이미 blank 템플릿으로 폴백하던 것과 동일한 패턴으로 fetch/파싱 예외도 흡수하도록 selectStarterTemplate.ts 수정, selectStarterTemplate.spec.ts 신규 3건 — (사이클 44)
[완료] 배포 감사(사이클 43, 6회차) — action-runner.ts#executeAction의 catch가 쏘는 onAlert(ChatAlert "터미널 오류")가 ActionCommandError의 header를 description으로 그대로 노출하는데, 빌드/앱 시작 실패 시 이 header가 'Build Failed'/'Failed To Start Application' 영어 리터럴이라 "오류: Build Failed"처럼 한국어 문장 중간에 영어가 섞여 노출되던 문제(사이클 36에서 고친 onDeployAlert 3곳과는 별개의 alert 경로, 5개 배포 제공자 전부에서 빌드/시작 실패마다 재현) → 두 헤더 한국어로 교체, actionCommandErrorKoreanAudit.spec.ts 신규 3건 — (사이클 43)
[완료] 미리보기/워크벤치 감사(사이클 42, 5회차) — LockManager.tsx(설정 > 잠금 탭)의 검색 placeholder/필터 옵션("All"/"Files"/"Folders")/잠금 해제 확인·성공 토스트/빈 상태 안내/"Unlock all" 버튼/footer "N item(s) • N selected" 표시까지 전체가 영어로 하드코딩돼있던 문제(19번째 사이클에서 FileTree.tsx 업로드/삭제 토스트는 고쳤지만 이 별도 파일은 범위 밖이라 놓쳐짐, EditorPanel.tsx "Locks" 탭에서 항상 렌더되는 실사용 표면) → 전부 한국어로 번역, lockManagerKoreanAudit.spec.ts 신규 2건 — (사이클 42)
[완료] 생성 감사(사이클 41, 5회차) — action-runner.ts의 #runFileAction이 webcontainer.fs.mkdir/writeFile 실패를 logger.error만 남기고 삼켜(재throw 없음), 디스크 부족/권한 오류 등으로 파일이 실제로 안 써져도 액션 상태가 'complete'로 표시되고 사용자에게 실패를 알릴 방법이 없던 문제(Supabase 액션 무음 실패와 같은 패턴이지만 가장 흔한 file 액션에서는 처음 확인) → catch 블록에서 재throw만 추가해 기존 #executeAction의 실패 처리 경로가 status를 'failed'로 정확히 설정하도록 수정, action-runner.spec.ts 신규 3건 — (사이클 41)
[완료] 온보딩 감사(사이클 40, 5회차) — Chat.client.tsx의 ?prompt= 쿼리 파라미터 딥링크 핸들러(템플릿 "이 템플릿으로 시작" 링크가 사용)가 if (prompt)로 truthy 체크만 해서, 메인 전송 경로가 이미 쓰는 messageContent?.trim() 공백 가드와 달리 공백 문자열도 통과시켜 빈 아이디어로 온보딩 명확화 화면이 열리던 불일치 → if (prompt?.trim())로 통일 — (사이클 40)
[완료] 모바일 감사(사이클 39, 6회차) — Header.tsx 랜딩 헤더에서 로그인 사용자에게 노출되는 "내 프로젝트" 텍스트+아바타 알약 버튼이 "요금제" 링크·테마 토글과 flex-wrap/축소 없이 한 줄로 나열돼 375px 뷰포트에서 폭 합 약 388px로 넘치던 문제(사이클 37 IMPROVEMENTS 항목 33 관찰 항목을 폭 계산으로 확인) → sm 미만에서 텍스트 라벨 숨기고 title로 접근성 유지(기존 ChatBox.tsx 이미지 첨부 버튼과 동일 패턴) — (사이클 39)
[완료] 다크모드 감사(사이클 38, 5회차) — NetlifyDeploymentLink.client.tsx 링크 아이콘 hover가 고정 Netlify 브랜드 틸(#00AD9F)을 써서, DeployButton.tsx 같은 드롭다운에 나란히 렌더되는 동일 구조의 VercelDeploymentLink.client.tsx(사이클 6에서 hover:text-[#000000]→hover:text-bolt-elements-textPrimary로 이미 수정됨)와 어긋나던 불일치 → 동일하게 테마 토큰으로 통일 — (사이클 38)
[완료] 요금제/결제 감사(사이클 37, 4회차) — ModelSelector.tsx 무료/유료 모델 필터·검색 결과 개수·로딩·빈 상태 문구(약 10곳)가 전부 영어로 하드코딩돼 바로 옆 이미 한국어인 검색창 placeholder와 한 화면에서 언어가 섞여 보이던 문제 → 전부 한국어로 번역 — (사이클 37)
[완료] 배포 감사(사이클 36, 5회차) — ActionRunner#runBuildAction()이 쏘는 빌드 시작/실패/완료 onDeployAlert 3곳이 전부 영어("Building Application"/"Build Failed"/"Build Completed")로 하드코딩돼 있어, Cloudflare/GitHub/GitLab/Netlify/Vercel 5개 배포 제공자 전부에서 각 훅이 미리 설정한 한국어 배포 상태("빌드 중이에요" 등)를 빌드 실행 중/직후에 매번 영어로 덮어쓰던 문제(모든 artifact가 같은 workbenchStore.deployAlert atom을 공유해서 발생) → 3곳 전부 한국어로 번역 — (사이클 36)
[완료] 미리보기/워크벤치 감사(사이클 35, 4회차) — DiffView.tsx "차이점" 탭이 다른 워크벤치 표면과 달리 상태 문구(Modified/No Changes/Streaming…)와 안내 문구(Files are identical/Select a file to view differences 등) 9곳이 전부 영어로 하드코딩돼 있던 문제 → 전부 한국어로 번역 — (사이클 35)
[완료] 생성 감사(사이클 34, 4회차) — EnhancedStreamingMessageParser.parse()가 코드블록 자동 파일감지 발동 시 super.parse()의 증분(delta) 반환 계약을 깨고 매 틱마다 메시지 전체를 재파싱해 반환, useMessageParser.ts가 이를 계속 덧붙여 스트리밍마다 채팅 텍스트가 중복 누적되던 문제 → parse()가 항상 메시지 전체 텍스트를 반환하도록 계약 변경 + 소비 측을 append→set으로 수정 — (사이클 34)
[완료] 온보딩 감사(사이클 33, 4회차) — BaseChat.tsx가 SpeechRecognition 미지원 브라우저(예: Firefox)에서는 recognition 인스턴스를 만들지 않아 startListening/stopListening이 no-op이었는데, ChatBox.tsx의 음성 입력 버튼은 props.isStreaming으로만 disabled를 결정해 첫 방문자가 랜딩 화면 마이크 아이콘을 눌러도 아무 피드백 없이 무반응이던 문제 → speechRecognitionSupported prop 추가해 미지원 브라우저에서 버튼 비활성화 — (사이클 33)
[완료] 한국어 문구 감사(사이클 32, 3회차) — APIKeyManager.tsx(채팅창에서 프로바이더별 API 키 입력 시마다 노출) 라벨("{provider} API Key:"), 상태 문구(Set via UI/environment variable/Not Set), placeholder("Enter API Key"), 버튼 title(Save/Cancel/Edit/Get API Key)까지 전체가 영어로 하드코딩돼 있던 문제 → 전부 한국어로 번역 — (사이클 32)
[완료] 모바일 감사(사이클 31, 3회차) — Workbench.client.tsx "바뀐 파일" Popover.Panel이 고정 w-80(320px)에 반응형 clamp가 없어(Headless UI Popover는 Radix와 달리 충돌 회피 로직 없음, overflow-hidden 조상 안에 포탈 없이 절대 위치) 375px 뷰포트에서 잘릴 위험 → w-[min(320px,calc(100vw-2rem))]로 수정 — (사이클 31)
[완료] 다크모드 감사(사이클 30, 4회차) — 사이드바 하단 SettingsButton/HelpButton 아이콘이 바로 옆 "내 앱" 링크(dark:text-gray-500)와 달리 라이트 전용 #666 고정색만 써서 다크모드에서 저대비로 흐릿하게 보이던 문제, GitHub 설정 탭 캐시 "전체 삭제" 버튼(text-red-600/border-red-200)이 같은 파일 성공 알림 박스와 달리 dark: 변형이 없던 문제 → 둘 다 dark: 변형 추가 — (사이클 30)
[완료] 요금제/결제 감사(사이클 29, 3회차) — BaseChat.tsx 무료 생성 잔여 횟수 안내 배지가 로그인 계정도 무조건 "무료 체험"(게스트 전용 용어)으로 표시하던 문제 → authUser 여부로 "무료 생성"/"무료 체험" 문구 분기 (Chat.client.tsx의 notifyGenerationLimitReached와 용어 통일) — (사이클 29)
[완료] 배포 감사(사이클 28, 2회차) — DeployButton.tsx에서 열리는 실제 GitHub/GitLab 배포 다이얼로그(GitHubDeploymentDialog.tsx/GitLabDeploymentDialog.tsx)가 하드코딩 색상만 고쳐졌을 뿐(cf6f6d9) 제목·라벨·placeholder·버튼·토스트/에러 문구 약 40곳이 전부 영어로 남아있던 문제(같은 배포 흐름의 *hook* 파일 GitHubDeploy.client.tsx/GitLabDeploy.client.tsx 토스트는 사이클 12에서 이미 한국어였지만, 실제 화면에 뜨는 다이얼로그 자체는 처음 감사됨) → 전부 한국어로 번역 — (사이클 28)
[완료] 미리보기/워크벤치 감사(사이클 27) — FileTree.tsx 우클릭 컨텍스트 메뉴 8개 항목(새 파일/새 폴더/경로 복사/상대 경로 복사/파일·폴더 잠금·해제)이 전부 영어로 하드코딩돼있던 문제, onCopyPath/onCopyRelativePath가 비동기 clipboard.writeText 실패를 동기 try/catch로 못 잡고 성공/실패 어느 쪽이든 사용자 피드백이 없던 문제 → 한국어 번역 + .then/.catch + 토스트 추가 — (사이클 27)
[완료] 온보딩 감사(사이클 25) — BaseChat.tsx ScrollToBottom 버튼("Go to last message"), WebSearch.client.tsx URL 가져오기 팝오버(버튼 라벨/성공·실패 토스트 4곳)가 채팅 툴바 안에서 영어로 하드코딩돼있던 문제 → 전부 한국어로 번역 — (사이클 25)
[완료] 한국어 문구 감사(사이클 24, 2회차) — 설정 > 프로필 탭(ProfileTab.tsx) 라벨/placeholder/토스트 전체가 영어로 하드코딩돼있던 문제 → 전부 한국어로 번역 — (사이클 24)
[완료] 모바일 감사(사이클 23, 2회차) — FileBreadcrumb.tsx 파일 경로 드롭다운이 avoidCollisions={false}로 Radix 자동 화면 밖 재배치를 꺼두고 있어, 화면 오른쪽 끝 근처(깊은 경로)에서 뷰포트 밖으로 밀려날 수 있던 문제 → 기본값(true)으로 복원 — (사이클 23)
[완료] 다크모드 감사(사이클 22, 3회차) — Markdown.module.scss 테이블/h6 GitHub 라이트 테마 하드코딩 색상(#dfe2e5/#f6f8fa/#6a737d)이 다크모드 채팅 배경 위에서 밝은 사각형으로 튀던 문제, Menu.client.tsx "내 앱" 사이드바 링크 아이콘 다크 변형 누락으로 저대비 문제 — 테마 토큰으로 교체 — (사이클 22)
[완료] 요금제/결제 감사(사이클 21, 2회차) — 로그인 계정 무료 생성 남은 횟수 조회(Supabase RPC) 실패 시 초기값 0이 그대로 남아 "무료 체험을 다 썼어요"로 오표시되던 문제 → 초기값을 null(모름)로 바꾸고 로딩 실패 시 안내 숨김 — (사이클 21)
[완료] 배포 감사(사이클 20) — GitLab 배포 성공 후 localStorage에 저장하는 저장소 URL이 아직 커밋 안 된 state 클로저 값(createdRepoUrl)을 읽어, 재배포 시 이전 저장소 URL 또는 첫 배포 시 빈 문자열이 저장되던 문제 → repoUrl 지역 변수로 수정 — (사이클 20)
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
- 사이클 26(감사 대상: 생성, 3회차)에서 코드 수정 없이 감사만 진행 — 서브에이전트가 보고한 3건(사용자 메시지 자동 코드실행 위험, Stop 버튼 abortAllActions 완전 no-op, 스트림 절단 시 파일 액션 영구 정지) 전부 직접 재검증 결과 실재하는 문제로 확인됐으나 셋 다 구조적 판단이 필요해 수정 없이 IMPROVEMENTS.md 항목 24로만 기록. 자세한 내용은 PROGRESS.md 사이클 26 기록 참고.
- 사이클 29(감사 대상: 요금제/결제, 3회차)에서 서브에이전트가 보고한 `freeTrial.ts`의 `getAccountGenerationsRemaining()`이 `platformSupabase`가 없을 때 `0`(고갈)을 반환하고 `incrementAccountGenerationsUsed()`는 같은 조건에서 throw하는 비일관성 후보는, `auth.ts`를 직접 확인한 결과 `authUserStore`가 `platformSupabase`가 있을 때만 값이 채워지는 구조라 "로그인 상태인데 platformSupabase가 없는" 경우 자체가 도달 불가능한 죽은 분기로 확인됨(오탐, 수정 안 함). `api.payment.verify.ts` 인증/재사용 방지 부재는 실재하는 구조적 문제로 확인돼 IMPROVEMENTS.md 항목 28로 기록.
