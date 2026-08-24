# 야간 자율 작업 6차 리포트 — 코랄레드 Cloud

브랜치: `overnight4` (계속)

규칙 준수 메모: 배포 금지 / main 머지 금지 / pricing.tsx·functions/[[path]].ts 수정 금지 / .env 키 값 출력 금지 / 작업당 개별 커밋 + typecheck/lint/build + git show --stat 검증 / 3회 실패 시 revert.

---

## 작업 0 — 설계 문서
**상태: 완료** — 커밋 `221a8d0`, 문서: `CLOUD-DESIGN.md`

위협 모델(T1~T9), 아키텍처, 앱 토큰 인증 설계, API 스펙, 데이터 모델, 쿼터 정책, 레이트리밋 설계, CORS 정책, 만료/정리, 미리보기 폴백, v1 한계까지 12개 섹션. 이후 작업 전부 이 문서 기준으로 구현했고, 구현 중 바뀐 세부사항(예: `app_secret_hash`의 정확한 용도 — 토큰 자체가 아니라 개별 앱 무효화용 해시)도 이 문서에 먼저 정리한 뒤 코드로 옮김.

## 작업 1 — Cloud DB 스키마
**상태: 완료** — `RUN-3-cloud.sql`(커밋 안 함, 프로젝트 루트에 그대로 있음, 실행은 성민)

`cloud_apps`, `cloud_documents`, `cloud_usage`, `cloud_rate_limit` 4개 테이블 + 트리거 3개(쿼터 강제, INSERT/UPDATE/DELETE 시 `cloud_usage` 자동 갱신) + RPC 2개(`cloud_check_rate_limit`, `cloud_expire_cleanup`) + pg_cron 스케줄. 아래 "RUN-3-cloud.sql 안내" 섹션에 실행 방법 정리.

설계 문서와 다른 점 하나: `owner_user_id`는 `auth.users`를 참조하는 외래키로 안 했음 — Cloud DB는 플랫폼 DB(코랄레드 계정이 있는 곳)와 완전히 별개 Supabase 프로젝트라 같은 DB 안에 `auth.users`가 없음. 그냥 `uuid not null` 컬럼으로 두고, 실제 소유권 검증은 서버 코드(`cloudPlatformAuth.ts`)가 플랫폼 프로젝트의 anon key로 JWT를 검증해서 처리.

쿼터는 트리거로 강제(무료: 문서 2,000개/10MB/컬렉션 20개, 유료 10배, 문서당 64KB는 공통) — "검증이 아니라 구조" 원칙대로 서버 코드가 실수로 체크를 빼먹어도 DB가 막음.

## 작업 2 — 서버 저장 API
**상태: 완료** — 커밋 `05de952`

`app/routes/api.cloud.$appId.$collection.ts` (POST 생성 / GET 목록), `app/routes/api.cloud.$appId.$collection.$docId.ts` (GET 단건 / PATCH / DELETE). `functions/[[path]].ts`는 손대지 않음 — 이 프로젝트의 라우팅이 이미 전부 Remix flat-routes(`app/routes/api.*.ts`)로 처리되고, `functions/[[path]].ts`는 모든 요청을 Remix 서버 빌드로 넘기는 범용 핸들러라 새 라우트 파일만 추가하면 끝이라는 걸 먼저 확인.

