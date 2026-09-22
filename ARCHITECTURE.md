# 코랄레드 아키텍처 (ARCHITECTURE)

폴더별 **담당 · 누가 호출하는가 · 무엇을 고치면 어디가 흔들리는가**. 인수인계 상태·함정은 `HANDOFF.md`, 결함 목록은 `docs/AUDIT-2026-09-22.md`. 기준 HEAD `a6f1030e` (2026-09-22).

## 0. 전체 지도

```
coralred (bolt.diy 포크, Remix + Vite, Cloudflare Pages Functions)
├── app/
│   ├── routes/            Remix 페이지 + /api/* 서버 엔드포인트 (Cloudflare Worker에서 실행)
│   ├── components/        React UI — chat(생성 UX), workbench(에디터·프리뷰·터미널), deploy, @settings(대부분 죽은 표면)
│   ├── lib/
│   │   ├── .server/       서버 전용: llm(스트리밍·모델 한도·결제 오류), media(Gemini/Seedream 이미지, Seedance/Kling 영상, R2)
│   │   ├── common/prompts 시스템 프롬프트(new-prompt, discuss-prompt, prompt-library)
│   │   ├── cinematic/     시네마틱 킷 트랙: 킷 프롬프트·시드·트랙 판정·장면 게이트
│   │   ├── media/         예약 사진 오케스트레이션(클라)·주입기·프롬프트 줄·룩 바이블
│   │   ├── review/        생성물 기계 검사(자동 검토 앞단)
│   │   ├── onboarding/    온보딩 질문 뱅크 → directives(industry/skeleton/palette)
│   │   ├── runtime/       LLM 응답 파서 → 액션 러너(파일 write, shell, dev 서버)
│   │   ├── stores/        nanostores 상태: workbench(액션 큐·파일), files, chat, terminal, palette, devServerHealth …
│   │   ├── cloud/         "코랄레드 Cloud" — 생성 앱용 백엔드(문서 CRUD, 앱 토큰, 프로비저닝, 사용량 기록, 온보딩 응답)
│   │   ├── modules/llm/   프로바이더 레지스트리(LLMManager, Anthropic 등)
│   │   ├── hooks/ persistence/ services/ supabase/ webcontainer/ utils/
│   ├── utils/             reviewGeneratedApp(자동 검토 오케스트레이션), selectStarterTemplate(baseline), featureFlags, logger
│   └── types/ styles/
├── kits/cinematic/        시네마틱 킷 원본(React+GSAP+Lenis+three). 생성물에 src/kit/으로 복사됨. 자체 package.json·demo
├── functions/             Cloudflare Pages Functions 진입: [[path]].ts(Remix 핸들러), _middleware.ts(Sentry)
├── public/                정적 파일(_routes.json으로 Function 우회), inspector-script.js(프리뷰 iframe 안에서 돎)
├── design-handoff/        브랜드·문구 정본, coralred-ui.css(생성 앱마다 주입되는 디자인 킷)
├── supabase/migrations/   플랫폼 DB SQL(자동 적용 안 됨) + 루트 RUN-*.sql
├── tests/
│   ├── benchmark/cinematic 렌더·모션·디테일 하네스 + rubric.md(실측 로그)
│   ├── benchmark/cssda    CSSDA 수상작 90개 측정 도구·데이터(기준값 출처)
│   ├── skeleton7-dom      게이트를 노드에서 돌리는 번들러(bundleAndRun.cjs)
│   └── fixtures/ media/   생성물 픽스처, 미디어 생성 실험 스크립트
├── docs/reports/          과거 작업 보고서(역사 자료, 현재 사실 아님)
└── server/preview-server.mjs  로컬 프리뷰 미러(개발용)
```

두 개의 "앱": **플랫폼**(coralred.kr 자체 — 로그인·요금제·생성 UI, Supabase 프로젝트 `VITE_PLATFORM_SUPABASE_*`)과 **생성 앱**(사용자가 만든 것 — 프리뷰는 WebContainer, 저장은 코랄레드 Cloud `CLOUD_SUPABASE_*`, 배포는 Cloudflare Pages). 헷갈리면 변수 접두사로 구분.

## 1. 폴더별 상세

