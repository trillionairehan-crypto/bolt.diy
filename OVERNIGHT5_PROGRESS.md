# overnight5 진행 기록

브랜치: `overnight5` (base: `overnight4` @ `b7805a3`)
시작: 2026-08-25

## ⚠️ 먼저 읽어야 할 것 — 브랜치/회차 번호 불일치

이 지시문이 말하는 "어젯밤(overnight4) 작업 목록"은 실제로 `overnight4` 브랜치의 **초기** 7개 커밋(`27ad450`~`c2aa617`, 리포트는 `OVERNIGHT-REPORT-4.md`)까지만 가리킴. 그런데 이 브랜치엔 그 뒤로 **같은 세션 안에서 두 회차가 더 진행**돼서 총 22개 커밋이 더 쌓여 있음:

- **"5차"**(`756ed82`~`ceec3a3`, 15개 커밋, `OVERNIGHT-REPORT-5.md`): Cloudflare 배포 URL 안정화(정확히 이 지시문의 "원클릭 배포" 항목의 후속 버그 수정), 배포 드롭다운 정리, Supabase 연결 마법사 신규 구축, 배포 시 Supabase 키 주입, 배포 완료 화면 안내, 마이그레이션 SQL 정리, Supabase 연결 진입점이 헤더에 없던 버그 수정, 브랜드 일관성(초록색→코랄, 아이콘, 용어) 수정.
- **"6차"**(`221a8d0`~`b7805a3`, 7개 커밋, `OVERNIGHT-REPORT-6.md`, `CLOUD-DESIGN.md`): "코랄레드 Cloud" — Supabase 가입 없이 쓰는 자체 저장 백엔드를 처음부터 설계·구현(DB 스키마, 서버 API, 클라이언트 SDK, 시스템 프롬프트 2트랙화, UI 통합, 적대적 보안 테스트 48건).

즉 이 지시문의 "완료 여부 확인 대상" 체크리스트는 여전히 유효한 항목들이지만(그 부분은 이후 두 회차가 거의 안 건드림), **이 브랜치는 이미 그 체크리스트보다 훨씬 앞서 있음**. 새로 만든 `overnight5` 브랜치는 이 22개 커밋을 전부 포함한 지점에서 시작함 — 아침에 헷갈리지 않도록 여기 명시.

가장 보수적인 선택으로 판단: 브랜치는 지시대로 새로 만들되(git 히스토리상 문제 없음), 체크리스트는 원래 의도대로(overnight4의 원 스코프) 검증하고, 그 이후 발견되는 새 버그는 지시문의 우선순위 규칙대로 큐에 넣어 처리함.

## 베이스라인

- `pnpm test`: **249/249 통과** (16개 파일). `cloudBuildSecurity.spec.ts`가 실제 프로덕션 빌드를 한 번 돌려서 52초 정도 걸림 — 나머지는 1초 내외.
- `pnpm run build`: **성공**.
- `pnpm run typecheck`: **에러 0건** (보호 파일 3개 포함, 기존 에러도 없음 — 지시문은 "기존 에러 무시"라고 했지만 실제로 하나도 없어서 무시할 것 자체가 없음).

## Phase 0 — 어젯밤(overnight4) 작업 목록 검증 결과

| 항목 | 상태 | 근거 |
|---|---|---|
| 소셜 로그인 아이콘(카카오/구글) | ✅ 완료 확인 | `SocialAuthButtons.tsx`에 `KakaoSymbol`/`GoogleSymbol` 그대로 존재 |
| 원클릭 Cloudflare 배포 + Made with 배지 | ✅ 완료, 게다가 개선됨 | 어젯밤엔 해시 프리뷰 URL 버그가 있었는데("5차"에서 발견·수정 완료, 커밋 `756ed82`) 지금은 결정론적 `{project}.pages.dev` 반환. 배지는 여전히 무조건 주입(티어 시스템 없음, 아래 계속) |
| 커스텀 도메인 연결(Pro 게이트) | ⚠️ 부분 — 게이트가 하드코딩 잠금 | `CustomDomainConnect.tsx:9`의 `TODO_IS_PRO_USER = false`가 그대로 — 전원 잠금(안전한 기본값이지만 기능 자체를 아무도 못 씀). 실제 티어 조회 로직이 없어서 못 고침(구조적 블록, 아래 BLOCKED에 기록) |
| 다크모드 설정 탭 정리 | ✅ 완료(@settings/ 범위 내) / ⚠️ 범위 밖 잔여 | @settings/ 9개 파일은 완료. `bolt-elements-*-dark`(존재하지 않는 CSS 변수라 조용히 무효화되는 죽은 참조) 패턴이 `GitHubDeploymentDialog.tsx`/`GitLabDeploymentDialog.tsx`/`ui/Tooltip.tsx`/`ui/Badge.tsx` 등 14개 파일에 여전히 남음 — 실사용 버그는 아님(앞의 non-dark 토큰이 이미 반응형이라 시각적으로는 정상 동작), 죽은 코드 정리 항목으로 큐에 넣음 |
| 품질 감사 12개 표면 | ✅ 대부분 완료 / ⚠️ 명시적으로 보류된 5개 항목 그대로 | `Preview.tsx`의 "창 크기" 드롭다운(하드코딩 보라 `#6D28D9`, 회색 `#111827`/`#6B7280`/`#F5EEFF`), `Workbench.client.tsx:555-557`의 "저장" 동기화 드롭다운(`bg-white dark:bg-[#141414]`, `border-gray-200/50`) 둘 다 grep으로 재확인 — 여전히 미수정. 둘 다 실사용자가 보는 화면이라 Phase 1 큐에 추가 |
| A5 미터링 수정 검증 | ❌ 여전히 미검증/동결 | `CORALRED_NEW_METERING`(`featureFlags.ts:11`) 여전히 `false`. 두 마이그레이션(`message_metering_v2`, `deployed_apps`) 미적용 확정(이 세션이 만든 `RUN-1-metering.sql`/`RUN-2-deployed-apps.sql`이 아직 저장소 루트에 커밋 안 된 채로 남아있음 — 성민이 아직 안 돌린 것으로 추정). 플래그를 켜면 마이그레이션 없이 RPC 실패 → 로그인 사용자 전체 생성 차단 장애. 그대로 동결 유지(재시도 안 함 — 구조적으로 DB 적용이 선행돼야 함) |
| 이전 "미검증" 수정들(체크포인트 되돌리기 등) | ❌ 여전히 브라우저 필요 | 코드 레벨 재검증만 가능, 실제 클릭 흐름은 이 세션 권한 밖 |

**결론**: 새로 발견된 "실제 버그"는 없음(전부 이미 알려진 미완 항목). Phase 1 큐는 아래.

## Phase 1 큐 (우선순위순)

1. ~~돈 걸린 것~~ — 없음(메터링은 액션 불가, 동결 유지가 맞는 판단)
2. **[진행] Preview.tsx 창 크기 드롭다운 하드코딩 색상** — 사용자가 미리보기를 열 때마다 보는 표면, 코랄 브랜드와 안 맞는 bolt.diy 잔재 보라색
3. **[진행] Workbench.client.tsx 저장 동기화 드롭다운 하드코딩 색상** — 마찬가지로 상시 노출 표면
4. **[대기] `bolt-elements-*-dark` 죽은 토큰 참조 14개 파일** — 실사용 버그 아님(우선순위 낮음), 시간 남으면 진행
5. **[대기] GitHub/GitLab 배포 다이얼로그 영어 문구** — 세미-개발자용, 파일 크고 범위 넓음

## 진행 기록

### [01:20] 문제 1 — Preview.tsx "창 크기" 드롭다운 하드코딩 색상
- **원인**: overnight4 품질 감사에서 "범위가 커서" 보류됐던 항목. bolt.diy 잔재 보라(`#6D28D9`)/회색(`#111827`,`#6B7280`,`#F5EEFF`,`#E5E7EB`) 하드코딩 6곳 + 부수로 발견한 영어 문구 4곳("Open in new tab/window", "Show Device Frame", "Landscape Mode").
- **변경**: `bolt-elements-*`/`--accent` 토큰으로 교체, 영어 문구 한국어로. 파일: `app/components/workbench/Preview.tsx`.
- **테스트**: `Preview.colors.spec.ts` 신규 6건(소스 내용 검증 — 이 코드베이스에 컴포넌트 렌더 테스트 인프라가 없어서 overnight5/6 세션의 기존 관행대로 소스/빌드 산출물 grep 방식 채택).
- **검증**: typecheck/lint/test(255개)/build 전부 통과.
- **커밋**: `ccafd7d`

### [01:23] 문제 2 — Workbench.client.tsx "저장" 동기화 드롭다운 하드코딩 색상
- **원인**: 같은 파일 안 바로 위(체크포인트 되돌리기 드롭다운)는 이미 토큰을 쓰는데, "저장" 드롭다운만 `bg-white dark:bg-[#141414]`/`border-gray-200/50 dark:border-gray-800/50`로 남아있던 불일치.
- **변경**: 형제 드롭다운과 동일하게 `bg-[var(--surface-2)]`/`border-bolt-elements-borderColor`로 통일. 파일: `Workbench.client.tsx`.
- **테스트**: `Workbench.colors.spec.ts` 신규 2건.
- **검증**: typecheck/lint/test(257개)/build 전부 통과.
- **커밋**: `a89d0ee`

### [01:32] 문제 3 — `bolt-elements-*-dark` 죽은 토큰 참조 12개 파일
- **원인**: overnight4가 @settings/ 안 2개 파일에서 찾아 고쳤던 패턴(`--bolt-elements-X-dark`가 `variables.scss`에 없는 CSS 변수라 조용히 무효화됨)이 @settings/ 밖 `app/components/ui/*` 12개 파일에 그대로 남아있던 것 — 실사용 버그는 아님(앞의 non-dark 토큰이 이미 테마 반응형), 죽은 코드 정리.
- **변경**: `sed -E` 정규식으로 `dark:X-Y-dark`(옵션 `/투명도`, `hover:`/`data-[state=active]:` 복합 선택자 포함) 패턴만 정확히 제거 — 다른 정상적인 `dark:` 변형(예: `dark:bg-bolt-elements-background-depth-4/50`)은 안 건드림. 적용 전 3개 파일로 dry-run 검증 후 12개 파일 일괄 적용.
- **테스트**: `deadDarkTokens.spec.ts` 신규 12건(파일별 소스 검사).
- **검증**: typecheck/lint/test(269개)/build 전부 통과. 시각적 변화 없음(죽은 코드 제거라 회귀 리스크 없음).
- **범위 밖으로 남긴 것**: `GitHubDeploymentDialog.tsx`(42곳)/`GitLabDeploymentDialog.tsx`(41곳) — 같은 패턴이지만 파일이 크고(1000줄 내외) 영어 문구 문제와 같이 다뤄야 해서 별도 작업으로 분리.
- **커밋**: `f06ca52`

### [01:36] 문제 4 — `GitHubDeploymentDialog.tsx`/`GitLabDeploymentDialog.tsx`의 같은 죽은 토큰 (일부만)
- **원인**: 문제 3과 동일 패턴, 두 큰 파일(1041줄/764줄)에 각각 42/41곳 — 문제 3에서 검증된 sed 정규식을 dry-run으로 먼저 두 파일 각각 diff 미리보기 확인(예상 개수와 diff 라인 수 일치 확인) 후 적용.
- **범위**: 죽은 토큰 제거만 진행. 같은 파일들의 영어 문구 전체 번역(오래전부터 "범위가 커서" 보류돼온 별개 항목)은 이번에도 손 안 댐 — 세미개발자용 화면이고 1000줄 가까운 파일을 통째로 번역하는 건 "최소 변경" 원칙을 벗어나는 별도 작업으로 판단.
- **테스트**: `app/components/deploy/deadDarkTokens.spec.ts` 신규 2건.
- **검증**: typecheck/lint/test(271개)/build 전부 통과.
- **커밋**: `6d88330`

**Phase 1 큐 소진.** Phase 2(무한 검증 루프)로 전환.

### [01:42] Phase 2 — 사이클 1 (감사 대상: 온보딩)
- **발견**: `PromptClarification.tsx`(온보딩 질문 화면)가 `ACCENT = '#FF5330'`을 하드코딩 — 이 값이 정확히 라이트 모드 `--accent`와 같아서 라이트 모드에선 안 보였지만, `variables.scss`의 다크 테마는 `--accent`를 다른(더 밝은) oklch 값으로, `--on-accent`를 `var(--bg)`(어두운 텍스트)로 설정함 — 이 화면은 그 어느 쪽도 안 따르고 있었음. 같은 파일 안 호버 상태 2곳은 이미 `var(--accent)`를 정상적으로 쓰고 있어서 나머지 7곳만 놓친 것으로 보임.
- **변경**: 7곳 전부 `var(--accent)`로, 버튼 2곳의 `text-white`는 `text-[var(--on-accent)]`로 교체.
- **테스트**: `PromptClarification.colors.spec.ts` 신규 4건.
- **검증**: typecheck/lint/test(275개)/build 전부 통과.
- **커밋**: `4769e51`

### [01:47] Phase 2 — 사이클 2 (감사 대상: 생성)
- **발견**: 같은 `#FF5330` 하드코딩 패턴이 `Artifact.tsx`(빌드 진행 바)와 `Messages.client.tsx`(생성 중 3점 타이핑 인디케이터 — 감싸는 알약 배경은 이미 `var(--accent-soft)`/`var(--accent-text)`를 정상적으로 쓰는데 점 3개만 하드코딩)에도 있었음.
- **변경**: 두 파일 전부 `var(--accent)`로 교체.
- **부가 조사**: `#FF5330`을 앱 전체에서 재검색하니 20개 파일이 더 나옴 — 대부분 랜딩 히어로(`BaseChat.tsx`/`Header.tsx`, 다크모드 무관하게 항상 코랄인 게 기존에도 의도된 설계), 로고, meta theme-color, hue 룩업 테이블(`paletteToHue.ts`/`answer-directives.ts`) 등 **의도적으로 고정 브랜드색**인 것들로 보임 — 전부 훑지 않고 판단 필요한 항목으로 개선 제안에 기록(무차별 일괄 치환은 랜딩 디자인을 깨뜨릴 위험).
- **테스트**: `generationIndicators.colors.spec.ts` 신규 2건.
- **검증**: typecheck/lint/test(277개)/build 전부 통과.
- **커밋**: `5858f4c`

### [02:17] 큐 파일 유실 발견 — 재구성
- **발견**: `OVERNIGHT5_QUEUE.md`가 저장소에 존재하지 않았음(커밋 이력에도 없음 — 애초에 git에 올라간 적이 없는 파일). 지시서 규칙상 큐 파일이 없으면 "초기 상태 파악" 절차를 타야 하는데, `OVERNIGHT5_PROGRESS.md`/`BLOCKED.md`/`IMPROVEMENTS.md`를 보면 이미 Phase 1(우선순위 수정 4건, 전부 커밋됨)과 Phase 2 검증 루프(사이클 2회, 전부 커밋됨)가 진행 중이었으므로, 처음부터 다시 조사하는 대신 기존 기록을 근거로 큐 파일을 재구성하는 쪽을 택함(보수적 선택 — 이미 검증된 내용을 다시 파는 건 낭비).
- **작업 트리 확인**: `app/routes/pricing.tsx`에 커밋 안 된 실제 PortOne 결제 연동 코드(loader + `requestPayment()` 호출, 서버 재검증 TODO 미해결)가 남아있었음. `OVERNIGHT5_IMPROVEMENTS.md`가 이미 이 파일을 "수정 금지 파일"로 기록해둔 시점에도 존재했던 것으로 보여 이 세션(혹은 이번 사이클)이 만든 변경이 아님. 실제 결제 SDK를 호출하는 미완성 기능이라 자동 세션이 임의로 커밋도, 되돌리기도 하지 않고 그대로 둠(보수적 선택).
- **베이스라인 재확인**: `pnpm vitest run` 277개 전부 통과, `pnpm run build` 클라이언트/서버 빌드 전부 성공(경고만 있음, 에러 없음).
- **커밋**: `3a7e6e7` — 이전 사이클이 만들었지만 커밋 안 된 완결 상태 산출물(`RUN-1-metering.sql`, `RUN-2-deployed-apps.sql`, `RUN-3-cloud.sql`, `overnight-loop.ps1`)만 정리해서 커밋. 코드 변경 없음.
- **결과**: `OVERNIGHT5_QUEUE.md` 신규 생성(다음 감사 영역: 미리보기/워크벤치). 이번 사이클은 여기서 종료.

### [02:24] Phase 2 — 사이클 3 (감사 대상: 미리보기/워크벤치)
- **발견**: `FileTree.tsx`(워크벤치 파일 탐색기)의 선택된 파일 좌측 보더가 `#FF5330` 하드코딩 — 온보딩/생성 화면에서 이미 고쳤던 동일 패턴. 다크 테마 `--accent`는 `variables.scss`에서 더 밝은 oklch 값이라 다크모드에서 색이 어긋남. Preview.tsx의 디바이스 프레임 노치/홈버튼 `#333`/`#555`/`#111` 하드코딩은 실제 폰 베젤 색을 흉내낸 의도적 고정색(팝업 창의 별도 HTML 문서 + 인앱 프레임 모두 동일 패턴)이라 그대로 둠 — 이미 자체적으로 라이트/다크 두 값을 분기 처리(getFrameColor)하고 있어 버그 아님.
- **변경**: `border-l-[#FF5330]` → `border-l-[var(--accent)]`. 파일: `app/components/workbench/FileTree.tsx`.
- **테스트**: `FileTree.colors.spec.ts` 신규 2건.
- **검증**: typecheck 통과(0 에러), lint 통과(무관한 기존 warning 1건만), test(279개, 전부 통과), build(client+server) 전부 성공.
- **커밋**: `0a7fc9d`
- **다음 감사 영역**: 배포로 갱신.