- **인증**: `cloudToken.ts` — `appId.iat.HMAC서명` 형태 토큰, Web Crypto(`crypto.subtle`)로 서명/검증(Cloudflare Workers엔 Node crypto가 없음). `app_secret_hash`엔 토큰 자체가 아니라 `sha256(token)`만 저장 — DB가 유출돼도 토큰 복원 불가. 이 해시는 동시에 개별 앱 무효화 수단이기도 함(전역 시크릿을 안 바꾸고 그 앱의 해시만 지우면 그 앱 토큰만 죽음).
- **app_id/device_key 강제**: `cloudDocuments.ts`의 모든 쿼리가 `app_id`(인증된 컨텍스트에서만 옴, 클라이언트가 못 바꿈) + `device_key`/`id`로 필터링. 클라이언트가 바디에 `appId`를 끼워 넣어도 무시됨(작업 7에서 실제로 검증).
- **service_role 키 격리**: `cloudSupabaseClient.ts`가 `context.cloudflare.env`로만 읽고 Remix 핸들러 안에서만 인스턴스화(`import.meta.env` 안 씀, `VITE_` 접두사 없음). `cloudBuildSecurity.spec.ts`가 실제로 `pnpm build`를 돌려서 `build/client`를 grep — `CLOUD_SUPABASE_SERVICE_KEY`/`CLOUD_APP_TOKEN_SECRET` 문자열이 없는 걸 확인(52초 정도 걸림 — 이 저장소 빌드가 빨라서 vitest 안에서 실제 빌드를 돌리는 게 감당할 만하다고 판단).
- **레이트리밋**: Cloudflare Pages Functions는 요청마다 다른 격리 인스턴스일 수 있어 인메모리 카운터를 못 믿음 — Cloud Supabase 자체에 분당 고정 윈도우 카운터 테이블을 두고 RPC로 원자적 증가+확인. RPC 실패 시 fail-open(레이트리밋 자체가 죽어도 저장 기능 전체가 막히면 안 됨).
- **CORS**: `cloud_apps.deploy_origin`과 요청의 `Origin` 헤더를 정확히 비교, 와일드카드 없음. Preflight(OPTIONS)는 인증 없이 즉시 응답(표준 관행 — 실제 보호는 본 요청에서).

## 작업 3 — 저장 SDK
**상태: 완료** — 커밋 `cb22506`, 파일: `app/lib/cloud/coralred-storage.client-template.js`

`db.create/list/get/update/remove`, 기기 키는 `crypto.randomUUID()` + localStorage 자동 발급(localStorage 접근 실패 시 세션 중에만 유지되는 메모리 키로 폴백). `VITE_CLOUD_API_BASE`/`VITE_CLOUD_APP_TOKEN`이 없으면(미리보기, 또는 배포는 됐지만 Cloud를 안 켠 경우) 전부 인메모리 `Map`으로 동작 — 새로고침하면 사라지지만 화면은 정상 작동. 에러는 상태코드별로 한국어 메시지 매핑, 서버가 이미 준 메시지가 있으면 그걸 우선.

인메모리 폴백 경로(생성/조회/목록/수정/삭제, 존재하지 않는 문서 404, 컬렉션 간 독립성)를 실제로 실행하는 vitest 9건 — `VITE_CLOUD_*`가 없는 테스트 환경이 정확히 "미리보기" 상태라 이 경로만 라이브 없이 검증 가능했음. 실제 fetch 경로(배포 후)는 성민 체크리스트로 넘김.

## 작업 4 — AI 시스템 프롬프트 개편
**상태: 완료** — 커밋 `f1467d2`

`new-prompt.ts`의 `<database_instructions>`를 TRACK A(코랄레드 Cloud, 기본)/TRACK B(내 Supabase, 고급) 2트랙으로 재구성. `STORAGE_MODE`는 `supabase.isConnected`로 결정 — 연결 안 돼 있으면 무조건 Cloud.

**캐싱과의 충돌을 피한 방법**: 이 프롬프트는 `CACHE_BREAKPOINT_MARKER` 앞(정적/캐시되는 부분)과 뒤(요청마다 가변)로 나뉘어 있고, 앞부분은 Anthropic 프롬프트 캐시 브레이크포인트가 걸려 있어(overnight3 `c6edda6`) 매 요청 바이트 단위로 동일해야 캐시가 먹힘. 두 트랙의 전체 지시문을 전부 정적 프리픽스 안에 항상 같이 둬서(하나만 골라 보여주는 게 아니라) 이 성질을 안 깸 — 실제로 어떤 트랙을 쓸지는 캐시 경계 뒤 `<request_specific_values>`의 `STORAGE_MODE` 한 줄로만 알려줌. `new-prompt.spec.ts`에 이 성질 자체를 검증하는 테스트를 넣음(cloud/supabase 두 상태로 프롬프트를 만들어서 정적 프리픽스가 바이트 단위로 같은지 비교) — 10개 테스트 전부 통과.

SDK 원문은 `coralred-storage.client-template.js?raw`로 그대로 임베드(Vite `?raw` import, 기존 `coralredKit.ts`의 CSS raw-import와 같은 패턴) — 프롬프트 안에 손으로 다시 타이핑 안 해서 SDK와 프롬프트가 절대 어긋날 수 없음.

