# 문서 ↔ 코드 대조 감사 2026-09-22

대상: `HANDOFF.md`, `ARCHITECTURE.md`, `AI_HANDOFF.md`, `TESTING.md`, `docs/API.md`, `docs/DB-AUDIT-2026-09-22.md`, `README.md` vs HEAD `f8e5f268` 실제 코드. 중점: 인증/권한/RLS/API 키·시크릿 노출/사용자 데이터 격리/Cloud API/WebContainer/파일 업로드/생성 API/결제 API. **코드는 변경하지 않았고 문서만 고쳤다.** 각 항목의 "문서 수정"은 이 커밋에서 반영된 것.

프로덕션 실측은 `https://coralred.kr`에 GET 요청으로 상태 코드·응답 필드 이름·값 길이만 확인했다(비밀값은 기록하지 않음).

## CRITICAL

| # | 문제 | 근거(코드) | 문서 상태 → 수정 |
|---|---|---|---|
| C1 | **`GET /api/export-api-keys`가 인증 없이 서버 env의 프로바이더 API 키 실값을 반환한다.** 프로덕션 200, 응답 키 `Anthropic`(108자)·`Google`(53자). bolt.diy의 로컬 전용 기능이 그대로 배포됨. | `app/routes/api.export-api-keys.ts` — 쿠키 키 + `context.cloudflare.env[apiTokenKey]`를 그대로 `Response.json(apiKeys)`. 가드 없음. | 모든 문서가 "잔재, 제거 후보"로만 언급, 키 반환 사실 없음 → `API.md` 잔재 절 배너, `HANDOFF`/`AI_HANDOFF` 상단 배너 + 다음 할 일 #0, `ARCHITECTURE` 라우트 표, `README` 환경 변수 절. |

**즉시 조치(사용자)**: ① Anthropic·Google AI Studio에서 해당 키 폐기·재발급 ② `api.export-api-keys.ts` 삭제(또는 `functions/_middleware.ts`에서 `/api/export-api-keys` 404) ③ 재배포 ④ Pages 시크릿 교체. 이 키로 이미 발생한 사용량은 각 콘솔에서 확인.

## HIGH

| # | 문제 | 근거 | 문서 수정 |
|---|---|---|---|
| H1 | `GET/POST /api/git-proxy/<domain>/<path>`가 인증 없는 범용 HTTPS 프록시(프로덕션 `example.com` 200). 남용·SSRF·평판. | `api.git-proxy.$.ts` — `https://${domain}/${path}`로 fetch, 헤더 일부 전달, 본문 반환. | `API.md` 잔재 절, `AI_HANDOFF` 알려진 문제 7. |
| H2 | 생성·미디어 라우트에 **인증·쿼터·레이트리밋 없음**: `/api/chat`, `/api/llmcall`, `/api/media-images`, `/api/media-video`. 한도는 클라이언트 `freeTrial.ts`(게스트는 `localStorage`)만. 문서는 "세션 선택"이라 써서 인증이 있는 것처럼 읽혔다. | 각 라우트에서 `getPlatformUserId`는 과금 userId 조회에만 쓰이고 null이어도 진행. | `API.md` 인증 종류 정의·각 라우트·구조 메모 1, `AI_HANDOFF` API 표·계정 절. |
| H3 | **미디어 `jobId` 소유 검증 없음** → 배포된 사이트의 이미지 URL에서 jobId를 읽어 같은 jobId로 생성 POST를 보내면 R2 `media/<jobId>/*.jpg`를 덮어쓸 수 있다(키가 결정적). 영상 폴링은 `taskId`도 클라이언트 값. | `api.media-images.ts:88`(형식만 검사), `r2.ts skeleton7ObjectKey`, `api.media-video.ts` GET `copyVideoToR2(state.videoUrl, …, media/${jobId}/…)`. | `API.md` media-images/video. |
| H4 | **커스텀 도메인 앱은 Cloud 저장을 못 쓴다**: `cloud-set-origin`이 `https://*.pages.dev`만 허용, 저장 API는 `Origin === deploy_origin` 정확 일치. 문서 어디에도 없음. | `api.cloud-set-origin.ts PAGES_DEV_ORIGIN_REGEX`, `cloudAuth.ts origin !== app.deploy_origin`. | `API.md` set-origin·domain, `AI_HANDOFF` 알려진 문제 8. |
| H5 | **PortOne 결제 UI가 없다.** `AI_HANDOFF`는 "PortOne 결제 UI 있음", `README`(구)·`ARCHITECTURE`는 `pricing.tsx`가 결제 라우트를 호출한다고 했으나 `pricing.tsx`에 PortOne SDK·`requestPayment` 없음(버튼은 `/` 링크). `PORTONE_STORE_ID`/`PORTONE_CHANNEL_KEY`는 코드에서 읽지 않는다. `api.payment.verify` 호출자 없음. | `grep -rn portone app` → verify/webhook 라우트와 주석 1곳뿐. | `AI_HANDOFF` 구현/미구현/환경변수, `ARCHITECTURE` 라우트 표, `API.md` verify. |

