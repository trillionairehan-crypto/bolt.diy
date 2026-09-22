# CoralRed API 목록

실제 코드 기준(`app/routes/api.*.ts`, HEAD `f8e5f268`, 2026-09-22 코드 대조 완료 — 불일치 목록은 `docs/DOC-VS-CODE-AUDIT-2026-09-22.md`). Remix 라우트 = Cloudflare Worker 핸들러. 응답은 전부 JSON(`{ error: string }`이 실패 형식, 일부 잔재는 텍스트).

**인증 종류**
- `세션` = 플랫폼 Supabase JWT, **`Authorization: Bearer <access_token>` 헤더만**(쿠키 안 읽음) → `getPlatformUserId(request)`. 플랫폼 anon 키로 `auth.getUser(jwt)` 검증. 헤더 없음·검증 실패·`VITE_PLATFORM_SUPABASE_*` 미설정이면 전부 null(게스트). "세션 선택"인 라우트는 **인증 없이 누구나 호출 가능**하고 userId는 과금 기록에만 쓰인다.
- `앱 토큰` = 코랄레드 Cloud HMAC 앱 토큰(`Authorization: Bearer <token>`) → `authenticateCloudRequest`. 생성 앱(배포된 사용자 사이트)이 부른다.
- `소유 토큰` = 앱 토큰 + 소유자 검증(`verifyCloudAppOwnerToken`).
- `공개` = 없음.

**DB 표기**: `P:` 플랫폼 Supabase, `C:` Cloud Supabase. 이름은 실제 테이블/RPC.

---

## 생성 (LLM)

### `POST /api/chat`
- **목적**: 앱 생성·수정의 본체. 시스템 프롬프트 선택(빌드/대화, 시네마틱 체크리스트 스왑), Claude 스트리밍, 컨텍스트 최적화, 토큰 한도 시 자동 continue, 스톨 재시도, 과금 기록.
- **입력**(JSON): `messages[]`(UI 메시지), `files`(파일맵), `promptId?`, `contextOptimization?`, `chatMode: 'build'|'discuss'`, `designScheme?`, `supabase?{isConnected, hasSelectedProject, credentials{anonKey, supabaseUrl}}`, `maxLLMSteps?`, `chatId`. 쿠키 `apiKeys`, `providers`는 파싱되지만 **프로덕션(`SHOW_DEV_TOOLS=false`)에서는 `apiKeys` 무시**(`base-provider.ts getProviderBaseUrlAndKey` — 서버 env 키만 사용). 모델·프로바이더는 마지막 사용자 메시지의 `[Model: …]`/`[Provider: …]` 태그로 **클라이언트가 고른다**(`stream-text.ts`) — 서버 env에 키가 있는 프로바이더(현재 Anthropic·Google)면 어느 모델이든 플랫폼 비용으로 호출 가능.
- **출력**: AI SDK 데이터 스트림(text/annotations/progress). 종료 시 `usage`, `finishReason`.
- **인증**: 세션 선택(게스트 허용). **생성 쿼터는 이 라우트가 강제하지 않음** — 클라이언트(`freeTrial.ts`)가 `P:increment_generation_count_v2` RPC를 직접 호출. 서버 강제 없음(§끝 참고).
- **DB**: `P:message_usage` insert(`recordMessageUsage`, `ctx.waitUntil`).
- **AI**: Anthropic `claude-sonnet-5`(기본). 자동 continue 최대 N회.
- **에러**: 401 인증 오류(프로바이더 키), 그 외 스트림 안 error 파트로 전달(토큰 한도·rate limit·quota를 한국어 문구로 분류). Sentry `route: api.chat`. 격리체 메모리 초과 시 Cloudflare 503 HTML(라우트 밖).

### `POST /api/llmcall`
- **목적**: 단발 LLM 호출 — 자동 검토(텍스트·시각), 업종→골격 매핑.
- **입력**: `system`, `message`, `model`, `provider{name}`, `streamOutput?`, `image?`(data URL, 시각 검토), `chatId?`, `isAutoFix?`, `messageId?`.
- **출력**: `{ text, usage, finishReason }` (streamOutput=true면 스트림).
- **인증**: 세션 선택 = **없음**(비로그인·비브라우저에서도 호출 가능, userId는 과금 기록용). 쿼터·레이트리밋 없음.
- **DB**: `P:message_usage` insert.
- **AI**: 호출자 지정 — 검토 `claude-haiku-4-5`, 시각 `claude-sonnet-5`, 매핑 `INDUSTRY_MAPPING_MODEL`.
- **에러**: 400 model/provider 누락·토큰 한도, 401 API key, **402 `provider_billing`**(Anthropic 크레딧 소진, `isRetryable:false`), 500 기타(`{error, message, statusCode, isRetryable, provider}`).