Cloud 트랙은 회원가입/로그인 화면 자체를 금지(기기 단위라 계정 개념이 없음) — 사용자 요청이 로그인/여러 기기 동기화를 암시하면 코드는 Track A대로 만들되 답변에서 "내 Supabase 연결(고급)"을 짧게 안내하도록 지시.

**온보딩 매핑 갱신**: `answer-directives.ts`의 `persistence` 질문 — `withoutAuth`는 이제 Supabase를 요구하지 않음(Cloud가 기본으로 이미 로그인 없이 저장됨), `withAuth`는 STORAGE_MODE에 따라 답변에서 안내가 갈리도록 재작성. 기존 테스트 1건 갱신, 실행 확인.

## 작업 5 — UI 통합
**상태: 완료** — 커밋 `5c8705d`

- 헤더의 "저장 기능 켜기" 버튼 → 아무것도 안 켜져 있으면 선택 화면(코랄레드로 바로 켜기 추천 / 내 Supabase 연결 고급)부터 보여줌.
- "코랄레드로 바로 켜기": 비로그인이면 `/login`으로, 로그인돼 있으면 `/api/cloud-provision` 호출 → 즉시 완료 상태. 계정당 5개 제한(서버에서 강제, `cloudProvision.ts`). 무료 티어 안내: "체험용이라 7일 뒤 데이터가 정리돼요. 계속 쓰려면 요금제를 확인해주세요."
- Cloud 상태는 `cloud.ts` 스토어가 채팅(chatId)별로 localStorage에 저장 — Supabase 연결과 달리 앱마다 `deploy_origin`이 다르므로 계정 전역 연결 하나로 못 묶음.
- 배포 파이프라인: `injectCloudEnv`가 `injectSupabaseEnv`와 같은 `.env` 병합 로직(공통 `mergeEnvFile`로 추출) 재사용해서 `VITE_CLOUD_API_BASE`/`VITE_CLOUD_APP_TOKEN` 주입. 배포 성공 직후 `/api/cloud-set-origin`을 한 번 호출해서 `cloud_apps.deploy_origin`을 실제 배포 URL로 기록(CORS가 이 값을 기준으로 검사하므로 필수).
- `/apps` 뱃지 3종(샘플 데이터/코랄레드 저장/내 Supabase 연결) + 만료 3일 전 경고 뱃지. `deployed_apps` 마이그레이션의 `supabase_connected boolean`을 `storage_mode text` + `storage_expires_at`으로 교체(아직 미적용이라 안전하게 직접 수정 — 이번 세션 기존 관행과 동일).

## 작업 6 — 만료·정리
**상태: 완료** (작업 1 + 5에 통합)

`RUN-3-cloud.sql`에 `cloud_expire_cleanup()` 함수(만료된 앱들의 문서만 삭제, 앱 행 자체는 남김 — 만료 안내를 계속 보여줄 수 있게)와 `pg_cron` 매시 정각 스케줄(재실행해도 안전하도록 기존 잡 존재 시 `unschedule` 후 재등록)이 이미 포함돼 있음. `/apps`의 3일 전 경고 뱃지는 작업 5에서 같이 구현.

## 작업 7 — 적대적 테스트
**상태: 완료** — 커밋 `48917c5`, 파일: `app/lib/cloud/cloudAdversarial.spec.ts` (48 tests)

