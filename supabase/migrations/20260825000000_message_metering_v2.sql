-- overnight3 A5: v2 message-metering schema. WRITTEN, NOT APPLIED — see OVERNIGHT-REPORT-3.md's
-- A5 section for the investigation this is based on and the morning application procedure.
--
-- Target definition this implements:
--   - 1 user utterance = 1 message (each real chat send counts once).
--   - Auto-fix triggers (actionAlert-originated retries) are excluded — the client never calls
--     increment_generation_count_v2() for those (see app/components/chat/Chat.client.tsx, the
--     isAutoFix param threaded into sendMessage).
--   - Free tier = 10 messages/month + 1 message/day (whichever runs out first blocks sending).
--
-- Deliberately NOT implemented here: paid-plan carryover (unused monthly messages rolling over,
-- capped at 2x the plan's monthly allotment). That requires knowing each plan's monthly
-- allotment, which lives in app/routes/pricing.tsx — a file this overnight session is not
-- allowed to open. The carryover_count column below is reserved for that; wire it up once the
-- plan schema is confirmed by hand in the morning.
--
-- This is purely additive — a new table and two new RPCs, both suffixed _v2. It does not touch
-- the existing generation_usage table or get_generation_count/increment_generation_count RPCs
-- that app/lib/freeTrial.ts's current (non-v2) functions call, which live only in the Supabase
-- project itself (not tracked in this repo) and are left completely untouched.

create table if not exists public.generation_usage_v2 (
  user_id uuid primary key references auth.users (id) on delete cascade,
  period_month text not null,
  month_count integer not null default 0,
  period_day text not null,
  day_count integer not null default 0,
  -- Reserved for paid-plan carryover (max 2x monthly allotment) — not yet read or written by
  -- any RPC below. See note above.
  carryover_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.generation_usage_v2 enable row level security;

create policy "users can read own v2 generation usage"
  on public.generation_usage_v2
  for select
  using (auth.uid() = user_id);

-- No insert/update policy for end users — all writes go through the SECURITY DEFINER RPC below,
-- so a client can never set its own count directly.

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
