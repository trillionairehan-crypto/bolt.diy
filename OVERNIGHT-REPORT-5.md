# 야간 자율 작업 5차 리포트

브랜치: `overnight4` (계속)
시작: 2026-08-24 (4차 이어서)

규칙 준수 메모: 4차와 동일 — 배포 금지 / main 머지 금지 / pricing.tsx·functions/[[path]].ts 수정 금지 / .env 토큰 값 미노출 / 작업당 개별 커밋 + typecheck/lint/build + git show --stat 검증 / 3회 실패 시 revert.

---

## 작업 6 — 마이그레이션 SQL 출력 (적용은 성민이 직접)

아래 두 파일 모두 **아직 DB에 적용 안 됨**. Supabase 대시보드 → SQL Editor에서 아래 순서로 그대로 실행하면 됨. (둘 사이에 의존관계는 없지만, 파일명 타임스탬프 순서대로 실행 권장.)

### 1) `supabase/migrations/20260825000000_message_metering_v2.sql`
(overnight3에서 작성 — 메시지당 1회 집계 v2 메터링. `app/utils/featureFlags.ts`의 `CORALRED_NEW_METERING` 플래그가 `false`라서 이 마이그레이션을 적용해도 즉시 동작이 바뀌진 않음 — 적용 후 RPC가 정상 동작하는지 확인하고, 그 다음에 플래그를 켜야 실제로 전환됨.)

```sql
-- overnight3 A5: v2 message-metering schema. WRITTEN, NOT APPLIED — see OVERNIGHT-REPORT-3.md's
-- A5 section for the investigation this is based on and the morning application procedure.
--
-- Target definition this implements:
--   - 1 user utterance = 1 message (each real chat send counts once).
--   - Auto-fix triggers (actionAlert-originated retries) are excluded — the client never calls
--     increment_generation_count_v2() for those (see app/components/chat/Chat.client.tsx, the
--     isAutoFix param threaded into sendMessage).
--   - Free tier = 10 messages/month + 1 message/day (whichever runs out first blocks sending).
--
-- Deliberately NOT implemented here: paid-plan carryover (unused monthly messages rolling over,
-- capped at 2x the plan's monthly allotment). That requires knowing each plan's monthly
-- allotment, which lives in app/routes/pricing.tsx — a file this overnight session is not
-- allowed to open. The carryover_count column below is reserved for that; wire it up once the
-- plan schema is confirmed by hand in the morning.
--
-- This is purely additive — a new table and two new RPCs, both suffixed _v2. It does not touch
-- the existing generation_usage table or get_generation_count/increment_generation_count RPCs
-- that app/lib/freeTrial.ts's current (non-v2) functions call, which live only in the Supabase
-- project itself (not tracked in this repo) and are left completely untouched.

create table if not exists public.generation_usage_v2 (
  user_id uuid primary key references auth.users (id) on delete cascade,
  period_month text not null,
  month_count integer not null default 0,
  period_day text not null,
  day_count integer not null default 0,
  -- Reserved for paid-plan carryover (max 2x monthly allotment) — not yet read or written by
  -- any RPC below. See note above.
  carryover_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.generation_usage_v2 enable row level security;

create policy "users can read own v2 generation usage"
  on public.generation_usage_v2
  for select
  using (auth.uid() = user_id);

-- No insert/update policy for end users — all writes go through the SECURITY DEFINER RPC below,
-- so a client can never set its own count directly.

create or replace function public.get_generation_status_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.generation_usage_v2;
  v_month text := to_char(now(), 'YYYY-MM');
  v_day text := to_char(now(), 'YYYY-MM-DD');
  v_month_count integer;
  v_day_count integer;
  v_free_monthly_limit constant integer := 10;
  v_free_daily_limit constant integer := 1;
begin
  select * into v_row from public.generation_usage_v2 where user_id = auth.uid();

  if v_row.user_id is null then
    v_month_count := 0;
    v_day_count := 0;
  else
    v_month_count := case when v_row.period_month = v_month then v_row.month_count else 0 end;
    v_day_count := case when v_row.period_day = v_day then v_row.day_count else 0 end;
  end if;

  return jsonb_build_object(
    'monthRemaining', greatest(v_free_monthly_limit - v_month_count, 0),
    'dayRemaining', greatest(v_free_daily_limit - v_day_count, 0),
    'carryover', coalesce(v_row.carryover_count, 0)
  );
end;
$$;

create or replace function public.increment_generation_count_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_day text := to_char(now(), 'YYYY-MM-DD');
begin
  insert into public.generation_usage_v2 (user_id, period_month, month_count, period_day, day_count)
  values (auth.uid(), v_month, 1, v_day, 1)
  on conflict (user_id) do update set
    month_count = case
      when public.generation_usage_v2.period_month = v_month
      then public.generation_usage_v2.month_count + 1
      else 1
    end,
    period_month = v_month,
    day_count = case
      when public.generation_usage_v2.period_day = v_day
      then public.generation_usage_v2.day_count + 1
      else 1
    end,
    period_day = v_day,
    updated_at = now();

  return public.get_generation_status_v2();
end;
$$;

grant execute on function public.get_generation_status_v2() to authenticated;
grant execute on function public.increment_generation_count_v2() to authenticated;
```

