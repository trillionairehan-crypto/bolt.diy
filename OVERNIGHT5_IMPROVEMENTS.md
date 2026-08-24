# overnight5 — 구조 변경 필요/판단 필요 항목 (제안만, 수정 안 함)

## 10. 미리보기/워크벤치 감사(사이클 11) — 3건은 고침, 4건은 판단 보류
Explore 서브에이전트로 워크벤치(파일트리/에디터/터미널/미리보기) 표면을 감사. 보고받은 7건 중 3건(`ExpoQrModal.tsx` 영어 문구, `TerminalTabs.tsx` "Terminal" 영어 라벨, `Preview.tsx` "새 창/탭에서 열기" 실패 시 무음 → 토스트 추가)은 직접 재검증 후 수정·테스트 추가·커밋. 아래 4건은 확인은 했으나 범위가 크거나 확신도가 낮아 손 안 댐:

- **`FileTree.tsx` 우클릭 컨텍스트 메뉴 전체가 영어** — "New File"/"New Folder"/"Copy path"/"Copy relative path"/"Lock File"/"Unlock File"/"Lock Folder"/"Unlock Folder"(519·526·530-531·542·547·556·563번 줄) 전부 미번역, 게다가 업로드/삭제/잠금 실패 시 토스트 6곳(352·409·429·449·469·489번 줄)도 영어. 같은 파일의 다른 토스트(성공/삭제 확인)는 한국어인데 이 부분만 놓친 것으로 보임 — 사용자가 자주 쓰는 메뉴라 우선순위 높음. **왜 안 고쳤나**: 14곳을 한 번에 바꾸는 작업이라 이번 사이클(3건 이미 수정) 범위를 넘어선다고 판단, 다음 사이클로 미룸. **제안**: 순수 문자열 치환이라 리스크는 낮음 — 다음 워크벤치 감사 때 최우선으로 처리 권장.
- **`EditorPanel.tsx` 사이드바 탭·버튼 미번역** — 탭 라벨 "Files"/"Search"/"Locks"(99·107·115번 줄), 저장 안 된 파일 액션 버튼 "Save"/"Reset"(156·159번 줄)이 영어. 코드 화면 방문 시 거의 항상 보이는 요소. **왜 안 고쳤나**: 위 FileTree.tsx 건과 같은 이유로 이번 사이클 범위 초과, 다음으로 미룸. **제안**: FileTree.tsx 컨텍스트 메뉴 건과 함께 "워크벤치 미번역 문구 일괄 정리"로 묶어 처리 권장.
- **`TerminalTabs.tsx` `closeTerminal`(36-65번 줄) — 마지막이 아닌 중간 터미널을 닫으면 다른 터미널의 백엔드 세션이 정리 안 된 채 남을 위험** — 터미널 ref/React key가 안정적인 id가 아니라 배열 **위치**(index)로 매겨짐. 중간 탭을 닫으면 `terminalCount`만 줄어들어 그 뒤 위치들이 한 칸씩 당겨지는데, React가 위치 기반 key(`terminal-container-N`)로 재조정하면서 실제로 언마운트되는 컴포넌트는 방금 닫은 탭이 아니라 그 다음 탭이 될 수 있음 — 이 경우 `workbenchStore.detachTerminal`이 한 번도 안 불린 세션이 조용히 버려질 수 있음. **왜 안 고쳤나**: React 키 재조정 추론에 기반한 진단이라 런타임으로 직접 재현·확인 못 함(확신도 중간), 고치려면 위치 기반 index를 안정적인 터미널 id로 바꾸는 구조 변경이 필요해 최소 변경 범위를 벗어남. **제안**: 터미널 2개 이상 열고 중간 것 닫기를 브라우저에서 재현해 실제 세션 누수가 있는지 먼저 확인, 있다면 `useState<number>` 카운터 대신 안정적 id 배열(`useState<string[]>`, `crypto.randomUUID()` 등)로 리팩터링 권장.
- **`Preview.tsx` iframe에 `onError` 처리 없음** — 로딩 스켈레톤(1116-1130번 줄 근처)은 `VITE_COMPILE_OK` postMessage나 15초 하드 타임아웃(731-746번 줄)으로만 해제되는데, iframe 자체엔 `onError`/`onLoad` 폴백이 없어서 실제로 로드가 실패(네트워크 끊김, 컨테이너 종료 등)해도 15초 뒤 빈/깨진 iframe이 아무 안내 없이 그냥 보임. **왜 안 고쳤나**: "로드 실패"를 어떻게 감지할지(iframe onError는 cross-origin이라 대부분 안 불림, postMessage 기반 커스텀 타임아웃/재시도 UI 설계가 필요)가 UX+구현 설계 결정이라 최소 변경을 넘어섬. **제안**: 15초 타임아웃 이후 "미리보기를 불러오지 못했어요 · 새로고침" 같은 안내 UI를 스켈레톤 대신 보여주는 설계를 다음에 검토 권장.

