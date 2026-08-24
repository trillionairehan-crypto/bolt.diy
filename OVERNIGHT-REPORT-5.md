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