### 2) `supabase/migrations/20260825000001_deployed_apps.sql`
(overnight3에서 작성, overnight4에서 `project_name` 컬럼 추가, 이번 세션에서 `supabase_connected` 컬럼 추가 — /apps 대시보드와 커스텀 도메인 기능이 이 테이블에 의존함.)

```sql
-- overnight3 A6: "내 앱" (/apps) dashboard storage. WRITTEN, NOT APPLIED — see
-- OVERNIGHT-REPORT-3.md's A6 section for the investigation and morning application procedure.
--
-- Investigated first (per instructions) before writing this: there was no deploy-record storage
-- anywhere before tonight — Netlify/Vercel deploys only ever wrote a bare
-- `localStorage.setItem('netlify-site-<chatId>', siteId)` (no URL, no timestamp, browser-local
-- only). This table is new, additive storage for a real history of deploys, one row per deploy.
--
-- No server-side deploy token exists for coralred to call on the user's behalf — Netlify/Vercel
-- calls happen directly from the browser using a personal access token the user pastes into
-- settings (see app/lib/stores/netlify.ts / vercel.ts), stored in that browser's localStorage
-- only. That means redeploy/delete from /apps cannot be implemented server-side tonight; the
-- report documents this as a requirement for whoever adds it, rather than shipping a dead button.

create table if not exists public.deployed_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chat_id text not null,
  app_name text not null,
  url text not null,
  provider text not null,
  -- Cloudflare Pages project name (e.g. "coralred-app-<chatId>"), null for other providers.
  -- overnight4 A3: needed so /apps' custom-domain UI calls the Pages domains API against the
  -- exact project the deploy actually created, rather than recomputing a name from chat_id — which
  -- is NOT always the same string used at deploy time (recordDeployedApp resolves chat_id to the
  -- routable urlId when it can, which can differ from the raw id toProjectName() hashed).
  project_name text,
  -- overnight5 작업 5: this deploy's build had real Supabase credentials injected (vs. the
  -- generated app's default sample-data mode) — see CloudflareDeploy.client.tsx's
  -- injectSupabaseEnv and /apps' badge that reads this column.
  supabase_connected boolean not null default false,
  deployed_at timestamptz not null default now()
);

create index if not exists deployed_apps_user_id_deployed_at_idx
  on public.deployed_apps (user_id, deployed_at desc);

alter table public.deployed_apps enable row level security;

create policy "users can read own deployed apps"
  on public.deployed_apps
  for select
  using (auth.uid() = user_id);

create policy "users can insert own deployed apps"
  on public.deployed_apps
  for insert
  with check (auth.uid() = user_id);

-- user_id is not settable from the client insert payload (app/lib/deployedApps.ts only sends
-- chat_id/app_name/url/provider) — filled in by this trigger from the authenticated session
-- instead, so a user can never insert a row under someone else's user_id.
create or replace function public.set_deployed_apps_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists deployed_apps_set_user_id on public.deployed_apps;

create trigger deployed_apps_set_user_id
  before insert on public.deployed_apps
  for each row
  execute function public.set_deployed_apps_user_id();
```

두 파일 다 `create table if not exists` / `create or replace function`이라 여러 번 실행해도 안전(멱등적)함.

---

## 진행 상황 (작성 중 — 실시간 업데이트)

### 작업 1 — 배포 URL 프로덕션 도메인 수정
**상태: 완료** — 커밋 `756ed82`

**원인**: `createDeployment()`가 어느 브랜치용 배포인지 Cloudflare에 알려주지 않아서, 이 Direct Upload 배포가 프로덕션 배포로 확실히 인식되지 않았음 — 그래서 응답의 `aliases`가 비어있거나 신뢰할 수 없는 상태였고, 기존 코드는 `deployment.url`(해시 프리뷰 URL, 바로 그 깨지는 케이스)로 폴백하고 있었음.

**수정**: 프로젝트 생성 시 설정한 `production_branch`와 동일한 값(`'main'`)을 배포 요청에도 명시적으로 포함(`PRODUCTION_BRANCH` 상수로 둘을 동기화). 반환 URL은 API 응답을 아예 신뢰하지 않고 `https://{projectName}.pages.dev`로 결정론적으로 생성 — Cloudflare가 `aliases`를 채워주든 말든 항상 정확함.

**SSL 활성화 지연 안내**: 판단 결과 추가하기로 함 — 새 프로젝트를 막 만든 첫 배포에서만(재배포 시엔 안 뜸) "방금 만든 주소예요. 1분 정도 후에 다시 열어보면 더 잘 열려요" 안내를 성공 화면에 표시. `ActionRunner.handleDeployAction`에 `note` 필드를 새로 추가해서 구현(기존엔 `content`가 에러 메시지 전용이었음).

**테스트**: 기존 vitest 2건을 새 동작(결정론적 URL, `isFirstDeploy`, `branch` 폼 필드 전송)을 검증하도록 재작성. 16/16 통과.

### 작업 2 — 배포 드롭다운 정리
**상태: 완료** — 커밋 `24b37e7`