## 9. 생성 감사(사이클 10) — 크래시 버그 1건은 고침, 나머지 4건은 판단 보류
Explore 서브에이전트로 생성(액션 실행/파싱/스트리밍) 표면을 감사. 보고받은 5건을 직접 소스로 재검증. 이 중 가장 심각한 크래시 버그(잘못된 Supabase `operation`/`filePath` 없는 `boltAction` 태그가 `message-parser.ts`의 `#parseActionTag`에서 throw → 어디서도 안 잡혀 `ChatErrorBoundary`까지 전파돼 채팅 전체 크래시)는 이번 사이클에 직접 수정·테스트 추가·커밋(`d158d4b`). 아래 4건은 확인은 했으나 최소 변경 범위를 벗어나 손 안 댐:

- **Supabase 액션 실패가 완전히 무음** — `action-runner.ts:176-189`(`#executeAction`의 supabase case)는 실패 시 `status: 'failed'`로 상태만 바꾸고 `onAlert`/`onSupabaseAlert` 콜백을 전혀 호출하지 않음(직접 확인: catch 블록에 알림 호출 없이 `return`만 있음). 게다가 `Artifact.tsx:43-48`이 진행 상황 목록에서 `type === 'supabase'` 액션을 무조건 필터링해서 빼버리므로(성공/실패 무관), 실패한 마이그레이션이 토스트도 목록 표시도 아이콘 변화도 없이 완전히 사라짐 — 사용자는 DB에 반영 안 된 걸 모른 채 다음 단계로 넘어갈 위험. **왜 안 고쳤나**: `Artifact.tsx`의 필터가 "마이그레이션 성공 케이스만 조용히 숨기려는 의도"인지 "실패도 몰라도 되게 설계한 것"인지 의도 불명 — 실패 시엔 필터에서 빼거나 `onSupabaseAlert`를 호출하도록 바꿔야 하는데, 알림 플러밍 경로를 새로 만드는 일이라 최소 변경을 벗어남. **제안**: 실패한 supabase 액션만 필터 예외로 두거나(`action.status === 'failed'`일 때 목록에 남기기), `#executeAction`의 catch에 `onSupabaseAlert` 호출 추가.
- **쉘 액션 에러 메시지가 영어로 그대로 노출** — `action-runner.ts:758-845`(`#createEnhancedShellError`)가 만드는 제목들(`'File Not Found'`, `'Command Not Found'`, `'Permission Denied'`, `'File or Directory Not Found'`, `'Target is a Directory'`, `'File Already Exists'`)이 `ChatAlert.tsx:57-60`에서 `오류: {description}` 형태로 그대로 렌더됨 — 한국어 UI 안에 영어 에러 문구가 섞여 보임(예: "오류: Command Not Found"). **왜 안 고쳤나**: 6개 문구를 다 한국어로 바꾸는 자체는 작지만, 이 문자열들이 다른 곳(로그, 다른 컴포넌트)에서도 매칭/파싱되는지 전수 확인이 필요해 보여 이번엔 손 안 댐. **제안**: 6개 제목 문자열을 한국어로 교체하기 전에 `grep -rn "File Not Found\|Command Not Found\|Permission Denied"` 등으로 다른 참조가 없는지 먼저 확인 후 진행 권장.
- **빌드 실패 시 알림이 두 번 뜨고 후자가 항상 'Dev Server Failed'로 잘못 표시** — `#runBuildAction`(action-runner.ts:513 근처)이 정확한 제목(`'Build Failed'`)으로 `onDeployAlert`를 먼저 쏘는데, 던진 `ActionCommandError`가 `#executeAction`의 바깥 catch까지 전파되면서 액션 종류와 무관하게 항상 `'Dev Server Failed'`라는 두 번째 `onAlert`가 또 뜸. **왜 안 고쳤나**: `ChatAlert.tsx`는 이 title 필드를 직접 렌더링하지 않고 `source`로 자체 제목을 만들어 쓰는 것으로 보여 사용자 화면 영향은 제한적(확신도 중간) — 실제 사용자 영향이 있는지 브라우저에서 재현 확인이 먼저 필요.
- **`cp`/`mv` 원본 파일 없음 검증이 죽은 코드** — `#validateShellCommand`(action-runner.ts:736-753)가 `cp`/`mv`의 소스 파일이 없으면 `{ shouldModify: false, warning: ... }`를 반환하는데, 호출부 `#runShellAction`(약 275번 줄)이 `shouldModify`가 true일 때만 `warning`을 읽어서 이 케이스의 경고가 항상 버려짐 — 명령은 그대로 실행되고 아무 경고도 안 남음. **왜 안 고쳤나**: 낮은 우선순위(로그 한 줄 안 뜨는 정도)이고, 원래 의도(경고만 로그? 명령 자체를 막아야 하나?)가 불명확해 판단 보류. **제안**: 최소한 `warning`이 있으면 `shouldModify` 여부와 무관하게 `logger.warn`으로 남기게 수정 권장.

