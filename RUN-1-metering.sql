
create table if not exists public.generation_usage_v2 (
  user_id uuid primary key references auth.users (id) on delete cascade,
  period_month text not null,
  month_count integer not null default 0,
  period_day text not null,
  day_count integer not null default 0,
  carryover_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.generation_usage_v2 enable row level security;

create policy "users can read own v2 generation usage"
  on public.generation_usage_v2
  for select
  using (auth.uid() = user_id);


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
