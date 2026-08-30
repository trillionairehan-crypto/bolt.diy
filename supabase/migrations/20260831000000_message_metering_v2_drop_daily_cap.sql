-- Corrects generation_usage_v2's RPCs against the pricing page (app/routes/pricing.tsx): the
-- Free plan there is advertised as "월 메시지 10건" only — no daily cap was ever mentioned. The
-- 20260825000000 migration (already applied) enforced an undisclosed 1/day cap alongside the
-- 10/month one; this migration removes the daily enforcement while keeping the 10/month limit.
--
-- Guest (non-authenticated) limits are handled entirely client-side via localStorage (see
-- app/lib/freeTrial.ts's V2_GUEST_MONTHLY_LIMIT) and never touch this table or these RPCs, so
-- nothing here changes guest behavior.
--
-- Deliberately not dropping the period_day/day_count columns — they're simply no longer read or
-- enforced, kept for now to avoid an unnecessary destructive schema change. Safe to drop later
-- in a follow-up migration once this is confirmed stable.

create or replace function public.get_generation_status_v2()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.generation_usage_v2;
  v_month text := to_char(now(), 'YYYY-MM');
  v_month_count integer;
  v_free_monthly_limit constant integer := 10;
begin
  select * into v_row from public.generation_usage_v2 where user_id = auth.uid();

  if v_row.user_id is null then
    v_month_count := 0;
  else
    v_month_count := case when v_row.period_month = v_month then v_row.month_count else 0 end;
  end if;

  return jsonb_build_object(
    'monthRemaining', greatest(v_free_monthly_limit - v_month_count, 0),
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
    -- period_day/day_count kept up to date (harmless bookkeeping) even though no longer enforced.
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