배포 버튼을 "클릭하면 바로 메뉴 열림" 구조에서 "메인 영역 클릭 = Cloudflare 바로 배포, 옆의 작은 화살표 = 다른 방법 메뉴" 스플릿 버튼 구조로 변경. Netlify/Vercel/GitHub/GitLab은 Radix `DropdownMenu.Sub`(이 코드베이스에서 처음 쓰는 패턴이지만 이미 설치된 패키지의 표준 기능)로 "다른 방법으로 내보내기" 하위 메뉴에 그대로 이동 — 기능 제거 없음, 핸들러/비활성 조건 동일. 라벨을 영어→한국어로 통일("Deploy to Netlify"→"Netlify로 내보내기" 등, 이번 작업과 무관하게 전부터 있던 voice.md 위반이었으나 파일 만지는 김에 같이 정리).

### 작업 3 — Supabase 연결 마법사 (핵심 작업)
**상태: 완료** — 커밋 `a0d63b0`

**전수 조사 결과 (요청대로 기록)**
- 진입점: `app/components/chat/SupabaseConnection.tsx` (ChatBox의 "저장 기능 켜기" 버튼) + `app/components/@settings/tabs/supabase/SupabaseTab.tsx` (설정 탭, 별도 상태 관리, 이번엔 안 건드림).
- **OAuth 없음.** 기존 방식은 **Supabase Personal Access Token**(계정 전체 권한, `app.supabase.com/account/tokens`에서 발급, 영어 페이지) 입력 → 서버가 Supabase Management API(`/v1/projects`)로 그 계정의 **모든 프로젝트 목록**을 가져옴 → 사용자가 프로젝트를 하나 선택 → 앱이 자동으로 그 프로젝트의 anon key를 가져와 저장.
- 문제점: (1) "Personal Access Token"이 뭔지, 어디서 만드는지 비개발자는 전혀 모름 (2) 이 토큰은 앱 하나가 아니라 **계정의 모든 프로젝트**에 접근 가능 — 과도한 권한 (3) `api.supabase.ts`가 진짜 사용자 정보 대신 `{email:'Connected', role:'Admin'}`라는 가짜 값을 반환하고 있었음(발견한 voice.md 위반이자 사실상 눈속임 데이터).
- 이미 있던 `credentials: {supabaseUrl, anonKey}` 개념(생성 요청에 실제로 AI 프롬프트까지 전달됨 — `Chat.client.tsx`)을 그대로 재사용할 수 있다는 걸 확인 — 새 스키마 안 만들어도 됨.

**구현**: URL + anon key 2칸만 받는 마법사로 전면 교체. 1단계(가입, GitHub로 가입하는 게 제일 빠르다는 안내) → 2단계(New Project 버튼, 비밀번호 자동생성, 지역 선택 — 텍스트로만 안내) → 3단계(Settings→API Keys에서 Project URL / anon public key 복사, **service_role 키는 절대 넣지 말라는 경고 포함**) → 입력 즉시 `{url}/auth/v1/settings`에 실제로 요청을 보내 살아있는 키인지 검증 후 연결 확정. 이전 PAT+프로젝트목록 방식은 삭제하지 않고 유지(이미 연결된 소수 사용자, 설정 탭 이용자용) — `connection.user` 존재 여부로 두 화면을 분기.

**부수적으로 발견해 같이 고친 것**: 앱 전체에 "연결됐다"를 판단하는 로직이 **서로 다른 기준으로 3곳에 따로** 있었음 — 새 방식으로 연결해도 이 셋 중 2곳은 여전히 "연결 안 됨"으로 인식하는 상태였음:
1. `useSupabaseConnection.ts` — `user && token`만 확인
2. `SupabaseAlert.tsx`(채팅 중 뜨는 저장 기능 변경 배너) — `token && selectedProjectId`만 확인
3. `Chat.client.tsx`의 `hasSelectedProject`(AI 생성 프롬프트에 그대로 들어가서, AI가 진짜 Supabase 코드를 쓸지 샘플 데이터로 쓸지 결정하는 값) — PAT 방식의 프로젝트 목록에서만 계산됨

`app/lib/stores/supabase.ts`의 `updateSupabaseConnection`에서 딱 한 번, 두 방식 모두 인식하도록 통합 계산하고, 나머지 세 곳은 그 값을 그대로 읽도록 수정 — 이 통합이 없었으면 마법사로 연결해도 배너나 AI 생성 로직이 계속 "연결 안 됨"으로 오작동했을 것.

**또 하나 발견한 진짜 구조적 문제**: `SupabaseAlert.tsx`의 "변경사항 적용" 버튼은 Supabase Management API로 SQL을 직접 실행하는데, **anon key로는 이게 원천적으로 불가능**함(Management API는 PAT 전용). 고치기 전엔 단순화 플로우 사용자가 이 버튼을 누르면 `console.error`만 찍히고 아무 반응도 없이 조용히 실패하는 상태였음. 연결은 됐지만 자동 적용은 안 되는 제3의 상태를 추가해서, 이 경우엔 SQL을 펼쳐서 보여주고 "SQL 복사" + "SQL 편집기 열기" 버튼으로 사용자가 직접 Supabase SQL Editor에 붙여넣도록 안내.

**연결 후 샘플→실제 전환 확인**: `Chat.client.tsx`가 `supabase.hasSelectedProject`를 AI 생성 프롬프트에 넘기는 것까지 코드로 확인함(위 수정으로 이제 credentials 존재 여부 기준). 실제로 생성된 앱이 샘플 데이터 대신 진짜 Supabase 클라이언트 코드를 쓰는지는 브라우저 확인 필요 — 체크리스트에 추가.