### `app/routes/` — 페이지 + API
| 파일 | 담당 | 호출자 | 고치면 영향 |
|---|---|---|---|
| `_index.tsx`, `chat.$id.tsx` | 생성 UI 진입, 저장 채팅 | 브라우저 | `Chat.client.tsx` 마운트 조건 |
| `api.chat.ts` | LLM 스트리밍 본체. 쿠키에서 apiKeys/providers, `stream-text.ts` 호출, 과금(`messageUsage`) | `Chat.client.tsx` useChat transport | 프롬프트 선택·컨텍스트 최적화·과금. **격리체 메모리의 절반**(§HANDOFF 4-1) |
| `api.llmcall.ts` | 비스트리밍 단발 LLM(자동 검토·온보딩 산업 매핑) | `reviewGeneratedApp.ts`, `mapIndustryToSkeleton.ts` | 402 결제 분류(`provider-error.ts`) |
| `api.media-images.ts`, `api.media-video.ts` | 예약(URL만) / 생성(Gemini 4장→R2) / 영상 작업 생성·폴링 | `skeleton7Images.ts` | R2 키 형식 `media/<jobId>/{hero,ch1..3}.jpg`·`hero-<provider>.mp4` — 바꾸면 주입기·게이트·프롬프트 줄 전부 |
| `api.onboarding.ts`, `api.utm-attribution.ts` | 온보딩 응답·UTM 저장 | `PromptClarification.tsx`, 랜딩 | `lib/cloud/onboardingResponses.ts` |
| `api.cloud.*`, `api.cloud-provision.ts`, `api.cloud-set-origin.ts` | 생성 앱의 백엔드 API(Bearer 앱 토큰, `cloudAuth.ts`) | 생성 앱 안의 `coralred-storage.client-template.js` | 생성 앱 전부(배포된 것 포함) — **호환성 깨지면 이미 배포된 사용자 앱이 죽는다** |
| `api.cloudflare-deploy.ts`, `api.cloudflare-domain.ts` | 생성 앱 배포·커스텀 도메인 | `CloudflareDeploy.client.tsx` | `lib/services/cloudflarePages.ts` |
| `api.payment.*` | PortOne 결제 검증·웹훅 | pricing.tsx, PortOne | 요금제·`generation_usage_v2` |
| `api.account-delete.ts`, `api.health.ts` | 탈퇴, 마이그레이션 헬스(`/api/health`) | 설정, 운영 | health의 `EXPECTED_TABLES`에 새 테이블 추가 |
| `api.git-*`, `api.github-*`, `api.gitlab-*`, `api.netlify-*`, `api.vercel-*`, `api.supabase*`, `api.mcp-*`, `api.system.*`, `api.update.ts`, `api.web-search.ts`, `api.enhancer.ts` | **bolt.diy 잔재.** UI는 `SHOW_DEV_TOOLS=false`로 숨김, 라우트는 살아 있음 | (사실상 없음) | 감사 문서 §API 참고 — 제거 후보 |

### `app/components/chat/` — 생성 UX (핵심)
- `Chat.client.tsx`(1,400줄): 온보딩 → `generateNewApp` → 스트림 → 자동 검토 → 자동 수정 → 예약 사진 주입까지 **모든 effect**. 여기가 바뀌면 생성 플로우 전체. 진입점: `generateNewApp()`, `sendMessage()`, `runAutoFix`, AUTO_REVIEW effect, `startSkeleton7ImageSet` effect, `devServerCrash` effect.
- `PromptClarification.tsx`: 온보딩 설문 UI(`lib/onboarding` 질문 뱅크 렌더). `Artifact.tsx`: 아티팩트 카드·"만드는 중/다 만들었어요" 라벨(`getGenerationPhaseLabel`). `Messages.client.tsx`, `BaseChat.tsx`, `LLMApiAlert.tsx`(stall·결제 알림).
- 죽은 표면: `DicussMode.tsx`, `ExamplePrompts.tsx`, `MCPTools.tsx`, `SpeechRecognition.tsx`, `WebSearch.client.tsx`.

### `app/components/workbench/` — 에디터·프리뷰
- `Preview.tsx`: WebContainer iframe, 프리뷰 에러 감지 → `setPreviewAlert`, 스크린샷 요청(`registerPreviewScreenshotRequester`, iframe 0×0이면 null). `Workbench.client.tsx`: 패널 열기는 `previewReady` 신호로만.
- `public/inspector-script.js`가 iframe 안에서 짝을 이룬다(CAPTURE_SCREENSHOT, vite 오버레이 감지). **둘은 postMessage 프로토콜로 묶여 있다 — 한쪽만 고치면 안 됨.**

