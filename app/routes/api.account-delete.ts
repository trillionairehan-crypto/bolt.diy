import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';
import { getPlatformUserId } from '~/lib/cloud/cloudPlatformAuth';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('accountDelete');

/**
 * 회원 탈퇴 — auth.users 행을 지우면 FK로 걸린 앱 데이터(generation_usage_v2/deployed_apps는
 * on delete cascade, message_usage/onboarding_responses/utm_attribution은 on delete set null)가
 * 마이그레이션에 이미 정의된 대로 정리된다. 여기서 별도로 테이블을 순회하며 지우지 않는다.
 *
 * message_usage.ts 등 다른 곳과 달리 서비스 키가 없다고 조용히 넘어가지 않는다 — 저기는 "로깅
 * 실패해도 무해"지만 여기는 유저가 "탈퇴됐다"고 믿었는데 실제로는 계정이 살아있는 것보다,
 * 명확한 에러로 실패를 알리는 게 맞다.
 */
export async function action({ context, request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const userId = await getPlatformUserId(request).catch(() => null);

  if (!userId) {
    return json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const env = context.cloudflare?.env as
    | { VITE_PLATFORM_SUPABASE_URL?: string; PLATFORM_SUPABASE_SERVICE_ROLE_KEY?: string }
    | undefined;
  const platformUrl = env?.VITE_PLATFORM_SUPABASE_URL;
  const serviceRoleKey = env?.PLATFORM_SUPABASE_SERVICE_ROLE_KEY;

  if (!platformUrl || !serviceRoleKey) {
    logger.error('Account delete failed: PLATFORM_SUPABASE_SERVICE_ROLE_KEY not configured');
    return json({ error: '지금은 탈퇴를 처리할 수 없어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }

  const adminClient = createClient(platformUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { error } = await adminClient.auth.admin.deleteUser(userId);

  if (error) {
    logger.error('Account delete failed', error);
    return json({ error: '탈퇴 처리 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }

  logger.info('Account deleted', { userId });

  return json({ ok: true }, { status: 200 });
}
