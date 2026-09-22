# 코랄레드 Cloud 설계 문서

이후 모든 작업(마이그레이션, 서버 API, SDK, 프롬프트, UI)은 이 문서를 기준으로 함. 수정이 필요하면 이 문서를 먼저 고치고 구현을 따라감.

## 0. 목표

비개발자 사용자가 Supabase 가입·프로젝트 생성·키 복사 없이 "저장 기능 켜기" 한 번으로 실제 저장이 되는 앱을 만들 수 있게 한다. 사용자는 코랄레드 Cloud 전용 Supabase 프로젝트를 자신이 소유하지 않고, 코랄레드 서버가 대신 관리한다.

## 1. 위협 모델

전제: 생성된 앱의 클라이언트 코드(JS 번들)는 **전부 공개**된다 — 브라우저 개발자 도구로 누구나 읽을 수 있다. 따라서 "클라이언트 코드에 뭐가 들어있는지"로 보안을 설계하면 안 되고, **서버가 매 요청마다 강제하는 것**으로만 보안이 성립해야 한다.

| # | 공격자 | 시도 | 왜 막히는가 |
|---|---|---|---|
| T1 | 생성된 앱의 사용자(악의적) | 브라우저 콘솔에서 다른 앱의 `appId`로 API를 직접 호출 | 요청엔 반드시 유효한 앱 토큰이 필요함. 토큰은 발급 시 `appId`+`issuedAt`을 서버 시크릿(`CLOUD_APP_TOKEN_SECRET`, 서버에만 존재)으로 HMAC 서명한 것이라 위조 불가능 — 서명이 appId와 묶여 있어서 "내 토큰"으로 "남의 appId"를 호출해도 서버가 재계산한 HMAC이 안 맞아 401 |
| T2 | 같은 앱의 사용자가 다른 기기의 데이터를 보려는 경우 | 유효한 토큰 + 임의의 `device_key` 값으로 조회 | 모든 쿼리가 서버 코드에서 `app_id AND device_key` 둘 다로 필터링됨(SQL WHERE절, 클라이언트가 넘긴 값이 아니라 서버가 검증한 값만 사용). `device_key`를 추측해도 그 기기의 데이터만 보임 — 애초에 앱 하나가 회원 시스템이 없으니 "누구 데이터인지" 자체가 기기 단위 익명 파티션일 뿐, 진짜 인증된 경계는 아님(v1의 알려진 한계, 12번 참고) |
| T3 | 생성된 앱의 사용자 | 다른 앱(coralred가 만든 남의 앱)의 배포 도메인이 아닌 곳에서 API 호출(예: 공격자 자기 사이트에서 fetch) | CORS: `cloud_apps.deploy_origin`에 저장된 정확한 origin만 `Access-Control-Allow-Origin`으로 허용. 배포 전(로컬 프리뷰)엔 SDK가 API를 아예 호출하지 않고 메모리 폴백으로 동작(작업 3) |
| T4 | 악의적 요청자 | `collection` 파라미터에 SQL 조각이나 경로 조작 문자열(`../`, `; drop table`, 등) | 서버가 `^[a-z][a-z0-9_]{0,30}$` 정규식으로 먼저 검증, 실패하면 쿼리 자체를 실행 안 함. Supabase JS 클라이언트는 파라미터 바인딩을 쓰므로 SQL 인젝션 자체는 애초에 문법적으로 불가능하지만, 정규식 검증은 그와 별개로 "이상한 컬렉션명"을 원천 차단 |
| T5 | 악의적 요청자 | 거대한 JSON, 깊은 중첩, 배열 폭탄으로 서버/DB 부담 유발 | 서버가 파싱 직후 깊이(8)·직렬화 크기(64KB) 검사 후 초과 시 즉시 400, DB에 닿지 않음. DB에도 `pg_column_size(data) <= 65536` CHECK 제약으로 2차 방어 |
| T6 | 만료된 무료 앱의 사용자 | 7일 지난 뒤에도 계속 발급된 토큰으로 쓰기 시도 | 토큰 자체(HMAC)는 시간이 지나도 여전히 "서명은 유효"하지만, 매 요청마다 DB에서 `cloud_apps.expires_at`을 확인 — 지났으면 토큰 서명과 무관하게 403 |
| T7 | 특정 앱 하나를 서비스 차원에서 차단해야 하는 경우(악용 신고 등) | — (공격이 아니라 운영 시나리오) | `CLOUD_APP_TOKEN_SECRET`은 전역이라 로테이션하면 모든 앱이 동시에 깨짐. 대신 `cloud_apps.app_secret_hash`를 토큰 발급 시 `sha256(token)`으로 저장해두고, 매 요청마다 재확인 — 이 값을 null로 지우면 그 앱의 토큰만 즉시 무효화(다른 앱은 영향 없음) |
| T8 | 과도한 요청으로 DB/쿼터 소진 유도 | 짧은 시간에 대량 요청 | 레이트리밋(8번) — 앱 전체 분당 120, 기기별 분당 60 |
| T9 | 코랄레드 서버 코드 자체가 실수로 service_role 키를 클라이언트에 흘리는 경우 | — (내부 실수 방지) | service_role 키는 `context.cloudflare.env`로만 읽고 Remix `action`/`loader` 안에서만 사용, `VITE_` 접두사 없음(Vite가 클라이언트 번들에 안 넣음). 빌드 산출물 grep 테스트로 실제로 안 들어갔는지 기계적으로 검증(작업 2) |

