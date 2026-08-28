import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { verifyCloudAppOwnerToken } from '~/lib/cloud/cloudAuth';
import { DEPLOYED_TIER_DAYS } from '~/lib/cloud/cloudProvision';

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

  /*
   * TRUST_FIX_REPORT.md 작업 1 — 배포 안내 문구 정책(배포 안 된 앱 7일 / 배포된 앱 30일)의 실제
   * 구현. cloud_apps.expires_at을 여기서 30일 뒤로 늘리는 게 실제 만료 시점을 결정하는 유일한
   * 지점이다 — RUN-3-cloud.sql의 cloud_expire_cleanup()이 매시간 이 컬럼만 보고 정리 대상을
   * 정하고, deployed_apps.storage_expires_at은 /apps 화면 표시용 복사본일 뿐 만료 자체와는
   * 무관하다.
   */
  const expiresAt = new Date(Date.now() + DEPLOYED_TIER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await verified.supabase
    .from('cloud_apps')
    .update({ deploy_origin: origin, expires_at: expiresAt })
    .eq('id', appId);

  if (error) {
    return json({ error: '배포 주소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }

  return json({ ok: true, expiresAt });
}