| 시나리오 | 방법 | 결과 |
|---|---|---|
| 다른 앱 appId로 토큰 위조 | app-a용 토큰으로 app-b 요청 | 401 (appId 불일치) |
| 서명 변조 | 토큰 서명 부분 1글자 변경 | `verifyCloudAppToken` → null |
| 잘못된 시크릿으로 서명 | 다른 시크릿으로 발급한 토큰 검증 | null |
| 형식이 깨진 토큰 | 점 구분 3부분이 아닌 문자열들 | null |
| 무효화된 앱(해시 불일치) | DB의 `app_secret_hash`가 다른 토큰 것 | 401 |
| 만료된 앱 | `expires_at`이 과거, 토큰/해시는 정상 | 403 |
| 배포 origin 불일치 | `Origin` 헤더 ≠ `deploy_origin` | 403 |
| 정상 케이스(대조군) | 전부 일치 | 200 + 정확한 CORS 헤더 |
| Authorization 헤더 없음 | 헤더 자체를 안 보냄 | 401 |
| Cloud 미설정(시크릿 없음) | 빈 env | 503 (열려있지 않고 명시적으로 막힘) |
| 바디에 appId 위장 삽입 | `createDocument` 바디에 `appId: 'attacker-app-id'` | INSERT는 실제 인증된 app_id만 사용, 무시됨 |
| list/get/update/delete가 실제로 app_id+device_key 필터를 거는지 | 가짜 쿼리 빌더로 `.eq()` 호출 자체를 기록 | 4개 함수 전부 두 필터 항상 포함 확인 |
| 존재 유무 노출 방지 | 남의 device_key로 조회 | 404 + "찾을 수 없어요"(에러 메시지가 이유를 알려주지 않음) |
| collection명 악성 문자열 20종 | SQL 조각, 경로 조작, 대문자, 하이픈, 길이초과, null byte, 한글 등 | 전부 `isValidCollectionName` false, 5개 CRUD 함수 전부 400으로 DB 도달 전 차단 |
| 정상 collection명(대조군) | `todos`, `user_posts_2026`, `a` | 전부 true |
| 64KB 초과 페이로드 | 큰 문자열 | `jsonByteSize` > 한도, 실제 `createDocument` 호출도 413 |
| JSON 깊이 9 | 9단 중첩 객체 | `validateDocumentShape` → depth 실패, `createDocument` 400 |
| 깊이 8(경계값, 대조군) | 8단 중첩 | 통과 |
| 배열 폭탄(1001개, 최상위) | 큰 배열 | array_length 실패 |
| 배열 폭탄(중첩) | 객체 안의 배열 | 마찬가지로 실패 |
| 정상 배열(50개, 대조군) | 통과 |
| 빌드 산출물에 service_role 키 부재 | 작업 2의 `cloudBuildSecurity.spec.ts` 재사용(중복 안 함) | 확인됨 |

## 작업 8 — 검증 루프 (종료 조건 없음, 계속 진행 중)

### 사이클 1

**기준선**: `pnpm test`(249개 전부 통과, 빌드 포함이라 53초) / `pnpm typecheck` / `pnpm lint` / `pnpm build` 전부 클린.

**우선 대상 1 — 동시 요청**: `cloud_check_rate_limit` RPC의 `insert ... on conflict do update` 패턴은 Postgres 행 잠금으로 동시 증가에 안전(표준 upsert 원자성) — 별도 코드 없이 DB가 보장. 다만 두 개의 별도 `insert`문(app 카운터, device 카운터)이 하나의 트랜잭션 안에 있는지 재확인: RPC 함수 전체가 하나의 암묵적 트랜잭션이라 안전 — 코드 재검토로 확인, 라이브 부하 테스트는 불가(DB 없음).

**우선 대상 2 — 쿼터 경계**: `cloud_enforce_quota()` 트리거의 `v_doc_count + 1 > v_max_docs` 비교를 다시 읽음 — 정확히 한도에 도달하는 마지막 한 건(`document_count`가 1999→2000이 되는 삽입)은 `1999 + 1 > 2000` = false라 통과, 그다음 삽입(`2000+1>2000`=true)이 막힘 — 정확히 "2,000개까지 허용"이라는 스펙과 일치함을 산술로 확인. 컬렉션 수 체크도 동일 패턴으로 검산.

**우선 대상 3 — 만료 직전/직후**: 작업 7에서 `expires_at`이 정확히 현재 시각보다 1000ms 과거인 케이스로 403을 확인함 — 경계 자체(정확히 현재 시각과 같은 순간)는 `<` 비교라 "지금 이 순간 막 만료"는 아직 유효 쪽으로 처리됨(의도된 동작 — `<=`가 아니라 `<`).

**우선 대상 4 — SDK 폴백 전환**: `coralred-storage.client-template.js`는 모듈 로드 시점에 `CLOUD_ENABLED`를 한 번만 계산(`import.meta.env`는 빌드타임에 고정) — 즉 배포된 빌드 안에서 "폴백에서 실제 API로" 런타임 전환은 없음(애초에 배포된 빌드는 항상 `CLOUD_ENABLED=true`이거나 애초에 Cloud를 안 켠 빌드는 계속 폴백). 전환이 일어나는 유일한 시점은 "Cloud를 새로 켜고 재배포"할 때뿐이고, 그건 완전히 새 빌드라 문제없음 — 코드 읽고 확인, 별도 수정 불필요.

