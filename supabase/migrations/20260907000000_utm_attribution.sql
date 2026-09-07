-- 첫 가입 시점의 UTM 유입 경로(utm_source/medium/campaign/content) 저장. onboarding_responses와
-- 같은 방식: 서버가 service_role로만 insert하고, 클라이언트는 절대 직접 쓰지 않는다.
--
-- 컬럼이 아니라 별도 테이블인 이유: 이 값들은 auth.users(Supabase Auth가 관리하는 테이블)에 붙일 곳이
-- 없다 — Supabase가 관리하는 auth 스키마 테이블에 임의 컬럼을 추가하는 건 지원되지 않고, 애초에
-- 코랄레드 쪽엔 auth.users 말고 별도의 public.users/profiles 테이블 자체가 없다(로그인 관련 앱
-- 데이터는 전부 user_id를 FK로 참조하는 별도 테이블 — generation_usage_v2, onboarding_responses 등
-- 이 방식). user_id를 기본키로 둔 1:1 테이블이 기존 패턴과 정확히 같다.
create table if not exists public.utm_attribution (
  user_id uuid primary key references auth.users (id) on delete cascade,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  created_at timestamptz not null default now()
);

alter table public.utm_attribution enable row level security;

-- 본인 행만 조회 가능. onboarding_responses/message_usage와 동일.
drop policy if exists "select own utm attribution" on public.utm_attribution;

create policy "select own utm attribution" on public.utm_attribution
  for select
  using (auth.uid() = user_id);

-- service_role의 insert(및 upsert가 쓰는 update)를 명시적으로 허용 — RUN-4에서 실측한 대로 RLS를
-- 켜고 정책을 하나도 안 두면 INSERT가 조용히 막힐 수 있다. anon/authenticated에는 아무 것도 부여하지
-- 않는다.
drop policy if exists "utm_attribution_service_role_insert" on public.utm_attribution;

create policy "utm_attribution_service_role_insert" on public.utm_attribution
  for insert
  to service_role
  with check (true);

-- 이미 가입한 유저는 절대 건드리지 않는다 — 첫 기록 이후 재로그인 시 upsert가 다시 불려도(감지가
-- 어긋나는 경우 대비) on conflict do nothing으로 흡수되지만, UPDATE 정책 자체를 두지 않아 DB
-- 레벨에서도 덮어쓰기를 원천 차단한다.

-- 확인용 쿼리 — 실행 후 이 한 줄로 최근 행이 들어왔는지 볼 수 있다:
-- select user_id, utm_source, utm_medium, utm_campaign, utm_content, created_at
--   from public.utm_attribution order by created_at desc limit 20;