### `POST /api/enhancer` (잔재)
- 프롬프트 다듬기. 쿠키 키만. UI 미노출. 제거 후보.

## 미디어 (이미지·영상)

### `POST /api/media-images`
- **목적**: (a) 예약 — 생성 전에 R2 공개 URL 4장(+영상 URL) 확정, (b) 생성 — Gemini로 hero/ch1/ch2/ch3 체이닝 생성 후 R2 업로드.
- **입력**: (a) `{ reserve: true, jobId }` (b) `{ jobId, chatId, industry, prompt, accentHex?, darkPalette?, direction? }`. `jobId` 형식 `JOB_ID_REGEX = /^[a-z0-9][a-z0-9-]{7,63}$/`.
- **출력**: (a) `{ jobId, images{hero,ch1,ch2,ch3}, video?{provider,url} }` (b) `{ images, costUsd, elapsedMs }`.
- **인증**: 세션 선택 = **없음**. 쿼터·레이트리밋 없음 → 누구나 Gemini 비용을 쓸 수 있다. `jobId`는 클라이언트가 정하고(`newJobId()` = 시간 base36 + 12 hex) 서버는 소유 검증을 하지 않는다 → **배포된 사이트의 이미지 URL에서 jobId를 읽은 뒤 같은 jobId로 생성 POST를 보내면 그 사이트의 `media/<jobId>/*.jpg`를 덮어쓸 수 있다**(R2 키가 결정적). 미해결.
- **DB**: `P:message_usage` insert(`image_cost`). 저장소: R2 `media/<jobId>/{hero,ch1,ch2,ch3}.jpg`.
- **AI**: Gemini `gemini-3.1-flash-image`(기본) 또는 Seedream(`IMAGE_PROVIDER=seedream`).
- **에러**: 400 body/jobId/필수값, 503 미설정(키·R2), **402 `provider_billing`**(Gemini 선불 크레딧 소진), 500 `{ error, kind: gemini_*|r2_upload|total_timeout|unknown, isRetryable }`. 총 타임아웃 240s. **chat 스트림과 동시 호출 금지**(격리체 128MB).

### `POST /api/media-video` / `GET /api/media-video`
- **목적**: 히어로 이미지 → 5초 무음 루프 영상 작업 생성 / 폴링(완료 시 R2 복사).
- **입력**: POST `{ jobId, imageUrl(https), provider?, prompt?, loop? }`; GET `?jobId&taskId&provider&chatId`.
- **출력**: POST `{ taskId, provider }`; GET `{ status: 'queued'|'running'|'succeeded'|'failed', url?, costUsd?, error? }`.
- **인증**: 세션 선택 = **없음**(위와 동일한 비용·덮어쓰기 문제. GET 폴링은 `taskId`도 클라이언트 값 — 남의 taskId를 넣으면 그 결과가 내 jobId 키로 R2에 복사된다).
- **DB**: 성공 시 `P:message_usage` insert(`video_cost`). R2 `media/<jobId>/hero-<provider>.mp4`. R2 미설정이면 `{ status:'succeeded', url, stored:false }`(프로바이더 임시 URL 그대로).
- **AI**: Seedance(ARK) 또는 Kling(`VIDEO_PROVIDER`).
- **에러**: 400 필수값, 503 프로바이더 미설정, **502** 생성/폴링 실패 `{ error, provider, status }` — 이 라우트는 아직 502를 쓴다(Cloudflare가 HTML로 덮을 수 있음, 구조 메모 4).

## 온보딩·분석

### `POST /api/onboarding`
- **목적**: 온보딩 5문항 응답 저장(분석용).
- **입력**: `{ chatId, q1Audience, q2Storage, q3Industry, q3Raw, q3MappedSkeleton, q4Integrations[], q5Palette }`.
- **출력**: `{ ok: true }` / `{ ok: false, reason }`(200).
- **인증**: 세션 선택(user_id null 허용). **DB**: `P:onboarding_responses` insert(service role). **AI**: 없음. **에러**: 405.

### `POST /api/utm-attribution`
- **목적**: 가입 사용자의 첫 UTM 1회 기록. **입력**: `{ utmSource, utmMedium, utmCampaign, utmContent }`. **출력**: `{ ok: true }`. **인증**: 세션 필수(401). **DB**: `P:utm_attribution` upsert. **에러**: 401, 405.

## 코랄레드 Cloud (생성 앱 백엔드)

