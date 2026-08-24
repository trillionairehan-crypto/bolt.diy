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