## 7. 온보딩 종료 직후 생성 실패 시 빈 화면 (Phase 2, 온보딩 감사, 사이클 9에서 발견)
`Chat.client.tsx:644-678`(`handleClarificationComplete`)가 `chatStarted=true`로 바꾸고 `clarifyingPrompt`를 지워 랜딩/온보딩 UI를 언마운트한 **다음에** `generateNewApp()`을 호출한다. `generateNewApp` 내부(`Chat.client.tsx:519-528`)에서 `checkGenerationsAllowed()`가 `false`를 반환하면(무료 생성 횟수 소진, 또는 483-490의 catch로 잡히는 네트워크/RPC 오류) 그냥 `return`하는데, 이 시점엔 이미 랜딩 화면이 사라진 뒤라 사용자는 메시지도 재시도 버튼도 없는 빈 채팅창만 보게 되고 토스트 하나(`무료 체험을 다 쓰셨어요...` 또는 `일시적인 오류가 발생했어요...`)만 스쳐 지나간다.
- **왜 이번 세션에서 안 고쳤는지**: "실패 시 랜딩으로 되돌리기"냐 "채팅창에 재시도 UI를 넣기"냐는 UX 설계 결정이라 최소 변경 범위를 벗어남. 상태 전환 순서(먼저 언마운트 후 비동기 체크)도 바꿔야 해서 회귀 위험이 있음.
- **제안**: `checkGenerationsAllowed()` 체크를 `chatStarted=true`/`clarifyingPrompt=null` 세팅보다 먼저 하도록 순서를 바꾸거나, 실패 시 온보딩 화면으로 되돌리는 로직을 추가 권장.