## 2. 아키텍처 개요

```
생성된 앱 (브라우저)                    coralred 서버 (Cloudflare Pages Functions)              Cloud Supabase (별도 프로젝트)
┌─────────────────────┐               ┌──────────────────────────────┐              ┌─────────────────────┐
│ coralred-storage.js  │  fetch(토큰)  │ app/routes/api.cloud.*.ts      │  service_role │ cloud_apps           │
│  db.create/list/...  │ ────────────▶ │  - 토큰 HMAC 검증               │ ────────────▶ │ cloud_documents       │
│  (device_key는       │               │  - app_id + device_key 강제 필터│              │ cloud_usage           │
│   localStorage 기기키)│ ◀──────────── │  - 정규식/크기/깊이 검증          │ ◀──────────── │                       │
└─────────────────────┘   JSON 응답    │  - 레이트리밋(RPC)              │              └─────────────────────┘
                                       └──────────────────────────────┘
```

앱은 Supabase URL도 anon key도 **아예 모른다**. 앱이 아는 건 `CLOUD_API_BASE`(coralred 서버 주소, 이미 배포 도메인과 같은 origin이라 사실상 상수)와 `CLOUD_APP_TOKEN`(배포 시 주입되는 문자열) 둘뿐.

## 3. 인증 — 앱 토큰

**발급** (Cloud 켜는 시점, 서버):
1. `appId`(uuid) 생성, `iat`(발급 유닉스초).
2. `payload = appId + '.' + iat`
3. `sig = base64url(HMAC-SHA256(payload, CLOUD_APP_TOKEN_SECRET))`
4. `token = payload + '.' + sig` (예: `<uuid>.<unix초>.<서명>`)
5. `app_secret_hash = sha256(token)`을 `cloud_apps.app_secret_hash`에 저장(해시만, 토큰 원문은 저장 안 함 — DB 유출 시에도 토큰 재구성 불가).
6. `token`은 이 시점에 응답으로 한 번 돌려주고, 배포 파이프라인이 `.env`에 주입(작업 5) — 서버는 이후 원문을 다시 안 돌려줌.

**검증** (매 요청, 서버):
1. `Authorization: Bearer <token>` 헤더에서 토큰 추출, `.`로 3분할 안 되면 401.
2. `payload = appId + '.' + iat` 재구성, `CLOUD_APP_TOKEN_SECRET`으로 HMAC 재계산, 상수시간 비교(`crypto.subtle` 사용 — 타이밍 공격 방지). 불일치 시 401.
3. URL 경로의 `:appId`와 토큰 안의 `appId`가 다르면 401(다른 앱 토큰으로 다른 앱 흉내 방지 — T1).
4. `cloud_apps`에서 `id = appId` 조회. 없으면 401.
5. `sha256(token) !== app_secret_hash`면 401(T7 — 개별 무효화된 토큰).
6. `expires_at`이 있고 지났으면 403(T6).
7. 여기까지 통과해야 실제 쿼리 진행.

