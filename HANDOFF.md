# 코랄레드 개발 인수인계 (HANDOFF)

다음 개발자(사람이든 AI든)가 이 저장소를 이어받을 때 첫 30분 안에 읽어야 하는 문서. 사용법·환경 변수는 `README.md`, 폴더별 담당·호출자·변경 영향은 `ARCHITECTURE.md`, 결함 목록·정리 우선순위는 `docs/AUDIT-2026-09-22.md`, 인수인계 시점의 상태·결정·함정은 여기. 마지막 갱신: 2026-09-22, HEAD `a6f1030e`.

## 0. 30초 요약

- **무엇**: bolt.diy 포크. 한국어 비개발자가 요청하면 LLM(Claude)이 React 앱을 만들고, 브라우저 WebContainer에서 바로 실행·미리보기. Cloudflare Pages(Remix + Functions)에 배포. 도메인 `coralred.kr`.
- **지금 초점**: "시네마틱 킷" 트랙 — 소개·홍보형 사이트를 어워드급(CSSDA 8.5~8.9)으로 뽑는 것. 킷은 `kits/cinematic/src`(21파일), 생성물에 `src/kit/`으로 시드된다.
- **작업 브랜치**: `feat/media-gen`. `main`은 이 브랜치를 fast-forward로 따라간다(`git fetch . feat/media-gen:main`). 워크트리 `bolt.diy-media-gen`에서 작업.
- **배포**: `npm run deploy` (build + `wrangler pages deploy build/client --project-name=coralred --branch=coralred`). 배포 = 새 Worker 격리체 = 병든 엣지 머신 리셋 수단이기도 하다.
- **막힌 것**: Google AI Studio 선불 크레딧 소진(Gemini 402) — 이미지·영상 생성 전부 실패. 충전 전엔 예약 사진 주입 end-to-end 검증 불가.

## 1. 생성 한 번의 데이터 흐름 (시네마틱 트랙)

```
사용자 프롬프트 + 온보딩 답변 (PromptClarification.tsx)
  → Chat.client.tsx generateNewApp()
     ├ getBaselineTemplate()  기본 파일 + coralred-ui.css + (시네마틱이면) seedCinematicKit() → src/kit/*
     ├ prepareSkeleton7Images()  /api/media-images {reserve} → R2 URL 4장+영상 예약 (생성은 아직 안 함)
     ├ 프롬프트 = 사용자 요청 + skeleton7PromptLines(예약 URL) + CINEMATIC_KIT_PROMPT(11장면 순서)
     └ /api/chat 스트리밍 (stream-text.ts, cinematic=isCinematicProject(files)로 체크리스트 스왑)
  → message-parser → action-runner: 파일 write / npm install / npm run dev (WebContainer)
  → 스트림 종료(isLoading=false)
     ├ startSkeleton7ImageSet()  ← 이제야 이미지 생성 POST (격리체 겹침 방지, §4)
     └ AUTO_REVIEW (reviewGeneratedApp.ts)
          ├ runMechanicalChecks (mechanical-checks.ts) ← 시네마틱 게이트 checkCinematicSceneOrder 포함
          ├ text review /api/llmcall (haiku)  → 파일 수정
          ├ visual review /api/llmcall (sonnet + 스크린샷)  ← iframe 보일 때만
          └ applySkeleton7Images()  예약 사진 주입/캐시버스터 재렌더 (injectCinematicImages)
  → 자동 수정(runAutoFix): 프리뷰 에러 시 무과금 재시도 2회 → 끝나면 예약 사진 재주입
```

핵심 파일:

| 역할 | 파일 |
|---|---|
| 생성 오케스트레이션 | `app/components/chat/Chat.client.tsx` (1,400줄, 모든 effect가 여기) |
| 킷 프롬프트 | `app/lib/cinematic/kit-prompt.ts`, `kit-files.ts`(?raw import, 클라이언트 전용), `seedKit.ts` |
| 트랙 판정 | `app/lib/cinematic/isCinematicProject.ts`(서버, src/kit/tokens.css 유무), `mechanical-checks.ts isCinematicTrackFile`(파일 단위) |
| 게이트 | `app/lib/cinematic/sceneOrder.ts` — 장면 순서·prop 이름(`KIT_COMPONENT_PROPS`)·export(`KIT_EXPORTS`/`KIT_FILES`)·외부 이미지/영상 호스트·루트 경로·자리표시자 |
| 사진 예약/주입 | `app/lib/media/skeleton7Images.ts`(클라 오케스트레이션), `injectCinematicImages.ts`, `skeleton7PromptLines.ts` |
| 이미지/영상 서버 | `app/routes/api.media-images.ts`, `api.media-video.ts`, `app/lib/.server/media/*` (Gemini/Seedream/Seedance, R2 업로드) |
| 시스템 프롬프트 | `app/lib/common/prompts/new-prompt.ts` (`SKELETON_7_SCREEN_CHECKLIST`, `cinematic` 파라미터) |
| 자동 검토 | `app/utils/reviewGeneratedApp.ts`, `app/lib/review/mechanical-checks.ts` |
| 액션 실행 | `app/lib/runtime/action-runner.ts`, `message-parser.ts`, `app/lib/stores/workbench.ts`, `files.ts` |
| dev 서버 감시 | `app/lib/stores/devServerHealth.ts` (셸 출력에서 `The service was stopped`만 사망으로) |
| 온보딩 | `app/lib/onboarding/question-bank.ts`, `answer-directives.ts` |
| 팔레트 | `app/lib/palettes.ts` (라이트 11 + 다크), 다크면 `<html data-theme="dark">` |

