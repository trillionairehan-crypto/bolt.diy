-- Server API auth/ownership hardening (SECURITY_PLAN.md). WRITTEN, NOT APPLIED — see
-- SECURITY_REPORT.md for the application procedure.
--
-- api.cloudflare-deploy.ts/api.cloudflare-domain.ts need to know "does this project_name already
-- belong to someone else" without leaking who the actual owner is, and without needing a
-- service_role key on the server (none exists for the platform Supabase project, and adding one
-- is out of scope for this session — .env is off-limits). SECURITY DEFINER lets this run with the
-- function owner's privileges regardless of the calling role, so the anon-key client the server
-- already uses can call it safely — it only ever returns a boolean, never row data.
--
-- Depends on deployed_apps (20260825000001_deployed_apps.sql) already existing — apply that one
-- first if it isn't applied yet.

create or replace function public.deployed_app_project_owned_by_other(p_project_name text, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.deployed_apps
    where project_name = p_project_name
      and user_id <> p_user_id
  );
$$;

grant execute on function public.deployed_app_project_owned_by_other(text, uuid) to anon, authenticated;