## 8. 온보딩 추가 질문 생성 실패가 완전히 조용함 (Phase 2, 온보딩 감사, 사이클 9에서 발견)
`app/utils/generateAppQuestions.ts:126-141`은 HTTP 실패/JSON 파싱 실패/LLM 응답 형식 이상 시 모두 `null`을 반환(또는 에러를 콘솔에만 로그)하는데, `PromptClarification.tsx:105-125`(현재 라인은 이동했을 수 있음, `dynamicQuestions = result ?? []` 부분)는 이 `null`을 "LLM이 추가 질문이 필요없다고 판단함"과 완전히 동일하게 취급한다. 즉 "API 실패로 추가 질문을 못 만듦"과 "정상적으로 추가 질문이 없음"을 사용자도 QA도 구분할 방법이 없음 — 에러 토스트도, 재시도도, UI에 드러나는 로그도 없음.
- **왜 이번 세션에서 안 고쳤는지**: 최소 수정으로는 "실패를 사용자에게 어떻게 보여줄지"(토스트? 조용히 넘어가되 로그만 남길지?)를 판단할 근거가 부족함 — 애초에 추가 질문은 "있으면 좋고 없어도 되는" 기능이라 실패해도 흐름을 막지 않는 현재 설계가 의도적일 가능성도 있음.
- **제안**: 최소한 실패 케이스(HTTP/파싱 오류)와 정상 빈 응답을 구분하는 반환 타입으로 바꾸고, 실패 시에만 낮은 우선순위 로그(사용자에게 노출 안 함)를 남기는 정도로 시작 권장.

## 1. `#FF5330` 하드코딩 나머지 20개 파일 — 개별 판단 필요
Phase 2 사이클 1·2에서 3개 파일(`PromptClarification.tsx`, `Artifact.tsx`, `Messages.client.tsx`)을 고쳤지만, 앱 전체 검색 결과 아래 파일들에 더 남아있음:

- `app/components/chat/BaseChat.tsx`, `app/components/header/Header.tsx` — **랜딩 히어로**, 다크모드 무관하게 항상 코랄이 의도된 설계로 보임(Header.tsx의 `isLanding` 조건부 배경이 이미 이 패턴을 명시적으로 쓰고 있음). 손대면 안 될 가능성이 높음.
- `app/components/ui/Logo.tsx`, `app/components/landing/CoralredHero.tsx` — 브랜드 로고/마케팅 히어로. 마찬가지로 고정색이 맞을 가능성 높음.
- `app/root.tsx` — 브라우저 UI(주소창 등)에 쓰는 `theme-color` meta 태그일 가능성. 고정값이 맞음.
- `app/utils/paletteToHue.ts`, `app/lib/onboarding/answer-directives.ts` — hue↔hex 룩업 테이블 자체. `#FF5330`이 `--hue: 33`의 "대표 hex"로 쓰이는 상수라 여기 있는 건 정상(값 자체가 이 상수를 정의하는 곳).
- `app/routes/privacy.tsx`, `app/routes/terms.tsx`, `app/components/legal/LegalPageLayout.tsx` — 미확인, 로고/헤더 부분일 가능성.
- `app/components/chat/APIKeyManager.tsx`, `ChatBox.tsx`(SVG 그라디언트만; isLanding 전용 인라인 스타일 블록은 의도된 고정색이라 그대로 둠), `ChatErrorBoundary.tsx`, `ModelSelector.tsx`, `app/components/deploy/GitHubDeploymentDialog.tsx`, `GitLabDeploymentDialog.tsx`, `app/components/sidebar/HistoryItem.tsx`, `Menu.client.tsx`, `app/components/ui/Slider.tsx`, `app/components/workbench/FileTree.tsx` — ✅ **모두 판단 완료·수정됨**(FileTree/GitHub·GitLabDeploymentDialog는 사이클 3·4에서, 나머지 7개는 사이클 6에서). 전부 앱 작업 화면 안 요소로 확인돼 `var(--accent)`/`var(--on-accent)`/`var(--accent-hover)`로 교체, `app/darkModeAccentAudit.spec.ts`로 회귀 방지.
- `app/root.tsx` 404 히어로(`background: '#FF5330'` 등 여러 곳) — 확인 결과 의도된 고정 코랄 브랜드 화면(로고 `onCoral` variant 사용)이 맞음. 단, 같은 파일의 **일반** `ErrorBoundary`(비-404 렌더 크래시 화면)의 재시작 버튼은 별개로 하드코딩돼 있었고 이건 버그였음 — 사이클 6에서 `var(--accent)`로 수정.
- `app/components/chat/StarterTemplates.tsx` — 미확인이었으나 `SHOW_DEV_TOOLS && !chatStarted` 뒤에 있는 죽은 코드 경로(프로덕션에서 도달 불가)로 확인됨. 실사용 버그 아님 — 손 안 댐, 낮은 우선순위로 남김.
- `app/utils/globalErrorRecovery.ts:95-127` — **판단 보류**. React 트리 바깥 `window.addEventListener('error', ...)`에서 `document.createElement`로 직접 그리는 최후 방어 크래시 카드라 Tailwind를 못 쓰지만, `style.background = 'var(--accent)'`처럼 CSS 커스텀 프로퍼티는 여전히 참조 가능함(React 렌더링과 무관). 지금은 항상 라이트(크림색) 카드를 그림 — 의도적으로 "테마와 무관하게 항상 안전한 고정 배색"을 노린 설계일 수도 있어(주석 없음, 판단 근거 부족) 이번엔 손 안 댐. 다음 세션에서 의도 확인 후 필요하면 `var(--accent)`/`var(--bg)`/`var(--text)`로 교체.