## 2. 킷 (`kits/cinematic/src`)

- 컴포넌트: Preloader, Cursor, Nav, Scene/SceneNav, HeroScene(+HeroCanvas WebGL), TextReveal, PinnedChapters(+ScrollChapter 모바일 폴백), Showcase3D(+Showcase3DScene three), Marquee, Contact, BigNumber, MediaStage/MediaTreatment, Wordmark, ScrollSequence. 훅은 `hooks.ts`(useSmoothScroll=Lenis+GSAP 방향 스냅, 3D 드래그 중 스크롤 잠금 `globalThis.__ckScrollLock`, `hasHangul/eyebrowClass`).
- 토큰: `tokens.css`. 코랄레드 변수(`--bg --text --accent…`)를 받고 폴백은 다크. 디스플레이 300/-0.03em/1.02, xl 136·lg 96px. 버튼은 밑줄 링크(`.ck-btn`), 알약은 `--solid`.
- **v0.4 기준(2026-09-18~19 감사로 확정)**: 화면당 헤드라인 하나가 압도, 미디어는 절반 풀블리드, UI 크롬 최소, 앰비언트 모션 항상(그레인·켄번즈·드리프트·빛 스침), 한글 라벨에 모노 대문자·넓은 자간 금지.
- 킷 typecheck: `cd kits/cinematic && npm run typecheck`. 킷 export를 바꾸면 `sceneOrder.spec.ts`의 동기화 테스트가 깨진다(의도).
- 생성물의 `src/kit/`은 자동 검토에서 제외(`reviewGeneratedApp EXCLUDED_DIR_PREFIXES`).

## 3. 검증 하네스 (`tests/benchmark/cinematic`) — 크레딧 없이 도는 것들

| 목적 | 명령 |
|---|---|
| 생성물 빌드+측정(구조·모션 채점) | `node tests/benchmark/cinematic/renderGenerated.mjs gen-2026-09-13-prod/` |
| 장면별 1440×900 샷 + 타이포 수치 | `AUDIT=1 node … renderGenerated.mjs gen-2026-09-13-prod/` (라이트: `PALETTE=light`) |
| 뷰포트 단위 샷(모바일: `MOBILE=1`) | `node tests/benchmark/cinematic/shotScenes.mjs <outDir> "0,1,2"` |
| 박스/리빌/유휴모션/스크린샷 재현 | `probeSection.mjs`, `probeReveal.mjs`, `probeIdle.mjs`, `probeScreenshot.mjs`, `detailProbe.mjs` |
| 수상작과 같은 모션 측정 | `node serveDist.mjs 4188` 후 `node tests/benchmark/cssda/motion.mjs --out <tmp>` (기준값: idle 0.036, 휠 394px) |
| 소스 게이트만 | `node tests/skeleton7-dom/bundleAndRun.cjs tests/benchmark/cinematic/sceneOrderCheck.ts --case=… --recheck` |
| 유닛 | `npx vitest run app/lib/cinematic app/lib/media app/lib/review app/lib/stores` |

빌드 산출물은 `kits/cinematic/.render-tmp/dist`(git 제외). 샷 증거는 `render-2026-09-12/kit-v0.4-audit/`. **사건·실험·판정 로그 전체는 `tests/benchmark/cinematic/rubric.md`** — 새 결함을 고치면 거기에 날짜 절을 추가한다.

## 4. 운영 함정 (전부 실측, 잊으면 재발)