## MEDIUM

| # | 문제 | 근거 | 문서 수정 |
|---|---|---|---|
| M1 | 세션 검증은 **`Authorization: Bearer` 헤더만** — 문서는 "또는 쿠키". | `cloudPlatformAuth.ts` | `API.md` 인증 정의, `AI_HANDOFF` Auth, `HANDOFF` §6. |
| M2 | 로그인 수단은 **Google·Kakao OAuth + 이메일 OTP**. 문서는 "Google·Kakao·GitHub OAuth". | `lib/stores/auth.ts` `signInWithGoogle/Kakao`, `signInWithOtp`. | `AI_HANDOFF` 2곳. |
| M3 | Cloud 문서 격리는 `app_id`+`device_key`(클라이언트 UUID)뿐, 사용자 인증 없음. 앱 토큰은 `VITE_CLOUD_APP_TOKEN`으로 배포 번들에 들어가는 **공개값**, `Origin`은 브라우저 밖에서 위조 가능 → 격리 근거는 device_key 추측 불가성. 설계대로지만 문서에 없었다. | `cloudDocuments.ts` 상단 주석, `CloudflareDeploy.client.tsx:120`, `coralred-storage.client-template.js getDeviceKey`. | `API.md` Cloud 절, `ARCHITECTURE` cloud 절. |
| M4 | **fail-open 3곳**: 배포 소유권 `isProjectOwnedByOther`(env 미설정·RPC 오류 → false=통과), Cloud 레이트리밋 `checkCloudRateLimit`(RPC 오류 → 통과), `getPlatformUserId`(env 미설정 → 게스트). | `deployedAppOwnership.ts`, `cloudAuth.ts` 하단, `cloudPlatformAuth.ts`. | `API.md` 구조 메모 7, deploy/domain/cloud 절. |
| M5 | Cloud 응답 형식이 문서와 다름: 목록 `{items,nextCursor}`(문서 `{documents}`), 생성/조회 `{id,data,createdAt,updatedAt}` 평면(문서 `{document}`), DELETE 204 무본문(문서 `{ok:true}`), 413(64KB)·507(쿼터)·403(만료/미배포) 누락, 쿼터를 429로 잘못 표기. "절대 건드리면 안 되는 계약"이 틀린 형식으로 적혀 있었다. | `cloudDocuments.ts`, `cloudResponses.ts`. | `API.md` Cloud 절, `AI_HANDOFF` 금지 목록. |
| M6 | 클라이언트가 `[Provider: X]`/`[Model: Y]` 태그로 프로바이더·모델을 고르며, 서버 env에 키가 있는 프로바이더(Anthropic·Google)면 어떤 모델이든 플랫폼 비용으로 호출 가능. 쿠키 `apiKeys`는 프로덕션에서 무시(문서는 입력으로만 기술). | `stream-text.ts:125-140`, `base-provider.ts:93-96`(`SHOW_DEV_TOOLS` 분기). | `API.md` chat 입력. |
| M7 | `api.payment.verify`의 금액·통화 검증은 클라이언트가 보내는 `expectedAmount/expectedCurrency`에 의존하고 없으면 생략; `paymentId`–사용자 결속 없음. 문서는 입력을 `{paymentId}`로만. | `api.payment.verify.ts:59-96`. | `API.md` verify. |
| M8 | 탈퇴가 지우지 않는 것: Cloud `cloud_apps`(`owner_user_id`는 FK 아님)·`cloud_documents`, R2 `media/*`, Pages 프로젝트. 문서는 플랫폼 FK cascade만 기술. | `api.account-delete.ts`, `RUN-3-cloud.sql`. | `API.md` account-delete, `DB-AUDIT` 2-3, `AI_HANDOFF` 알려진 문제 8. |
| M9 | `DB-AUDIT`가 `generation_usage_v2` 코드 참조에 `api.chat.ts`(RPC)를 넣었으나 서버는 이 테이블을 읽거나 쓰지 않는다(클라이언트 `freeTrial.ts`만). | `grep increment_generation_count_v2 app` | `DB-AUDIT` 표. |
| M10 | 502를 여전히 쓰는 라우트(`media-video`, `cloudflare-deploy`, `cloudflare-domain`, `payment/verify`) — 구조 메모 4는 "500/402로 낸다"로 일반화돼 있었다. deploy의 409(이미지 미도달)·파일 크기 400도 누락. | 각 라우트 `status: 502`, `api.cloudflare-deploy.ts:123`, `cloudflarePages.ts` 25MB/20MB/200파일. | `API.md`. |