## 2. `GitHubDeploymentDialog.tsx`/`GitLabDeploymentDialog.tsx` 영어 문구 전체 번역
overnight4부터 계속 "범위가 커서" 보류돼온 항목. 이번 세션은 죽은 다크모드 토큰만 정리(커밋 `6d88330`)하고 영어 문구는 그대로 둠. 각각 1000/760줄 내외, GitHub/GitLab 계정이 있어야 쓰는 세미개발자용 화면이라 우선순위는 낮지만, 언젠가는 정리가 필요한 진짜 스코프.
- **사이클 8(한국어 문구 감사)에서 범위 확장 확인**: 같은 패턴이 `GitHubAuthDialog.tsx`(GitHub 토큰 연결 다이얼로그), `ui/BranchSelector.tsx`(브랜치 선택 다이얼로그), `ui/ColorSchemeDialog.tsx`(Design Palette 다이얼로그의 액션 버튼 영역 — "Cancel"/"Save Changes")에도 있음을 확인. 서브에이전트가 처음엔 "Korean UI 속 영어 Cancel 하나만 섞여있다"고 보고했으나 직접 grep(`[가-힣]` 매치 0건)으로 재확인한 결과 이 4개 파일은 **다이얼로그 전체가 처음부터 끝까지 영어**임 — "한 단어만 번역 누락"이 아니라 통짜 미번역 화면이라 최소 변경 원칙에 안 맞아 손 안 댐. 번역할 땐 이 4개 파일을 항목 2와 묶어서 한 번에 처리 권장(문구 통일 필요 — 예: 전부 "취소"로).

## 6. 사이드바 진입점 이름 불일치 — "내 프로젝트"(랜딩/헤더) vs "내 앱"(실제 앱 목록 페이지)
`CoralredHero.tsx:97`(랜딩 타일)과 `Header.tsx:80`(헤더 버튼) 둘 다 "내 프로젝트"라는 라벨로 대화 기록 사이드바(`openAccount`)를 열지만, 실제 배포된 앱 목록 페이지(`app/routes/apps.tsx`, `Menu.client.tsx:568`에서 연결)는 "내 앱"이라는 이름을 씀. 사용자가 랜딩에서 "내 프로젝트"를 누르면 앱 목록이 아니라 대화 기록 서랍이 열려서 기대와 다른 화면을 보게 됨.
- **왜 이번 세션에서 안 고쳤는지**: 이건 문구 오타가 아니라 내비게이션 구조/IA 이름 결정("사이드바 토글은 뭐라 부를지", "앱 목록과 대화 기록을 어떻게 구분해서 부를지")이라 코드 몇 글자 바꾸는 걸 넘어섬 — 관련된 모든 진입점(랜딩, 헤더, 사이드바 내부, 앱 목록 페이지)을 한 번에 맞춰야 함.
- **제안**: "내 프로젝트"/"내 앱"/"내 대화" 세 단어 중 어느 것을 어디에 쓸지 사람이 먼저 정하고, 그 결정에 맞춰 4개 파일을 한 커밋으로 정리 권장.