### 작업 4 — 배포에 Supabase 키 주입
**상태: 완료** — 커밋 `a3021cf`

**조사 결과**: `new-prompt.ts` 시스템 프롬프트가 이미 "연결이 선택돼 있으면 `.env`에 `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`를 써라"고 AI에게 지시하고 있었고, Vite가 빌드 시점에 `VITE_*`를 정적으로 inline함 — 즉 메커니즘 자체는 부분적으로 있었음. 하지만 이건 **AI가 매번 그 지시를 따른다는 보장이 없는** 프롬프트 의존 동작이고, 특히 "앱을 먼저 만들고 → 나중에 마법사로 Supabase를 연결"하는 이번 세션의 실제 사용 흐름에서는 AI가 그 시점 이후 다시 그 파일을 쓸 이유가 없어서 **빠질 수 있는 틈**이 실제로 있었음.

**구현**: `useCloudflareDeploy`에 빌드 직전(Vite가 빌드 시점에 값을 굳히므로) 결정론적 주입 단계 추가 — 스토어에서 직접 연결된 credentials를 읽어서, WebContainer의 기존 `.env`를 줄 단위로 파싱해 두 키만 교체/추가(AI가 써둔 다른 변수는 그대로 유지) 후 다시 씀. 연결 안 된 앱은 이 함수가 즉시 리턴해서 손대지 않음 — 요청대로 샘플 데이터 모드 그대로 동작.

**보안 검증**: `app/lib/supabase/keyRole.ts` — Supabase anon key/service_role key 둘 다 JWT인데, payload의 `role` 클레임으로 구분 가능하다는 점을 이용해 디코딩. **두 지점에서 독립적으로 체크**: (1) 마법사 입력 시점(`handleSimpleConnect`, 작업 3에서 이미 커밋됨 — 이번 커밋에서 service_role 거부 로직 추가) (2) 배포 직전 주입 시점(`injectSupabaseEnv`, 1번 체크를 우회한 값이 스토어에 남아있는 경우까지 대비한 2차 방어선) — service_role로 판정되면 배포 자체를 중단시킴. vitest 7건(진짜 형태의 anon/service_role JWT로 검증, 손상된 입력 처리 포함).

### 작업 5 — 배포 완료 화면 "다음 단계" 가이드
**상태: 완료** — 커밋 `ad481c0`

`DeployAlert.tsx`의 배포 성공 화면(`type==='success' && stage==='complete'`)에 "다음 단계" 카드 3개 추가:
1. **Supabase 연결** — 아직 연결 안 됐을 때만 표시, 클릭하면 작업 3의 마법사가 열림(`open-supabase-connection` 이벤트 재사용).
2. **링크 공유** — 이미 있던 복사 버튼 로직 재사용.
3. **수정 안내** — 채팅으로 요청하고 다시 배포하면 같은 주소로 업데이트된다는 안내(정적 텍스트, 별도 액션 불필요).

`/apps`에 두 번째 뱃지("저장 기능 연결됨"/"샘플 데이터") 추가 — `deployed_apps` 마이그레이션(아직 미적용, 안전하게 계속 확장 중)에 `supabase_connected` 컬럼 추가하고, `injectSupabaseEnv`가 그 배포에서 실제로 키를 주입했는지 여부를 그대로 기록(현재 연결 상태를 다시 조회하지 않음 — 나중에 연결을 끊어도 "그 배포 당시" 상태를 정확히 반영).

### 작업 6 — 마이그레이션 SQL 출력
**상태: 완료** — 커밋 `959f01e`. 위 섹션에 두 마이그레이션 전문과 실행 순서 출력함. 적용은 안 함(요청대로).

---

## 작업 7 — 검증 루프 (종료 조건 없음, 계속 진행 중)

### 사이클 1
**기준선**: `pnpm test`(173개, 이후 175개) / `pnpm typecheck` / `pnpm lint` / `pnpm build` 전부 통과 확인.

**우선 심층 리뷰 1 — Supabase 키 주입 경로: 실제 보안 구멍 발견 및 수정 (커밋 `2a8fcd2`)**

`isServiceRoleKey`(`app/lib/supabase/keyRole.ts`)가 레거시 JWT 형태 키(`header.payload.signature`, payload의 `role` 클레임으로 anon/service_role 구분)만 디코딩하고 있었음. 그런데 Supabase가 2024년부터 새 API 키 형식(`sb_publishable_...`/`sb_secret_...`)을 도입했고, 지금(2026)은 새 프로젝트의 기본 키 형식임 — 이 새 키들은 JWT가 아니라 점(`.`)으로 구분되지 않는 불투명 문자열이라 `jwt.split('.')[1]`이 `undefined`가 되고, `getSupabaseKeyRole`은 `null`을 반환 → `isServiceRoleKey`가 `false`를 반환. 즉 사용자가 새 프로젝트의 "secret" 키(레거시 service_role에 해당)를 anon key 입력란에 붙여넣으면, 마법사 연결 시점과 배포 주입 시점 둘 다에서 걸러지지 않고 그대로 통과했을 것.