### `POST /api/cloud-provision`
- **목적**: 사용자의 생성 앱에 저장 백엔드 발급(앱 id + HMAC 토큰).
- **입력**: 없음(세션으로 사용자 식별). **출력**: `201 { appId, token, expiresAt }`.
- **인증**: 세션 필수(단, 503 시크릿 미설정 검사가 401보다 먼저). **DB**: `C:cloud_apps` count(5개 한도)·insert(`app_secret_hash`=sha256(token), `tier='free'`, `expires_at`=**지금+7일**; 배포 후 `cloud-set-origin`이 +30일로 갱신). **AI**: 없음. 토큰은 여기서 딱 한 번 반환되고 클라이언트 `localStorage`(`lib/stores/cloud.ts`, chatId 키)에 저장된다.
- **에러**: 401 로그인 필요, 405, 429 `계정당 저장 기능은 앱 5개까지`, 503 시크릿 미설정, 500 provision 실패. **현재 Cloud 프로젝트 DNS 불가 → 500/503 예상.**

### `POST /api/cloud-set-origin`
- **목적**: 앱의 배포 origin 등록(CORS 허용 대상). **입력**: `{ appId, origin }` — **`origin`은 `https://<name>.pages.dev` 형식만 허용**(`PAGES_DEV_ORIGIN_REGEX`). **출력**: `{ ok: true, expiresAt }`(만료를 지금+30일로 연장).
- **인증**: 소유 토큰(만료·origin 검사 없이 토큰+해시만). **DB**: `C:cloud_apps` update `deploy_origin`, `expires_at`. **에러**: 400 형식/origin, 401 토큰, 405, 500.
- **결과적 제약**: 커스텀 도메인(`/api/cloudflare-domain`)으로 서비스되는 앱은 브라우저 `Origin`이 `deploy_origin`과 달라 **저장 API가 전부 403** — 커스텀 도메인 + Cloud 저장은 현재 조합 불가. `CloudflareDeploy.client.tsx`의 `CLOUD_API_ORIGIN`도 `https://coralred.kr` 하드코딩.

### `GET|POST /api/cloud/:appId/:collection`
- **목적**: 컬렉션 목록 조회 / 문서 생성. 생성 앱 SDK(`coralred-storage.client-template.js`)가 호출.
- **입력**: GET `?deviceKey=&limit=(≤100, 기본 20)&cursor=(created_at)`; POST `{ deviceKey, data }` — `data`는 plain object, JSON 깊이 ≤8, 배열 ≤1000, 직렬화 ≤64KB. `collection` `^[a-z][a-z0-9_]{0,30}$`, `deviceKey` 1~128자 문자열.
- **출력**: GET `{ items: [{id, data, createdAt, updatedAt}], nextCursor }`; POST `201 {id, data, createdAt, updatedAt}`. CORS preflight(OPTIONS) 204, `Origin` 그대로 반영.
- **인증**: 앱 토큰 → HMAC 검증 → `cloud_apps.app_secret_hash` 대조 → `expires_at` → `deploy_origin` 존재 → 요청 `Origin` === `deploy_origin`(정확 일치). **사용자 인증은 없다**: 문서 격리는 `app_id` + 클라이언트가 보내는 `device_key`(SDK가 `localStorage`의 random UUID)뿐이라, 같은 앱 안에서 다른 방문자의 데이터를 못 보는 근거는 device_key 추측 불가성이다. 앱 토큰은 배포 번들(`VITE_CLOUD_APP_TOKEN`)에 들어 있어 **공개값**이고, `Origin` 헤더는 브라우저 밖에서 위조 가능하다.
- **DB**: `C:cloud_documents` select/insert, `C:cloud_check_rate_limit` RPC(앱 120/분·기기 60/분; **RPC 오류면 통과(fail-open)**), 트리거 `cloud_enforce_quota`·`cloud_track_usage_*` → `C:cloud_usage`. **AI**: 없음.
- **에러**: 400 형식, 401 토큰·앱 없음, 403 만료(`체험 기간`)/미배포/origin 불일치, 405, **413** 64KB 초과, 429 레이트리밋, **507** 쿼터(문서 수·바이트·컬렉션 수), 500, 503 Cloud 미설정.

### `GET|PATCH|DELETE /api/cloud/:appId/:collection/:docId`
- **목적**: 단일 문서 조회/수정/삭제. **입력**: GET `?deviceKey=`; PATCH `{ deviceKey, data }`; DELETE `?deviceKey=` 또는 body `{ deviceKey }`. **출력**: GET/PATCH `{id, data, createdAt, updatedAt}`; DELETE **204 본문 없음**. `docId`는 UUID 형식만(아니면 404). 인증·DB·에러는 위와 동일 + 404 문서 없음(다른 device_key의 문서도 404).