### [02:26] Phase 2 — 사이클 4 (감사 대상: 배포)
- **베이스라인 재확인**: `pnpm vitest run` 279/279 통과, `pnpm run build` 성공(이 사이클 시작 시점 — 이전 사이클이 커밋 안 하고 남긴 변경 없음, `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드만 여전히 미커밋 상태로 남아있고 이전 사이클들의 판단대로 그대로 둠).
- **발견**: `GitHubDeploymentDialog.tsx`(13곳)/`GitLabDeploymentDialog.tsx`(1곳)에 동일한 `#FF5330`/`#E44A28` 하드코딩 패턴 — 사이클 1~3에서 고친 PromptClarification/Artifact/Messages/FileTree와 완전히 같은 버그 클래스(라이트 모드 `--accent`와 값이 같아 라이트에선 안 보이지만, 다크 모드 `--accent`는 더 밝은 oklch로 갈리고 `--on-accent`도 달라짐). 이 두 파일은 `OVERNIGHT5_IMPROVEMENTS.md` 항목 1에 "판단 필요"로 남아있었는데, 이번 사이클 감사 영역이 정확히 "배포"이고 이 다이얼로그가 랜딩/마케팅이 아니라 워크벤치 내부에서 뜨는 배포 플로우 UI라 테마 반응형이 맞다고 판단(FileTree.tsx와 동일 근거).
- **변경**: 아이콘 색, 버튼 배경/hover, 포커스 링, 체크박스 accent-color, 텍스트 강조색 전부 `text-[#FF5330]`/`bg-[#FF5330]`/`hover:bg-[#E44A28]`/`text-white`(accent 배경 위) → `var(--accent)`/`var(--accent-hover)`/`var(--on-accent)`로 교체. 파일: `GitHubDeploymentDialog.tsx`, `GitLabDeploymentDialog.tsx`.
- **테스트**: `deployDialogAccentColor.spec.ts` 신규 3건(소스 grep 방식, 기존 관행과 동일).
- **검증**: typecheck 0에러, lint 통과(무관한 기존 warning 1건만), test 282개 전부 통과, build(client+server) 성공.
- **커밋**: `cf6f6d9`
- **범위 밖으로 남긴 것**: `IMPROVEMENTS.md` 항목 1의 나머지 파일들(랜딩/법률 페이지 등, 개별 판단 필요), `bg-white` 하드코딩(다이얼로그 배경, 이번 버그와 다른 패턴이라 손 안 댐).
- **다음 감사 영역**: 요금제/결제로 갱신.

### [03:05] Phase 2 — 사이클 5 (감사 대상: 요금제/결제)
- **베이스라인 재확인**: `pnpm vitest run` 282/282 통과, `pnpm run build` 성공(client+server). `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음 — 이전 사이클들의 판단대로 이번에도 손 안 댐(이 파일은 "수정 금지"로 취급).
- **감사 범위**: `pricing.tsx`(읽기 전용 확인만) 외에 결제/요금제와 실제로 연결된 표면 전부 — `api.payment.verify.ts`, `api.payment.webhook.ts`, `CustomDomainConnect.tsx` + `api.cloudflare-domain.ts`, `cloudflarePages.ts`의 Made-with 배지, `freeTrial.ts`, 헤더/사이드바의 "요금제" 링크, 설정 탭.
- **발견 1 (오탐)**: Grep 도구 출력에서 `Header.tsx`/`Menu.client.tsx`의 `href="/pricing"`이 `href="\pricing"`(백슬래시)로 보여서 실제 버그인가 의심했으나, `Read` 도구로 원본 바이트를 직접 확인하니 정상적인 `/pricing`이었음 — Grep 콘텐츠 출력 렌더링 특이 현상으로 판단, 실제 코드엔 문제 없음.
- **발견 2 (구조적, 코드 수정 안 함)**: `api.cloudflare-domain.ts`/`api.cloudflare-deploy.ts` 모두 요청자의 로그인 여부·프로젝트 소유권을 확인하는 코드가 전혀 없음. `CustomDomainConnect.tsx`의 `TODO_IS_PRO_USER` 게이트는 클라이언트 렌더링만 막을 뿐이라, `projectName`을 아는 사람이면 API에 직접 요청해 커스텀 도메인 연결·배포를 트리거할 수 있는 구조(단, 이 환경엔 `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`이 없어 503으로 막혀있음 — 프로덕션 설정 여부는 확인 불가). 앱 전체에 요청 인증 미들웨어 자체가 안 보여서 이 두 파일만 땜질하는 건 "최소 변경" 원칙과 일관성을 둘 다 벗어남 — `OVERNIGHT5_IMPROVEMENTS.md` 항목 4로 기록, 사람 판단 필요(우선순위 높음으로 표시).
- **나머지**: `api.payment.verify.ts`/`api.payment.webhook.ts`는 이미 자체 주석으로 "미완성 스켈레톤, pricing.tsx 연동 대기"라고 명시돼 있어 기존 기록과 일치 — 새로운 문제 아님. `CustomDomainConnect.tsx` 자체 로직(폴링, 재시도, 에러 메시지)은 검토 결과 문제 없음. `freeTrial.ts`는 메터링 동결 상태 그대로, 이번 사이클에서 손 안 댐.
- **코드 변경 없음** — 이번 사이클은 감사만 진행, 커밋은 문서(QUEUE/PROGRESS/REPORT)만.
- **다음 감사 영역**: 다크모드로 갱신.

### [03:15] Phase 2 — 사이클 6 (감사 대상: 다크모드)
- **베이스라인 재확인**: `corepack pnpm vitest run` 282/282 통과, `pnpm run build` 성공(client+server). `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음 — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **환경 메모**: 이 세션의 PowerShell/Bash PATH엔 `pnpm`이 직접 없었음(`corepack`은 있음) — `corepack pnpm <cmd>`로 전부 실행. `pnpm --version` 직접 실행은 EPERM으로 실패.
- **감사 방법**: 서브에이전트로 앱 전체(`app/`)를 재검색 — 기존에 알려진 "라이트 모드 --accent와 값이 같은 #FF5330/#E44A28 하드코딩" 패턴과 "죽은 dark: 토큰" 패턴 둘 다, 이미 고친 파일들(설정 탭 9개, PromptClarification/Artifact/Messages/FileTree/GitHub·GitLabDeploymentDialog/ui 12개) 밖에 더 있는지 확인.
- **발견 (죽은 다크 토큰)**: 새 인스턴스 없음 — 이 패턴은 이미 전부 정리됨(남은 참조는 회귀 테스트 스펙 파일 안뿐).
- **발견 (하드코딩 accent hex, 9곳/7개 파일)**:
  1. `ChatBox.tsx:136-139` — 채팅 입력창 애니메이션 테두리 글로우의 SVG 그라디언트 stop 4개. `isLanding` 조건부 인라인 스타일(같은 파일, 별개 블록)은 의도된 랜딩 전용 고정색이라 안 건드림 — 이 SVG는 `chatStarted` 이후 실제 채팅 입력창에도 항상 렌더링됨.
  2. `app/components/ui/Slider.tsx:74` — 워크벤치 코드/Diff/미리보기 탭 밑줄 인디케이터. 탭 글자색은 이미 토큰(`text-bolt-elements-item-contentAccent`)을 쓰는데 밑줄만 하드코딩.
  3. `APIKeyManager.tsx:158` — "API 키 받기" 버튼.
  4. `ModelSelector.tsx:691,852` — "무료 모델만" 토글, 무료 모델 선물상자 아이콘.
  5. `Menu.client.tsx:387,400,410,423` — 로그인/새 채팅 버튼, 선택모드 토글, 검색창 포커스 링. 이미 `dark:` 접두사가 붙어있었지만 같은 리터럴 값을 반복해서(`dark:bg-[#FF5330]/10` = `bg-[#FF5330]/10`) 사실상 무의미했음 — "죽은 다크 토큰"과 사촌 패턴.
  6. `HistoryItem.tsx:92,101,181` — 채팅 이름변경 입력창 포커스 링, 액션 버튼 hover 색 2곳.
  7. `ChatErrorBoundary.tsx:40` — 채팅 크래시 화면 재시작 버튼. 주변은 이미 `bolt-elements-*` 토큰인데 버튼만 고정.
  8. `root.tsx:260-261` — **일반**(비-404) `ErrorBoundary`의 재시작 버튼. 같은 파일 404 히어로(라인 202 근처)는 확인 결과 의도된 고정 코랄이라 그대로 둠 — 헷갈리지 않게 두 블록을 구분해서 처리.
  9. `VercelDeploymentLink.client.tsx:138` — accent 색은 아니지만 같은 클래스의 버그(테마 토큰 기반인데 hover만 순수 검정 `#000000` 하드코딩, 다크모드에서 저대비 위험) → `hover:text-bolt-elements-textPrimary`로 교체.
- **판단 보류(수정 안 함)**: `app/utils/globalErrorRecovery.ts:95-127`(React 트리 밖 최후 방어 크래시 카드, 항상 라이트 배색 — 의도적 "테마 무관 고정 안전색" 설계일 가능성 있어 보류) / `StarterTemplates.tsx`(죽은 코드 경로, `SHOW_DEV_TOOLS && !chatStarted` 뒤라 프로덕션 도달 불가). 둘 다 `OVERNIGHT5_IMPROVEMENTS.md` 항목 1에 기록.
- **변경**: 위 9곳 전부 `var(--accent)`/`var(--on-accent)`/`var(--accent-hover)`/`bolt-elements-textPrimary`로 교체. 파일: `ChatBox.tsx`, `Slider.tsx`, `APIKeyManager.tsx`, `ModelSelector.tsx`, `Menu.client.tsx`, `HistoryItem.tsx`, `ChatErrorBoundary.tsx`, `root.tsx`, `VercelDeploymentLink.client.tsx`.
- **테스트**: `app/darkModeAccentAudit.spec.ts` 신규 14건(소스 grep 방식, 기존 관행과 동일). root.tsx는 일반 ErrorBoundary 블록만 검사하고 404 히어로의 의도된 `#FF5330`은 남아있는지 별도로 확인하는 테스트도 추가(실수로 같이 지워지는 것 방지).
- **검증**: typecheck 0에러, lint 통과(무관한 기존 warning 1건만, `auth.ts`), test 296개 전부 통과, build(client+server) 성공.
- **커밋**: `b204747`
- **다음 감사 영역**: 모바일로 갱신.

### [03:04] Phase 2 — 사이클 7 (감사 대상: 모바일)
- **베이스라인 재확인**: `corepack pnpm vitest run` 296/296 통과, `pnpm run build` 성공(client+server). `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음 — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/workbench/*`, `deploy/*`, `header/*`, `chat/*`, `settings/*`, `pricing.tsx`, `Dialog.tsx` 계열을 검색해 고정폭/오버플로/터치타겟/데스크톱 전용 표면 위주로 모바일 깨짐 후보 5건을 확인 요청.
- **발견 1(고침)**: `ControlPanel.tsx:263`(설정 모달) — `w-[1200px] h-[90vh]` 고정, 반응형 변형 전혀 없음. 375px 폰에서 뷰포트를 약 825px 초과해 아바타 메뉴에서 열리는 핵심 진입점(설정)이 사실상 사용 불가.
- **발견 2(고침)**: `ColorSchemeDialog.tsx:230`(Design Palette 다이얼로그, 워크벤치 툴바 아이콘버튼에서 열림) — `min-w-[480px] max-w-[90vw]`가 함께 있었지만 CSS에서 `min-width`가 `max-width`보다 항상 우선이라 `max-w-[90vw]`가 사실상 죽은 코드였음. 375px 폰에서 90vw=~337px인데 실제로는 480px로 렌더돼 ~140px 오버플로.
- **변경**: `ControlPanel.tsx` → `w-[95vw] sm:w-[90vw] max-w-[1200px] h-[90vh]`. `ColorSchemeDialog.tsx` → `w-[90vw] sm:min-w-[480px] sm:w-auto max-w-[90vw]`(모바일에선 min-w 미적용, sm 이상에서만 480px 최소폭 복원).
- **테스트**: `app/mobileDialogOverflow.spec.ts` 신규 2건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm vitest run` 298/298 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `7800fa8`
- **범위 밖으로 남긴 것**: 서브에이전트가 찾은 나머지 2건(`Menu.client.tsx` 아바타 32px 터치타겟, `HeaderActionButtons.client.tsx` flex-wrap 부재)은 확신도가 낮거나 다른 부작용 확인이 더 필요해 `OVERNIGHT5_IMPROVEMENTS.md` 항목 5로 기록만 하고 코드는 손 안 댐.
- **다음 감사 영역**: 한국어 문구로 갱신.

### [03:20] Phase 2 — 사이클 8 (감사 대상: 한국어 문구)
- **베이스라인 재확인**: `corepack pnpm vitest run` 298/298 통과, `pnpm run build` 성공(client+server). `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음 — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: 서브에이전트로 앱 전체 UI 문구(버튼/토스트/에러메시지/placeholder/제목)를 대상으로 용어 불일치·부자연스러운 번역투·조사 오류·영어 혼입·존댓말 레벨 불일치를 검색. 보고받은 5건 각각을 직접 grep/Read로 재검증(agent 보고를 그대로 신뢰하지 않고 원본 확인).
- **검증 중 정정한 것**: agent가 "GitHubAuthDialog/GitLabDeploymentDialog/BranchSelector/ColorSchemeDialog에 영어 'Cancel'이 한국어 UI 속에 섞여있다"고 보고했으나, 각 파일을 `[가-힣]` 패턴으로 grep한 결과 0건 — 실제로는 이 4개 파일이 처음부터 끝까지 통째로 영어(한국어가 전혀 없음)였음. "단어 하나 누락"이 아니라 "화면 전체 미번역"이라 최소 변경 범위를 넘어서 이번엔 손 안 대고 `OVERNIGHT5_IMPROVEMENTS.md` 항목 2에 정정 기록만 남김.
- **변경(3건, 전부 검증 완료 후 수정)**:
  1. `app/components/deploy/DeployButton.tsx` — `'GitLab로 내보내기'` → `'GitLab으로 내보내기'` (받침 있는 명사 뒤 조사 오류, 받침 없는 GitHub/Vercel의 "로"는 정상이라 그대로 둠).
  2. `app/components/sidebar/Menu.client.tsx` — 검색 placeholder/aria-label("채팅 검색...")과 목록 제목("내 채팅")이 같은 파일 안 15곳 이상의 토스트/삭제 다이얼로그("대화")와 용어가 갈려있던 것을 "대화"로 통일(다수결 근거로 "대화" 채택).
  3. `app/components/chat/BaseChat.tsx` — 랜딩 3단계 안내 제목이 `말하면`(조건절)/`만들어져요`(평서문)/`바로 써요`(평서문)로 문법적으로 안 맞았던 것을 `말해요`(평서문)로 수정해 병렬 구조 통일.
- **테스트**: `app/koreanCopyAudit.spec.ts` 신규 3건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm vitest run` 301/301 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `e2eb0e0`
- **범위 밖으로 남긴 것(구조적 판단 필요, IMPROVEMENTS.md에 기록)**: (1) 랜딩/헤더의 "내 프로젝트"와 실제 앱 목록 페이지의 "내 앱"이 다른 이름을 가리키는 내비게이션 명명 불일치(항목 6, 신규) — 여러 진입점을 한 번에 맞춰야 하는 IA 결정이라 보류. (2) GitHubAuthDialog/BranchSelector/ColorSchemeDialog 전체 미번역(항목 2에 추가) — GitHub/GitLabDeploymentDialog와 같은 스코프로 묶어 나중에 한 번에 처리 권장.
- **다음 감사 영역**: 온보딩으로 갱신(로테이션 처음부터 다시).

### [03:30] Phase 2 — 사이클 9 (감사 대상: 온보딩)
- **베이스라인 재확인**: `corepack pnpm vitest run` 301/301 통과, `pnpm run build` 성공(client+server). `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음 — 이전 사이클들의 판단대로 이번에도 손 안 댐(사용자 본인의 진행 중 작업, 자동 세션이 만든 변경 아님).
- **감사 방법**: Explore 서브에이전트로 온보딩 표면(`PromptClarification.tsx`, `BaseChat.tsx`, `Chat.client.tsx`의 온보딩 완료 처리, `generateAppQuestions.ts`, `ChatBox.tsx`)을 대상으로 엣지 케이스(빈/공백 입력, 더블 서브밋, 생성 실패)·에러 처리 누락·다크모드·모바일 관점으로 점검 요청. 보고받은 9건 중 소스를 직접 Read로 재확인.
- **변경(5건, 전부 검증 완료 후 수정)**:
  1. `app/components/chat/ChatBox.tsx` — 전송 버튼 disabled 조건이 `input.length === 0`만 봐서 공백만 입력해도(스페이스바 실수 등) 버튼이 활성화되지만 클릭해도 `sendMessage`의 trim 체크에 막혀 조용히 아무 반응 없던 문제 → `input.trim().length === 0` 기준으로 수정.
  2. `app/components/chat/PromptClarification.tsx` — "바로 만들기"/최종 "만들기" 버튼에 더블탭 가드가 없어(옵션 선택 버튼엔 `pendingOptionId` 가드가 이미 있었음) 빠르게 두 번 누르면 `onComplete`(→`generateNewApp`→`recordGenerationUsed`)가 두 번 호출돼 무료 생성 크레딧이 이중 차감될 위험 → `completedRef` 가드로 첫 호출 이후 무시하도록 수정.
  3. `app/components/chat/PromptClarification.tsx` — "바로 만들기"(~32px)/"직접 입력할게요"(~36px) 버튼이 권장 터치 타겟(~40-44px) 미만이고, 온보딩 화면 첫 진입 시 가장 먼저 보이는 인터랙션 요소라 영향이 큼 → 둘 다 `min-h-11`(44px)로 수정.
  4. `app/components/chat/PromptClarification.tsx` — 직접입력 인풋의 Enter 키 처리에 IME 조합 중 가드가 없어(메인 채팅창인 `ChatBox.tsx`는 이미 `isComposing` 체크가 있음) 한글 입력 중 Enter로 조합 중인 글자가 잘려서 제출될 수 있던 불일치 → `!e.nativeEvent.isComposing` 가드 추가.
  5. `app/components/chat/BaseChat.tsx` — "어떻게 만들어지나요" 3단계 안내 섹션은 주변 전부 `var(--bg)`/`var(--surface)`/`var(--text)` 등 테마 토큰을 쓰는데 단계 번호 배지만 `#FF5330`/`#FAF7F0` 하드코딩 → 다크모드에서 카드는 어두워지는데 배지만 라이트모드 코랄로 남던 문제. 사이클 6의 하드코딩 accent 정리(`darkModeAccentAudit.spec.ts`) 대상 파일 목록에 `BaseChat.tsx`가 없어 놓쳤던 사각지대 → `var(--accent)`/`var(--on-accent)`로 수정.
- **테스트**: `app/onboardingAudit.spec.ts` 신규 5건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm vitest run` 306/306 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `aff3c5c`
- **범위 밖으로 남긴 것(구조적 판단 필요, IMPROVEMENTS.md 항목 7·8로 기록)**: (1) 온보딩 완료 직후 `generateNewApp()`이 무료 생성 한도 초과/네트워크 오류로 실패하면, 이미 랜딩/온보딩 UI가 언마운트된 뒤라 사용자가 빈 채팅창만 보게 되는 문제 — 토스트 하나만 스쳐 지나가고 재시도 수단이 없음. 상태 전환 순서를 바꾸거나 실패 시 되돌리는 UX 설계가 필요해 보류. (2) `generateAppQuestions.ts`가 API 실패와 "정상적으로 추가 질문 없음"을 구분 없이 둘 다 `null`/빈 배열로 처리해 완전히 조용함 — 실패를 사용자에게 어떻게 노출할지(또는 안 할지) 판단 근거 부족해 보류. 그 외 낮은 우선순위(모바일 섹션 padding 반응형 부재)는 기록 없이 넘김.
- **다음 감사 영역**: 생성으로 갱신.

### [03:35] Phase 2 — 사이클 10 (감사 대상: 생성)
- **베이스라인 재확인**: `corepack pnpm vitest run` 306/306 통과, `pnpm run build` 성공(client+server). `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 큐에도 기록돼 있음) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `action-runner.ts`(액션 실행), `message-parser.ts`(스트리밍 파싱), `Artifact.tsx`/`Messages.client.tsx`(진행 상황 렌더), `api.chat.ts`(서버 스트리밍 라우트)를 대상으로 스트림 에러/불완전 태그 처리, 무음 실패, 한국어 문구, 다크모드/모바일 관점으로 점검 요청. 보고받은 5건 전부 직접 Read로 재검증(콜 체인 추적 포함).
- **변경(1건, 크래시 버그 — 검증 완료 후 수정)**: `app/lib/runtime/message-parser.ts`(`#parseActionTag` 호출부, `parse()` 내부) — Supabase 액션의 `operation`이 `migration`/`query`가 아니거나 `migration`인데 `filePath`가 없으면 `#parseActionTag`가 `throw`하는데, 이를 잡는 `try/catch`가 `useMessageParser.ts`→`Chat.client.tsx`→`EnhancedStreamingMessageParser.parse` 어느 호출 체인에도 없어서 `ChatErrorBoundary`까지 전파돼 채팅 세션 전체가 에러 화면으로 크래시되는 구조였음(AI가 이런 태그를 출력하는 건 드물지만 한 번이라도 발생하면 사용자가 대화를 통째로 잃음). `#parseActionTag` 호출을 `try/catch`로 감싸 실패 시 해당 액션 태그만 건너뛰고(`state.insideAction`을 true로 만들지 않고 `i`를 태그 끝으로 이동) 나머지 스트림 파싱은 계속하도록 수정.
- **테스트**: `app/lib/runtime/message-parser.spec.ts`에 신규 2건(잘못된 operation / migration인데 filePath 없음, 둘 다 `runTest` 헬퍼로 "안 던지고 다음 액션은 정상 처리됨"을 스냅샷으로 검증).
- **검증**: `corepack pnpm vitest run` 308/308 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `d158d4b`
- **범위 밖으로 남긴 것(구조적 판단 필요, `OVERNIGHT5_IMPROVEMENTS.md` 항목 9로 기록)**: (1) Supabase 액션 실패가 알림 없이 완전히 무음(콜백 미호출 + `Artifact.tsx`가 목록에서 아예 필터링) — 알림 플러밍 신설이 필요해 보류. (2) 쉘 액션 에러 제목 6개가 영어로 하드코딩돼 한국어 UI에 그대로 노출 — 다른 참조 여부 전수 확인 먼저 필요. (3) 빌드 실패 시 알림이 두 번 뜨고 두 번째가 항상 'Dev Server Failed'로 잘못 표시 — 실제 사용자 영향 브라우저 재현 필요(확신도 중간). (4) `cp`/`mv` 원본 없음 검증 결과가 호출부에서 읽히지 않아 항상 버려지는 죽은 코드 — 낮은 우선순위.
- **다음 감사 영역**: 미리보기/워크벤치로 갱신.