1. **Worker 격리체 128MB**: `/api/chat` 스트리밍과 `/api/media-images`가 같은 격리체에서 겹치면 둘 다 죽고 그 엣지 머신의 SSR이 `Worker exceeded resource limits`(503)를 계속 낸다. 브라우저는 HTTP/2로 그 머신에 핀 고정 → curl은 정상이라 오인 쉽다. 진단: 콘솔 `fetch('/pricing')` 10회 + `cf-ray` 접미사. 리셋: 같은 코드로 `npm run deploy`. 예방: 이미지 생성은 스트림 종료 뒤(`startSkeleton7ImageSet`, `waitForQuietChat`).
2. **Cloudflare가 502/504 JSON을 자기 HTML로 덮는다** → 서버 오류는 500/402로 낸다(`api.media-images`, `api.llmcall`).
3. **공급자 결제 오류**는 upstream 400/402로 온다. `app/lib/.server/llm/provider-error.ts`가 402 `provider_billing`으로 통일. Anthropic·Gemini 문구 포함.
4. **"마무리가 안 끝났어요"(post-stream stall)**: 진짜 원인은 기본 킷 아티팩트의 `npm run dev`가 다음 아티팩트에 abort되는 정상 종료였다(`start:aborted` = settled, a6f1030e). 다른 경로(saveFile 무응답, 큐 거부)도 막아 뒀다. 진단: 프로덕션 콘솔 `window.__ckUnsettled()`.
5. **Vite `Pre-transform error`는 dev 서버 사망이 아니다**(잘못된 import에도 찍힘). `The service was stopped`만 사망. 사망이면 `restartStartAction` 2회 → 새 탭 안내.
6. **WebContainer 탭 자원 소진**: 한 탭에서 생성 ~7회 뒤 esbuild가 죽는다. 검증은 새 탭에서.
7. **모델 편차(전부 게이트/주입기에 반영됨)**: 파일 단위 `./kit/X` import, `/hero.jpg` 루트 경로, 지어낸 영상 호스트, 예약 URL 무시하고 Pexels, prop 이름 지어내기(`description`·`eyebrow` 별칭은 킷이 받음), 힌트 문구의 자리표시자 복사. **LLM에게 가는 어떤 문구에도 `<jobId>` 같은 자리표시자를 쓰지 말 것.**
8. **자동 검토 스크린샷**은 코드 뷰가 열려 있으면 iframe 0×0 → `data:,`. 숨은 iframe이면 건너뛴다.
9. **온보딩 단계 전환 20~40초** — WebContainer 부팅과 메인 스레드 경합. 미착수 이슈.
10. `_routes.json`으로 정적 에셋은 Function을 안 거친다. 앱 라우트와 겹치는 접두사 추가 금지.

## 5. 브랜치·미병합·미적용

- 브랜치 현황(2026-09-22 정리): `main` = `feat/media-gen`(fast-forward). `overnight5`는 main에 전부 병합됨 — 로컬·origin에서 삭제 대상(아래 §6). 되돌릴 기준점은 태그·브랜치 `coralred-v0.1-clean`(README "되돌릴 기준점").
- `feat/access-policy`(1커밋, `bolt.diy` 워크트리): 비로그인 생성 차단, 계정 월 1건 첫 생성만, 수정 메시지 차단. 클라이언트 게이트만. **RUN-7 SQL 미적용.**
- `feat/stall-fix`(2커밋, `bolt.diy-stall-fix` 워크트리): thinking 모델 스톨 감지 + 설치 중 stall 유예. `a6f1030e`의 start:aborted 수정과 겹치는 영역 — 병합 시 `getUnsettledActions` 충돌 확인.
- **SQL은 자동 적용 안 됨.** 정본 `supabase/migrations/*.sql`, 과거 수동 적용본 `supabase/migrations/manual/RUN-*.sql`. 라이브 vs 리포 드리프트·정리 마이그레이션은 `docs/DB-AUDIT-2026-09-22.md`(`.pending` 파일은 사용자가 직접 적용). 적용 여부는 `/api/health`의 `migrations` 맵으로 확인(테이블 존재만 검사). `RUN-2-metering-v2-fix.sql`·RUN-7은 미적용 기록 있음.
- 루트의 `*_REPORT.md`, `OVERNIGHT*.md`, `GEN_STALL_FIX*.md` 등 30개는 과거 작업 보고서 — `docs/reports/`로 이동(이 커밋). 현재 사실은 이 문서와 `rubric.md`가 우선.

## 6. 규칙

- 커밋 전 `npx tsc --noEmit -p .` + `npx eslint` + 관련 vitest. husky가 typecheck·lint를 돌린다(CRLF는 lint 실패 — 파일은 LF).
- 킷 코드는 `?raw`로만 번들되므로 서버 번들에 영향 없음 — 킷만 바꾼 배포는 서버 회귀를 못 만든다.
- 생성 품질 변경 = 프롬프트 문구 변경 뒤 실생성 1런으로 확인(확률적). 킷 변경 = 하네스로 결정적 확인.
- 한국어 UI 문구는 `design-handoff/coralred-voice.md`(해요체, 개발 용어 금지).
- 사진: 실사 AI 인물 금지(그림체는 허용). 오브젝트·공간 우선.
- 테스트 계정 쿼터 리셋: PostgREST PATCH `generation_usage_v2` (키는 `.env`의 `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`).

## 7. 다음 할 일 (우선순위)

1. Google AI Studio 크레딧 충전 → 새 탭에서 실생성 1~2런: 예약 사진이 프리뷰에 실제로 뜨는지, 킷 v0.4 결과물 눈으로 확인.
2. 온보딩 전환 지연(§4-9) 원인 — WebContainer `boot()`를 온보딩 뒤로 미루거나 워커로.
3. `feat/stall-fix`·`feat/access-policy` 병합 + RUN-7 SQL.
4. 미디어 생성을 별도 Worker로 분리(격리체 문제의 구조적 해법, 지금은 순서 조정으로 회피 중).
5. 모바일에서 장면 스냅 유지 여부 결정(현재 켜짐).