`CLOUD_APP_TOKEN_SECRET`은 새 서버 전용 시크릿(`.env`에 사용자가 직접 추가해야 함 — 이 문서에서 값 생성은 안 하고 요구사항만 명시. `openssl rand -hex 32` 같은 걸로 사용자가 만들어서 `.env`에 넣으면 됨).

## 4. API 스펙

베이스: `/api/cloud/:appId/:collection`

| 메서드 | 경로 | 동작 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/api/cloud/:appId/:collection` | 문서 생성 | 헤더: `Authorization: Bearer <token>`. 바디: `{ deviceKey: string, data: object }` | 201 `{ id, data, createdAt, updatedAt }` |
| GET | `/api/cloud/:appId/:collection?deviceKey=...&cursor=...&limit=...` | 목록(페이지네이션, limit 최대 100 기본 20) | 헤더만 | 200 `{ items: [...], nextCursor: string \| null }` |
| GET | `/api/cloud/:appId/:collection/:docId?deviceKey=...` | 단건 조회 | 헤더만 | 200 `{ id, data, createdAt, updatedAt }` 또는 404 |
| PATCH | `/api/cloud/:appId/:collection/:docId` | 부분 수정(data 전체 교체, merge 아님 — SDK가 merge 원하면 먼저 get) | 바디: `{ deviceKey, data }` | 200 갱신된 문서 |
| DELETE | `/api/cloud/:appId/:collection/:docId` | 삭제 | 바디 또는 쿼리로 `deviceKey` | 204 |

공통 에러 응답 형태: `{ error: "해요체 한국어 메시지" }`. 상태코드: 400(검증 실패) / 401(인증 실패) / 403(만료·CORS) / 404(없음) / 413(용량 초과) / 429(레이트리밋) / 507(쿼터 초과 — "용량이 다 찼어요" 계열).

`collection` 세그먼트는 라우트 진입 즉시 정규식 검증(작업 2). `docId`는 uuid 형식 검증.

## 5. 데이터 모델

`RUN-3-cloud.sql`에 정확한 DDL 작성(작업 1). 요약:

- **cloud_apps**: `id, owner_user_id(coralred 계정 auth.users), app_secret_hash, deploy_origin, tier('free'|'paid'), created_at, expires_at`
- **cloud_documents**: `id, app_id, collection(정규식 CHECK), device_key(길이 CHECK), data jsonb(크기 CHECK), created_at, updated_at` — 인덱스 `(app_id, collection, device_key)`
- **cloud_usage**: `app_id(PK), document_count, total_bytes, updated_at` — 트리거로 자동 유지(캐시, 쿼터 계산용)
- **cloud_rate_limit**: `key(PK, 'app:'+appId 또는 'dev:'+appId+':'+deviceKey), window_start, request_count` — RPC로만 갱신

쿼터는 **트리거로 강제**(애플리케이션 코드가 실수로 빼먹어도 DB가 막음 — "검증이 아니라 구조" 원칙). `BEFORE INSERT ON cloud_documents` 트리거가 `cloud_apps.tier`로 한도를 정하고 `cloud_usage`를 확인해서 초과 시 `RAISE EXCEPTION`. 서버 API는 이 예외를 잡아 507로 매핑.

## 6. 쿼터 정책

| 항목 | 무료 | 유료(10배) |
|---|---|---|
| 앱당 문서 수 | 2,000 | 20,000 |
| 앱당 총 용량 | 10MB | 100MB |
| 앱당 컬렉션 수 | 20 | 200 |
| 문서당 크기 | 64KB (공통, 배율 없음) | 64KB |

무료 앱 만료: `created_at + 7일`. 유료: `expires_at = null`.

## 7. 레이트리밋

Cloudflare Pages Functions는 요청마다 새 격리 인스턴스일 수 있어 인메모리 카운터를 신뢰할 수 없음(콜드스타트마다 리셋, 엣지 리전마다 다른 인스턴스). 이미 Cloud 전용 Supabase가 있으므로 거기에 분당 고정 윈도우 카운터 테이블(`cloud_rate_limit`)을 두고, RPC(`cloud_check_rate_limit`)로 원자적 증가+한도 확인. 매 요청마다 실제 CRUD 전에 이 RPC를 한 번 호출 — 왕복이 하나 늘어나는 비용을 감수(v1에서는 정확성 우선, 최적화는 12번 한계에 기록).

앱 전체 120/분, 기기별 60/분 — 둘 중 하나라도 초과하면 429.

## 8. CORS

`cloud_apps.deploy_origin`은 Cloud를 켠 시점엔 비어있고(아직 배포 전), 배포 파이프라인이 첫 배포 성공 시 `https://{projectName}.pages.dev`로 채움(작업 5, overnight5의 `deployToCloudflarePages` 반환값 재사용). 서버는 요청의 `Origin` 헤더를 이 값과 정확히 비교해서 `Access-Control-Allow-Origin`을 그 값으로만 설정 — 와일드카드 사용 안 함. `deploy_origin`이 아직 비어있는 상태(배포 전)에서의 API 호출은 CORS를 통과할 방법이 없음 — 의도된 동작(어차피 미리보기는 API를 안 부름, 작업 3).

