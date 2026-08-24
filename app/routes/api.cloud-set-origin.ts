import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { verifyCloudAppOwnerToken } from '~/lib/cloud/cloudAuth';

const PAGES_DEV_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.pages\.dev$/;

/**
 * Called once by the deploy pipeline right after a successful Cloudflare Pages deploy —
 * CLOUD-DESIGN.md section 8: deploy_origin is empty until the app's first deploy, and the
 * storage API refuses every request (CORS-wise) until this is set.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: '지원하지 않는 요청이에요.' }, { status: 405 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 });
  }

  const appId = (body as { appId?: unknown })?.appId;
  const origin = (body as { origin?: unknown })?.origin;

  if (typeof appId !== 'string' || !appId) {
    return json({ error: '요청 형식이 올바르지 않아요.' }, { status: 400 });
  }

  if (typeof origin !== 'string' || !PAGES_DEV_ORIGIN_REGEX.test(origin)) {
    return json({ error: '배포 주소 형식이 올바르지 않아요.' }, { status: 400 });
  }

  const env = context?.cloudflare?.env ?? {};
  const verified = await verifyCloudAppOwnerToken(request, env, appId);

  if (!verified.ok) {
    return verified.response;
  }

  const { error } = await verified.supabase.from('cloud_apps').update({ deploy_origin: origin }).eq('id', appId);

  if (error) {
    return json({ error: '배포 주소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }

  return json({ ok: true });
}