## 배포

### `POST /api/cloudflare-deploy`
- **목적**: 생성 앱 빌드 산출물을 사용자별 Cloudflare Pages 프로젝트로 배포. "Made with Coralred" 배지 주입, 생성 이미지 URL 도달성 검사.
- **입력**: `{ projectName, files: Record<path, base64|string> }`. **출력**: `{ success, url, deploymentId, projectName, isFirstDeploy }`.
- **인증**: 세션 필수. **DB**: `P:deployed_app_project_owned_by_other` RPC(소유권; `isProjectOwnedByOther`는 **플랫폼 env 미설정·RPC 오류 시 false = 통과(fail-open)**), 성공 후 클라이언트가 `P:deployed_apps` insert(`recordDeployedApp`, RLS `auth.uid()=user_id`). 외부: Cloudflare API(`CLOUDFLARE_API_TOKEN`). 파일 1개 ≤25MB, 배치 20MB/200파일. **AI**: 없음.
- **에러**: 400 프로젝트명/파일/손상/크기, 401, 403 `다른 계정에 연결`, **409** 생성 이미지 URL 미도달, **502** Cloudflare 설정·권한·실패(아직 502), 503 토큰 미설정, 500.

### `POST|GET /api/cloudflare-domain`
- **목적**: 커스텀 도메인 연결 / 상태 조회. **입력**: POST `{ projectName, domain }`; GET `?projectName`. **출력**: `{ status, verification… }`(Cloudflare 응답 가공).
- **인증**: 세션 필수 + 소유권 RPC(위와 같은 fail-open). **DB**: `P:deployed_app_project_owned_by_other`. **에러**: 400 도메인 형식, 401, 403, **502**(아직 502), 503, 500. (티어 게이트는 클라이언트 `TODO_IS_PRO_USER=false`로 잠김.) 커스텀 도메인 앱은 Cloud 저장과 조합 불가(`cloud-set-origin` 참고).

## 결제

### `POST /api/payment/verify`
- **목적**: PortOne 결제 건 서버 조회. **입력**: `{ paymentId, expectedAmount?, expectedCurrency? }` — 기대 금액·통화는 **클라이언트가 보내는 값이고 없으면 검사 생략**(status `PAID`만 보면 verified). `paymentId`가 이 사용자 것인지 묶어주는 검사 없음. **출력**: `{ verified, status, amount, currency }`.
- **인증**: 세션 필수. **DB**: **없음(결과를 저장하지 않음 — 요금제 반영 경로 미구현)**. 외부: PortOne API(`PORTONE_API_SECRET`). **에러**: 405(텍스트), 400 `missing_payment_id|invalid_request_body`, 401 `login_required`, 500 `payment_verification_unavailable|verification_request_failed`, 502 `portone_lookup_failed`. **호출자 없음** — `pricing.tsx`에는 PortOne SDK·`requestPayment` 코드가 없고(요금제 버튼은 `/`로 링크), 이 라우트를 부르는 코드는 리포에 없다.

### `POST /api/payment/webhook`
- **목적**: PortOne 웹훅 수신. **입력**: PortOne 페이로드(`webhook-id/timestamp/signature` 헤더 읽기만). **출력**: `200 'ok'`(항상, `PORTONE_WEBHOOK_SECRET` 유무와 무관). **인증**: **서명 미검증(TODO)**. **DB**: 없음. → 사실상 no-op. 결제 완결 작업의 핵심 미구현. 이 라우트가 뭔가 하기 시작하면 서명 검증이 먼저다.

## 계정·운영

### `POST /api/account-delete`
- **목적**: 탈퇴. **출력**: `{ ok: true }`. **인증**: 세션 필수. **DB**: 플랫폼 service role로 `auth.admin.deleteUser` → `P:` FK cascade(`generation_usage_v2`, `deployed_apps`, `utm_attribution`), set null(`message_usage`, `onboarding_responses`). **남는 것**: `C:cloud_apps`(`owner_user_id`는 FK 아님)와 그 `cloud_documents`, R2의 `media/*`, Cloudflare Pages 프로젝트 — 탈퇴해도 삭제되지 않는다. **에러**: 401, 405, 500.

### `GET /api/health`
- **목적**: 마이그레이션 적용 여부(테이블 존재). **출력**: `{ status:'healthy', timestamp, migrations: { generation_usage_v2, deployed_apps, message_usage, onboarding_responses, utm_attribution } }`. **인증**: 공개. **DB**: `P:` anon 클라이언트 head select.

