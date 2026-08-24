import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cloud 전용 Supabase 프로젝트 클라이언트 — 본체 플랫폼 DB(platform-client.ts)와 완전히 분리된
 * 별도 프로젝트, service_role 키 사용. `context.cloudflare.env`로만 값을 읽고(VITE_ 접두사 없음)
 * Remix action/loader 안에서만 인스턴스화해야 클라이언트 번들에 절대 안 들어감 — 모듈 최상단에서
 * `import.meta.env`를 읽는 platform-client.ts와 의도적으로 다른 패턴.
 */
export function getCloudSupabaseClient(env: {
  CLOUD_SUPABASE_URL?: string;
  CLOUD_SUPABASE_SERVICE_KEY?: string;
}): SupabaseClient | null {
  const url = env.CLOUD_SUPABASE_URL;
  const key = env.CLOUD_SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