### `app/lib/runtime/` + `app/lib/stores/workbench.ts` — 액션 실행
- `message-parser.ts`: `<boltArtifact>/<boltAction>` 스트림 파싱 → `onActionOpen/Stream/Close`. `action-runner.ts`: 아티팩트별 직렬 큐(`#currentExecutionPromise`), 파일 write(20s 타임아웃), shell/start(`BoltShell.executeCommand` — 이전 실행 abort), `retryAction`, `restartStartAction`.
- `workbench.ts`: 전역 실행 큐(`addToExecutionQueue`, catch로 보호), `_runAction`(에디터 갱신 → `filesStore.saveFile` → 러너), `getUnsettledActions`(start running/aborted = settled), `restartDevServer`, 디버그 `window.__ckUnsettled`.
- 고치면 영향: stall 판정(`Chat.client` post-stream 30s 감시, `Artifact.tsx` 완료 라벨) — 두 곳이 같은 "settled" 규칙을 써야 한다.

### `app/lib/cinematic/` — 시네마틱 트랙
- `kit-prompt.ts`(11장면 순서, 모델에게 가는 킷 API 요약), `kit-files.ts`(`?raw` import, **클라이언트 전용** — 서버에서 import 금지), `seedKit.ts`(WebContainer에 `src/kit/` 쓰기), `isCinematicProject.ts`(서버: 파일맵에 `src/kit/tokens.css` 있으면 체크리스트 스왑), `sceneOrder.ts`(게이트).
- 킷 export/파일을 바꾸면: `sceneOrder.ts`의 `KIT_EXPORTS`/`KIT_FILES`/`KIT_COMPONENT_PROPS` + spec 동기화 테스트가 깨진다(의도된 안전장치).

### `app/lib/media/` — 예약 사진
- `skeleton7Images.ts`: 예약(`prepare`) → 스트림 종료 뒤 생성 시작(`start…`, `waitForQuietChat`) → 주입/캐시버스터(`apply…`, `lastApplied` 재주입). 모듈 상태(`pending`, `lastInput`, `lastApplied`, `chatStreaming`)가 있다 — 탭 세션 단위.
- `injectCinematicImages.ts`(URL 문자열 치환: 외부 이미지·스톡·루트 경로·영상), `injectSkeleton7Images.ts`(구형 data-slot 마크업 주입), `skeleton7PromptLines.ts`(모델에게 가는 URL 지시 — **자리표시자 금지**), `shotlist.ts`/`look-bibles.ts`/`world-cards.ts`/`style-locks.ts`/`photo-grade.ts`(이미지 프롬프트 재료).
- 서버 짝: `lib/.server/media/skeleton7-image-set.ts`(4장 체이닝 생성, base64 레퍼런스), `gemini-image.ts`, `seedream-image.ts`, `r2.ts`, `video/*`.

### `app/lib/review/` + `app/utils/reviewGeneratedApp.ts` — 자동 검토
- `mechanical-checks.ts`(2,400줄): 결정적 검사 모음 → `runMechanicalChecks(files, hue)`가 finding + 자동수정 파일 반환. 시네마틱 게이트도 여기서 호출(`runCinematicSceneOrderCheck`). `isSkeleton7File`/`isCinematicTrackFile` 판정도 여기(media·review가 공유).
- `reviewGeneratedApp.ts`: 기계 검사 → 텍스트 검토(haiku) → 시각 검토(sonnet+스크린샷) → 파일 쓰기. `EXCLUDED_DIR_PREFIXES=['kit/']`.
- 힌트 finding의 `message`는 LLM에게 그대로 간다 — 문구 = 프롬프트다.

### `app/lib/common/prompts/` — 시스템 프롬프트
- `new-prompt.ts`: 빌드 모드 본문 + `SKELETON_7_SCREEN_CHECKLIST`(cinematic이면 킷 체크리스트로 스왑). `prompt-library.ts`가 `stream-text.ts`에 공급. `discuss-prompt.ts`: 대화 모드.
- 프롬프트 변경은 확률적 → 실생성 1런 + 게이트 통과율로 확인. 관련 메모: CRITICAL 규칙 수정 시 파일 전체에서 옛 문구 잔재 grep.

### `app/lib/onboarding/` → `PromptClarification.tsx`
- `question-bank.ts`(Q1 사용자/Q2 저장/Q3 업종 그리드/Q4 연동/Q5 팔레트), `answer-directives.ts`(answers → `{industry, skeleton, palette…}`), `mapIndustryToSkeleton.ts`(LLM 보조 매핑). `skeleton===7 || looksLikeShowcasePrompt()` → 시네마틱 트랙.

### `app/lib/cloud/` — 코랄레드 Cloud(생성 앱 백엔드)
- 토큰(`cloudToken.ts` HMAC, `CLOUD_APP_TOKEN_SECRET`), 인증(`cloudAuth.ts` Bearer + 레이트리밋), 문서 CRUD(`cloudDocuments.ts`), 프로비저닝(`cloudProvision.ts`), 클라이언트 템플릿(`coralred-storage.client-template.js` — 생성 앱에 주입되는 SDK), 플랫폼 인증(`cloudPlatformAuth.ts getPlatformUserId`), 사용량(`messageUsage.ts` → `message_usage`·`generation_usage_v2`), 온보딩 응답, UTM.
- 스펙 다수(`*.spec.ts`, 보안 spec). **API 계약 변경 = 이미 배포된 사용자 앱 호환성.**