**수정**: `sb_secret_` 접두사를 별도로 차단하는 체크 추가(`isServiceRoleKey`가 두 형식 모두 확인). 두 체크포인트(`handleSimpleConnect`, `injectSupabaseEnv`) 모두 이 함수 하나를 통해 검증하므로 한 곳만 고치면 둘 다 방어됨. vitest 2건 추가(`sb_secret_` 차단, `sb_publishable_` 허용). 마법사 안내 문구와 에러 메시지도 "anon/public" 뿐 아니라 "publishable", "service_role/secret"까지 언급하도록 업데이트 — 새 형식 프로젝트에서도 안내가 정확하게 맞도록.

**우선 심층 리뷰 2 — 배포 파이프라인의 바이너리 처리**: `bytesToBase64`/`base64ToBytes` 라운드트립, blake3 해시 계산, `.html` 배지 주입 순서(해시 계산 전에 배지가 먼저 주입되므로 해시가 최종 콘텐츠 기준으로 정확함) 정적 검토 완료 — 로직 자체는 정확함. 다만 `chunkForUpload`의 배치 크기 판단이 원본 바이트 기준(`UPLOAD_BATCH_MAX_BYTES` 20MB)이고 실제 전송은 base64 인코딩(약 1.33배 부풀림)이라, 25MB에 가까운 단일 파일 하나만으로 배치가 실제로는 ~26~27MB짜리 요청이 될 수 있음. Cloudflare의 실제 요청 크기 제한이 정확히 얼마인지 문서화되어 있지 않고, 이 배포 규칙상 실제 배포를 실행해 테스트할 수 없어(배포 금지) 라이브 검증 불가 — 아래 "미수정 이슈"에 기록.

**우선 심층 리뷰 3 — 마법사 상태 전이**: `SupabaseConnection.tsx`/`useSupabaseConnection.ts` 검토. `handleWizardConnect`→`handleSimpleConnect` 흐름, 연결/해제/에러 상태들의 store 반영 확인. `연결하기` 버튼은 `simpleConnecting`으로 disabled 처리되지만, `setSimpleConnecting(true)`가 URL/키 형식 검증 이후에 호출되므로 아주 빠른 연속 클릭 시 두 번째 클릭이 첫 번째 렌더 반영 전에 새 요청을 시작할 이론적 여지가 있음 — 다만 두 요청 모두 멱등적(같은 값으로 같은 store 업데이트)이라 실질적 피해 없음(중복 토스트 정도). 낮은 심각도로 판단, 이번 사이클엔 수정 보류.

**이번 사이클 커밋**: `959f01e`(작업 6 리포트), `2a8fcd2`(service_role 키 형식 보안 수정).

### 사이클 2
**테스트 실행 가능 검증**: 배포 파이프라인의 바이너리 처리 관련해서 이전엔 없던 실행 가능 테스트 2건 추가 — (1) 25MB 초과 파일 거부 시 `toUserMessage`가 의존하는 "파일이" 문자열이 실제로 에러 메시지에 포함되는지, (2) 200개 파일 배치 상한을 넘겼을 때 업로드 요청이 실제로 여러 번(200개+1개)으로 쪼개지는지 — 둘 다 모킹된 fetch로 실제 실행해서 확인함(커밋 `c2c16f0`).

**정적 스캔 — unused code**: `useSupabaseConnection.ts`의 `handleConnect`/`updateToken`이 어느 소비자에서도 호출되지 않는 걸 발견. 이 훅은 현재 `SupabaseConnection.tsx`(채팅 마법사) 하나만 쓰는데, 이번 세션 초반 작업 3 리팩터링 이후로 그 컴포넌트는 이 두 export를 구조분해하지 않음. eslint의 no-unused-vars가 못 잡는 이유는 훅의 return 객체 프로퍼티라서 — 실제 소비자가 구조분해하는지까지는 정적 룰이 못 봄. 삭제 전에 PAT 연결 경로 자체가 완전히 죽은 게 아닌지 확인: 설정(Settings) 페이지의 `SupabaseTab.tsx`가 동일한 `supabaseConnection` 스토어를 직접 읽고 쓰는 자기 자신만의 `handleConnect` 구현을 갖고 있어서, PAT 연결 자체는 여전히 그 경로로 가능함(중복 구현이 두 곳에 있었던 것). 안전하게 삭제 가능 확인 후 제거(커밋 `91b4d28`) — `logStore` import도 그 함수에서만 쓰이고 있어서 같이 제거.

**이번 사이클 커밋**: `c2c16f0`(바이너리 처리 테스트 추가), `91b4d28`(죽은 코드 제거).

*(사이클 3 이후는 계속 진행 중 — 종료 조건 없음. 성민이 돌아올 때까지 같은 구조로 반복하며 이 파일에 계속 append함.)*

---

## 작업별 완료/스킵 요약

| 작업 | 상태 | 커밋 |
|---|---|---|
| 1. 배포 URL 프로덕션 도메인 수정 | 완료 | `756ed82` |
| 2. 배포 드롭다운 정리 | 완료 | `24b37e7` |
| 3. Supabase 연결 마법사 | 완료 | `a0d63b0` |
| 4. 배포에 Supabase 키 주입 | 완료 | `a3021cf` |
| 5. 배포 완료 화면 "다음 단계" 가이드 | 완료 | `ad481c0` |
| 6. 마이그레이션 SQL 출력 | 완료 | `959f01e` |
| 7. 검증 루프 | 진행 중 (종료 조건 없음) | `2a8fcd2`, `c2c16f0`, `91b4d28`, `2b5e937`, `488384e` |