### [03:50] Phase 2 — 사이클 11 (감사 대상: 미리보기/워크벤치)
- **베이스라인 재확인**: `corepack pnpm vitest run` 308/308 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `Workbench.client.tsx`/`Preview.tsx`/`FileTree.tsx`/`EditorPanel.tsx`/`terminal/*`를 대상으로 엣지 케이스(빈 상태, 포트 미준비, 파일명 이상), 에러 처리 누락, 한국어 문구, 다크모드/모바일 관점으로 점검 요청. 보고받은 7건을 직접 Read로 재검증.
- **변경(3건, 전부 검증 완료 후 수정)**:
  1. `app/components/workbench/ExpoQrModal.tsx` — Expo Go 미리보기 안내 다이얼로그 3곳(제목/설명/URL 없음 안내)이 전부 영어였음(이 모달은 `expoUrl`이 있을 때만 뜨는 별도 아이콘 버튼 경로라 이전 사이클들의 한국어 문구 감사에서 놓친 사각지대). 한국어로 번역. 배경색 `#8a5fff`는 Expo 자체 브랜드 보라색으로 판단해(로고 아이콘 옆 QR 배경) 손 안 댐.
  2. `app/components/workbench/terminal/TerminalTabs.tsx` — 첫 번째 터미널은 "코랄레드 터미널"(한국어)인데 추가로 여는 터미널만 "Terminal {n}"(영어)이라 같은 탭 바 안에서 용어가 갈렸던 것 → "터미널 {n}"으로 통일.
  3. `app/components/workbench/Preview.tsx` — "새 창에서 열기"/"새 탭에서 열기" 버튼이 팝업 차단·잘못된 미리보기 URL·미리보기 없음 상황에서 `console.warn`/`console.error`만 찍고 아무 UI 반응이 없어(이 파일에 `toast` import 자체가 없었음) 사용자는 버튼을 눌러도 아무 일도 안 일어나는 것처럼 보였음 → `react-toastify`의 `toast` import 추가, 4개 실패 지점(팝업 차단 1곳, 잘못된 URL 2곳, 활성 미리보기 없음 1곳) 전부에 한국어 토스트 추가.
- **테스트**: `app/previewWorkbenchAudit.spec.ts` 신규 3건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm vitest run` 311/311 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **범위 밖으로 남긴 것(구조적 판단 필요, `OVERNIGHT5_IMPROVEMENTS.md` 항목 10으로 기록)**: (1) `FileTree.tsx` 우클릭 컨텍스트 메뉴 전체(8개 항목) + 실패 토스트 6곳이 영어 — 다음 사이클 최우선 후보. (2) `EditorPanel.tsx` 사이드바 탭("Files"/"Search"/"Locks")·버튼("Save"/"Reset") 영어. (3) `TerminalTabs.tsx`의 `closeTerminal`이 위치 기반 key라 중간 탭을 닫으면 다른 탭의 세션이 안 정리된 채 남을 수 있는 구조적 의심(런타임 미검증, 확신도 중간). (4) `Preview.tsx` iframe에 `onError` 폴백이 없어 실제 로드 실패 시 15초 뒤 무음으로 빈 화면만 보임 — 감지/재시도 UX 설계 필요.
- **다음 감사 영역**: 배포로 갱신.

### [04:00] Phase 2 — 사이클 12 (감사 대상: 배포)
- **베이스라인 재확인**: `corepack pnpm vitest run` 311/311 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/deploy/*`(GitHub/GitLab/Vercel/Netlify/Cloudflare 배포 훅, DeployButton.tsx, CustomDomainConnect.tsx, VercelDeploymentLink.client.tsx)를 대상으로 엣지 케이스, 에러 처리 누락, 한국어 문구, 다크모드/모바일 관점으로 점검 요청(사이클 4에서 이미 색상/다크모드 처리가 끝난 다이얼로그 2개는 제외 지시). 보고받은 3건 전부 직접 Read/Grep으로 재검증.
- **정정한 것**: 서브에이전트가 "double-click 시 GitHub/GitLab/Vercel/Netlify 배포가 중복 실행될 수 있다"고 보고했으나, `DeployButton.tsx:41-148`을 직접 확인한 결과 5개 프로바이더 버튼이 전부 하나의 공유 `isDeploying` state로 동시에 disabled 처리되고 있어(Cloudflare 훅에만 있는 내부 재진입 가드는 이 컴포넌트가 유일한 호출자라 실질적으로 덧대는 방어일 뿐) 실제 위험은 낮다고 판단, 수정 안 함(`OVERNIGHT5_IMPROVEMENTS.md` 항목 11에 정정 기록).
- **변경(1건, 전부 검증 완료 후 수정)**: `app/components/deploy/GitHubDeploy.client.tsx`/`GitLabDeploy.client.tsx`/`VercelDeploy.client.tsx`/`NetlifyDeploy.client.tsx` — 계정 미연결/채팅 없음/빌드 실패/배포 응답 오류/타임아웃 시 뜨는 토스트와 throw Error 문구가 `CloudflareDeploy.client.tsx`만 한국어이고 나머지 4개 프로바이더는 전부 영어 그대로였음(예: "Please connect your GitHub account...", "🚀 GitHub deployment preparation completed successfully!"). CloudflareDeploy.client.tsx의 기존 한국어 문구·용어를 그대로 맞춰 4개 파일 전부 번역.
- **테스트**: `app/deployToastKoreanAudit.spec.ts` 신규 8건(소스 grep 방식, 기존 관행과 동일 — 문자열 리터럴만 정확히 매칭하도록 처음엔 느슨한 substring 패턴으로 오탐(코드 주석까지 걸림)이 나서 리터럴 앞뒤 문맥까지 포함하도록 좁혀 재작성).
- **검증**: `corepack pnpm vitest run` 319/319 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `f7c5d57`
- **범위 밖으로 남긴 것(구조적 판단 필요, `OVERNIGHT5_IMPROVEMENTS.md` 항목 11로 기록)**: `VercelDeploymentLink.client.tsx`의 배포 상태 조회 fetch 실패가 완전히 무음(콘솔 로그만, UI엔 아무것도 안 뜸) — "미배포"와 "조회 실패"를 구분 못 하는 문제, UX 설계 필요해 보류.
- **다음 감사 영역**: 요금제/결제로 갱신.

### [04:10] Phase 2 — 사이클 13 (감사 대상: 요금제/결제)
- **베이스라인 재확인**: `corepack pnpm vitest run` 319/319 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 수정 금지 파일) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `pricing.tsx`는 제외하고 요금제/결제 연결 표면(`api.payment.verify.ts`/`api.payment.webhook.ts`, `CustomDomainConnect.tsx`+`api.cloudflare-domain.ts`, `api.cloudflare-deploy.ts`, `freeTrial.ts`, `cloudflarePages.ts`)을 대상으로 엣지 케이스·에러 처리 누락·한국어 문구·다크모드/모바일 관점으로 점검 요청(사이클 5에서 이미 구조적 문제로 기록된 인증 부재/Pro 게이트 항목은 재보고 제외 지시). 보고받은 5건 전부 직접 Read로 재검증.
- **발견·수정(1건, 크래시 버그)**: `app/routes/api.cloudflare-deploy.ts` — `deployFiles` 매핑 안 `base64ToBytes()` 호출이 기존 `try/catch` 블록 **바깥**에 있어서, 클라이언트가 손상되거나 잘못된 base64 파일 콘텐츠를 보내면 `atob()`이 던지는 예외가 어디서도 안 잡히고 그대로 전파돼 이 라우트의 다른 모든 에러 케이스(`toUserMessage`가 친절한 한국어로 처리하는)와 달리 안내 없는 원시 500 오류로 이어지는 구조였음.
- **변경**: 디코딩 단계(`Object.entries(files).map(...)`)를 별도 `try/catch`로 감싸 실패 시 `400 파일 데이터가 손상됐어요. 다시 빌드한 뒤 시도해주세요.`를 반환하도록 수정. 파일: `app/routes/api.cloudflare-deploy.ts`.
- **테스트**: `app/apiCloudflareDeployAudit.spec.ts` 신규 2건 — `action()`을 직접 호출해 실제 동작을 검증(소스 grep이 아니라 실행 기반 테스트, 이 라우트는 순수 함수라 가능했음). **주의**: 처음엔 `app/routes/` 안에 스펙 파일을 뒀다가 `cloudBuildSecurity.spec.ts`(실제 프로덕션 빌드 실행)가 `MISSING_EXPORT` 에러로 실패함 — Remix가 `app/routes/` 안의 모든 파일을 라우트로 자동 인식해서 클라이언트 번들에서 `action`/`loader` export를 스트립하는 처리가 스펙 파일에도 적용되면서 깨진 것으로 확인. `app/` 최상위(`app/apiCloudflareDeployAudit.spec.ts`)로 옮겨서 해결 — **이후 사이클에서 라우트 액션/로더를 직접 호출하는 테스트를 추가할 땐 반드시 `app/routes/` 바깥에 둘 것**.
- **검증**: `corepack pnpm run typecheck` 0에러(보호 파일 `functions/[[path]].ts`의 기존 무시 대상 에러 1건 제외), `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 321/321 통과(`cloudBuildSecurity.spec.ts`의 실제 프로덕션 빌드 포함), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `54326e0`
- **범위 밖으로 남긴 것(구조적/판단 필요, `OVERNIGHT5_IMPROVEMENTS.md` 항목 12로 기록)**: (1) `freeTrial.ts`의 로그인 사용자 조회/증가 함수가 "Supabase 클라이언트 없음" 상황을 다르게 처리(조회는 조용히 0, 증가는 throw) — 메터링 관련이라 위험 회피, 손 안 댐. (2) `freeTrial.ts`의 게스트 localStorage 카운터가 원자성 없는 read-modify-write라 동시 요청 시 언더카운트 가능 — 마찬가지로 메터링, 손 안 댐. (3) `api.cloudflare-domain.ts`의 도메인 정규식이 한글 도메인을 거부하면서 퓨니코드 안내가 없음 — 낮은 우선순위 UX 갭. (4) `cloudflarePages.ts`의 무료 배지 문구 "Made with 코랄레드"(영어+한국어 혼용) — 의도적 브랜딩 관용구일 가능성 높아 기록만.
- **다음 감사 영역**: 다크모드로 갱신.

### [04:24] Phase 2 — 사이클 14 (감사 대상: 다크모드)
- **베이스라인 재확인**: `corepack pnpm vitest run` 321/321 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 수정 금지 파일) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/` 전체(이미 정리된 파일들 제외 지시)를 대상으로 하드코딩 accent hex 신규 사례, 죽은 dark 토큰, 저대비/불일치 다크모드 표면을 재검색. 보고받은 5건 전부 직접 Grep/Read로 재검증.
- **발견·수정(1건)**: `app/routes/privacy.tsx:178`, `app/routes/terms.tsx:121,172`, `app/components/legal/LegalPageLayout.tsx:26` — 법률 페이지(개인정보처리방침/이용약관) 링크 4곳이 `text-[#FF5330]` 하드코딩. 이 페이지들은 배경/텍스트/보더 전부 `bolt-elements-*` 테마 토큰을 쓰는데 링크만 라이트모드 고정 코랄로 남아 다크모드 `--accent`와 어긋났음. `OVERNIGHT5_IMPROVEMENTS.md` 항목 1에 "미확인"으로 남아있던 후보였는데 이번에 직접 확인해 버그로 확정 — `login.tsx`/`signup.tsx`가 이미 쓰는 `style={{ color: 'var(--accent)' }}` 패턴으로 통일.
- **판단 보류(수정 안 함, 확신도 낮거나 범위 확장 필요)**: (1) `NetlifyConnection.tsx:861-862`의 `text-bolt-elements-textDestructive`가 `uno.config.ts`에 정의 안 된 죽은 토큰 — 에러 메시지 강조색이 빠지는 문제로 보이나 에러 상황에서만 보여 확신도/영향도 중간, 다음 사이클 후보로 남김. (2) `NetlifyTab.tsx`/`NetlifyConnection.tsx`의 `bolt-elements-link-text`/`link-textHover` 죽은 토큰 4곳 — 같은 패턴, 범위 확인 더 필요. (3) GitHub/GitLab 저장소 카드의 `icon-warning`/`icon-info` 죽은 토큰 다수(별 아이콘 등 색상 누락) — 파일 수가 많아 범위 큼, 다음 사이클로 미룸. (4) `Search.tsx:203`의 `text-gray-500`이 형제 상태(`text-bolt-elements-textTertiary`)와 토큰 불일치 — 확신도 낮은 스타일 닛(nit)으로 판단, 손 안 댐.
- **테스트**: `app/legalPagesAccentAudit.spec.ts` 신규 3건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm vitest run` 324/324 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `6f9b309`
- **범위 밖으로 남긴 것**: 위 판단 보류 4건 모두 `OVERNIGHT5_IMPROVEMENTS.md` 항목 13으로 신규 기록.
- **다음 감사 영역**: 모바일로 갱신.

### [04:40] Phase 2 — 사이클 15 (감사 대상: 모바일, 2회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 324/324 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 수정 금지 파일) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/**`/`app/routes/**` 전체를 재검색(사이클 7에서 이미 고친 ControlPanel.tsx/ColorSchemeDialog.tsx, 확신도 낮아 보류된 Menu.client.tsx 아바타/HeaderActionButtons.client.tsx는 재보고 제외 지시)해 고정폭/터치타겟/wrap 부재 새 후보를 확인 요청. 보고받은 5건 전부 직접 Read/Grep으로 재검증.
- **발견·수정(3건, 전부 검증 완료 후 수정)**:
  1. `app/components/chat/WebSearch.client.tsx:119-142` — "사이트 참고" 팝오버(채팅 툴바 버튼, 상시 노출)의 URL 입력창이 `w-[300px]` 고정. 팝오버 자체도 `max-w` 제한이 없어 375px 뷰포트에서 입력창+버튼+패딩 합이 뷰포트를 넘음 → 입력창을 `w-[min(300px,calc(100vw-8rem))]`로, 팝오버 컨테이너에 `max-w-[calc(100vw-2rem)]` 추가.
  2. `app/components/chat/APIKeyManager.tsx:124` — 프로바이더 API 키 편집 입력창도 동일한 `w-[300px]` 고정, 부모가 `flex items-center justify-between`(wrap 없음)이라 좁은 화면에서 라벨과 충돌 위험 → `w-[min(300px,calc(100vw-10rem))]`로 수정.
  3. `app/components/workbench/FileBreadcrumb.tsx:123` — 폴더 브레드크럼 드롭다운이 `min-w-[300px]`만 있고 `max-w` 없음, `DropdownMenu.Content`에 `avoidCollisions={false}`가 설정돼 있어 화면 밖으로 밀려도 자동 재배치가 안 됨(사이클 7의 `ColorSchemeDialog.tsx`와 같은 "min-width가 max-width보다 CSS 우선순위 높음" 버그 클래스) → `min-w-[300px]`를 `w-[min(300px,calc(100vw-2rem))]`로 교체(기존 `Dialog.tsx:119`가 이미 쓰던 `w-[min(Npx,calc(100vw-Nrem))]` 관용구 재사용).
