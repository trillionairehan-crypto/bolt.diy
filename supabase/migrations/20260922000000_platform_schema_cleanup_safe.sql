-- 2026-09-22 플랫폼 DB 정리 1/2 — 안전 단계(추가·보강만, 기존 기능 무영향).
-- 대상: 플랫폼 Supabase 프로젝트(VITE_PLATFORM_SUPABASE_URL). Cloud 프로젝트에는 돌리지 않는다.
-- 근거: docs/DB-AUDIT-2026-09-22.md. 전부 idempotent(if not exists / or replace) — 여러 번 실행해도 같은 결과.

begin;

-- 1) deployed_apps: 리포의 스키마와 라이브가 갈라졌다.
--    라이브에는 옛 RUN-2가 만든 supabase_connected boolean이 있고, 리포 마이그레이션의 storage_mode/
--    storage_expires_at은 없다. 코드(app/lib/deployedApps.ts)는 storage_mode로 insert하다가 42703이면
--    두 컬럼을 빼고 재시도하는 폴백으로 버티는 중. 컬럼을 추가해 폴백을 끝낸다.
alter table public.deployed_apps
  add column if not exists storage_mode text not null default 'sample',
  add column if not exists storage_expires_at timestamptz;

-- check 제약은 있을 때만 추가(중복 이름 방지)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deployed_apps_storage_mode_check'
  ) then
    alter table public.deployed_apps
      add constraint deployed_apps_storage_mode_check check (storage_mode in ('sample', 'cloud', 'supabase'));
  end if;
end $$;

-- 옛 불리언을 새 컬럼으로 백필(supabase_connected=true ↔ storage_mode='supabase'). 컬럼 삭제는 2단계.
update public.deployed_apps
   set storage_mode = 'supabase'
 where storage_mode = 'sample'
   and exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'deployed_apps' and column_name = 'supabase_connected'
   )
   and coalesce((to_jsonb(deployed_apps) ->> 'supabase_connected')::boolean, false);

-- 2) deployed_apps: 사용자별 프로젝트명 중복 방지(코드의 deployed_app_project_owned_by_other가 전제하는 불변식).
--    provider별로 같은 project_name은 한 사용자에게만.
create unique index if not exists deployed_apps_provider_project_name_uidx
  on public.deployed_apps (provider, project_name)
  where project_name is not null;

-- 3) message_usage: 채팅별·기간별 집계 쿼리(요금제 페이지·운영)에 인덱스가 없다.
create index if not exists message_usage_chat_id_idx on public.message_usage (chat_id);
create index if not exists message_usage_user_created_idx on public.message_usage (user_id, created_at desc);
create index if not exists message_usage_model_idx on public.message_usage (model);

-- 4) updated_at 자동 갱신 — generation_usage_v2는 RPC가 직접 세팅하지만 트리거로 강제해 두면 수동 PATCH
--    (운영 중 쿼터 리셋)에서도 갱신된다.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists generation_usage_v2_set_updated_at on public.generation_usage_v2;
create trigger generation_usage_v2_set_updated_at
  before update on public.generation_usage_v2
  for each row execute function public.set_updated_at();

-- 5) 헬스체크가 보는 테이블에 대한 코멘트(스키마 문서화 — information_schema로 읽힌다)
comment on table public.generation_usage_v2 is '계정/게스트 월간 생성 쿼터. 한도는 RPC get/increment_generation_count_v2가 단일 소스. day_count/period_day/carryover_count는 미사용(2단계에서 정리).';
comment on table public.message_usage is 'LLM·이미지·영상 호출 원장. image_cost/video_cost는 미디어 행에만.';
comment on table public.deployed_apps is '사용자 앱의 Cloudflare Pages 배포 기록. storage_mode = sample|cloud|supabase.';
comment on table public.onboarding_responses is '온보딩 5문항 응답(분석용).';
comment on table public.utm_attribution is '가입 시 UTM 1회 기록.';

commit;
