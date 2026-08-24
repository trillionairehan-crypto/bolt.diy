# overnight5 — 구조 변경 필요/판단 필요 항목 (제안만, 수정 안 함)

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