### `GET /api/models`, `GET /api/models/:provider`, `GET /api/configured-providers`
- **목적**: 모델/프로바이더 목록(bolt 원본). UI는 `SHOW_DEV_TOOLS=false`로 숨김이지만 `Chat.client`가 부팅 시 호출. **인증**: 공개. **DB/AI**: 없음(정적 목록 + 일부 프로바이더 원격 조회).

## bolt.diy 잔재 (UI 숨김·URL 열림·제거 후보)

> **CRITICAL (2026-09-22 프로덕션 실측)**: `GET /api/export-api-keys`는 인증 없이 **서버 env의 프로바이더 API 키를 그대로 JSON으로 반환**한다(`{ Anthropic: '<실키>', Google: '<실키>' }` — `coralred.kr`에서 200 확인, 값은 기록하지 않음). bolt 원본의 로컬 전용 기능이 그대로 배포돼 있다. 조치: 키 2개 폐기·재발급 → 라우트 삭제(또는 `functions/_middleware.ts`에서 404) → 재배포. 그 전까지 이 저장소의 어떤 문서도 "키가 안전하다"고 전제하지 말 것.

> **HIGH**: `GET|POST /api/git-proxy/<domain>/<path>`는 인증 없는 **범용 HTTPS 프록시**(임의 도메인으로 요청 전달, 본문 반환 — `example.com` 200 확인). 남용·SSRF·평판 위험. `GET /api/check-env-key?provider=X`는 어떤 프로바이더 키가 설정됐는지 노출(200). `GET /api/system/diagnostics`는 토큰 유무·nodeEnv 노출(200).

`GET|POST /api/git-proxy/*`, `/api/github-{branches,stats,user}`, `/api/gitlab-{branches,projects}`, `/api/netlify-{deploy,user}`, `/api/vercel-{deploy,user}`, `/api/supabase`, `/api/supabase/{query,variables}`, `/api/supabase-user`, `/api/mcp-{check,update-config}`, `/api/system/{diagnostics,disk-info,git-info}`, `/api/update`, `/api/web-search`, `/api/check-env-key`, `/api/export-api-keys`. 인증 없음(`api.enhancer`는 쿠키 키, `api.supabase/query`는 body의 사용자 토큰). `api.system.disk-info`는 Cloudflare에서 죽은 코드. 상세 `docs/AUDIT-2026-09-22.md §5`. `tests/api/routes.contract.spec.ts`는 이 잔재 라우트를 **검사하지 않는다**.

---

## 구조적 메모 (API 설계 시 알아둘 것)

1. **생성 쿼터가 서버에서 강제되지 않는다.** `/api/chat`·`/api/llmcall`·`/api/media-images`·`/api/media-video`는 인증 없이 받고, 한도 판정·증가는 클라이언트 `freeTrial.ts`가 RPC로 한다(게스트 한도 1은 `localStorage`). 클라이언트를 우회하면 무제한(LLM·Gemini·R2 비용). 요금제(Light/Pro/Max) 도입 전에 서버 앞단에서 `increment_generation_count_v2`를 호출하도록 옮겨야 한다.
2. **결제 → 요금제 반영 경로가 없다.** `verify`는 조회만, `webhook`은 no-op. `plans/subscriptions` 테이블 + 서명 검증이 선행.
3. **오류 형식 3종 혼재**: `{error}` JSON(코랄레드), `Response(text)`(payment), `{error,message,statusCode,isRetryable,provider}`(llmcall). 신규는 `lib/cloud/cloudResponses.ts jsonError` 형식으로.
4. **Cloudflare가 502/504를 자기 HTML로 덮는다** → 서버는 500/402로 낸다(`media-images`, `llmcall`). **아직 502를 쓰는 라우트**: `media-video`, `cloudflare-deploy`, `cloudflare-domain`, `payment/verify`.
5. **격리체 128MB**: `/api/chat` 스트림 중 `/api/media-images` 생성 호출 금지. 클라이언트 `waitForQuietChat`이 지킨다.
6. 미디어 라우트는 `chatId`를 과금 키로만 쓴다 — 서버에 `chats` 테이블이 없어 검증 불가.
7. **fail-open 3곳**: 배포 소유권 RPC(`isProjectOwnedByOther`), Cloud 레이트리밋 RPC(`checkCloudRateLimit`), `getPlatformUserId`(env 미설정 → 게스트). 미설정·장애 시 조용히 느슨해진다 — 알람 없음.
8. **`deployed_app_project_owned_by_other` RPC는 `anon`에게도 execute 허용**(마이그레이션 `20260826`) — anon 키만 있으면 프로젝트명이 다른 계정 소유인지 조회 가능(정보 노출, 낮음).