- **테스트**: `app/mobileFixedWidthOverflow.spec.ts` 신규 3건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm vitest run` 327/327 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **범위 밖으로 남긴 것(구조적/확신도 낮음, `OVERNIGHT5_IMPROVEMENTS.md` 항목 14로 기록)**: (1) `GitHubStats.tsx`/`StatusDashboard.tsx`의 `grid-cols-4`/`grid-cols-3`이 반응형 변형 없음(형제 블록은 이미 `md:grid-cols-4` 패턴을 쓰는데 일부만 놓침) — 실사용 빈도 낮은 설정 세부 화면이라 우선순위 낮게 기록. (2) WebSearch/APIKeyManager의 Fetch/Save 버튼 `px-3 py-1.5`가 36px 미만 터치타겟(확신도 낮음, 폭 수정만 이번에 반영).
- **다음 감사 영역**: 한국어 문구로 갱신.

### [04:44] Phase 2 — 사이클 16 (감사 대상: 한국어 문구)
- **베이스라인 재확인**: `corepack pnpm vitest run` 327/327 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 수정 금지 파일) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/**`/`app/routes/**`/`app/lib/**`를 대상으로 하드코딩 영어 UI 문구(토스트, 버튼 라벨, aria-label, placeholder, title)와 어색한 한국어 문구를 재검색(이미 정리된 표면은 제외 지시). 보고받은 8건 전부 직접 Read/Grep으로 재검증.
- **변경(2건, 전부 검증 완료 후 수정)**:
  1. `app/components/chat/ModelSelector.tsx` — 프로바이더/모델 검색 드롭다운(모델 전환마다 열리는 핵심 표면)의 `placeholder="Search providers/models..."`, `aria-label="Search providers/models"`, `aria-label="Clear search"`(2곳), 무료/선택됨 배지 `title="Free model"`/`title="Selected"` 전부 영어였음 → 한국어로 번역.
  2. `app/components/chat/CodeBlock.tsx:74` — AI가 만드는 거의 모든 코드 블록에 뜨는 복사 버튼 `title="Copy Code"` → `title="코드 복사"`.
- **재검증 결과 skip한 것**: 서브에이전트가 보고한 `DicussMode.tsx`(파일명 오타)의 `title="Discuss"`는 grep으로 사용처를 확인한 결과 앱 어디서도 import되지 않는 죽은 컴포넌트라 실사용자에게 도달 불가 — 손 안 댐.
- **테스트**: `app/modelSelectorKoreanAudit.spec.ts` 신규 4건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm vitest run` 331/331 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `5191796`
- **범위 밖으로 남긴 것(범위 초과, `OVERNIGHT5_IMPROVEMENTS.md` 항목 15로 기록)**: (1) `FileTree.tsx` 우클릭 메뉴 8곳 + catch fallback 토스트 6곳(사이클 11부터 알려진 항목, 여전히 미해결) — 다음 사이클 최우선 후보. (2) `EditorPanel.tsx` 사이드바 탭/버튼(마찬가지로 사이클 11부터 미해결). (3) `GitCloneButton.tsx`/`ImportFolderButton.tsx` 신규 발견 — title 2곳 + 토스트 6곳 영어.
- **다음 감사 영역**: 온보딩으로 갱신(전체 목록 한 바퀴 완료 후 처음으로 복귀).

### [05:00] Phase 2 — 사이클 17 (감사 대상: 온보딩, 3회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 331/331 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 수정 금지 파일) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `PromptClarification.tsx`/`BaseChat.tsx`/`Chat.client.tsx`(온보딩 완료 경로)/`generateAppQuestions.ts`/`ChatBox.tsx`를 재감사, 사이클 1·9에서 이미 고친 항목은 재보고 제외 지시. 보고받은 5건(신규) 전부 직접 Read로 재검증.
- **발견·수정(1건, 검증 완료 후 수정)**: `PromptClarification.tsx`의 `buildFinalPromptAndDirectives` — 고정 질문은 "잘 모르겠어요"(value===null)를 `mapAnswerToDirectives`의 기본 케이스에서 의도적으로 무시(EMPTY, `answer-directives.ts`에 명시된 설계)하는데, 앱별 동적(isDynamic) 질문은 이 예외가 없어서 "잘 모르겠어요"를 선택해도 `"${question.question} ${answer.label}"`(예: "매매 방식은 어떻게 되나요? 잘 모르겠어요") 형태의 무의미한 줄이 그대로 생성 프롬프트("추가로 알려주신 내용")에 들어가고 있었음. `answer.optionId === 'unsure'` 체크를 custom/isDynamic 분기보다 먼저 추가해 빈 객체를 반환하도록 수정.
- **테스트**: `app/onboardingUnsureAnswerAudit.spec.ts` 신규 1건(소스 검사 — 'unsure' 체크가 존재하고 dynamic 분기보다 먼저 오는지 확인).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 332/332 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `c66f00e`
- **범위 밖으로 남긴 것(구조적, `OVERNIGHT5_IMPROVEMENTS.md` 항목 16으로 기록)**: (1) 이미지만 업로드하고 텍스트 없이 첫 메시지를 보내면 전송 버튼은 활성화되는데 아무 반응 없는 막다른 골목(`ChatBox.tsx`/`Chat.client.tsx`의 `sendMessage`가 업로드 파일을 안 봄). (2) `selectOption`의 220ms 지연 확인 애니메이션이 "직접 입력" 제출/"바로 만들기" 스킵과 경쟁 상태(레이스 컨디션으로 답변이 조용히 덮어써지거나 언마운트된 컴포넌트에 setState). (3) 온보딩 완료 직후 짧은 순간 이전 입력창 텍스트가 남아 재전송 가능(항목 7과 근본 원인 겹침). 셋 다 여러 핸들러/상태 전환 순서를 함께 바꿔야 하는 구조적 수정이라 이번 사이클 범위를 넘어섬.
- **다음 감사 영역**: 생성으로 갱신.

### [05:20] Phase 2 — 사이클 18 (감사 대상: 생성, 2회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 332/332 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `message-parser.ts`/`enhanced-message-parser.ts`/`action-runner.ts`/`workbench.ts`/`Artifact.tsx`/`api.chat.ts`를 재감사(사이클 10에서 이미 고친 크래시 버그, 기록된 4건은 재보고 제외 지시). 보고받은 6건 전부 직접 Read로 재검증.
- **발견·수정(1건, 검증 완료 후 수정, 세션 전체 영향 크래시급)**: `message-parser.ts`의 `file` 타입 액션이 `filePath` 속성 없이도 `logger.debug`만 남기고 `filePath: undefined`로 통과했음. 이 액션이 `WorkbenchStore#_runAction`(`workbench.ts:666`)의 `path.join(wc.workdir, data.action.filePath)`에 도달하면 `path-browserify`가 던지는데, 이 호출은 `addToExecutionQueue`(`workbench.ts:96-98`)가 만드는 `#globalExecutionQueue` 프로미스 체인 안에서 실행되고 이 체인엔 `.catch`가 전혀 없음(grep으로 3곳 전체 참조 확인) — 한 번 reject되면 그 뒤로 체인에 이어붙는 모든 `.then(() => callback())`이 콜백을 아예 안 부르고 reject만 전달하므로, 그 세션에서 앞으로 오는 모든 파일 쓰기·셸 실행이 사용자에게 아무 에러 없이 조용히 no-op이 됨(모듈 전역 싱글턴 스토어라 세션 끝까지 영구 지속). Supabase 액션의 filePath 누락 케이스(사이클 10에서 이미 throw로 처리돼 있음, `message-parser.ts:383-386`)와 동일한 패턴으로 맞춰 throw하도록 수정 — 기존 malformed-tag catch(`message-parser.ts:223-233`, 사이클 10에서 추가됨)가 그대로 스킵 처리함.
- **테스트**: `app/lib/runtime/message-parser.spec.ts`에 신규 1건 추가(`filePath` 없는 file 액션이 throw 없이 스킵되는지 확인, 기존 Supabase 케이스 테스트와 동일 패턴).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 333/333 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `a967692`
- **범위 밖으로 남긴 것(구조적/판단 필요, `OVERNIGHT5_IMPROVEMENTS.md` 항목 17로 기록)**: (1) 자동 감지 폴백의 `reset()`이 전체 파서 상태+공유 아티팩트 카운터를 초기화해 중복 액션 재실행 위험(런타임 미재현, 확신도 중). (2) 파일 쓰기 실패가 무음으로 삼켜지고 액션은 그대로 complete 표시. (3) type 속성 누락 액션이 아무 실행 없이 complete 표시(같은 패턴이지만 file 액션 건보다 영향 범위 작음). (4) 스트리밍 진행 상태 라벨(`api.chat.ts`) 6곳 하드코딩 영어. (5) 쉘 액션 코드 블록이 라이트 모드에서도 항상 dark-plus 테마 — 의도된 디자인일 가능성 있어 사람 확인 필요.
- **다음 감사 영역**: 미리보기/워크벤치로 갱신.

### [05:22] Phase 2 — 사이클 19 (감사 대상: 미리보기/워크벤치, 2회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 333/333 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/workbench/**`/`app/lib/stores/workbench.ts`/`app/lib/stores/previews.ts`를 재감사(이전 사이클에서 이미 고친 색상/모바일/터미널 탭 항목은 재보고 제외 지시). 보고받은 5건 전부 직접 Read/Grep으로 재검증.
- **발견·수정(2건, 전부 검증 완료 후 수정)**:
  1. `app/lib/stores/previews.ts:321-331`, `app/components/workbench/Workbench.client.tsx:418-429` — 파일 저장 후 "미리보기 새로고침" 기능이 `usePreviewStore()`가 지연 생성하는, `Promise.resolve({} as WebContainer)`로 초기화된 가짜 싱글턴을 호출하고 있었음. `WorkbenchStore`(`workbench.ts:42`)가 이미 실제 webcontainer와 연결된 `PreviewsStore` 인스턴스를 들고 있는데 완전히 다른 인스턴스를 매번 새로 만드는 구조. 이 가짜 스토어의 `#init()`(생성자에서 `.catch` 없이 호출됨, `previews.ts:93`)이 `await Promise.resolve({} as WebContainer)` 후 `{}.on(...)`을 호출해 던지므로 **파일을 저장할 때마다** unhandled promise rejection이 발생했고, `refreshAllPreviews()`는 항상 빈 `previews` 배열을 순회해 실제로는 아무 새로고침도 안 일어났음 → `WorkbenchStore`에 `refreshAllPreviews()` 메서드를 추가해 자신의 `#previewsStore`로 위임하도록 수정, `Workbench.client.tsx`는 `workbenchStore.refreshAllPreviews()`를 호출하도록 변경, 죽은 `usePreviewStore` import 제거.
  2. `app/components/workbench/FileTree.tsx` — 업로드/삭제/파일·폴더 잠금·해제의 성공/예상된 실패(반환값 `false`) 토스트는 전부 한국어인데, 실제 예외가 발생하는 `catch` 경로 6곳(`Error uploading ${file.name}`, `` Error deleting ${isFolder ? 'folder' : 'file'} ``, `Error locking file`, `Error unlocking file`, `Error locking folder`, `Error unlocking folder`)만 영어로 하드코딩돼 있었음 → 같은 동작의 한국어 문구로 통일.