## 9. 미리보기(WebContainer) 폴백

`coralred-storage.js`는 실행 시점에 `window.location.origin`이 `CLOUD_API_BASE`와 다르고 로컬/웹컨테이너 프리뷰로 보이면(또는 `CLOUD_APP_TOKEN`이 아예 주입 안 됐으면) 실제 fetch를 시도하지 않고 모듈 스코프의 `Map` 기반 인메모리 스토어로 완전히 동작을 흉내낸다. 새로고침하면 사라짐 — 안내 문구로 고지.

## 10. 만료·정리 (작업 6)

`pg_cron` 확장으로 매시 정각 실행되는 잡: `expires_at`이 지난 `cloud_apps`의 `cloud_documents`를 삭제(앱 행 자체는 남겨서 "만료됐어요" 안내를 계속 보여줄 수 있게 함 — `cloud_apps`는 안 지움, 문서만 지움). 삭제 3일 전 구간은 서버 API가 `expires_at`을 그대로 노출하고 프론트(`/apps`)가 계산해서 안내 뱃지 표시(별도 잡 불필요).

## 11. AI 생성 코드와의 관계 (작업 4 연계)

기본 모드에서 AI는 `@supabase/supabase-js`를 절대 쓰지 않고 `coralred-storage.js`의 `db.*` 메서드만 사용 — 이 문서의 API 스펙이 곧 AI가 알아야 하는 유일한 저장 인터페이스. 회원가입 화면 생성 금지(기기 단위 식별이라 이메일/비번 개념이 없음).

## 12. 알려진 한계 (v1, 정직하게 기록)

- **device_key는 인증이 아니라 파티션**: 브라우저 localStorage를 지우면 그 "사용자"의 데이터에 다시 접근할 방법이 없음(다른 새 기기키가 발급됨). 진짜 계정 시스템이 아니라 "이 브라우저가 만든 데이터"를 남과 안 섞는 수준의 격리. 여러 기기 동기화가 필요하면 자기 Supabase 연결로 안내(배경에 명시된 범위).
- **레이트리밋의 DB 왕복 비용**: 매 요청 RPC 호출 하나 추가. 트래픽이 커지면 CRUD와 합쳐진 단일 RPC로 최적화 여지 있음.
- **CORS의 배포 전 상태**: Cloud를 켠 직후~첫 배포 전 사이엔 어떤 origin에서도 호출 불가(의도됨, SDK가 폴백으로 처리).
- **로테이션**: `CLOUD_APP_TOKEN_SECRET`을 바꾸면 이미 발급된 모든 토큰이 깨짐(전체 재발급 필요). 개별 앱만 무효화하려면 `app_secret_hash`를 null로 지우는 경로가 필요(이번 세션엔 관리자 도구까지는 안 만듦 — SQL로 수동).
