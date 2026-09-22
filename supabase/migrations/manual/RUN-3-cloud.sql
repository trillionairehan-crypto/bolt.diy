create table if not exists public.cloud_apps (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  app_secret_hash text not null,
  deploy_origin text,
  tier text not null default 'free' check (tier in ('free', 'paid')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists cloud_apps_owner_user_id_idx on public.cloud_apps (owner_user_id);

alter table public.cloud_apps enable row level security;

create table if not exists public.cloud_documents (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  collection text not null check (collection ~ '^[a-z][a-z0-9_]{0,30}$'),
  device_key text not null check (char_length(device_key) between 1 and 128),
  data jsonb not null check (pg_column_size(data) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cloud_documents_app_collection_device_idx
  on public.cloud_documents (app_id, collection, device_key);

alter table public.cloud_documents enable row level security;

create table if not exists public.cloud_usage (
  app_id uuid primary key references public.cloud_apps (id) on delete cascade,
  document_count integer not null default 0,
  total_bytes bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.cloud_usage enable row level security;

create table if not exists public.cloud_rate_limit (
  key text primary key,
  window_start timestamptz not null,
  request_count integer not null default 0
);

alter table public.cloud_rate_limit enable row level security;

create or replace function public.cloud_enforce_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_max_docs integer;
  v_max_bytes bigint;
  v_max_collections integer;
  v_doc_count integer;
  v_total_bytes bigint;
  v_collection_count integer;
  v_new_size integer;
  v_is_new_collection boolean;
begin
  select tier into v_tier from public.cloud_apps where id = new.app_id;

  if v_tier = 'paid' then
    v_max_docs := 20000;
    v_max_bytes := 100 * 1024 * 1024;
    v_max_collections := 200;
  else
    v_max_docs := 2000;
    v_max_bytes := 10 * 1024 * 1024;
    v_max_collections := 20;
  end if;

  v_new_size := pg_column_size(new.data);

  select coalesce(document_count, 0), coalesce(total_bytes, 0)
    into v_doc_count, v_total_bytes
    from public.cloud_usage where app_id = new.app_id;

  if v_doc_count is null then
    v_doc_count := 0;
    v_total_bytes := 0;
  end if;

  if v_doc_count + 1 > v_max_docs then
    raise exception 'cloud_quota_documents_exceeded';
  end if;

  if v_total_bytes + v_new_size > v_max_bytes then
    raise exception 'cloud_quota_bytes_exceeded';
  end if;

  select not exists (
    select 1 from public.cloud_documents
    where app_id = new.app_id and collection = new.collection
    limit 1
  ) into v_is_new_collection;

  if v_is_new_collection then
    select count(distinct collection) into v_collection_count
      from public.cloud_documents where app_id = new.app_id;

    if v_collection_count + 1 > v_max_collections then
      raise exception 'cloud_quota_collections_exceeded';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists cloud_documents_enforce_quota on public.cloud_documents;

create trigger cloud_documents_enforce_quota
  before insert on public.cloud_documents
  for each row
  execute function public.cloud_enforce_quota();

create or replace function public.cloud_track_usage_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cloud_usage (app_id, document_count, total_bytes, updated_at)
  values (new.app_id, 1, pg_column_size(new.data), now())
  on conflict (app_id) do update set
    document_count = public.cloud_usage.document_count + 1,
    total_bytes = public.cloud_usage.total_bytes + pg_column_size(new.data),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists cloud_documents_track_insert on public.cloud_documents;

create trigger cloud_documents_track_insert
  after insert on public.cloud_documents
  for each row
  execute function public.cloud_track_usage_insert();

create or replace function public.cloud_track_usage_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer;
begin
  v_delta := pg_column_size(new.data) - pg_column_size(old.data);
  update public.cloud_usage
    set total_bytes = greatest(total_bytes + v_delta, 0), updated_at = now()
    where app_id = new.app_id;
  return new;
end;
$$;

drop trigger if exists cloud_documents_track_update on public.cloud_documents;

create trigger cloud_documents_track_update
  after update on public.cloud_documents
  for each row
  execute function public.cloud_track_usage_update();

create or replace function public.cloud_track_usage_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cloud_usage
    set document_count = greatest(document_count - 1, 0),
        total_bytes = greatest(total_bytes - pg_column_size(old.data), 0),
        updated_at = now()
    where app_id = old.app_id;
  return old;
end;
$$;

drop trigger if exists cloud_documents_track_delete on public.cloud_documents;

create trigger cloud_documents_track_delete
  after delete on public.cloud_documents
  for each row
  execute function public.cloud_track_usage_delete();

create or replace function public.cloud_check_rate_limit(p_app_id uuid, p_device_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_app_key text := 'app:' || p_app_id::text;
  v_dev_key text := 'dev:' || p_app_id::text || ':' || p_device_key;
  v_app_count integer;
  v_dev_count integer;
begin
  insert into public.cloud_rate_limit (key, window_start, request_count)
  values (v_app_key, v_window, 1)
  on conflict (key) do update set
    request_count = case when public.cloud_rate_limit.window_start = v_window
      then public.cloud_rate_limit.request_count + 1 else 1 end,
    window_start = v_window
  returning request_count into v_app_count;

  insert into public.cloud_rate_limit (key, window_start, request_count)
  values (v_dev_key, v_window, 1)
  on conflict (key) do update set
    request_count = case when public.cloud_rate_limit.window_start = v_window
      then public.cloud_rate_limit.request_count + 1 else 1 end,
    window_start = v_window
  returning request_count into v_dev_count;

  return v_app_count <= 120 and v_dev_count <= 60;
end;
$$;

create extension if not exists pg_cron;

create or replace function public.cloud_expire_cleanup()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.cloud_documents
  where app_id in (
    select id from public.cloud_apps
    where expires_at is not null and expires_at < now()
  );
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cloud-expire-cleanup') then
    perform cron.unschedule('cloud-expire-cleanup');
  end if;
end $$;

select cron.schedule('cloud-expire-cleanup', '0 * * * *', 'select public.cloud_expire_cleanup();');