이미 완료된 상태라 스킵 처리한 작업은 없음 — 7개 작업 모두 이번 세션에서 처음 손댐.

## 전체 커밋 목록 (이번 세션, 오래된 순)

1. `756ed82` fix: return the stable pages.dev URL instead of a hash-preview URL
2. `24b37e7` feat: promote Cloudflare to the default one-click deploy action
3. `a0d63b0` feat: non-developer-friendly Supabase connection wizard
4. `a3021cf` feat: inject connected Supabase credentials into every Cloudflare deploy
5. `ad481c0` feat: post-deploy "다음 단계" guide cards + /apps connection badge
6. `959f01e` docs: add migration SQL + execution order to overnight5 report (task 6)
7. `2a8fcd2` fix: block Supabase's new sb_secret_ key format in service-role guard
8. `2b5e937` docs: log task 6 completion and validation-loop cycle 1 in overnight5 report
9. `c2c16f0` test: cover Cloudflare deploy file-size limit and upload batching
10. `91b4d28` refactor: remove dead handleConnect/updateToken from useSupabaseConnection
11. `488384e` docs: log validation-loop cycle 2 in overnight5 report

전부 `pricing.tsx`/`functions/[[path]].ts` 미포함, `.env` 값 미노출, 커밋 전 typecheck+lint+build 통과 확인.

## 성민 브라우저 체크리스트 (내가 직접 확인 못 하는 것들)

이번 세션은 WebContainer/브라우저를 직접 조작해서 눈으로 확인하는 게 불가능한 환경이라, 아래는 전부 정적 검토 + vitest로만 검증했고 실제 브라우저에서 한 번씩 눈으로 봐야 확실함.

1. **배포 URL 실사용 재확인** — 작업 1 수정 후 실제로 새 프로젝트를 배포해서 반환된 `{project}.pages.dev` 주소가 SSL 오류 없이 바로 열리는지. (직전 실사용 테스트에서 발견된 원 버그의 재현 확인.)
2. **배포 드롭다운 UI** — Cloudflare 버튼 바로 클릭 시 배포되는지, 캐럿 버튼 눌렀을 때 "다른 방법으로 내보내기" 서브메뉴가 Radix Sub 컴포넌트로 정상적으로 열리고 hover/keyboard 네비게이션이 되는지 (Sub 메뉴는 이번 세션에서 이 코드베이스에 처음 쓴 패턴).
3. **Supabase 마법사 3단계 화면** — 실제로 새 Supabase 계정으로 처음부터 끝까지 따라가봤을 때 안내 문구(어떤 버튼을 누르라는 지시)가 실제 Supabase 화면과 어긋나지 않는지. Supabase가 UI를 자주 바꾸는 편이라 "톱니바퀴 모양 Project Settings" 같은 문구가 최신 화면과 다를 수 있음.
4. **anon/publishable 키 붙여넣기 → 연결 → 샘플 데이터 배너 전환** — 마법사로 연결 성공 시 생성된 앱 미리보기의 "샘플 데이터" 배너가 실제로 "연결됨" 상태로 바뀌는지 (스토어 상태 전이는 확인했지만, 그 상태를 구독하는 미리보기 iframe/배너 쪽까지는 이번 세션에서 직접 렌더링해서 보지 못함).
5. **배포 시 Supabase 키 실제 주입 확인** — 연결된 앱을 배포한 뒤, 배포된 사이트가 실제로 그 Supabase 프로젝트에 데이터를 저장/조회하는지 (즉 `.env` 주입이 빌드에 실제로 반영됐는지 최종 결과물에서 확인).
6. **배포 완료 화면 "다음 단계" 카드** — 3개 카드가 실제 배포 흐름에서 올바른 타이밍에 나타나는지, Supabase 카드 클릭 시 마법사가 정말 열리는지.
7. **/apps 대시보드 뱃지** — "저장 기능 연결됨"/"샘플 데이터" 뱃지가 실제 배포 기록과 맞게 표시되는지 (마이그레이션이 아직 미적용이라 지금은 이 컬럼 자체가 없어서, 마이그레이션 적용 후에만 확인 가능).
8. **마이그레이션 실행** — Task 6에 출력한 두 SQL을 Supabase SQL Editor에서 실행하고 에러 없이 끝나는지.

## 미수정 이슈 (사유)

