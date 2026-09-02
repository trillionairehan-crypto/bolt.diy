-- 메시지별 토큰 사용량 로깅 (원가 파악용). 기록은 서버가 service_role로만 한다 — 클라이언트가
-- 직접 insert할 수 있는 정책은 두지 않는다(service_role은 RLS를 우회하므로 별도 insert 정책 불필요).
create table if not exists public.message_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  chat_id text not null,
  message_id text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  model text not null,
  is_auto_fix boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists message_usage_user_id_idx on public.message_usage (user_id);
create index if not exists message_usage_created_at_idx on public.message_usage (created_at);

alter table public.message_usage enable row level security;

-- 본인 행만 조회 가능. 게스트(user_id is null) 행은 아무도 select로 못 본다 — 의도된 동작.
create policy "select own message usage" on public.message_usage
  for select
  using (auth.uid() = user_id);
