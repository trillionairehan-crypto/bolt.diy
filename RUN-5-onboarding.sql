-- 온보딩 설문(Q1~Q5) 답변 저장. message_usage(20260902000000_message_usage.sql)와 같은 방식:
-- 서버가 service_role로만 insert하고, 클라이언트는 절대 직접 쓰지 않는다.
--
-- RUN-4-cloud-apps-rls-policy.sql에서 실측한 교훈 그대로 적용: RLS를 켜고 정책을 하나도 안 두면
-- INSERT가 "new row violates row-level security policy"로 조용히 막힐 수 있다(서버 클라이언트가
-- 실제로 RLS를 우회하는 방식이 아닐 경우) — 그래서 select 정책과 별개로 service_role용 정책도
-- 명시적으로 둔다.
create table if not exists public.onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  chat_id text not null,
  q1_audience text,
  q2_storage text,
  q3_industry text,
  q3_raw text,
  q3_mapped_skeleton integer,
  q4_integrations text[] not null default '{}',
  q5_palette text,
  created_at timestamptz not null default now()
);

create index if not exists onboarding_responses_user_id_idx on public.onboarding_responses (user_id);
create index if not exists onboarding_responses_chat_id_idx on public.onboarding_responses (chat_id);
create index if not exists onboarding_responses_created_at_idx on public.onboarding_responses (created_at);

alter table public.onboarding_responses enable row level security;

-- 본인 행만 조회 가능. 게스트(user_id is null) 행은 아무도 select로 못 본다 — message_usage와 동일.
drop policy if exists "select own onboarding responses" on public.onboarding_responses;

create policy "select own onboarding responses" on public.onboarding_responses
  for select
  using (auth.uid() = user_id);

-- service_role의 insert를 명시적으로 허용 — RUN-4와 같은 이유(RLS+정책 0개는 INSERT를 조용히
-- 막을 수 있다). anon/authenticated에는 아무 것도 부여하지 않는다.
drop policy if exists "onboarding_responses_service_role_insert" on public.onboarding_responses;

create policy "onboarding_responses_service_role_insert" on public.onboarding_responses
  for insert
  to service_role
  with check (true);

-- 확인용 쿼리 — 실행 후 이 한 줄로 최근 행이 들어왔는지 볼 수 있다:
-- select chat_id, q1_audience, q2_storage, q3_industry, q3_mapped_skeleton, q4_integrations, q5_palette, created_at
--   from public.onboarding_responses order by created_at desc limit 10;
