import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { getCloudSupabaseClient } from '~/lib/cloud/cloudSupabaseClient';
import { getPlatformUserId } from '~/lib/cloud/cloudPlatformAuth';
import { provisionCloudApp, type ProvisionCloudAppResult } from '~/lib/cloud/cloudProvision';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.cloud-provision');

/*
 * CLOUD_PROVISION_FIX.md — each failure reason gets a short, opaque code appended to the
 * (otherwise identical) user-facing message. Never the actual Postgres/exception text — that only
 * ever goes to logger.error (server-side, wrangler tail) — but distinct enough that a report from
 * a user ("CLOUD-IN") tells us which branch failed without needing log access at all.
 */
const ERROR_CODES: Record<'quota_check_failed' | 'insert_failed' | 'unexpected', string> = {
  quota_check_failed: 'CLOUD-QC',
  insert_failed: 'CLOUD-IN',
  unexpected: 'CLOUD-EX',
};

function provisionFailureResponse(reason: 'quota_check_failed' | 'insert_failed' | 'unexpected') {
  return json(
    { error: `저장 기능을 켜지 못했어요. 잠시 후 다시 시도해주세요. (오류 코드: ${ERROR_CODES[reason]})` },
    { status: 500 },
  );
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: '지원하지 않는 요청이에요.' }, { status: 405 });
  }

  const env = context?.cloudflare?.env ?? {};
  const supabase = getCloudSupabaseClient(env);
  const secret = env.CLOUD_APP_TOKEN_SECRET;

  if (!supabase || !secret) {
    return json({ error: '지금은 저장 기능을 쓸 수 없어요. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }

  const userId = await getPlatformUserId(request);

  if (!userId) {
    return json({ error: '로그인이 필요해요.' }, { status: 401 });
  }

  let result: ProvisionCloudAppResult;

  try {
    result = await provisionCloudApp(supabase, secret, userId);
  } catch (error) {
    /*
     * Catches anything provisionCloudApp itself doesn't already turn into a result (e.g. issueCloudAppToken/
     * hashCloudAppToken throwing) — without this, an uncaught exception here had no logging of its own at all.
     */
    logger.error('unexpected exception', error instanceof Error ? error.message : String(error));

    return provisionFailureResponse('unexpected');
  }

  if (!result.ok) {
    if (result.reason === 'quota_exceeded') {
      return json({ error: '계정당 저장 기능은 앱 5개까지 켤 수 있어요.' }, { status: 429 });
    }

    return provisionFailureResponse(result.reason);
  }

  return json({ appId: result.appId, token: result.token, expiresAt: result.expiresAt }, { status: 201 });
}
