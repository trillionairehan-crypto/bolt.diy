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