### `app/utils/`
- `selectStarterTemplate.ts getBaselineTemplate(hue, {cinematic, darkTheme})`: 첫 아티팩트(baseline). `featureFlags.ts SHOW_DEV_TOOLS=false`(bolt 개발자 UI 전부 숨김). `logger.ts`(scoped logger; `debugLogger`는 브라우저 전용). `constants.ts`(`DEFAULT_MODEL='claude-sonnet-5'`, `WORK_DIR`).

### `kits/cinematic/`
- `src/` 21파일 — §HANDOFF 2. `demo/`(tsconfig, 로컬 데모), `package.json`(three·gsap·lenis 등 — knip이 "unlisted"라 하는 건 루트가 아니라 여기 선언돼서). typecheck: `npm run typecheck` (demo tsconfig).
- 변경 영향: 생성물 `src/kit/`(다음 생성부터), 하네스 스크린샷, `sceneOrder.ts` 동기화 spec. 서버 번들에는 영향 없음.

### `functions/`, `public/`
- `[[path]].ts`: Remix 서버 빌드 로드. `_middleware.ts`: Sentry pages plugin(모든 요청). `public/_routes.json`: `/assets/*`·정적 파일은 Function 우회 — **앱 라우트와 겹치는 접두사 추가 금지**. `public/inspector-script.js`: 프리뷰 iframe 내부 스크립트(위 workbench 참고).

### `supabase/migrations/` + `RUN-*.sql`
- 자동 적용 없음. 적용 여부는 `/api/health`의 `migrations`(테이블 존재만). 새 테이블 = SQL + `EXPECTED_TABLES` 추가.

### `tests/`
- `benchmark/cinematic`: §HANDOFF 3. `rubric.md`가 실측 로그. `benchmark/cssda`: 수상작 크롤·측정(`motion.mjs`가 기준값 출처). `skeleton7-dom/bundleAndRun.cjs`: TS 게이트를 노드에서 번들해 실행. `fixtures/generated/*.json`: 기계 검사 픽스처. `media/*`: 이미지·영상 생성 실험 스크립트(비용 발생).

## 2. 변경 → 영향 표 (자주 손대는 것)

| 바꾸는 것 | 반드시 함께 볼 곳 | 확인 방법 |
|---|---|---|
| 킷 컴포넌트 prop/export | `sceneOrder.ts` `KIT_COMPONENT_PROPS`/`KIT_EXPORTS`/`KIT_FILES`, `kit-prompt.ts` API 요약 | `npx vitest run app/lib/cinematic`(동기화 spec) |
| 킷 스타일/모션 | — | `AUDIT=1 renderGenerated.mjs`, `probeIdle`, cssda `motion.mjs` |
| 예약 URL 키 형식 | `r2.ts skeleton7ObjectKey`, `injectCinematicImages`, `sceneOrder`(경로 검사), `skeleton7PromptLines`, `api.media-video` 키 | `vitest app/lib/media app/lib/cinematic` |
| "settled" 액션 규칙 | `workbench.getUnsettledActions`, `Artifact.tsx allActionFinished` | `window.__ckUnsettled()` 프로덕션 |
| 자동 검토 힌트 문구 | 그 문구가 LLM에게 감 — 자리표시자·복사 가능한 예시 금지 | 실생성 1런 |
| `/api/chat` 메모리·동시성 | `skeleton7Images.ts` 시작 타이밍(`waitForQuietChat`) | 브라우저 콘솔 `fetch('/pricing')`×10 + cf-ray |
| 온보딩 질문/보기 | `answer-directives.ts`, `question-bank.spec.ts`(항목 수 고정), `mapIndustryToSkeleton` | vitest onboarding |
| 시스템 프롬프트 CRITICAL 규칙 | `new-prompt.ts` 전체 grep(옛 문구 잔재), `prompt-library.ts` | 실생성 1런 |
| 플랫폼 DB 테이블 | SQL + `api.health.ts EXPECTED_TABLES` + `lib/cloud/*` 타입 | `/api/health` |
| Cloud API 계약 | `coralred-storage.client-template.js`(생성 앱 SDK) + 보안 spec | `vitest app/lib/cloud` |
| 정적 파일 추가 | `public/_routes.json` exclude | curl `cf-cache-status` |
