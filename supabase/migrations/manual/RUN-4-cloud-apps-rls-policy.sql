-- CLOUD_PROVISION_FIX.md — RUN-3-cloud.sql turned on Row Level Security for cloud_apps
-- (alter table public.cloud_apps enable row level security;) but never added a single policy for
-- it. With RLS on and zero policies, Postgres allows SELECT to just silently return zero rows
-- (no error) but flatly rejects every INSERT with "new row violates row-level security policy" —
-- which matches this bug exactly: the quota-check SELECT never errors, but the INSERT that
-- creates the new cloud_apps row does, and that's the 500.
--
-- This only matters if the server's Supabase client isn't actually bypassing RLS the way a
-- genuine service_role key normally would — this policy makes service_role's access explicit and
-- correct either way, and grants nothing to anon/authenticated (the server is the only caller of
-- cloud_apps; no client-side code should ever query it directly).

drop policy if exists "cloud_apps_service_role_all" on public.cloud_apps;

create policy "cloud_apps_service_role_all" on public.cloud_apps
  for all
  to service_role
  using (true)
  with check (true);