**이번 사이클 발견한 안전 이슈 없음** — 정적/산술 검토로 설계대로 동작함을 확인. 다음 사이클은 라이브 DB가 생긴 뒤(마이그레이션 적용 후) 실제 동시 요청/쿼터 경계를 성민이 직접 확인하는 쪽이 더 의미 있을 것으로 판단(아래 체크리스트에 포함).

*(사이클 2 이후는 계속 진행 — 종료 조건 없음. 성민이 돌아올 때까지 같은 구조로 반복.)*

---

## 전체 커밋 목록 (이번 세션, 오래된 순)

1. `221a8d0` docs: add CLOUD-DESIGN.md for overnight6 coralred Cloud storage backend
2. `05de952` feat: add coralred Cloud server storage API (overnight6 task 2)
3. `cb22506` feat: add coralred-storage client SDK template (overnight6 task 3)
4. `f1467d2` feat: two-track storage mode in the system prompt (overnight6 task 4)
5. `5c8705d` feat: UI integration for coralred Cloud storage (overnight6 task 5)
6. `48917c5` test: adversarial attack scenarios for coralred Cloud (overnight6 task 7)

전부 `pricing.tsx`/`functions/[[path]].ts` 미포함, `.env` 값 미노출, 커밋 전 typecheck+lint+test+build 통과 확인.

## RUN-3-cloud.sql 안내

**경로**: 프로젝트 루트 `RUN-3-cloud.sql` (커밋 안 됨 — RUN-1/RUN-2와 같은 방식으로 로컬에만 있음)

**실행**: Supabase 대시보드 → **CLOUD_SUPABASE_URL이 가리키는 프로젝트**(본체 플랫폼 프로젝트가 아님, 주의!) → SQL Editor에 전체 붙여넣고 실행. `create table if not exists`/`create or replace function`/`drop trigger if exists` 위주라 여러 번 실행해도 안전.

**사전 확인 필요**: `pg_cron` 확장은 Supabase 프로젝트에서 기본적으로 사용 가능하지만 플랜에 따라 활성화 방법이 다를 수 있음 — `create extension if not exists pg_cron;`이 권한 오류로 실패하면 대시보드의 Database → Extensions에서 `pg_cron`을 먼저 켜야 함.

**추가로 `.env`에 필요한 값** (이미 안내드린 `CLOUD_SUPABASE_URL`/`CLOUD_SUPABASE_SERVICE_KEY` 외에 하나 더 필요):
- `CLOUD_APP_TOKEN_SECRET` — 서버가 앱 토큰을 HMAC 서명/검증하는 데 쓰는 랜덤 시크릿. 아무 곳에도 없는 새 값이라 제가 만들어드릴 수 없음(값을 알면 누구나 토큰을 위조할 수 있어서 저도 몰라야 함) — `openssl rand -hex 32` 같은 명령으로 32바이트 이상 랜덤 값을 직접 만들어서 `.env`에 추가해주세요. 이 값이 없으면 Cloud API가 전부 503으로 응답해요(코드가 이미 그렇게 방어하고 있음 — 안전하게 실패함).

## 성민 브라우저 체크리스트

정적 검토·모킹된 함수 실행으로는 확인 못 하는 것들:

1. **`.env`에 `CLOUD_APP_TOKEN_SECRET` 추가 + `RUN-3-cloud.sql` 실행** (선행 조건 — 아래 항목들이 이걸 전제로 함).
2. **저장 기능 켜기 → 선택 화면 → "코랄레드로 바로 켜기"** — 로그인 안 한 상태에서 눌렀을 때 `/login`으로 가는지, 로그인 후 다시 누르면 즉시 "켜졌어요" 상태가 되는지.
3. **같은 계정으로 앱 6개째 Cloud 켜기 시도** — 5개 제한 에러 메시지가 뜨는지("계정당 저장 기능은 앱 5개까지 켤 수 있어요").
4. **Cloud 켠 앱 생성 → 배포 전 미리보기에서 저장 기능 사용** — 새로고침하면 데이터가 사라지는지(인메모리 폴백 확인), 화면 자체는 에러 없이 잘 도는지.
5. **배포 → 실제로 저장되는지** — 배포된 사이트에서 데이터를 저장하고 새로고침해도 남아있는지(Cloud API 왕복 확인).
6. **실기기(또는 시크릿 창) 2대에서 같은 배포 앱 접속 → 데이터가 서로 안 섞이는지** — 기기 A에서 만든 항목이 기기 B에는 안 보여야 함(device_key 파티션 확인). 이건 코드 리뷰로는 "구조가 맞다"까지만 확인했고 실제 브라우저 두 개로 직접 봐야 확실함.
7. **CORS 확인** — 배포된 Cloud 앱의 API를 브라우저 개발자 도구에서 다른 origin(예: 그냥 아무 사이트 콘솔)으로 fetch 시도했을 때 CORS 에러로 막히는지.
8. **레이트리밋** — 짧은 시간에 같은 기기로 요청을 60번 넘게 보내면 429가 뜨는지(개발자 도구 콘솔에서 반복 호출로 확인 가능).
9. **7일 만료 안내** — `/apps`에 만료 3일 전 경고 뱃지가 뜨는지는 실제로 7일을 기다리기 전에는 확인 어려움 — `RUN-3-cloud.sql` 실행 후 SQL Editor에서 테스트용 앱 하나의 `expires_at`을 수동으로 3일 이내로 앞당겨서 확인하는 걸 추천.
10. **AI 생성 코드 실제 확인** — 새 대화에서 "할 일 목록 앱 만들어줘" 같은 요청을 했을 때 AI가 실제로 `coralred-storage.js`를 쓰고 로그인 화면을 안 만드는지, "다른 기기에서도 로그인해서 쓰고 싶어요" 같은 요청엔 Supabase 연결을 안내하는지.
11. **내 Supabase(고급) 경로 회귀 확인** — 선택 화면에서 "내 Supabase 연결(고급)"을 눌렀을 때 기존 3단계 마법사가 그대로 나오는지, "뒤로" 버튼이 선택 화면으로 돌아가는지.

## 미해결 이슈 (사유)

| 이슈 | 사유 |
|---|---|
| 동시 요청/레이트리밋/쿼터 경계의 실제 부하 검증 안 됨 | 라이브 Cloud Supabase 프로젝트가 아직 없음(마이그레이션 미적용) + 배포 금지 규칙. 트리거/RPC의 원자성은 Postgres 자체 보장에 의존하는 표준 패턴이라 설계상 안전하다고 판단했지만, 실제 동시 트래픽에서의 동작은 성민이 라이브 환경에서 확인 필요. |
| `CLOUD_API_ORIGIN`(`https://coralred.kr`)이 하드코딩됨 | 배포된 앱이 호출할 coralred 서버 주소는 고정값이라 문제는 아니지만, 로컬 개발/스테이징 환경을 따로 운영하게 되면 이 상수를 환경별로 바꿀 방법이 없음 — 현재는 프로덕션 전용으로 충분하다고 판단해 상수로 둠. |
| Cloud 앱 "끄기"가 서버 쪽 `cloud_apps` 행을 안 지움 | 로컬 연결 정보만 지우고 서버 행은 만료될 때까지 남음 — 사용자가 "껐으니 슬롯이 비었겠지" 생각하면 5개 제한과 어긋날 수 있음. 실제 삭제 API를 만들려면 소유권 재확인 로직이 하나 더 필요해서 이번 사이클엔 범위 밖으로 미룸. |
| `/apps`의 만료 경고가 배포 시점 스냅샷(`storage_expires_at`)이라 이후 요금제 변경을 반영 못함 | 무료→유료 전환 시 실제 만료일이 바뀌어도(`expires_at`이 null이 됨) `/apps`는 다음 재배포 전까지 예전 값을 보여줌. 실시간으로 보여주려면 클라이언트가 Cloud DB를 직접 조회해야 하는데 그럴 자격 증명이 없어서(의도된 격리) 지금은 이렇게 둠 — 유료 전환 UI 자체가 아직 없어서 당장 급한 문제는 아님. |
| `SupabaseConnection.tsx` 파일명이 이제 실제 내용(Cloud+Supabase 둘 다)과 안 맞음 | 이번 세션에 리네임까지 하기엔 import 경로가 여러 곳이라 위험 대비 이득이 적다고 판단, 다음 정리 작업 때 `StorageConnection.tsx` 같은 이름으로 옮기는 걸 권장. |