| 이슈 | 사유 |
|---|---|
| `chunkForUpload`가 base64 인코딩으로 인한 ~1.33배 부풀림을 배치 크기 계산에 반영 안 함 — 25MB에 가까운 단일 파일이 있으면 실제 전송 요청이 20MB 배치 상한보다 커질 수 있음 | Cloudflare의 실제 요청 크기 한도가 문서화돼 있지 않고, 실제 배포 없이는 라이브 검증이 불가능함(이번 세션은 배포 금지). 코드 로직 자체는 일관되고 현재 앱 빌더 규모(대부분 수백 KB~수 MB) 사이트에선 발생 가능성이 낮음 — 실사용 중 대용량 파일(동영상 등) 배포 시 관찰 필요. |
| 마법사 "연결하기" 버튼의 초고속 연속 클릭 시 `simpleConnecting` 상태 반영 전에 두 번째 클릭이 통과할 이론적 여지 | 두 요청 모두 멱등적이라 실질적 피해가 토스트 중복 정도로 낮음. 클로드플레어 배포 쪽엔 이미 있는 재진입 가드 패턴을 여기도 넣을 수 있지만, 실제 사용자 피해가 없어 이번 사이클엔 우선순위 낮음으로 보류. |
| Custom domain API(`addCustomDomain`/`getCustomDomainStatus`)의 응답 필드 구조가 실제 라이브 API로 검증된 적 없음(이전 세션부터 계속) | Cloudflare Pages 커스텀 도메인 API는 Wrangler CLI 자체에 서브커맨드가 없어 실사용 레퍼런스가 없고, DNS/도메인 편집 권한이 있는 토큰으로 라이브 테스트하는 것도 배포 금지 범위 밖 작업이라 판단해 보류. |

---

## 추가 작업 — Supabase 연결 진입점이 사용자에게 노출되지 않는 문제
**상태: 완료** — 커밋 `af1e0cd`(헤더 진입점 + postMessage 브릿지), `e058ab8`(시스템 프롬프트 문구 수정)

### 조사

**연결 UI가 실제로 어디서 열리는지 전수 확인**: `<SupabaseConnection>`(overnight5 마법사 포함)은 세션 시작 시점엔 `ChatBox.tsx`(채팅 입력창 툴바, 전송 버튼 옆) 딱 한 곳에만 마운트돼 있었음 — `showLabel={isLanding}`이라 랜딩 페이지에선 "저장 기능 켜기" 텍스트가 보이지만, 채팅이 시작된 뒤(`isLanding=false`)엔 Supabase 로고 아이콘만 남고 라벨이 사라짐. 반면 작업공간 헤더(`HeaderActionButtons.client.tsx`)엔 `shouldShowButtons && <DeployButton />`만 있고 Supabase 관련 버튼이 전혀 없었음 — 신고된 증상과 정확히 일치. 이 마법사를 여는 경로는 총 3개였음: (1) 채팅 입력창의 아이콘 버튼(직접 클릭), (2) `DeployAlert.tsx`의 배포 완료 카드(`open-supabase-connection` CustomEvent를 `document`에 dispatch), (3) `SupabaseAlert.tsx`의 SQL 배너 "저장 기능 연결하기" 버튼(같은 이벤트 dispatch) — (2)와 (3)은 헤더나 배포 후에만 뜨는 알림이라 상시 노출이 아니었고, 실질적인 상시 진입점은 (1) 하나뿐이었는데 그게 안 보이는 게 문제였음.

**생성된 앱의 "샘플 데이터" 배너 위치 확인 — 예상과 다른 구조 발견**: 배너 텍스트("샘플 데이터로 보고 있어요...")를 코드베이스에서 찾아보니 coralred 자체 UI가 아니라 `new-prompt.ts`(시스템 프롬프트) 안에 AI가 생성 앱 자신의 JSX에 넣도록 지시하는 예시 코드였음 — 즉 이 배너는 WebContainer 프리뷰 iframe 안, coralred 호스트 페이지와는 별개의 문서(origin)에서 렌더링됨. 클릭 가능하게 만들려면 coralred 쪽 DOM에서 직접 이벤트를 붙일 수 없고, `window.postMessage` 기반 크로스 프레임 통신이 필요함 — 이 코드베이스엔 이미 `Inspector.tsx`(요소 검사 기능)가 같은 패턴(`iframe.contentWindow.postMessage` + 부모의 `window.addEventListener('message', ...)`)을 쓰고 있어서 그 방식을 그대로 따름.

**생성된 앱의 Supabase 사용 여부 감지 가능성 확인**: 시스템 프롬프트상 "CRITICAL: Use Supabase for databases by default, unless specified otherwise" — 데이터가 필요 없는 앱(계산기 등)은 애초에 Supabase를 안 쓸 수 있음. 코드베이스에 파일 트리에서 `@supabase/supabase-js` import 여부 등으로 감지하는 기존 로직은 없었음(직접 확인). 다만 이번 요구사항이 "상시 노출"이라 감지 로직 자체가 불필요 — 배포 버튼처럼 항상 보여주는 쪽으로 구현하고, 감지 로직은 만들지 않음(과잉 구현 방지).

**문구 출처 확인**: "채팅창 상단에서 Supabase를 연결하면..." 문구는 시스템 프롬프트에 하드코딩된 한국어 문장이 아니라, `new-prompt.ts`의 `<request_specific_values>`에 있는 영문 지시문 `'Remind user to "connect to Supabase in chat box before proceeding".'`을 AI가 매 응답마다 자연스러운 한국어로 풀어쓴 결과였음 — 즉 이 지시문 자체를 고쳐야 AI의 모든 응답에서 일관되게 고쳐짐. 같은 문구가 `prompts.ts`("original")와 `optimized.ts`("optimized")에도 있지만 이 둘은 `PromptLibrary`에서 `'default'`(=`new-prompt.ts`)가 아닌 대체 프롬프트라 기본 사용자에게는 노출되지 않음 — 실제 증상과 무관하다고 판단해 손대지 않음(범위 최소화).

