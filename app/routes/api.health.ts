import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

/**
 * 마이그레이션 헬스체크 — supabase/migrations의 SQL 파일이 실제로 DB에 적용됐는지는 그동안 대화로만
 * 추적해왔다("이거 실행했나?"). 여기서 만드는 테이블마다 하나씩 추가해서, 배포 후 이 엔드포인트
 * 한 번 찍어보면 적용 안 된 마이그레이션을 바로 알 수 있게 한다.
 *
 * anon 키로 충분하다 — RLS가 막는 건 "행을 보여주는 것"이지 "테이블 존재 자체"가 아니다. 테이블이
 * 없으면 PostgREST가 Postgres의 42P01(undefined_table)을 그대로 실어 보낸다; 있으면 RLS로 걸러진
 * 빈 결과(count 0)가 오지 에러가 나지 않는다 — 그래서 42P01 여부만 보면 된다.
 */
const EXPECTED_TABLES = [
  'generation_usage_v2',
  'deployed_apps',
  'message_usage',
  'onboarding_responses',
  'utm_attribution',
] as const;

const TABLE_MISSING_CODE = '42P01';

interface PlatformEnv {
  VITE_PLATFORM_SUPABASE_URL?: string;
  VITE_PLATFORM_SUPABASE_ANON_KEY?: string;
}

export async function checkMigrationTables(env: PlatformEnv | undefined): Promise<Record<string, boolean> | null> {
  const url = env?.VITE_PLATFORM_SUPABASE_URL;
  const anonKey = env?.VITE_PLATFORM_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } });

  const entries = await Promise.all(
    EXPECTED_TABLES.map(async (table) => {
      const { error } = await client.from(table).select('*', { head: true, count: 'exact' });
      return [table, error?.code !== TABLE_MISSING_CODE] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const migrations = await checkMigrationTables(context.cloudflare?.env as PlatformEnv).catch(() => null);

  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    migrations,
  });
};
