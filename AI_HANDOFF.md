# CoralRed AI Handoff

다른 AI 개발자(GPT/Codex 등)에게 넘기는 인수인계. **실제 코드 기준**, HEAD `af93b2c6` (2026-09-22). 더 깊은 내용: `HANDOFF.md`(함정·절차), `ARCHITECTURE.md`(폴더별 담당·호출자·영향), `docs/AUDIT-2026-09-22.md`(결함 목록).

## 현재 상태 — 구현되어 있는 기능

- **한국어 프롬프트 → React 앱 생성**: 온보딩 5문항(누가 쓰나/저장 방식/업종/연동/팔레트) → Claude(`claude-sonnet-5`) 스트리밍 → WebContainer(브라우저 안 Node)에서 `npm install && npm run dev` → 즉시 미리보기. `app/components/chat/Chat.client.tsx`.
- **디자인 킷 2종 주입**: 모든 앱에 `design-handoff/coralred-ui.css`(`.cr-*` 클래스, `--hue` 토큰). 소개·홍보형(업종 "브랜드 소개·포트폴리오" 또는 프롬프트에 소개/포트폴리오 류 단어)이면 **시네마틱 킷**(`kits/cinematic/src` 21파일 → 생성물 `src/kit/`; Lenis+GSAP 스크롤 스냅·핀 챕터, WebGL 히어로, three.js 3D 쇼케이스, 커스텀 커서). 킷 v0.4(어워드급 구도·모션 감사 반영).
- **AI 사진·영상 자동 생성**: 생성 전에 R2 URL 4장(hero, ch1~3)+영상 1개를 예약해 프롬프트에 넣고, chat 스트림이 끝난 뒤 Gemini(`gemini-3.1-flash-image`)로 4장 체이닝 생성 → R2 업로드, Seedance/Kling으로 히어로 루프 영상. 모델이 URL을 무시하면 정규식 주입기가 갈아끼움(`app/lib/media/`).
- **자동 검토·자동 수정**: 첫 렌더 뒤 기계 검사(`mechanical-checks.ts` — 이모지·색 리터럴·타이포·시네마틱 장면 게이트 등) → Haiku 텍스트 검토 → Sonnet 시각 검토(스크린샷) → 파일 자동 수정. 프리뷰 런타임 에러는 무과금 자동 수정 2회.
- **계정·과금**: Supabase Auth(Google·Kakao·GitHub OAuth). 게스트 월 1건, Free 계정 월 10건(RPC `get_generation_status_v2`/`increment_generation_count_v2`가 단일 소스). 요금제 Free 0 / Light 9,900 / Pro 29,900 / Max 79,900원(월 메시지 10/35/100/300) — PortOne 결제 UI 있음.
- **코랄레드 Cloud(생성 앱용 백엔드)**: 생성 앱이 "저장 기능 켜기"를 하면 앱 토큰(HMAC)을 발급하고 `/api/cloud/:appId/:collection[/:docId]` 문서 CRUD, 레이트리밋, 쿼터 RPC 제공. 생성 앱에는 `coralred-storage.client-template.js` SDK가 주입됨.
- **배포**: 생성 앱을 Cloudflare Pages로 배포 + 커스텀 도메인 연결(`api.cloudflare-deploy.ts`, `api.cloudflare-domain.ts`), "Made with Coralred" 배지 주입. 코드 ZIP 내려받기.
- **운영**: Sentry(Pages 미들웨어), `/api/health`(마이그레이션 테이블 존재 검사), 온보딩 응답·UTM 저장, 사용량 로깅(`message_usage`).
- **품질 하네스**(`tests/benchmark/cinematic`): 생성물 빌드·장면별 스크린샷·타이포 수치·모션 측정(CSSDA 수상작 90개와 같은 잣대)·유휴 모션·리빌 회귀 프로브. 실측 로그 `rubric.md`.

## 아직 안 된 것 — 미구현