- **테스트**: `app/workbenchPreviewRefreshAudit.spec.ts` 신규 3건, `app/fileTreeErrorToastKoreanAudit.spec.ts` 신규 2건(둘 다 소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 338/338 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `654e1e9`, `e234a86`
- **범위 밖으로 남긴 것(구조적/확신도 낮음, `OVERNIGHT5_IMPROVEMENTS.md` 항목 18로 기록)**: (1) `Preview.tsx:694` 인스펙터 모드 클립보드 복사 promise에 `.catch` 없음(발생 조건 드묾). (2) `EditorPanel.tsx` 사이드바 탭("Files"/"Search"/"Locks")·저장/리셋 버튼("Save"/"Reset") 영어 — 사이클 11부터 알려진 항목, 다음 한국어 문구 감사 후보로 유지. (3) `Preview.tsx` 팝업/디바이스 프레임 미리보기 창 제목("... Preview", "(Landscape)"/"(Portrait)") 영어 — 브라우저 탭 제목 수준이라 영향도 낮게 판단.
- **다음 감사 영역**: 배포로 갱신.

### [05:40] Phase 2 — 사이클 20 (감사 대상: 배포)
- **베이스라인 재확인**: `corepack pnpm vitest run` 338/338 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/deploy/**`, 배포 훅(`useXDeploy`), `api.*deploy*.ts` 라우트를 재감사(사이클 12·13에서 이미 고친 훅 토스트 영어/base64 크래시 항목, DeployButton 공유 상태는 재보고 제외 지시). 보고받은 3건 전부 직접 Read/Grep으로 재검증.
- **발견·수정(1건, 검증 완료 후 수정)**: `GitLabDeploymentDialog.tsx` — GitLab 배포 성공 후 `localStorage.setItem('gitlab-repo-${chatId}', ...)`에 저장하는 저장소 URL이 `createdRepoUrl`(state) 클로저 값을 읽고 있었는데, 이 값은 같은 함수 실행 안에서 방금 호출한 `setCreatedRepoUrl()`이 아직 반영 안 된 이전 값(첫 배포면 빈 문자열, 재배포면 이전 저장소 URL)이었음. 화면에 뜨는 성공 다이얼로그는 다음 렌더에서 올바른 값을 보여줘 눈에 안 띄지만, `localStorage`에 영구 저장되는 값은 계속 틀림. 대조군인 `GitHubDeploymentDialog.tsx`(462-468번 줄)는 URL을 인라인으로 재계산해 이 문제가 없음을 확인. 방금 계산한 URL을 담는 `repoUrl` 지역 변수를 추가해 `setCreatedRepoUrl` 호출과 `localStorage.setItem` 양쪽에서 같은 값을 쓰도록 수정.
- **테스트**: `app/gitlabDeployStaleUrlAudit.spec.ts` 신규 2건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 340/340 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `7627a81`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 19로 기록)**: (1) `GitHubDeploymentDialog.tsx`/`GitLabDeploymentDialog.tsx` 다이얼로그 본문 전체 영어 — 이미 항목 2(사이클 8)에 기록된 것과 동일 항목, 재확인만 함. (2) Vercel/Netlify 배포 실패 시 서버가 보내는 영어 에러 문자열(`api.vercel-deploy.ts` 등)이 `data.error || '한국어 fallback'` 패턴에서 항상 우선시돼 한국어 fallback이 무의미해지는 문제 — 서버 쪽 에러 생성 지점 전수 조사가 먼저 필요해 이번엔 보류.
- **다음 감사 영역**: 요금제/결제로 갱신.

### [05:52] Phase 2 — 사이클 21 (감사 대상: 요금제/결제, 2회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 340/340 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: 서브에이전트로 `pricing.tsx`(읽기 전용 확인만), `api.payment.verify.ts`, `api.payment.webhook.ts`, 요금제/결제 관련 UI를 재감사(사이클 5의 구조적 발견은 재보고 제외 지시). 보고받은 4건 전부 직접 Read로 재검증.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/chat/BaseChat.tsx` — 랜딩 화면의 무료 생성 남은 횟수 표시가 `getGenerationsRemaining().then(...)`에 `.catch()`가 없어, 로그인 계정에서 Supabase RPC가 실패(네트워크 오류 등)하면 `getAccountGenerationsRemaining()`이 던지는 에러가 unhandled rejection으로 사라지고 `freeGenerationsRemaining`의 초기값 `0`이 그대로 남았음. `0`은 "남은 횟수 없음"과 구분이 안 돼 실제로는 남은 횟수를 모르는 상태인데 "무료 체험을 다 썼어요. 계속하려면 요금제를 확인해주세요"라는 문구와 `/pricing` 링크를 보여줘, 아직 무료 생성이 남은 로그인 사용자를 일시적 네트워크 오류만으로 결제 페이지로 유도할 뻔한 문제. `Chat.client.tsx`의 실제 생성 게이트(`checkGenerationsAllowed`)는 이미 같은 종류의 에러를 try/catch로 잡아 "일시적인 오류가 발생했어요" 토스트로 처리하는데, 이 표시 전용 로직만 그 패턴이 빠져 있었음 → 초기값을 `null`(모름)로 바꾸고, `.catch()`로 에러를 로깅하며 `null`을 유지, 렌더링도 `freeGenerationsRemaining !== null`일 때만 하도록 수정(로딩 실패 시엔 안내 자체를 숨김).
- **테스트**: `app/freeGenerationsCounterAudit.spec.ts` 신규 3건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 343/343 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `7889fc6`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 20으로 기록)**: 나머지 3건 전부 `pricing.tsx` 안(수정 금지 방침 유지) — (1) 연간 결제 할인 안내 문구가 실제 미구현 기능을 광고. (2) "브랜딩 표시"(제약사항)가 다른 혜택과 같은 초록 체크로 표시돼 혼동 소지. (3) 결제 CTA 버튼(`.cr-btn`, 36px)이 권장 터치 타겟 미만.
- **다음 감사 영역**: 다크모드로 갱신.

### [06:05] Phase 2 — 사이클 22 (감사 대상: 다크모드, 3회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 343/343 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/**`, `app/routes/**`, `app/styles/**`를 재감사(사이클 6·Phase2 사이클1~6에서 이미 고친 accent hex 하드코딩, 모바일 오버플로, 죽은 다크 토큰 항목은 재보고 제외 지시). 보고받은 2건 전부 직접 Read로 재검증.
- **발견·수정(2건, 전부 검증 완료 후 수정)**:
  1. `app/components/chat/Markdown.module.scss` — 테이블 테두리 `#dfe2e5`, 줄무늬 행 배경 `#f6f8fa`, h6 색상 `#6a737d`가 GitHub 라이트 테마 값으로 하드코딩돼 있었음. 이 스타일은 `Markdown.tsx`(수정 금지 파일이지만 `.module.scss`는 별도 파일이라 대상 아님)가 쓰는 클래스로, 사용자 메시지·AI 응답 전부가 거치는 앱에서 가장 빈도 높은 표면. AI 응답에 마크다운 표가 포함되면(비교표, 스펙 목록 등 흔한 형식) 다크모드 채팅 배경 위에 밝은 회색 사각형이 튀어 보이는 문제 → `var(--bolt-elements-borderColor)`/`var(--bolt-elements-bg-depth-2)`/`var(--bolt-elements-textTertiary)`로 교체(전부 라이트/다크 양쪽에 정의된 기존 토큰).
  2. `app/components/sidebar/Menu.client.tsx:569` — 사이드바 하단 액션바 "내 앱" 링크 아이콘이 다크 변형 없는 고정 `text-[#666]`이었음. 바로 위·아래 형제 요소(`border-gray-200 dark:border-gray-800`, `text-gray-400 dark:text-gray-600`)는 전부 다크 변형이 있는데 이 아이콘만 빠져 있어, 사이드바 배경이 `dark:bg-gray-950`(거의 검정)인 다크모드에서 대비가 낮아 흐릿하게 보이던 문제 → `dark:text-gray-500` 추가.
- **테스트**: `app/markdownTableDarkModeAudit.spec.ts` 신규 5건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 348/348 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `b07ff47`
- **범위 밖으로 남긴 것**: 없음 — 서브에이전트가 조사한 나머지 후보(랜딩 히어로 고정 코랄, 코드블록 dark-plus 강제, 소셜 로그인 브랜드 색상, Preview.tsx 디바이스 프레임, 데이터 시각화)는 전부 의도된 고정 디자인으로 직접 확인, 실제 버그 아님.
- **다음 감사 영역**: 모바일로 갱신.

### [06:15] Phase 2 — 사이클 23 (감사 대상: 모바일, 2회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 348/348 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/**`, `app/routes/**`, `app/styles/**`를 재감사(사이클 15에서 이미 고친 w-[300px] 류 고정 폭 항목은 재보고 제외 지시). 보고받은 5건 전부 직접 Read/git log로 재검증.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/workbench/FileBreadcrumb.tsx` — 파일 경로 드롭다운(`DropdownMenu.Content`)이 `avoidCollisions={false}`로 Radix의 자동 화면 밖 재배치를 꺼두고 있었음. 사이클 15에서 폭은 `w-[min(300px,calc(100vw-2rem))]`로 이미 clamp했지만(그 커밋 메시지 자체가 "avoidCollisions=false와 겹쳐 화면 밖 재배치도 안 됨"이라고 문제를 언급하고도 그때는 폭만 고치고 넘어감), `align="start"` 고정 앵커링은 그대로라 화면 오른쪽 끝 근처(깊은 폴더 경로 탭 시)에서 여전히 뷰포트 밖으로 밀려날 수 있었음 → `avoidCollisions={false}` 제거, 기본값(true)으로 Radix 자동 재배치가 동작하도록 수정.
- **테스트**: `app/fileBreadcrumbMobileCollisionAudit.spec.ts` 신규 2건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 350/350 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `97c184a`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 21로 기록)**: (1) `ChatBox.tsx` 채팅 툴바 `flex-nowrap` + 가로 스크롤 폴백 없음(재현 확신도 낮음, 구조적). (2) `ChatBox.tsx` 채팅 액션 버튼 `h-8`(32px) 터치 타겟 미달(여러 파일 공유 클래스, 일괄 조정 필요). (3) `GitHubStats.tsx` `grid-cols-4` 고정(설정 다이얼로그 내부, 반응형 브레이크포인트 누락). (4) `StatsDisplay.tsx`(GitLab) `grid-cols-3` 고정(같은 패턴).
- **다음 감사 영역**: 한국어 문구로 갱신.

### [06:17] Phase 2 — 사이클 24 (감사 대상: 한국어 문구, 2회차)
- **베이스라인 재확인**: `corepack pnpm run typecheck` 0에러, `corepack pnpm vitest run` 350/350 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/**`, `app/routes/**`, `app/lib/**`를 재감사(사이클 16에서 이미 고친 ModelSelector/CodeBlock/ExpoQrModal/TerminalTabs/Preview/배포 훅/FileTree 항목은 재보고 제외 지시). 보고받은 7건 중 노출 빈도가 가장 높은 1건만 직접 Read로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/@settings/tabs/profile/ProfileTab.tsx` — 설정 > 프로필 탭 전체(프로필 사진/사용자 이름/소개 라벨, placeholder, 업로드 성공·실패 토스트, 필드 업데이트 토스트, 아바타 `alt` 텍스트)가 하나도 빠짐없이 영어로 하드코딩돼 있었음. `ControlPanel.tsx:152`에서 실제 렌더되는, 사용자가 프로필을 수정할 때마다 보는 화면이라 노출 빈도가 높다고 판단 → 전부 한국어로 번역.
- **테스트**: `app/profileTabKoreanAudit.spec.ts` 신규 2건(소스 grep 방식, 기존 관행과 동일. JSX 주석(`{/* Username Input */}` 등)은 사용자에게 노출되지 않아 검사 대상에서 제외하고 실제 렌더 텍스트만 체크).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 352/352 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `867a4c0`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 22로 기록)**: 나머지 6건은 분량이 많아 한 사이클 범위를 넘어선다고 판단 — (1) `useChatHistory.ts` 채팅 로드/저장/복제/가져오기 토스트 약 8곳. (2) `useDataOperations.ts` Settings > Data 탭 내보내기/가져오기/초기화/실행취소 토스트 약 35곳(분량 최다, 별도 사이클 필요). (3) `GitHubErrorBoundary.tsx` 전체(실제 wrapping 확인됨, 죽은 코드 아님). (4) `useEditChatDescription.ts` 채팅 이름 변경 검증/토스트 6곳. (5) `LockManager.tsx` 잠금 해제 토스트 3곳. (6) `ScreenshotSelector.tsx` 스크린샷 캡처 토스트 4곳.
- **다음 감사 영역**: 온보딩으로 갱신.

### [06:36] Phase 2 — 사이클 25 (감사 대상: 온보딩)
- **베이스라인 재확인**: `corepack pnpm vitest run` 352/352 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/chat/**`(온보딩 진입 흐름: 랜딩 프롬프트 입력, PromptClarification, 첫 생성)를 재감사(사이클 11·17에서 이미 고친 PromptClarification 항목, StarterTemplates 죽은 코드, root.tsx 404 히어로 고정 코랄은 재보고 제외 지시). 보고받은 3건 중 확신도 high 2건을 직접 Read로 재검증 후 수정.
- **발견·수정(2건, 전부 검증 완료 후 수정)**:
  1. `app/components/chat/BaseChat.tsx:790` — 채팅이 맨 아래로 스크롤돼있지 않을 때(새 채팅 첫 생성 응답 도중/직후 포함) 뜨는 "맨 아래로 이동" 버튼이 `Go to last message`로 영어 하드코딩. 이 파일의 다른 문구는 전부 한국어.
  2. `app/components/chat/WebSearch.client.tsx` — 랜딩/채팅 프롬프트 툴바의 "사이트" 버튼(참고 URL 가져오기 팝오버)에서 버튼 자체 title/라벨은 한국어인데 실제 제출 버튼 텍스트(`Fetch`/`Fetching...`)와 성공/실패 토스트 3곳(`URL content fetched`, `Failed to fetch URL content`, `Failed to fetch URL`)이 전부 영어로 남아있어 같은 UI 안에서 한/영이 섞이던 문제.
  → 둘 다 한국어로 번역.
- **테스트**: `app/onboardingKoreanAudit.spec.ts` 신규 4건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 356/356 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `82dc2ea`
- **범위 밖으로 남긴 것**: `app/components/chat/Chat.client.tsx:102` — 첫 생성 턴 이후 `storeMessageHistory` 실패 시 `error.message`(IndexedDB 등 원본 영어 예외 메시지 가능)를 그대로 토스트에 노출하는 문제(확신도 medium, 재현 조건이 IndexedDB 실패라 낮은 빈도) — `OVERNIGHT5_IMPROVEMENTS.md` 항목 23으로 기록.
- **다음 감사 영역**: 생성으로 갱신.

### [06:50] Phase 2 — 사이클 26 (감사 대상: 생성, 3회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 356/356 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/lib/runtime/`(액션 실행기), `app/lib/hooks/useMessageParser.ts`, `app/lib/stores/workbench.ts`를 재감사(사이클 10·18에서 이미 고친 항목, IMPROVEMENTS.md 항목 9·17에 이미 기록된 항목은 재보고 제외 지시). 보고받은 3건 전부 직접 Read/git log로 재검증.
- **발견(3건, 전부 수정 없이 판단 보류)**:
  1. `app/lib/hooks/useMessageParser.ts:78-80` — 스트리밍 파서가 AI 응답뿐 아니라 **사용자가 직접 입력한 메시지**도 동일하게 파싱해, 사용자 메시지 안의 코드 블록이 정규식 휴리스틱에 걸리면 실제 파일 쓰기/셸 명령 실행으로 이어질 수 있는 경로 확인. 의도된 파워유저 기능인지 버그인지 이번 세션에서 확정 못 함(업스트림 bolt.diy 코드로 보여 fork 이전 의도 파악 필요) — 사람 판단 필요, 보안 성격이라 우선순위 높음으로 기록.
  2. `app/lib/stores/workbench.ts:564-566` — 채팅 Stop 버튼이 호출하는 `abortAllActions()`가 `// TODO` 주석만 있는 완전한 no-op. 실행 중인 셸 명령/큐에 남은 파일 쓰기가 Stop을 눌러도 그대로 끝까지 진행됨. 제대로 고치려면 WebContainer 셸 프로세스 강제 종료 경로를 새로 연결해야 하고, 이 저장소 테스트(소스 grep 방식)로는 검증 불가 — 브라우저 직접 확인 필요한 구조 변경.
  3. `app/lib/stores/workbench.ts:668-701` + `action-runner.ts` — LLM 응답이 파일 액션 중간에 잘리면(토큰 한도 등) 파일이 최초 조각에서 멈추고 Artifact 패널이 영원히 spinner 상태로 남는 경로 확인(라이브 재현은 못 함, 확신도 medium-high).
- **수정하지 않은 이유**: 3건 모두 최소 변경으로 안전하게 고칠 수 없는 구조적 판단 필요 사안 — 1번은 의도 확인이 먼저 필요, 2번은 WebContainer 셸 API 조사 및 브라우저 검증 필요, 3번은 스트림 절단 감지용 타임아웃 로직 신규 설계 필요. `OVERNIGHT5_IMPROVEMENTS.md` 항목 24로 상세 기록.
- **테스트/커밋**: 코드 변경 없어 테스트 추가·커밋 없음(문서만 갱신).
- **다음 감사 영역**: 미리보기/워크벤치로 갱신.

