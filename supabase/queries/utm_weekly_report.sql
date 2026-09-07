-- UTM 주간 리포트 — 매주 월요일 수동 실행용. utm_attribution.sql(20260907000000)이 실제 DB에
-- 적용된 뒤(가입이 최소 1건 쌓인 뒤)부터 의미 있는 결과가 나온다.
--
-- 1) 이번 주(월요일 00:00 ~ 지금) 신규 가입의 유입 경로별 집계
select
  coalesce(utm_source, '(직접/오가닉)') as utm_source,
  coalesce(utm_medium, '-') as utm_medium,
  coalesce(utm_campaign, '-') as utm_campaign,
  count(*) as signups
from public.utm_attribution
where created_at >= date_trunc('week', now())
group by utm_source, utm_medium, utm_campaign
order by signups desc;

-- 2) 지난 4주 추이 — 주차별 소스별 가입 수
select
  date_trunc('week', created_at) as week_start,
  coalesce(utm_source, '(직접/오가닉)') as utm_source,
  count(*) as signups
from public.utm_attribution
where created_at >= date_trunc('week', now()) - interval '3 weeks'
group by week_start, utm_source
order by week_start desc, signups desc;

-- 3) 전체 기간 캠페인별 합계(어느 캠페인이 가장 많이 데려왔는지)
select
  coalesce(utm_campaign, '(캠페인 없음)') as utm_campaign,
  coalesce(utm_source, '-') as utm_source,
  count(*) as signups,
  min(created_at) as first_seen,
  max(created_at) as last_seen
from public.utm_attribution
group by utm_campaign, utm_source
order by signups desc;

-- 4) 오가닉(utm 전무) 비율 — 유료 유입이 실제로 오가닉 대비 어느 정도인지 감 잡는 용도
select
  case when utm_source is null then '오가닉' else '유입(UTM 있음)' end as bucket,
  count(*) as signups,
  round(100.0 * count(*) / nullif(sum(count(*)) over (), 0), 1) as pct
from public.utm_attribution
group by bucket;