- **결제 서버 검증**: `api.payment.webhook.ts:32` 웹훅 서명 미검증, `pricing.tsx`가 `api.payment.verify` 안 부름. 결제해도 요금제가 계정에 반영되는 경로 없음(티어 조회 자체가 없음 → `TODO_IS_PRO_USER=false`, 배지 무조건).
- **Light/Pro/Max 한도 적용**: RPC는 Free 10건만. 유료 플랜 한도·"수정 메시지 차단" 정책은 `feat/access-policy` 브랜치(1커밋, 미병합, RUN-7 SQL 미적용).
- **사용자 사진 업로드로 시네마틱 채우기**: 지금은 AI 생성 사진만. 실사 인물은 정책상 금지(그림체만 허용).
- **미디어 생성 별도 Worker 분리**: 지금은 순서 조정(`waitForQuietChat`)으로 격리체 겹침을 피함.
- **`.env.example` 최신화**: 실사용 키 27개 누락.
- **온보딩 전환 지연 해결**(20~40초, WebContainer 부팅과 경합).
- **bolt.diy 잔재 제거 결정**: GitHub/GitLab/Netlify/Vercel 배포, 로컬 모델, MCP, 설정 패널 43파일, 잔재 API ~30개(`SHOW_DEV_TOOLS=false`로 UI만 숨김, URL은 열림).

## 알려진 문제 — 현재 버그

1. **Google AI Studio 선불 크레딧 소진** → `/api/media-images` 402 `provider_billing`. 이미지·영상 전부 실패. 충전 필요(코드 문제 아님). 그 전엔 예약 사진 주입이 end-to-end로 검증 안 됨(마지막 성공 검증 09-18).
2. **Worker 격리체 128MB**: `/api/chat` 스트림과 이미지 생성이 같은 격리체에서 겹치면 둘 다 죽고 그 엣지 머신 SSR이 `Worker exceeded resource limits` 503 지속. 지금은 순서로 회피. 재발 시 같은 코드 재배포로 리셋(격리체 교체).
3. **온보딩 단계 전환 20~40초** 프리즈(WebContainer boot가 메인 스레드 점유).
4. **한 탭에서 생성 ~7회 뒤 WebContainer esbuild 사망**(`The service was stopped`) → 자동 재시작 2회 후 "새 탭" 안내. 새 탭이면 정상.
5. **모델 편차**(확률적, 게이트가 잡아 자동 수정으로 돌림): 킷 파일 단위 import, 루트 경로 미디어, 지어낸 prop/컴포넌트, 예약 URL 대신 스톡 사진.
6. 빌드 경고: `sentryHandleError` import-is-undefined(클라 번들, 무해).
7. 잔재 API(`api.system.disk-info`, `api.update`, `api.mcp-update-config`, `api.web-search`) 인증 없이 열려 있음. `disk-info`는 Cloudflare에서 `child_process` 없어 죽은 코드.

## 기술 스택

- **Frontend**: React 18.3 + Remix 2.15(Vite 5.4) SSR, TypeScript 5.7, nanostores 상태, UnoCSS/Tailwind 유틸, CodeMirror 6 에디터, xterm 터미널, `@webcontainer/api` 1.6(프리뷰 런타임). 킷: GSAP·Lenis·three/@react-three/fiber.
- **Backend**: Cloudflare Pages Functions(Worker, `nodejs_compat`) — Remix 라우트 `app/routes/api.*.ts`. LLM은 Vercel AI SDK `ai` 7.0 + `@ai-sdk/anthropic`(기본 `claude-sonnet-5`, 검토 `claude-haiku-4-5`). 이미지 Gemini REST, 영상 Seedance(ARK)/Kling, 저장 Cloudflare R2(aws4fetch S3 서명).
- **Database**: Supabase Postgres 2개 프로젝트 — **플랫폼**(`VITE_PLATFORM_SUPABASE_*`: 계정·사용량·온보딩·UTM·배포 기록)과 **Cloud**(`CLOUD_SUPABASE_*`: 생성 앱 데이터 `cloud_apps`/`cloud_documents`). 마이그레이션은 SQL 수동 적용.
- **Auth**: Supabase Auth OAuth(Google, Kakao, GitHub) → 플랫폼 세션(`getPlatformUserId`). 생성 앱 → Cloud API는 HMAC 앱 토큰(`CLOUD_APP_TOKEN_SECRET`) Bearer.
- **Deployment**: `npm run deploy` = `remix vite:build` + `wrangler pages deploy build/client --project-name=coralred --branch=coralred`. 프로덕션 `coralred.kr`(구 서브도메인 `bolt-air.pages.dev`). Sentry `@sentry/cloudflare`. 정적 파일은 `public/_routes.json`으로 Function 우회. 생성 앱 배포도 Cloudflare Pages(사용자별 프로젝트).

