import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { getCloudSupabaseClient } from '~/lib/cloud/cloudSupabaseClient';
import { getPlatformUserId } from '~/lib/cloud/cloudPlatformAuth';
import { provisionCloudApp } from '~/lib/cloud/cloudProvision';

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

  const result = await provisionCloudApp(supabase, secret, userId);

  if (!result.ok) {
    if (result.reason === 'quota_exceeded') {
      return json({ error: '계정당 저장 기능은 앱 5개까지 켤 수 있어요.' }, { status: 429 });
    }

    return json({ error: '저장 기능을 켜지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }

  return json({ appId: result.appId, token: result.token, expiresAt: result.expiresAt }, { status: 201 });
}