## 3. Pro 티어 게이트 시스템 부재
`CustomDomainConnect.tsx`의 `TODO_IS_PRO_USER = false`(전원 잠금), Made-with 배지 무조건 주입 — 둘 다 서버에 구독/티어 조회 로직 자체가 없어서 발생. `pricing.tsx`(수정 금지 파일)의 PortOne 결제 흐름과 연결되는 더 큰 작업이라 이번 세션 범위 밖.

## 5. 모바일 감사 사이클 — 남은 항목 2건 (구조 변경 아님, 다음 사이클에서 개별 판단)
Phase 2 검증 사이클(감사 대상: 모바일)에서 서브에이전트로 발견, 이번 사이클엔 상위 2건(설정 모달/Design Palette 다이얼로그 오버플로)만 고치고 커밋(`7800fa8`). 남은 2건은 확신도가 낮거나 다른 파일과 일관성 확인이 더 필요해 보류:
- `app/components/sidebar/Menu.client.tsx:368` — 아바타/프로필 버튼이 `w-[32px] h-[32px]`로 권장 터치 타겟(~40-44px)보다 작음. 사이드바 채팅 목록의 다른 항목들과 인접해 있어 오탐(誤打) 가능성. 다만 이 파일이 이미 이번 브랜치에서 여러 번 수정된 이력(사이클 6에서 hover 색 등)이 있어, 크기만 단독으로 키우면 레이아웃(목록 항목 높이 등)에 의도치 않은 영향이 있는지 스크린샷으로 직접 확인 후 진행 권장.
- `app/components/header/HeaderActionButtons.client.tsx:22-57` — Deploy/export 버튼 그룹에 `flex-wrap`이 없어 좁은 화면에서 채팅 제목과 붙을 위험(확정 아님, 낮은 우선순위 watch-item).

## 4. 배포/도메인 API 라우트에 사용자 인증·소유권 확인이 아예 없음 (Phase 2, 요금제/결제 감사에서 발견)
`api.cloudflare-domain.ts`(action/loader 둘 다), `api.cloudflare-deploy.ts` 모두 `projectName`을 요청 본문/쿼리에서 그대로 받아 Cloudflare Pages API를 호출할 뿐, 요청자가 로그인했는지·그 프로젝트의 실제 소유자인지 검증하는 코드가 전혀 없음. `CustomDomainConnect.tsx`의 `TODO_IS_PRO_USER` 게이트는 **클라이언트 렌더링만** 막을 뿐이라, `projectName`을 아는 사람이면 누구나 `/api/cloudflare-domain`에 직접 POST해서 커스텀 도메인을 연결하거나 `/api/cloudflare-deploy`로 임의 배포를 트리거할 수 있음(단, `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`이 이 환경에 설정돼 있어야 실제로 동작 — 로컬/이 세션 환경엔 없어서 503으로 막혀있는 것으로 보이나, 프로덕션 환경 변수 설정 여부는 이 세션에서 확인 불가).
- **왜 이번 세션에서 안 고쳤는지**: 이 앱 전체에 사용자별 세션/요청 인증 미들웨어 자체가 없어 보임(다른 API 라우트들도 동일 패턴인지 전수조사 필요) — 이 두 파일만 땜질하면 일관성이 깨지고, "최소 변경" 원칙을 벗어나는 아키텍처 결정(어떤 인증 방식을 쓸지, Supabase 세션 쿠키를 어떻게 서버에서 검증할지)이 필요함.
- **제안**: 아침에 사람이 프로덕션에 `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`이 실제로 설정돼 있는지 먼저 확인. 설정돼 있다면 이 두 라우트(및 비슷한 다른 라우트)에 최소한 "로그인 여부 + 프로젝트 소유권" 확인을 추가하기 전까지는 위험이 실재함 — 우선순위 높게 다룰 것을 권장.