## 주요 폴더

```
app/routes/            페이지(_index, chat.$id, apps, pricing, guide, login…) + api.*.ts (Worker 엔드포인트)
app/components/chat/   생성 UX — Chat.client.tsx(오케스트레이션 전부), PromptClarification(온보딩), Artifact(진행 카드)
app/components/workbench/ 에디터·프리뷰(Preview.tsx ↔ public/inspector-script.js postMessage)·터미널
app/lib/cinematic/     시네마틱 트랙: kit-prompt(11장면 순서), seedKit, isCinematicProject, sceneOrder(게이트)
app/lib/media/         예약 사진 오케스트레이션(skeleton7Images), 주입기(injectCinematicImages), 프롬프트 줄
app/lib/.server/       서버 전용: llm(stream-text, provider-error 402), media(gemini/seedream/r2/video)
app/lib/review/ + app/utils/reviewGeneratedApp.ts  자동 검토(기계 검사 → LLM 검토 → 파일 수정)
app/lib/runtime/       message-parser(boltArtifact/boltAction) → action-runner(파일 write·shell·dev 서버)
app/lib/stores/        workbench(액션 큐·getUnsettledActions), files, chat, palette, devServerHealth
app/lib/cloud/         코랄레드 Cloud: cloudAuth/cloudToken/cloudDocuments/cloudProvision, messageUsage, 클라 SDK 템플릿
app/lib/onboarding/    question-bank → answer-directives(industry/skeleton/palette)
app/lib/common/prompts new-prompt(빌드 모드, 체크리스트 스왑), discuss-prompt
kits/cinematic/        킷 원본(자체 package.json, demo). 생성물 src/kit/으로 복사
functions/             Pages Functions 진입([[path]].ts Remix, _middleware.ts Sentry)
public/                _routes.json, inspector-script.js, 정적 에셋
design-handoff/        브랜드·문구 정본, coralred-ui.css
supabase/migrations/ + RUN-*.sql  DB SQL(수동 적용)
tests/benchmark/cinematic  렌더·모션·디테일 하네스, rubric.md(실측 로그)
tests/benchmark/cssda      수상작 측정 도구(기준값 출처)
docs/reports/          과거 작업 보고서(역사)
```

## 주요 API

전체 목록(목적·입력·출력·인증·DB·AI·에러)은 `docs/API.md`.

코랄레드 고유(전부 `app/routes/`):

| 엔드포인트 | 역할 | 인증 |
|---|---|---|
| `POST /api/chat` | LLM 스트리밍 생성·수정. 쿠키 apiKeys/providers, 과금 기록 | 플랫폼 세션(과금), 게스트 허용(월 1) |
| `POST /api/llmcall` | 단발 LLM(자동 검토·업종 매핑). 결제 오류 402 `provider_billing` | 세션 |
| `POST /api/media-images` | `{reserve:true, jobId}` → URL 예약 / `{jobId, industry, prompt, accentHex, darkPalette, chatId}` → Gemini 4장→R2. 실패 500, 결제 402 | 세션 |
| `POST/GET /api/media-video` | 영상 작업 생성 / 폴링(`?jobId&taskId&provider&chatId`) → R2 URL | 세션 |
| `POST /api/onboarding`, `POST /api/utm-attribution` | 온보딩 응답·UTM 저장 | 세션/익명 |
| `POST /api/cloud-provision` | 생성 앱에 Cloud 백엔드 발급(앱 토큰) | 세션 |
| `/api/cloud/:appId/:collection[/:docId]` (GET/POST/PATCH/DELETE), `POST /api/cloud-set-origin` | 생성 앱 데이터 CRUD, 레이트리밋 | 앱 토큰 Bearer |
| `POST /api/cloudflare-deploy`, `POST /api/cloudflare-domain` | 생성 앱 배포·커스텀 도메인 | 세션 |
| `POST /api/payment/verify`, `POST /api/payment/webhook` | PortOne 검증·웹훅(**서명 미검증**) | — |
| `POST /api/account-delete` | 탈퇴 | 세션 |
| `GET /api/health` | 마이그레이션 테이블 존재 맵 | 공개 |
| `GET /api/models`, `GET /api/configured-providers` | 모델 목록(UI는 숨김) | 공개 |