## LOW

| # | 문제 | 근거 | 문서 수정 |
|---|---|---|---|
| L1 | `api.check-env-key`(어느 프로바이더 키가 설정됐는지 200), `api.system.diagnostics`(토큰 유무·nodeEnv 200) 정보 노출. | 프로덕션 실측. | `API.md` 잔재 절. |
| L2 | `deployed_app_project_owned_by_other` RPC가 `anon` execute 허용 → anon 키로 프로젝트명 소유 여부 조회 가능. | `20260826000000_*.sql:28`. | `API.md` 구조 메모 8, `DB-AUDIT` 2-3. |
| L3 | `cloud-provision` 만료 7일, `cloud-set-origin`이 배포 시 30일로 연장, set-origin 출력에 `expiresAt` 포함 — 문서 누락. | `cloudProvision.ts FREE_TIER_DAYS/DEPLOYED_TIER_DAYS`. | `API.md`. |
| L4 | `RUN-*.sql` 위치가 `supabase/migrations/manual/`인데 `ARCHITECTURE`·`AI_HANDOFF`는 "루트 RUN-*.sql". Cloud 스키마 정본이 `supabase/migrations/`에 없다는 점도 명시 안 됨. | 파일 트리. | 두 문서. |
| L5 | `VITE_KAKAO_JS_KEY`는 플랫폼이 아니라 생성 앱용(프롬프트 예시)인데 플랫폼 env로 기재. `.env.example`(이 커밋)에도 같은 주석 — 코드가 아니라 `.env.example` 주석이므로 다음 커밋에서 정정 대상. | `new-prompt.ts:584,942`만 참조. | `AI_HANDOFF` 환경변수. |
| L6 | `AI_HANDOFF` "`.env.example` 최신화: 27개 누락"은 이 커밋(f8e5f268)에서 해결됨 — 미구현 목록에서 제거. | `.env.example` | `AI_HANDOFF`. |
| L7 | `Chat.client.tsx` 1,400줄 → 실제 1,666줄. | `wc -l` | `HANDOFF` 표. |
| L8 | `HANDOFF` §0 "막힌 것: Gemini 크레딧 소진"은 시점 정보(충전 여부는 코드로 확인 불가) — 확인 방법으로 바꿈. | — | `HANDOFF` §0, §7. |
| L9 | `TESTING.md`가 보안 경계(잔재 라우트 열림, 인증 없는 비용 라우트, jobId 소유권)는 어떤 테스트도 안 잡는다는 점을 안 적었다. | `routes.contract.spec.ts` 범위 = 코랄레드 고유 14개. | `TESTING.md` "못 잡는 것". |
| L10 | `api.payment.verify`·`webhook`의 405는 텍스트 응답(`Method not allowed`) — JSON `{error}`가 아님. | 라우트 상단. | `API.md` verify. |

## 문서와 코드가 일치함을 확인한 것(변경 없음)

