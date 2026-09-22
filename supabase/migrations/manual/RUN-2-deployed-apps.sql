
create table if not exists public.deployed_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chat_id text not null,
  app_name text not null,
  url text not null,
  provider text not null,
  project_name text,
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