bolt 잔재(UI 숨김, URL 열림, 제거 후보): `api.git-*`, `api.github-*`, `api.gitlab-*`, `api.netlify-*`, `api.vercel-*`, `api.supabase*`, `api.mcp-*`, `api.system.*`, `api.update`, `api.web-search`, `api.enhancer`, `api.check-env-key`, `api.export-api-keys`.

## DB 구조

**플랫폼 Supabase** (`supabase/migrations/`, `RUN-1,2,5,6.sql`)
- `generation_usage_v2` — 계정/게스트별 `month_count`, `day_count`(폐지) 등. RPC `get_generation_status_v2`, `increment_generation_count_v2`(한도 10의 단일 소스).
- `message_usage` — 메시지별 토큰·모델·`isAutoFix`·`imageCost`(RUN-6 media cost). `messageUsage.ts recordMessageUsage`.
- `deployed_apps` — 사용자별 Cloudflare 프로젝트 소유. RPC `deployed_app_project_owned_by_other`, 트리거 `set_deployed_apps_user_id`.
- `onboarding_responses`, `utm_attribution`.
- 헬스 검사 대상 5개: `generation_usage_v2, deployed_apps, message_usage, onboarding_responses, utm_attribution`.

**Cloud Supabase** (`RUN-3-cloud.sql`, `RUN-4-cloud-apps-rls-policy.sql`)
- `cloud_apps`(앱 id, 토큰 해시, origin), `cloud_documents`(appId·collection·docId·jsonb), `cloud_rate_limit`, `cloud_usage`. RPC `cloud_check_rate_limit`, `cloud_enforce_quota`, `cloud_track_usage_*`, `cloud_expire_cleanup`. RLS 정책 RUN-4.

라이브 드리프트(2026-09-22 실측): `deployed_apps`에 `storage_mode/storage_expires_at` 없음(코드 폴백 운영), v1 잔재 `user_generation_usage`·RPC 2개·`rls_auto_enable` 존재, **Cloud 프로젝트 DNS 해석 불가**. 정리 마이그레이션 `supabase/migrations/20260922000000_*_safe.sql`(추가만) / `…_destructive.sql.pending`(사용자 승인 후). 상세 `docs/DB-AUDIT-2026-09-22.md`. RUN-*.sql은 `supabase/migrations/manual/`로 이동.

## 환경변수

플랫폼(필수): `ANTHROPIC_API_KEY`, `VITE_PLATFORM_SUPABASE_URL`, `VITE_PLATFORM_SUPABASE_ANON_KEY`, `PLATFORM_SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN`
Cloud 백엔드: `CLOUD_SUPABASE_URL`, `CLOUD_SUPABASE_SERVICE_KEY`, `CLOUD_APP_TOKEN_SECRET`
미디어: `GOOGLE_GENERATIVE_AI_API_KEY`(Gemini; `.env`의 `GEMINI_API_KEY`는 미사용), `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_BASE_URL`, `VIDEO_PROVIDER`(seedance|kling), `ARK_API_KEY`, `KLING_API_KEY`/`KLING_ACCESS_KEY`/`KLING_SECRET_KEY`, 선택 `IMAGE_PROVIDER=seedream`, `SEEDREAM_MODEL`
배포·도메인: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
결제: `PORTONE_STORE_ID`, `PORTONE_CHANNEL_KEY`, `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET`
기타: `VITE_KAKAO_JS_KEY`, `VITE_DISABLE_PERSISTENCE`, 잔재 `GITHUB_TOKEN`·`NETLIFY_TOKEN`·`OPENAI_API_KEY`
프로덕션 값은 Cloudflare Pages 프로젝트 `coralred` 환경변수. 로컬은 `.env`(`.env.example`은 미갱신). 서버 코드는 `env?.X || process.env.X` 패턴.

## 현재 작업 중인 부분

