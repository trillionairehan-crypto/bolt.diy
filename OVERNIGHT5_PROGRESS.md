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