### 구현

1. **헤더 상시 노출** (`af1e0cd`): `<SupabaseConnection>`을 `ChatBox.tsx`에서 제거하고 `HeaderActionButtons.client.tsx`로 이동, `<DeployButton />` 왼쪽에 배치. `shouldShowButtons`(activePreview 존재 여부) 조건 없이 항상 렌더링 — Header.tsx가 이미 `chat.started`일 때만 이 컴포넌트를 렌더링하므로 결과적으로 "채팅이 시작된 이후 상시 노출". 인스턴스를 여러 곳에 중복 마운트하면 Dialog가 두 번 열릴 위험이 있어서(각 인스턴스가 독립된 `useState`로 열림 상태를 들고 있음), 새로 추가하지 않고 기존 마운트를 헤더로 옮기는 방식을 택함 — 이제 마운트는 정확히 하나. 버튼 라벨을 "저장 기능 켜기"/"연결됨"에서 "Supabase 연결"/"Supabase 연결됨"으로 변경(작업 지시의 버튼명과 일치).
2. **미리보기 배너 클릭 가능화** (`af1e0cd`): `app/lib/supabase/previewBridge.ts` 신설 — `OPEN_SUPABASE_CONNECTION_MESSAGE_TYPE` 상수와 `isOpenSupabaseConnectionMessage` 판별 함수. `SupabaseConnection.tsx`의 기존 `open-supabase-connection` CustomEvent 리스너 옆에 `window.addEventListener('message', ...)`를 추가해서 이 메시지를 받으면 같은 방식으로 다이얼로그를 엶. `new-prompt.ts`의 배너 예시 3곳(RIGHT 예제 2개 + 서술 문단 1개) 전부 `<span>`에서 `<button onClick={() => window.parent.postMessage({ type: 'coralred:open-supabase-connection' }, '*')}>`로 교체, "배너는 반드시 클릭 가능해야 하며 이 메시지 타입 문자열을 정확히 써야 한다"를 CRITICAL 규칙에 추가.
3. **AI 안내 문구 위치 수정** (`e058ab8`): `<request_specific_values>`의 두 리마인더 지시문을 "in chat box" → "Supabase 연결 버튼(배포 버튼 옆, 작업공간 상단)"으로 수정. "WRONG" 예시 안에 있던 동일 문구도 일관성을 위해 같이 수정(그 예시 자체는 여전히 금지된 패턴을 보여주는 용도).
4. **세 경로 동일 마법사 확인**: 마운트가 정확히 하나이므로(2번 항목) 구조적으로 세 경로(헤더 버튼 직접 클릭 / `open-supabase-connection` CustomEvent — 배포 완료 카드·SQL 배너에서 계속 사용 / 새 `message` 이벤트 — 생성 앱 배너) 전부 같은 컴포넌트 인스턴스의 같은 `isDialogOpen` 상태를 열게 됨. 이전처럼 여러 인스턴스를 두는 방식이 아니라서 "두 다이얼로그가 동시에 뜨는" 류의 버그가 애초에 발생할 수 없는 구조.

### 검증

- typecheck / lint / test(181개 통과, `previewBridge.spec.ts` 4개 신규) / build 전부 클린.
- `isOpenSupabaseConnectionMessage`에 대해 vitest로 실행 가능 검증: 정확한 메시지 타입만 true, Inspector의 `INSPECTOR_HOVER` 같은 무관한 메시지·null/undefined/문자열/숫자·타입 필드 없는 객체는 전부 false — 4개 케이스.
- 클릭 → 다이얼로그가 실제로 열리는 화면 동작은 Radix Dialog + nanostores + WebContainer 연동까지 마운트하는 풀 컴포넌트 렌더링 테스트가 이 코드베이스에 기존 사례가 없어(기존 스펙들은 전부 추출된 순수 함수만 테스트) 이번엔 새로 만들지 않고 아래 성민 확인 항목으로 남김.

**성민 브라우저 체크리스트 추가 항목**:
1. 채팅을 시작한 뒤 헤더에서 "Supabase 연결" 버튼이 "배포하기" 왼쪽에 실제로 보이는지, 라이트/다크 모드 둘 다 확인.
2. 그 버튼 클릭 → 마법사 다이얼로그가 열리는지, 연결 완료 후 라벨이 "Supabase 연결됨"으로 바뀌는지.
3. Supabase 미연결 상태로 앱 하나를 생성한 뒤, 미리보기에 뜨는 "샘플 데이터로 보고 있어요" 배너가 버튼처럼 클릭되는지(커서가 포인터로 바뀌는지), 클릭 시 헤더가 아닌 프리뷰 안에서 다이얼로그가 열리는지.
4. 배포 완료 카드의 "Supabase 연결" 항목과 SQL 변경사항 배너의 "저장 기능 연결하기" 버튼도 여전히 같은 다이얼로그를 여는지(회귀 확인).
5. AI 생성 완료 메시지에서 Supabase 관련 안내가 나올 때 "작업공간 상단" 같은 정확한 위치로 언급하는지(새로 생성한 앱에서 확인 — 시스템 프롬프트 캐시 때문에 새 대화에서 확인 권장).