- 브랜치 `feat/media-gen`(main과 동일 HEAD). **실생성 검증 대기**: 2026-09-20 3런에서 찾은 결함(stall 원인 `start:aborted`, 파일 단위 import, 루트 경로 미디어, `<jobId>` 자리표시자 복사, 스트림 중 이미지 생성 금지, 숨은 iframe 스크린샷)은 전부 수정·배포됐지만, Gemini 크레딧 소진으로 **예약 사진이 프리뷰에 뜨는 것**은 아직 눈으로 재확인 못 함.
- 킷 v0.4 결과물을 실생성에서 확인하는 것(하네스로는 확인됨).
- 디버그 훅: 프로덕션 콘솔 `window.__ckUnsettled()`(멈춘 액션), `fetch('/pricing')`×10 + `cf-ray`(병든 머신 판별).

## 테스트

뭔가 고치면 `pnpm run check`(typecheck·lint·vitest 890+·build) → 커밋, `pnpm run check:full`(+ e2e 스모크: 랜딩→만들기→온보딩, 요금제·가이드·약관·로그인, health, 정적 에셋) → 배포. 새 라우트는 `tests/api/routes.contract.spec.ts`, 새 페이지는 `tests/e2e/smoke.mjs`에 한 줄. 상세 `TESTING.md`.

## 절대 건드리면 안 되는 부분

- **Cloud API 계약**(`/api/cloud/*` 응답 형식, `coralred-storage.client-template.js`, 앱 토큰 형식) — 이미 배포된 사용자 앱이 이걸 부른다. 바꾸면 남의 사이트가 죽는다.
- **R2 키 형식** `media/<jobId>/{hero,ch1,ch2,ch3}.jpg`, `hero-<provider>.mp4` — 예약 URL·주입기·게이트·프롬프트 줄·영상 라우트가 전부 이 형식을 전제.
- **`generation_usage_v2` RPC와 한도 값(10)** — 클라이언트에 상수 두지 말 것, RPC가 단일 소스.
- **이미지 생성 시작 타이밍**: chat 스트림 중에 `/api/media-images` 생성 POST를 보내면 격리체가 죽는다. `startSkeleton7ImageSet`/`waitForQuietChat` 경로만 사용.
- **`getUnsettledActions`와 `Artifact.tsx allActionFinished`의 "settled" 규칙**(complete, 또는 start의 running/aborted) — 두 곳이 같아야 stall 오탐이 안 난다.
- **LLM에게 가는 문구에 자리표시자(`<jobId>`, `{x}`) 금지** — 모델이 그대로 URL에 복사한다. 게이트 힌트·프롬프트 줄 모두.
- **`public/_routes.json`** — 앱 라우트(`/apps`, `/brief`, `/chat`, `/guide`, `/login`, `/pricing` …)와 겹치는 exclude 추가 금지.
- **`kits/cinematic/src`의 export 목록** — 바꾸면 `sceneOrder.ts`의 `KIT_EXPORTS`/`KIT_FILES`/`KIT_COMPONENT_PROPS`와 spec을 같이 고쳐야 한다(동기화 테스트가 막아준다).
- **`app/lib/cinematic/kit-files.ts`는 클라이언트 전용**(`?raw` import) — 서버 코드에서 import하면 빌드가 깨진다.
- 사진 정책: **실사 AI 인물 금지**. 이미지 프롬프트에 사람을 넣으려면 비사진 스타일 락 필수.
- 한국어 UI 문구는 `design-handoff/coralred-voice.md` 규칙(해요체, 개발 용어 금지).

## 앞으로 만들 예정

1. Gemini 크레딧 충전 후 실생성 재검증 → 시네마틱 트랙을 기본 경로로 확정.
2. 결제 완결: 웹훅 서명 검증, `pricing.tsx` 서버 검증 호출, 계정 티어 저장 → Light/Pro/Max 한도·배지·커스텀 도메인 게이트(`feat/access-policy` 병합 + RUN-7).
3. 사용자 실사진 업로드 → 시네마틱 킷에 배치(AI 사진 대체).
4. 미디어 생성 별도 Worker/큐로 분리(격리체 문제 구조적 해결).
5. 온보딩 전환 지연 해결(WebContainer boot 지연 로드).
6. bolt.diy 잔재 제거(설정 패널·잔재 API·dep ~20) — `docs/AUDIT-2026-09-22.md` 우선순위 #3.
7. CSSDA 제출용 플래그십 사이트 1개(실제 고객 사진) — 목표 8.5~8.9 tier, "Made with Coralred" 크레딧.