- `getUnsettledActions`/`Artifact.tsx` settled 규칙, `restartDevServer` 2회 후 새 탭 안내(`Chat.client.tsx:1400`), `devServerHealth` `The service was stopped`만 사망.
- `kits/cinematic/src` 21파일, `mechanical-checks.ts` ~2,400줄, vitest 98파일/891, e2e 18검사, CI `e2e-smoke` 잡, pre-push vitest 전체.
- `api.health EXPECTED_TABLES` 5개, 플랫폼 FK cascade/set null 목록, 플랫폼 RLS(`auth.uid()=user_id` select + service role/RPC 쓰기).
- Cloud 토큰 `appId.iat.sig` HMAC-SHA256, DB에는 sha256만, 상수시간 비교, R2 키 형식, 64KB/깊이 8/배열 1000 제한, 컬렉션 정규식, 앱 5개 한도.
- 코드 ZIP 내보내기가 실제 `.env`/`.env.*`를 제외하고 `.env.example`만 넣는 것(`workbench.ts:938-974`).
- `public/_routes.json` exclude 목록, Sentry `_middleware.ts`(`SENTRY_DSN`), `.env.example`에 실키 없음.
- `Anthropic`·`Google` 프로바이더는 쿠키 `providerSettings.baseUrl`을 무시한다(키가 남의 baseUrl로 새는 경로는 없음 — 다른 프로바이더는 env 키가 없어 무관).

## 추가로 발견된 문제(문서 범위 밖, 코드 수정 필요 — 이번엔 손대지 않음)

1. **C1 키 유출**(위). 코드 한 줄 삭제로 끝나지만 키 재발급이 선행.
2. `api.git-proxy.$.ts` 범용 프록시(H1) — 라우트 삭제 대상.
3. 미디어 라우트 `jobId` 소유 검증 없음(H3) — 예약 시 발급한 jobId를 서버가 기억(KV/DB)하거나 jobId에 HMAC을 붙여 생성 요청에서 검증해야 한다.
4. 커스텀 도메인 + Cloud 저장 조합 불가(H4) — `cloud_apps.deploy_origin`을 복수 허용하거나 `cloudflare-domain` 성공 시 갱신.
5. `isProjectOwnedByOther`·`checkCloudRateLimit` fail-open(M4) — 최소한 Sentry 경고.
6. `deployed_app_project_owned_by_other` anon execute(L2) — `authenticated`만으로 좁히려면 서버가 anon 키 대신 service role로 호출해야 한다.
7. 탈퇴 시 Cloud/R2/Pages 잔존(M8) — 탈퇴 라우트에 Cloud `cloud_apps` 삭제(+cascade) 추가.
8. `api.payment.verify` 금액 검증을 서버 상수(요금제 표)로(M7) — 결제 UI가 생길 때.
9. `preflightResponse`가 임의 `Origin`을 반영(설계상 무해하다고 주석) — 실제 요청은 정확 일치 검사하므로 데이터 유출은 없음. 기록만.

## 확인하지 못한 부분

- **PortOne 대시보드**에 웹훅 URL이 등록돼 있는지(등록돼 있어도 서버는 no-op).
- **Cloud Supabase 프로젝트**(`fsnqxknb…`) 상태 — DNS 해석 불가 상태 그대로. RUN-3/4가 라이브에 적용됐는지, RLS 정책이 실제로 있는지 라이브 대조 불가.
- **플랫폼 라이브 RPC 본문**(`increment_generation_count_v2`가 0831 버전인지) — `pg_get_functiondef` 필요.
- **Cloudflare Pages 시크릿 목록**과 코드가 읽는 이름의 일치(`wrangler pages secret list`는 사용자 실행 필요). `export-api-keys` 응답으로 `ANTHROPIC_API_KEY`·`GOOGLE_GENERATIVE_AI_API_KEY`가 설정된 것만 간접 확인.
- **Gemini 크레딧 잔량**(실생성 없이는 모름).
- **WebContainer 안**의 동작(7회 후 esbuild 사망, 온보딩 20~40초 지연)은 실측 로그(`rubric.md`) 기준이며 이번에 재현하지 않음.
- **Sentry**가 실제로 이벤트를 받는지(DSN 값·프로젝트는 대시보드).
- `api.export-api-keys`로 유출된 키가 **외부에서 이미 사용됐는지** — Anthropic/Google 콘솔의 사용량·IP 로그로만 확인 가능.
- 잔재 라우트 중 `api.supabase.query`(body 토큰으로 임의 Supabase에 SQL 실행 프록시), `api.mcp-update-config`, `api.web-search`(외부 검색 API 키 유무)는 프로덕션에서 400만 확인, 내부 동작은 읽지 않음.
