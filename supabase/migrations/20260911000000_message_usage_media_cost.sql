-- 이미지·영상 생성 원가(USD) 로깅. 토큰 컬럼과 별개로 생성 1세트당 실제 청구 추정치를 남긴다.
-- 이미지 세트 행: model='gemini-*-image', image_cost=세트 합계. 영상 행: video_cost.
alter table public.message_usage
  add column if not exists image_cost numeric(10, 6),
  add column if not exists video_cost numeric(10, 6);