### [07:00] Phase 2 — 사이클 27 (감사 대상: 미리보기/워크벤치)
- **베이스라인 재확인**: `corepack pnpm vitest run` 356/356 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/workbench/**`, `app/lib/stores/workbench.ts`를 재감사(FileBreadcrumb avoidCollisions/폭, 미리보기 새로고침 죽은 싱글턴, FileTree 토스트 영어, Preview 창 크기·저장 동기화 드롭다운 하드코딩 색상, 새 창 열기 팝업 차단 안내, FileTree 선택 파일 보더 색상, 설정 모달/Design Palette 오버플로, abortAllActions no-op·스트림 절단(이미 항목 24) 등 기존에 고친/기록된 항목은 재보고 제외 지시). 보고받은 5건 중 확신도 high 2건(같은 파일 안에서 서로 연관된 문제)을 직접 Read로 재검증 후 수정.
- **발견·수정(1개 파일, 연관된 2건, 전부 검증 완료 후 수정)**: `app/components/workbench/FileTree.tsx` —
  1. 우클릭 컨텍스트 메뉴 8개 항목(새 파일/새 폴더/경로 복사/상대 경로 복사/파일 잠금/파일 잠금 해제/폴더 잠금/폴더 잠금 해제)이 전부 영어로 하드코딩. 사이클 19에서 이 파일의 토스트 6곳은 이미 한국어로 고쳤지만 컨텍스트 메뉴 자체는 그때 손 안 댔던 부분. 파일 트리에서 가장 자주 쓰는 상호작용(우클릭)이라 노출 빈도 높음.
  2. `onCopyPath`/`onCopyRelativePath`가 비동기 `navigator.clipboard.writeText()`를 동기 `try/catch`로 감싸고 있어 Promise reject를 못 잡고, 성공/실패 어느 쪽이든 사용자에게 피드백이 전혀 없었음(파일 트리의 다른 모든 액션 — 생성/삭제/잠금 — 은 성공/실패 토스트가 있는데 이 둘만 없음). 클립보드 쓰기 실패(포커스 없음/권한 거부/비보안 컨텍스트) 시 조용히 아무 일도 안 일어나는 것처럼 보이는 문제.
  → 컨텍스트 메뉴 8개 항목 한국어로 번역, `onCopyPath`/`onCopyRelativePath`를 `.then()/.catch()`로 수정하고 성공("경로를 복사했어요")/실패("경로를 복사하지 못했어요") 토스트 추가.
- **테스트**: `app/fileTreeContextMenuAudit.spec.ts` 신규 4건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(자동 prettier --fix로 포맷 에러 1건 정리, 무관한 기존 warning 1건만 남음, `auth.ts`), `corepack pnpm vitest run` 360/360 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `d8552b6`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 25·26으로 기록)**: (1) `Preview.tsx` — 새 창 열기(`openInNewWindow` 비-프레임 분기, "새 창에서 열기" 메뉴 버튼) 2곳이 사이클 11에서 고친 팝업 차단 안내 패턴이 빠져있음 + 기기 프레임 팝업 창 자체의 `<title>`/`(Landscape)`/`(Portrait)` 텍스트가 영어 하드코딩. (2) `TerminalTabs.tsx` — 탭을 배열 인덱스로 키/ref 관리해 중간 탭을 닫으면 마지막 탭이 `detachTerminal()` 없이 언마운트돼 WebContainer 셸 프로세스가 리크될 수 있는 경로(확신도 medium, 브라우저 직접 재현 필요).
- **다음 감사 영역**: 배포로 갱신.

### [07:10] Phase 2 — 사이클 28 (감사 대상: 배포, 2회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 360/360 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 배포 관련 훅/다이얼로그/API 라우트를 재감사(사이클 12·13·20에서 이미 고친 항목, DeployButton.tsx 더블클릭 레이스, ExpoQrModal 등 기존에 고친/판단 완료된 항목은 재보고 제외 지시). 보고받은 3건 중 확신도 high 1건(가장 영향 큰 것)을 직접 Read로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/deploy/GitHubDeploymentDialog.tsx`, `app/components/deploy/GitLabDeploymentDialog.tsx` — `DeployButton.tsx`에서 "GitHub로 내보내기"/"GitLab으로 내보내기" 클릭 시 실제로 열리는 다이얼로그. 사이클 12는 이 배포 흐름의 *hook* 파일(GitHubDeploy.client.tsx/GitLabDeploy.client.tsx)의 토스트만 한국어로 고쳤고, 하드코딩 색상 수정(cf6f6d9)도 이 다이얼로그 파일들을 건드렸지만 문구 자체는 그때도 손 안 댔던 부분 — 다이얼로그 제목("Deploy to GitHub" 등), 폼 라벨("Repository Name", "Recent Repositories"), placeholder("Search repositories..."), 빈 상태 문구, 버튼("Cancel"/"Deploying..."/"View Repository"/"Copy URL" 등), 성공/연결 필요 다이얼로그 문구, 토스트/에러 메시지(약 15개, GitHub API rate limit/404/422 등 세분화된 에러 케이스 포함) 총 약 40곳이 전부 영어로 남아있었음. 두 프로바이더 모두 배포 기능 전체를 처음 쓰는 흐름에서 마주치는 가장 눈에 띄는 표면인데 모달 전체가 영어였음.
  → 전부 한국어로 번역(에러 메시지의 조건 분기 구조는 그대로 유지, 문구만 교체).
- **테스트**: `app/deployDialogKoreanAudit.spec.ts` 신규 4건(소스 grep 방식, 기존 관행과 동일 — `deployToastKoreanAudit.spec.ts` 패턴 참고).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 364/364 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `983d671`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 27로 기록)**: (1) `CloudflareDeploy.client.tsx`/`VercelDeploy.client.tsx`/`NetlifyDeploy.client.tsx`의 `appName: description.get() || 'Untitled'` — 채팅 설명이 비어있을 때 영어 "Untitled"가 "내 앱" 대시보드(전부 한국어)에 그대로 노출(확신도 medium). (2) `app/routes/apps.tsx`의 `STORAGE_MODE_LABEL[app.storage_mode]`가 `PROVIDER_LABEL`과 달리 폴백이 없어 스키마 밖 값이면 `undefined` 렌더 위험(확신도 low). 둘 다 한 줄 수준으로 작고 안전하나 이번 사이클은 다이얼로그 번역에 집중.
- **다음 감사 영역**: 요금제/결제로 갱신.

### [07:20] Phase 2 — 사이클 29 (감사 대상: 요금제/결제, 3회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 364/364 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `api.payment.verify.ts`/`api.payment.webhook.ts`, `CustomDomainConnect.tsx`+`api.cloudflare-domain.ts`, `freeTrial.ts`, 요금제 관련 내비게이션/설정 탭을 대상으로 사이클 5·21이 이미 다룬 항목(인증/소유권 부재, TODO_IS_PRO_USER, 메터링 동결) 제외하고 새 문제 위주로 점검 요청. 보고받은 3건 모두 직접 코드로 재검증.
- **재검증 중 기각한 것**: `freeTrial.ts:38-40` `getAccountGenerationsRemaining()`이 `platformSupabase`가 없을 때 `0`을 반환(throw 아님)해 `incrementAccountGenerationsUsed()`와 비일관적이라는 후보 — `app/lib/stores/auth.ts`를 직접 확인한 결과 `authUserStore`는 `initAuthListener()`가 `platformSupabase.auth.getSession()`/`onAuthStateChange` 콜백에서만 값을 채우고, 그 함수 자체가 `!platformSupabase`면 즉시 no-op으로 반환돼 로그인 상태가 절대 안 만들어짐 — 즉 "로그인된 상태인데 platformSupabase가 없는" 시나리오가 애초에 도달 불가능한 죽은 분기라 실사용 버그 아님으로 판단(오탐, 수정 안 함).
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/chat/BaseChat.tsx:506-523` — 채팅창 위 무료 생성 잔여 횟수 안내 배지가 로그인 여부와 무관하게 항상 "무료 체험"(게스트 전용 용어 — `freeTrial.ts` 주석 기준 "비로그인 게스트의 무료 생성 한도"는 "체험", "로그인한 계정의 무료 생성 한도"는 "생성")으로 표시되고 있었음. 정확히 같은 상황(무료 생성 소진)을 다루는 `Chat.client.tsx`의 `notifyGenerationLimitReached`(사이클 9 이전부터 존재)는 이미 게스트("무료 체험을 다 쓰셨어요")와 로그인 계정("무료 생성 횟수를 모두 사용했어요")을 구분하는데, 이 배지만 그 구분을 안 따라가고 있어 용어 불일치였음.
  → `useState`로 이미 로드돼 있던 `authUser`(`useStore(authUserStore)`) 기준으로 "무료 생성"/"무료 체험" 텍스트 분기(잔여/소진 두 문구 다).
- **테스트**: `app/pricingCopyAudit.spec.ts` 신규 2건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 366/366 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `d72f5f6`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 28로 기록)**: `api.payment.verify.ts`에 요청자 인증/소유권 확인 및 `paymentId` 재사용(replay) 방지가 전혀 없음 — 항목 4(배포/도메인 API 인증 부재)와 같은 클래스의 새 파일. 실제 플랜 활성화 쓰기 로직이 아직 없어(`pricing.tsx` 미완성) 그 설계와 함께 다뤄야 하는 구조적 사안이라 이번엔 기록만.
- **다음 감사 영역**: 다크모드로 갱신.

### [07:35] Phase 2 — 사이클 30 (감사 대상: 다크모드, 4회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 366/366 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/**`, `app/styles/**`, `app/routes/**`(Markdown.tsx/markdown.ts 제외 지시)에서 하드코딩 색상/dark: 변형 누락을 재감사(Markdown.module.scss 테이블/h6, Menu.client.tsx 아이콘, 법률 페이지 링크, Preview/Workbench 드롭다운, bolt-elements-*-dark 죽은 토큰, Phase2 사이클1-6 accent hex 등 기존에 고친 항목은 재보고 제외 지시). 보고받은 2건 모두 직접 Read/Grep으로 재검증 후 수정.
- **발견·수정(2건, 전부 검증 완료 후 수정)**:
  1. `app/components/ui/SettingsButton.tsx` — 사이드바 하단(`Menu.client.tsx:565`)에서 "내 앱" 링크 바로 옆에 나란히 렌더되는 SettingsButton/HelpButton 아이콘이 `text-[#666]` 라이트 전용 고정색만 쓰고 `dark:` 변형이 없음. 같은 줄 옆의 "내 앱" 링크(`Menu.client.tsx:569`)는 이미 `dark:text-gray-500`을 갖고 있어, 다크모드에서 한 줄 안에 저대비(흐릿함)/정상 대비 아이콘이 섞여 보이던 문제.
  2. `app/components/@settings/tabs/github/components/GitHubCacheManager.tsx:351` — GitHub 설정 탭 캐시 관리 "전체 삭제" 버튼이 `text-red-600 hover:text-red-700 border-red-200 hover:border-red-300`로 라이트 전용 고정색만 쓰고 `dark:` 변형이 없음. 같은 파일의 성공 알림 박스(`border-green-200 dark:border-green-700` 등, line 360)는 이미 dark 변형을 갖고 있는 것과 대비.
  → 둘 다 인접/동일 파일의 기존 dark: 패턴을 그대로 따라 변형 추가.
- **테스트**: `app/darkModeCycle30Audit.spec.ts` 신규 3건(소스 grep 방식, 기존 관행과 동일). 첫 시도에서 block comment 안에 `red-*/border-red-*` 텍스트를 그대로 써서 `*/`가 조기 종료되며 esbuild 파싱 에러 발생 → 주석 문구 수정으로 해결.
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 369/369 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `e0521f9`
- **다음 감사 영역**: 모바일로 갱신.

### [07:45] Phase 2 — 사이클 31 (감사 대상: 모바일, 3회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 369/369 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/workbench/**`, `deploy/**`, `header/**`를 재감사(사이클 7·15·23에서 이미 고친 항목은 재보고 제외 지시). 보고받은 5건 중 확신도 high 1건을 직접 Read로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/workbench/Workbench.client.tsx:128` — Diff 탭 툴바의 "바뀐 파일" `FileModifiedDropdown`이 렌더하는 Headless UI `Popover.Panel`이 `w-80`(320px) 고정폭에 반응형 clamp가 전혀 없었음. 이 컴포넌트는 Radix(충돌 시 자동 flip/collision 회피)가 아니라 Headless UI `Popover`라 그런 로직이 없고, 패널은 포탈 없이 조상(`h-full flex flex-col ... overflow-hidden`, line 474)의 절대 위치 자식으로 렌더돼 좁은 화면에서 잘릴 위험. `useViewport`가 1024px 미만을 "작은 뷰포트"로 보고 워크벤치를 `w-full`로 만들기 때문에 375px 폰에서 이 툴바/패널이 정확히 그 폭.
  → `WebSearch.client.tsx`/`APIKeyManager.tsx`/`FileBreadcrumb.tsx`에서 이미 검증된 관용구(`w-[min(Npx,calc(100vw-Mrem))]`)와 동일 패턴으로 `w-[min(320px,calc(100vw-2rem))]`로 교체.
- **테스트**: `app/mobileFixedWidthOverflow.spec.ts`에 신규 1건 추가(기존 관행과 동일 파일에 이어 붙임).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 370/370 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `67b2470`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 25로 기록)**: (1) `Preview.tsx` 미리보기 툴바가 `flex-wrap` 없이 기기 모드에서 8개 이상 아이콘+URL 입력창을 한 줄에 배치(확신도 medium-high, 레이아웃 설계 결정 필요). (2) `Preview.tsx`의 손수 구현한 "새 창 옵션" 드롭다운이 Radix가 아니라 충돌 회피 로직 없음(확신도 low-medium, 실사용 위험은 낮아 보임). (3) 이전 사이클(15/23)이 미해결로 남긴 "Menu.client.tsx 32px 아바타 터치타겟" 항목은 이번에 재검증 결과 그 div엔 클릭 핸들러가 없는 정적 이미지일 뿐이고 실제 클릭 가능한 아바타 버튼(`AvatarDropdown.tsx`)은 이미 40px이라 오탐으로 종결.
- **다음 감사 영역**: 한국어 문구로 갱신.

### [08:00] Phase 2 — 사이클 32 (감사 대상: 한국어 문구, 3회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 370/370 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 이미 다룬 영역(BaseChat/WebSearch/ProfileTab/사이드바/FileTree/배포 다이얼로그/ChatBox/PromptClarification/ModelSelector/CodeBlock/ExpoQrModal/pricing.tsx) 제외하고 `@settings/tabs/*`(profile 외), APIKeyManager.tsx, EditorPanel, 라우트, UI 다이얼로그, confirm/alert, 빈 상태·로딩 문구 위주로 재감사 요청.
- **발견**: 5건 보고, 전부 실재 확인. 규모가 커서(설정 탭 전체, confirm() 6곳, 배포/연결 탭 토스트 다수 등) 이번 사이클은 노출 빈도가 가장 높은 1건만 처리하고 나머지는 `OVERNIGHT5_IMPROVEMENTS.md` 항목 29로 기록.
- **발견·수정(1건, 직접 Read로 재검증 후 수정)**: `app/components/chat/APIKeyManager.tsx` — 채팅 메인 화면에서 프로바이더별 API 키를 입력/확인할 때마다 노출되는 컴포넌트 전체(라벨 "{provider} API Key:", 상태 문구 "Set via UI"/"Set via environment variable"/"Not Set (Please set via UI or ENV_VAR)", placeholder "Enter API Key", IconButton title 4개: Save/Cancel/Edit/Get API Key)가 영어로 하드코딩돼 있었음.
  → 전부 한국어로 번역("API 키:", "화면에서 설정됨", "환경 변수로 설정됨", "설정 안 됨 (화면 또는 환경 변수로 설정해 주세요)", "API 키 입력", "API 키 저장", "취소", "API 키 수정", "API 키 발급받기").
- **테스트**: `app/apiKeyManagerKoreanAudit.spec.ts` 신규 2건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 372/372 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `0b8faca`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 29로 기록)**: (1) `FeaturesTab.tsx` 전체(제목/설명/툴팁/섹션 헤더/토스트 ~20곳) 100% 영어. (2) `confirm()`/`window.confirm()` 네이티브 대화상자 6곳(VercelTab/NetlifyTab/NetlifyConnection/SupabaseTab/LocalProvidersTab/useGit.ts) 전부 영어. (3) 배포/연결 탭(Netlify/Vercel/Supabase/MCP/EventLogs/Data) 토스트 다수 영어. (4) `NotificationsTab.tsx` 필터 라벨 8개 + 빈 상태 문구 영어.
- **다음 감사 영역**: 온보딩으로 갱신.

### [08:10] Phase 2 — 사이클 33 (감사 대상: 온보딩, 4회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 372/372 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `BaseChat.tsx`/`PromptClarification.tsx`/`ChatBox.tsx`/`StarterTemplates.tsx` 등 온보딩 표면을 재감사(사이클 17·25 및 aff3c5c/4769e51에서 이미 고친 항목은 재보고 제외 지시). 보고받은 5건 중 확신도 high 1건을 직접 Read/Grep으로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/chat/BaseChat.tsx:204,234-269` — `SpeechRecognition`/`webkitSpeechRecognition`을 지원하지 않는 브라우저(Firefox 등)에서는 `recognition` state가 계속 `null`로 남아 `startListening`/`stopListening`(line 324-336)이 완전한 no-op이 되는데, `app/components/chat/ChatBox.tsx:342`의 `SpeechRecognitionButton`은 `disabled={props.isStreaming}`로만 결정돼 있어 미지원 브라우저의 첫 방문자가 랜딩 화면(온보딩 첫 상호작용 중 하나)에서 마이크 아이콘을 눌러도 토스트도, 비활성화 표시도 없이 아무 반응이 없던 문제.
  → `ChatBoxProps`에 `speechRecognitionSupported: boolean` 추가, `BaseChat.tsx`에서 `speechRecognitionSupported={recognition !== null}`로 전달, `ChatBox.tsx`에서 `disabled={props.isStreaming || !props.speechRecognitionSupported}`로 수정.
- **테스트**: `app/onboardingSpeechRecognitionSupportAudit.spec.ts` 신규 2건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 374/374 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `7c82be5`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 30으로 기록)**: (1) `PromptClarification.tsx`의 진행률 바가 `'waitingForDynamic'` 상태에서 동적 질문 도착 시 분모가 커지며 순간적으로 뒤로 가는 문제(확신도 medium-high, 진행률 계산 로직 재설계 필요). (2) `ChatBox.tsx` 드래그오버 테두리가 인라인으로 `#1488fc` 하드코딩돼 랜딩 팔레트/다크모드와 무관하게 항상 파란색으로 뜨는 문제(확신도 medium, 시각적 영향만). 나머지 2건(`StarterTemplates.tsx` 영어 문구, `ExamplePrompts.tsx`)은 `SHOW_DEV_TOOLS` 플래그로 현재 도달 불가능한 죽은 코드라 기록만 하고 손 안 댐.
- **다음 감사 영역**: 생성으로 갱신.

### [08:20] Phase 2 — 사이클 34 (감사 대상: 생성, 4회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 374/374 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `message-parser.ts`/`action-runner.ts`/`workbench.ts`/`useMessageParser.ts`/`Artifact.tsx`/`api.chat.ts`를 재감사(사이클 10·18·26에서 이미 기록된 구조적 항목 8건은 재보고 제외 지시). 보고받은 2건 중 확신도 high인 1건을 직접 Read로 소스 추적해 재검증.
- **발견**: `app/lib/runtime/enhanced-message-parser.ts`의 `parse()`가 `super.parse()`(증분/delta 반환이 계약인 베이스 클래스)를 호출한 뒤, 코드블록 자동 파일감지(`_detectAndWrapCodeBlocks`, 9번째 사이클 개선 문서에 기록된 "정식 boltArtifact 태그 없이 파일경로+코드블록만 보내는 경우 자동으로 파일로 인식"하는 기능)가 한 번이라도 발동하면 `this.reset()` 후 `enhancedInput` 전체를 처음부터 다시 파싱해 그 결과(메시지 "전체" 텍스트)를 그대로 반환하고 있었음. 소비자인 `useMessageParser.ts:83`(수정 전)은 `(prevParsed[index] || '') + newParsedContent`로 이 반환값이 항상 "새로 나온 부분만"이라고 가정하고 계속 덧붙이고 있어서, 자동 파일감지가 한 번 발동한 뒤로는 스트리밍 틱마다 채팅 텍스트가 지수적으로 중복 누적되는 문제였음. `EnhancedStreamingMessageParser`는 `useMessageParser.ts`에서만 쓰여 계약 변경의 파급 범위가 한정적임을 grep으로 확인.
- **변경**: `enhanced-message-parser.ts` — 내부적으로 메시지별 "지금까지의 전체 파싱 결과"(`_fullOutput` 맵)를 추적하도록 재설계해 `parse()`가 항상 전체 텍스트를 반환하도록 계약 변경(일반 텍스트만 있는 흔한 경로는 내부적으로 델타를 누적해 전체를 재구성하므로 동작·성능 변화 없음). `reset()`을 파싱 상태 초기화(`_resetParserState`, 내부 재시도 시 사용)와 전체 출력 초기화(외부 명시적 reset 시에만 `_fullOutput` 클리어)로 분리해, 내부 자동 재시도가 실수로 캐시된 전체 출력까지 지우지 않도록 함. `useMessageParser.ts` — 소비 측을 append(`+`)에서 set(`=`)으로 수정.
- **테스트**: `app/lib/runtime/enhanced-message-parser.spec.ts` 신규 2건 — 문자 단위 스트리밍 시뮬레이션으로 매 틱의 반환 길이가 그 시점까지의 원본 입력 길이를 절대 넘지 않는지 검증(예전 버그라면 이 불변식이 깨짐), `reset()` 후 새 메시지가 이전 출력 없이 깨끗하게 시작하는지 검증.
- **검증**: `corepack pnpm vitest run` 376/376 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `5d0b275`
- **범위 밖으로 남긴 것**: 서브에이전트가 보고한 2번째 항목(`workbench.ts`의 `actionStreamSampler`가 `WorkbenchStore`당 공유 인스턴스라 두 액션이 100ms 안에 동시 스트리밍되면 한쪽의 중간 업데이트가 드롭될 수 있는 문제, 확신도 low-medium, 최종 `onActionClose` 쓰기는 정상 동작해 UI 프리뷰 반짝임 정도로 추정)은 재현·확신도가 낮아 기록만 하고 손 안 댐.
- **다음 감사 영역**: 미리보기/워크벤치로 갱신.

### [08:30] Phase 2 — 사이클 35 (감사 대상: 미리보기/워크벤치, 4회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 376/376 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: general-purpose 서브에이전트로 `Preview.tsx`/`Workbench.client.tsx`/`EditorPanel.tsx`/`FileTree.tsx`/`FileBreadcrumb.tsx`/`DiffView.tsx`/`workbench.ts`/`previews.ts`를 재감사(사이클 11·19·23·27·31 및 커밋 ccafd7d/a89d0ee에서 이미 고친 항목, IMPROVEMENTS.md 항목 25는 재보고 제외 지시). 보고받은 5건 중 확신도 high인 1건(가장 노출 빈도 높은 항목)을 직접 Read로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/workbench/DiffView.tsx` — "차이점" 탭이 다른 워크벤치 표면(코드/미리보기 슬라이더, 파일트리 컨텍스트 메뉴, 배포 다이얼로그 등 전부 한국어)과 달리 상태 문구·안내 문구 9곳이 전부 영어로 하드코딩: `Files are identical`/`Both versions match exactly`/`Current Content`(파일 동일 시 안내), `Modified`/`No Changes`/`Streaming…`(상단 상태 배지), `Loading diff...`(로딩), `Select a file to view differences`(파일 미선택), `Failed to render diff view`(렌더 에러).
  → 전부 한국어로 번역("파일이 동일해요", "두 버전이 완전히 일치해요", "현재 내용", "수정됨", "변경 없음", "스트리밍 중…", "차이점을 불러오는 중...", "차이점을 보려면 파일을 선택하세요", "차이점 화면을 그리지 못했어요").
- **테스트**: `app/diffViewKoreanAudit.spec.ts` 신규 2건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 378/378 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `36530fb`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 31로 기록)**: (1) `Preview.tsx` `openInNewWindow` 프레임 없는 분기가 팝업 차단 시 무음 실패(확신도 high). (2) `Preview.tsx` 창크기 드롭다운 "새 창에서 열기"도 같은 클래스의 무음 실패(확신도 high). (3) `EditorPanel.tsx` 파일 탐색기 탭 라벨(Files/Search/Locks)·Save/Reset 버튼 영어 하드코딩(확신도 medium-high). (4) `Preview.tsx` inspector 클립보드 쓰기 실패 시 `.catch` 없이 선택 결과가 조용히 드롭되는 문제(확신도 medium).
- **다음 감사 영역**: 배포로 갱신.

### [사이클 36] Phase 2 — 사이클 36 (감사 대상: 배포, 5회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 378/378 통과, `pnpm run build` 성공(client+server). `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음 — 이전 사이클들의 판단대로 이번에도 손 안 댐(사용자 본인 진행 중 작업).
- **감사 방법**: Explore 서브에이전트로 배포 표면 전체(`DeployButton.tsx`, 5개 제공자 `*.client.tsx`, `GitHubDeploymentDialog.tsx`/`GitLabDeploymentDialog.tsx`, `CustomDomainConnect.tsx`, `api.*deploy*.ts`/`api.*domain*.ts`)를 대상으로 엣지 케이스·에러 처리 누락·영어 잔재·다크모드·모바일 관점 재검색. 보고받은 5건 중 최상위 1건을 직접 코드로 재확인.
- **발견 및 확인**: `ActionRunner#runBuildAction()`(`app/lib/runtime/action-runner.ts:464-534`)이 빌드 시작/실패/완료 시 쏘는 `onDeployAlert` 3곳이 `title: 'Building Application'`/`'Build Failed'`/`'Build Completed'`로 하드코딩된 영어. `workbenchStore.addArtifact()`(`app/lib/stores/workbench.ts:583-613`)가 **모든** artifact의 `ActionRunner`를 같은 `workbenchStore.deployAlert` atom(`.set()`, 덮어쓰기)에 연결하는데, 5개 배포 훅(Cloudflare/GitHub/GitLab/Netlify/Vercel) 전부가 배포 직전 `deployArtifact.runner.handleDeployAction('building', 'running', ...)`으로 한국어 "빌드 중이에요"를 먼저 알림으로 띄운 뒤, 실제 빌드는 `artifact.runner.runAction({type:'build', ...})`로 **다른** runner에서 실행함 — 이 다른 runner의 `#runBuildAction`이 빌드 시작 시점에 곧바로 위 영어 알림으로 덮어씀. `DeployAlert.tsx:16,73,81`이 `alert.title`/`alert.description`을 그대로 렌더(주변 문구는 전부 한국어)해서 사용자는 배포 버튼을 누를 때마다(제공자 무관) 빌드 진행 중 영어 텍스트가 화면에 뜨는 것을 목격하게 됨 — 엣지 케이스가 아니라 100% 재현되는 상시 버그.
- **변경**: `app/lib/runtime/action-runner.ts` 3곳 — `'Building Application'`/`'Building your application...'` → `'빌드 중이에요'`/`'앱을 빌드하고 있어요...'`, `'Build Failed'`/`'Your application build failed'` → `'빌드에 실패했어요'`/`'앱 빌드에 실패했어요'`, `'Build Completed'`/`'Your application was built successfully'` → `'빌드가 끝났어요'`/`'앱이 성공적으로 빌드됐어요'`.
- **테스트**: `app/buildActionDeployAlertKoreanAudit.spec.ts` 신규 4건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm vitest run` 382/382 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: (다음 커밋)
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 32로 기록)**: (1) `api.netlify-deploy.ts`/`api.vercel-deploy.ts`의 영어 에러 문구가 번역 없이 toast로 직행(확신도 high, 파일마다 10곳 이상이라 범위 큼). (2) `useVercelDeploy`/`useNetlifyDeploy`/`useGitHubDeploy`/`useGitLabDeploy` 4곳에 `useCloudflareDeploy`와 달리 더블클릭 재진입 가드 없음(확신도 medium, 설계 판단 필요). (3) `GitLabDeploymentDialog.tsx` sr-only "Close dialog" 2곳 미번역(낮은 우선순위, 다음 사이클에 바로 처리 가능).
- **다음 감사 영역**: 요금제/결제로 갱신.

### [09:00] Phase 2 — 사이클 37 (감사 대상: 요금제/결제, 4회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 382/382 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 진행 중 작업, 이 세션들이 만든 변경 아님) — 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 요금제/결제와 실제로 연결된 표면(설정 탭, 헤더/사이드바 요금제 링크, 무료 생성 잔여 횟수 표시, tier/plan 유틸, Made-with 배지 로직, 무료/유료 구분 조건문)을 대상으로 이미 알려진 항목(freeTrial.ts 메터링 동결, api.cloudflare-domain/deploy 인증 부재, CustomDomainConnect TODO_IS_PRO_USER, api.payment.verify/webhook 인증·재사용 방지 부재, BaseChat.tsx 용어 분기) 제외하고 재검색 요청. 보고받은 4건 중 최상위 1건을 직접 Read로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/chat/ModelSelector.tsx` — 모델 드롭다운의 "무료 모델만" 필터 토글("Free models only"), 필터 켰을 때 개수("N free model(s)"), 검색 결과 개수("N model(s) found (showing best matches)"), 모델 목록 로딩("Loading models..."), 빈 상태 안내 5곳(검색 결과 없음/무료 모델 없음/로컬 프로바이더 미실행 안내 2곳/검색 팁/필터 해제 안내)이 전부 영어로 하드코딩. 바로 옆 프로바이더·모델 검색창 placeholder/aria-label과 무료 모델 배지 title은 이전 한국어 문구 감사 사이클에서 이미 한국어로 고쳐져 있어, 드롭다운 하나를 여는 순간 한국어와 영어가 섞여 보이던 일관성 문제.
  → 전부 한국어로 번역.
- **테스트**: 기존 `app/modelSelectorKoreanAudit.spec.ts`에 신규 2건 추가(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 384/384 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `e74886f`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 33으로 기록)**: (1) `Chat.client.tsx`의 `recordGenerationUsed` 실패 시 조용히 생성을 계속 허용하는 비대칭 처리(정책 결정 필요). (2) `Header.tsx` 랜딩 헤더의 요금제/테마/계정 pill이 반응형 처리 없이 나열돼 좁은 화면에서 오버플로 가능성(실기기 확인 필요). (3) 로그인 계정 소진 토스트에 요금제 이동 액션 부재(UX 설계 판단 필요).
- **다음 감사 영역**: 다크모드로 갱신.

### [09:12] Phase 2 — 사이클 38 (감사 대상: 다크모드, 5회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 384/384 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 진행 중 작업) — 이전 사이클들의 판단대로 이번에도 손 안 댐, diff 내용을 직접 확인해 이전 기록과 동일함을 재검증.
- **감사 방법**: Explore 서브에이전트로 `app/components/`, `app/routes/`, `app/lib/` 전체를 대상으로 하드코딩 hex 색상, `dark:` 변형 없는 `bg-white`/`text-black`/`border-gray-*`, 남은 죽은 `dark:X-Y-dark` 토큰, 항상-라이트 표면을 재검색(이미 고쳐진 파일 목록을 프롬프트에 명시해 중복 보고 방지 요청). 보고받은 최상위 1건을 직접 Read로 재확인.
- **발견 및 확인**: `NetlifyDeploymentLink.client.tsx:31`이 링크 아이콘 hover 색을 Netlify 브랜드 틸 `hover:text-[#00AD9F]`로 하드코딩. 완전히 동일한 마크업/툴팁 구조에 `DeployButton.tsx`(같은 배포 드롭다운, 210번대 줄)에서 나란히 렌더되는 `VercelDeploymentLink.client.tsx`는 사이클 6에서 정확히 이 패턴(`hover:text-[#000000]`)을 `hover:text-bolt-elements-textPrimary`로 이미 고쳤음(`darkModeAccentAudit.spec.ts`에 회귀 테스트 존재) — Netlify 쪽만 놓친 사각지대. 대비 계산상 `#00AD9F`가 다크 배경에서 완전히 안 보이는 수준은 아니었지만(대략 5:1대), 아이콘 자체가 Netlify 로고가 아니라 범용 `i-ph:link` 아이콘이라 브랜드색을 고정할 근거가 약하고, 바로 옆 동일 컴포넌트가 이미 테마 토큰으로 통일돼 있어 일관성 관점에서 명확한 수정 대상으로 판단.
- **변경**: `app/components/chat/NetlifyDeploymentLink.client.tsx` 1곳 — `hover:text-[#00AD9F]` → `hover:text-bolt-elements-textPrimary`.
- **테스트**: `app/darkModeAccentAudit.spec.ts`에 신규 2건 추가(Vercel 쪽 기존 테스트와 대칭 구조, 소스 grep 방식).
- **검증**: `corepack pnpm vitest run` 386/386 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `fd91f58`
- **다음 감사 영역**: 모바일로 갱신.

### [09:24] Phase 2 — 사이클 39 (감사 대상: 모바일, 6회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 386/386 통과, `pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 진행 중 작업, 이 세션들이 만든 변경 아님) — diff 내용을 직접 확인해 이전 기록과 동일함을 재검증, 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 375px 뷰포트 기준 고정폭 오버플로/터치타겟/래핑 없는 가로 레이아웃을 재검색(이미 고쳐진 항목 목록을 프롬프트에 명시해 중복 보고 방지). 보고받은 4건 중 최상위 1건을 직접 Read + 폭 계산으로 재검증.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/header/Header.tsx:67-98` — 랜딩 헤더(홈 화면, `chat.started===false`)에서 로그인 사용자에게 "요금제" 링크 + `ThemeSwitch` + "내 프로젝트" 텍스트+아바타 알약 버튼이 `flex items-center justify-end gap-5`로 나열되는데 `flex-wrap`/`min-w-0`/축소 규칙이 전혀 없음. 폭 계산: 로고(~112px) + 헤더 `px-4`(32px) + "요금제"(~48px) + `gap-5` 2개(40px) + `ThemeSwitch`(~32px) + 알약 버튼(~124px) ≈ 388px, 375px 뷰포트를 넘침(사이클 37에서 IMPROVEMENTS 항목 33으로 "실기기 확인 필요"로만 관찰됐던 항목을 이번에 폭 계산으로 확정). 게스트(로그인 안 함) 변형은 알약이 "로그인"으로 더 짧아 ~341px로 이번엔 안 넘침 — 이번 수정 범위 밖.
- **변경**: `app/components/header/Header.tsx` — 알약 버튼의 "내 프로젝트" 텍스트를 `<span className="hidden sm:inline">`로 감싸 `sm` 미만에서 숨기고 `title="내 프로젝트"`로 접근성 유지, 좌측 패딩을 `pl-4`→`pl-1.5 sm:pl-4`로 조정(텍스트 없을 때 과도한 여백 방지). `app/components/chat/ChatBox.tsx`의 "이미지 첨부" 버튼(`hidden sm:inline` 패턴)과 동일한 기존 하우스 컨벤션을 그대로 적용해 구조 변경 없이 처리.
- **테스트**: `app/headerMobileOverflowAudit.spec.ts` 신규 2건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm vitest run` 388/388 통과, `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm run build`(client+server) 성공.
- **커밋**: `d54235f`
- **범위 밖으로 남긴 것**: (1) `Preview.tsx` 워크벤치 미리보기 툴바(772-863행)가 Device Mode 켰을 때 아이콘 최대 9개가 `flex-nowrap`으로 나열돼 375px에서 넘칠 수 있음(사이클 31 IMPROVEMENTS 항목 25에서 이미 기록, 툴바 재구성이 필요해 구조 변경으로 판단, 계속 미착수). (2) `ChatBox.tsx` 메인 채팅 입력창 아이콘 버튼들이 `h-8`(32px)로 하우스 44px 기준(`PromptClarification.tsx`의 `min-h-11`)보다 작음 — 여러 파일에 걸친 공유 클래스라 일괄 조정 필요(사이클 23 IMPROVEMENTS 항목 21에서 이미 기록). (3) `GitHubStats.tsx:192`/`StatsDisplay.tsx:42` 설정 다이얼로그 통계 그리드가 `grid-cols-4`/`grid-cols-3` 고정이고 형제 그리드는 이미 `md:grid-cols-4` 반응형 — 기계적인 수정이지만 이번 사이클 범위 밖, `OVERNIGHT5_IMPROVEMENTS.md` 항목 34로 신규 기록.
- **다음 감사 영역**: 온보딩으로 갱신.

### [09:27] Phase 2 — 사이클 40 (감사 대상: 온보딩, 5회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 388/388 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 진행 중 작업, 이 세션들이 만든 변경 아님) — diff 내용을 직접 확인해 이전 기록과 동일함을 재검증, 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `PromptClarification.tsx`/`BaseChat.tsx`/`ChatBox.tsx`/`Chat.client.tsx`(온보딩 완료 처리)를 대상으로 이미 고쳐진 항목(사이클 9·17·33 목록을 프롬프트에 명시)을 제외하고 재검색. 보고받은 5건 중 최상위 1건을 직접 Read로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/chat/Chat.client.tsx:255-268` — `/templates`의 "이 템플릿으로 시작" 링크가 쓰는 `?prompt=` 쿼리 파라미터 딥링크 핸들러가 `if (prompt)`로 truthy 체크만 해서, 같은 파일의 메인 전송 경로(`sendMessage`, 691-693번 줄)가 이미 쓰는 `messageContent?.trim()` 공백 가드와 달리 `?prompt=%20%20` 같은 공백 문자열도 그대로 `setClarifyingPrompt`에 넘겨 빈 아이디어로 온보딩 명확화 화면이 열리던 불일치(URL 조작으로만 도달 가능, 일반 UI 클릭으로는 발생 안 함). `checkGenerationsAllowed()`는 크레딧을 소모하지 않고 통과 여부만 확인하므로 크레딧 낭비는 아니지만, 사용자에게 빈 프롬프트로 온보딩 화면이 열리는 혼란스러운 진입점.
  → `if (prompt?.trim())`로 다른 진입점과 동일한 기준 통일.
- **테스트**: 기존 `app/onboardingAudit.spec.ts`에 신규 1건 추가(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 389/389 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `9f6fbec`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 35로 기록)**: (1) `PromptClarification.tsx`의 옵션 선택 220ms 지연 타이머가 "바로 만들기" 스킵으로 인한 언마운트 시 정리(clearTimeout)되지 않아 언마운트 후 상태 업데이트 레이스 가능(확신도 medium, 사이클 17 항목 16에서 이미 유사 항목으로 기록됨 — 이번엔 정확한 라인 재확인만). (2) 요약 편집 textarea를 공백으로 지우고 "만들기"를 누르면 안내 없이 원본 프롬프트로 조용히 되돌아감(확신도 medium). (3) 요약 textarea가 내부 마커 문자열(`ONBOARDING_ADDITIONS_MARKER`)을 그대로 노출해 사용자가 편집하면 이후 "답변 N개 반영됨" 표시가 어긋날 수 있음(확신도 low-medium). (4) `RotatingPlaceholder.tsx`의 내부 setTimeout이 언마운트 시 정리 안 됨(확신도 low, React 18에서 사실상 무해).
- **다음 감사 영역**: 생성으로 갱신.

### [09:38] Phase 2 — 사이클 41 (감사 대상: 생성, 5회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 389/389 통과, `corepack pnpm run build`(client+server) 성공, `corepack pnpm run typecheck` 0에러. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 진행 중 작업, 이 세션들이 만든 변경 아님) — diff 내용을 직접 확인해 이전 기록과 동일함을 재검증, 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `action-runner.ts`/`message-parser.ts`/`enhanced-message-parser.ts`/`useMessageParser.ts`/`workbench.ts`/`Artifact.tsx`를 재감사(사이클 10·18·26·34에서 이미 고친/기록된 항목 목록을 프롬프트에 명시해 제외 지시). 보고받은 4건 중 확신도 high, 가장 흔한 액션 타입에 영향, 크래시/데이터 손상급인 최상위 1건을 직접 Read로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/lib/runtime/action-runner.ts:334-341`(mkdir), `:370-375`(writeFile) — `#runFileAction`이 `webcontainer.fs.mkdir`/`webcontainer.fs.writeFile` 실패를 `catch`에서 `logger.error`만 남기고 삼켜(재throw 없음), 바깥 `#executeAction`(161-258행)의 try/catch가 이 실패를 감지할 방법이 없었음. 그 결과 디스크 부족/권한 오류 등으로 파일이 실제로 안 써져도 액션 상태가 `'complete'`로 표시되고 `Artifact.tsx`엔 초록 체크만 남아 사용자가 생성 결과물 손상을 알 방법이 없었음(이미 알려진 Supabase 액션 무음 실패 패턴 — IMPROVEMENTS.md 항목 9 — 과 동일 클래스지만 가장 흔한 file 액션에서는 처음 확인). `Artifact.tsx`가 `'failed'` 상태를 이미 렌더링하는 것을 확인해, catch 블록에서 재throw만 추가(새 알림 UI는 추가 안 함, 기존 `#executeAction`의 catch가 status를 `'failed'`로 정확히 설정).
- **테스트**: `app/lib/runtime/action-runner.spec.ts` 신규 파일, 3건(mocked webcontainer로 mkdir 실패/writeFile 실패/정상 성공 각각의 최종 액션 상태 검증 — 이 파일에 대한 첫 실제 클래스 단위 테스트, 기존 message-parser 계열 순수 함수 테스트와 달리 생성자에 mock webcontainer Promise를 주입하는 방식).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 392/392 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `3800c28`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 36으로 기록)**: (1) `enhanced-message-parser.ts`의 언랩 코드블록 자동감지 폴백이 파서 상태 전체를 리셋해 워크벤치가 사용자 의사와 무관하게 다시 열리고 매 렌더 전체 재파싱이 발생할 수 있음(확신도 high, 브라우저 재현은 못함). (2) 셸 명령 자동교정이 `action.content`를 nanostores 경유 없이 직접 mutate해 UI가 교정 전 명령을 계속 보여줄 수 있음(확신도 medium). (3) `addAction`의 `running` 상태 갱신이 실행 체인에 재대입되지 않아 여러 액션이 동시에 "실행 중"으로 잘못 표시될 수 있음(확신도 low-medium).
- **다음 감사 영역**: 미리보기/워크벤치로 갱신.

### [09:59] Phase 2 — 사이클 42 (감사 대상: 미리보기/워크벤치, 5회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 392/392 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 진행 중 작업, 이 세션들이 만든 변경 아님) — diff 내용을 직접 확인해 이전 기록과 동일함을 재검증, 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `app/components/workbench/**`, `app/lib/stores/workbench.ts`, `app/lib/stores/previews.ts`를 재감사(사이클 17·18·19·24·25·31·35·36·41 및 IMPROVEMENTS.md 항목 15/18/24/25/31/36에 이미 기록된 항목 목록을 프롬프트에 명시해 재보고 제외 지시). 보고받은 5건 중 최상위 1건을 직접 Read로 재검증.
- **오탐 확인**: 서브에이전트가 최우선으로 보고한 `TerminalTabs.tsx:156`의 "코랄레드 터미널"을 "깨진/의미불명 한국어"로 지목했으나, 직접 Read로 확인한 결과 "코랄레드"는 이 포크 자체의 한국어 브랜드명(오늘 지시서에도 "너는 코랄레드(bolt.diy 포크)"로 명시)이라 "코랄레드 터미널" = "Coralred Terminal"로 정상적인 의도된 문구임을 확인, 오탐으로 종결(수정 안 함).
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/workbench/LockManager.tsx` 전체 — 설정 > "Locks" 탭(잠긴 파일/폴더 관리 화면)의 검색 placeholder(`"Search..."`), 필터 옵션(`"All"/"Files"/"Folders"`), 선택 없이 잠금 해제 시도 시 토스트(`"No items selected to unlock."`), 성공 토스트(`` `Unlocked ${n} selected item(s).` ``), 전체 선택 라벨(`"All"`), "Unlock all" 버튼(라벨+title), 빈 상태 안내(`"No locked items found"`), 개별 항목 잠금 해제 버튼 title(`"Unlock"`)·성공 토스트(`` `${path} unlocked` ``), footer 항목 수 표시(`` `${n} item(s) • ${n} selected` ``)까지 전부 영어로 하드코딩. `EditorPanel.tsx`에서 "Locks" 탭으로 항상 렌더되는 실사용 표면(죽은 코드 아님, import 확인). 19번째 사이클에서 `FileTree.tsx`의 업로드/삭제/잠금 관련 catch 토스트는 이미 한국어로 고쳤지만, 이 잠금 *관리* 전용 별도 컴포넌트는 그때 범위 밖이었고 이후 사이클에서도 재감사 대상에 든 적 없어 처음 발견.
- **테스트**: `app/lockManagerKoreanAudit.spec.ts` 신규 파일, 2건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 394/394 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `9e800f1`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 37로 기록)**: (1) `TerminalTabs.tsx`의 `closeTerminal(index)`가 중간 터미널을 닫을 때, 렌더 루프가 배열 위치 기준으로 재키잉되면서 실제로 언마운트되는 컴포넌트가 사용자가 닫은 인스턴스가 아니라 최고 인덱스 인스턴스일 수 있어 store의 터미널 참조가 꼬일 위험(확신도 medium, 코드 추론만, 재현 못함). (2) `ScreenshotSelector.tsx` 스크린샷 캡처 성공/실패 토스트 4곳 영어. (3) `PortDropdown.tsx:63` "Ports" 드롭다운 헤더 라벨 영어. (4) `InspectorPanel.tsx` 전체 영어 + 의심되는 오타 클래스(`bg-bolt-elements-bg-depth-1`, 실제 토큰은 `background-depth`) — 단 이 컴포넌트는 자기 자신 외에는 아무 데서도 import되지 않는 죽은 코드로 확인돼 우선순위 낮음.
- **다음 감사 영역**: 배포로 갱신.

### [10:00] Phase 2 — 사이클 43 (감사 대상: 배포, 6회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 394/394 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 진행 중 작업, 이 세션들이 만든 변경 아님) — diff 내용을 직접 확인해 이전 기록과 동일함을 재검증, 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `DeployButton.tsx`, 5개 제공자 `*.client.tsx`, `GitHubDeploymentDialog.tsx`/`GitLabDeploymentDialog.tsx`, `CustomDomainConnect.tsx`, `api.*deploy*.ts`/`api.*domain*.ts`, `action-runner.ts`(배포 관련 부분), `DeployAlert.tsx`류를 재감사(사이클 4·12·13·20·28·36 및 IMPROVEMENTS.md 항목 32 등 이미 알려진 항목 목록을 프롬프트에 명시해 재보고 제외 지시). 보고받은 5건 중 최상위 1건을 직접 Read로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/lib/runtime/action-runner.ts:315`(`#runStartAction`)/`:524`(`#runBuildAction`)가 `throw new ActionCommandError('Failed To Start Application'/'Build Failed', ...)`로 던지는 에러의 첫 인자(header)가, `#executeAction`의 일반 catch(244-253행)를 거쳐 `onAlert?.({ type: 'error', title: 'Dev Server Failed', description: error.header, ... })`로 전달되고, 이게 `app/components/chat/ChatAlert.tsx`(제목은 하드코딩 한국어 "터미널 오류"지만 59행 `오류: {description}`은 raw description을 그대로 노출)에서 렌더돼 "오류: Build Failed"처럼 한국어 문장 중간에 영어가 섞여 노출되던 문제. 사이클 36에서 고친 `onDeployAlert`(빌드 중/실패/완료 알림, 이미 한국어)와는 **별개의 alert 채널**이라 그때 안 잡혔고, 5개 배포 제공자 전부가 같은 `runAction({type:'build'})`/`{type:'start'}` 경로를 타므로 빌드나 앱 시작이 실패할 때마다(정상적인 에러 상황에서 매번) 재현됨.
- **변경**: `app/lib/runtime/action-runner.ts` 2곳 — `ActionCommandError('Failed To Start Application', ...)` → `ActionCommandError('애플리케이션 시작 실패', ...)`, `ActionCommandError('Build Failed', ...)` → `ActionCommandError('빌드 실패', ...)`. `#createEnhancedShellError`의 셸 명령 에러 타이틀 사전(예: `'File Not Found'` 등, 288행에서 쓰임)은 같은 클래스의 문제지만 훨씬 큰 별도 범위라 손 안 댐.
- **테스트**: `app/actionCommandErrorKoreanAudit.spec.ts` 신규 파일, 3건(소스 grep 방식, 기존 관행과 동일).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 397/397 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `d5ebd1e`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 38로 기록)**: (1) GitHub/GitLab/Vercel/Netlify 배포 아티팩트 제목 4곳이 영어("GitHub Deployment" 등, Cloudflare만 한국어). (2) `VercelDeploymentLink.client.tsx`가 채팅 전환 시 이전 채팅의 배포 링크를 계속 보여줄 수 있음(`deploymentUrl` state가 `currentChatId` 변경에 리셋 안 됨, Netlify 쪽은 매 렌더 스토어에서 새로 읽어 문제 없음). (3) Netlify/Vercel 배포 훅이 빌드 산출물을 `utf-8` 텍스트로 읽어 바이너리 자산이 깨질 수 있음(Cloudflare는 이미 바이트 안전 읽기로 수정됨, 자체 주석에도 명시). (4) `DeployButton.tsx` 서브메뉴 4개 항목이 메인 버튼과 달리 `isStreaming` disabled 가드 없음.
- **다음 감사 영역**: 요금제/결제로 갱신.

### [10:14] Phase 2 — 사이클 44 (감사 대상: 요금제/결제, 7회차)
- **베이스라인 재확인**: `corepack pnpm vitest run` 397/397 통과, `corepack pnpm run build`(client+server) 성공. `app/routes/pricing.tsx`의 기존 미완성 PortOne 연동 코드는 여전히 미커밋 상태로 남아있음(사용자 본인 진행 중 작업, 이 세션들이 만든 변경 아님) — diff 내용을 직접 확인해 이전 기록과 동일함을 재검증, 이전 사이클들의 판단대로 이번에도 손 안 댐.
- **감사 방법**: Explore 서브에이전트로 `pricing.tsx`(PortOne 부분 제외), 구독/크레딧/`freeTrial.ts`, `BaseChat.tsx`/`Chat.client.tsx` 무료 생성 배지, `ModelSelector.tsx`를 재감사(사이클 21·29·37 및 IMPROVEMENTS.md 항목 4/28/33 등 이미 기록된 항목 목록을 프롬프트에 명시해 재보고 제외 지시). 보고받은 3건 중 최상위 1건을 직접 Read로 재검증 후 수정.
- **발견·수정(1건, 검증 완료 후 수정)**: `app/components/chat/Chat.client.tsx:519-533`의 `generateNewApp()`이 `checkGenerationsAllowed()` 통과 직후 `recordGenerationUsed()`로 무료 생성 크레딧을 **먼저 차감**하고 `setFakeLoading(true)`를 띄운 뒤, `autoSelectTemplate`가 켜져 있으면(기본값 true, `settings.ts:285`) `selectStarterTemplate()`를 호출함. 그런데 `app/utils/selectStarterTemplate.ts:102-106`의 `fetch('/api/llmcall')`/`response.json()` 호출은 어떤 try/catch도 없이 그대로 예외를 전파했고, 호출부인 `handleClarificationComplete`(677행)도 `generateNewApp(...)`을 await/catch 없이 fire-and-forget으로 부르기 때문에, 네트워크 오류나 비-JSON 응답(500 HTML 에러 페이지 등) 시 예외가 unhandled rejection이 되어 `setFakeLoading(false)`에 도달하지 못하고 채팅 화면이 무한 로딩 상태로 멈춤. 크레딧은 이미 차감된 뒤라 새로고침해도 복구 안 됨.
- **변경**: `app/utils/selectStarterTemplate.ts` — `fetch`/`response.json()`/파싱 전체를 try/catch로 감싸, 실패 시 기존에 LLM 파싱 실패(`parseSelectedTemplate`가 null 반환) 때 이미 쓰던 것과 동일한 blank 템플릿 폴백(`{ template: 'blank', title: '' }`)으로 흡수하도록 수정. `Chat.client.tsx`는 건드리지 않음(blank 반환 시 이미 안전하게 baseline 경로로 이어짐).
- **테스트**: `app/utils/selectStarterTemplate.spec.ts` 신규 파일, 3건(정상 파싱 성공 / fetch reject 시 blank 폴백 / 비-JSON 응답 시 blank 폴백, `vi.stubGlobal('fetch', ...)` 방식은 `generateAppQuestions.spec.ts`와 동일 패턴).
- **검증**: `corepack pnpm run typecheck` 0에러, `corepack pnpm run lint` 통과(무관한 기존 warning 1건만, `auth.ts`), `corepack pnpm vitest run` 400/400 통과, `corepack pnpm run build`(client+server) 성공.
- **커밋**: `1c391e1`
- **범위 밖으로 남긴 것(`OVERNIGHT5_IMPROVEMENTS.md` 항목 39로 기록)**: (1) `app/routes/terms.tsx:86`가 존재하지 않는 "설정 화면을 통한 회원 탈퇴" 기능을 명시적으로 약속함(코드베이스 전체에 탈퇴 UI/API 없음, `signOut`만 존재) — 새 기능 구현 또는 법률 문구 수정이 필요해 사람 판단 대기. (2) `pricing.tsx`의 `.cr-grid-4` 4열 그리드가 태블릿 폭(761~1024px)에서 2열 브레이크포인트 없이 데스크톱 레이아웃 유지돼 카드가 좁아짐(확신도 medium).
- **다음 감사 영역**: 다크모드로 갱신.
