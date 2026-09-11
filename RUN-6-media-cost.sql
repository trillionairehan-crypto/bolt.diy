-- Supabase SQL Editor에서 직접 실행 (supabase/migrations/20260911000000_message_usage_media_cost.sql과 동일)
alter table public.message_usage
  add column if not exists image_cost numeric(10, 6),
  add column if not exists video_cost numeric(10, 6);
