import type { SupabaseClient } from '@supabase/supabase-js';
import { getCloudSupabaseClient } from './cloudSupabaseClient';
import { verifyCloudAppToken, hashCloudAppToken } from './cloudToken';
import { corsHeadersFor, jsonError } from './cloudResponses';

interface CloudEnv {
  CLOUD_SUPABASE_URL?: string;
  CLOUD_SUPABASE_SERVICE_KEY?: string;
  CLOUD_APP_TOKEN_SECRET?: string;
}

export interface CloudAuthContext {
  supabase: SupabaseClient;
  appId: string;
  corsHeaders: Record<string, string>;
}

export type CloudAuthResult = { ok: true; context: CloudAuthContext } | { ok: false; response: Response };

/**
 * Full request pipeline from CLOUD-DESIGN.md section 3 ("검증" steps 1-6) — every storage route
 * calls this first and does nothing else until it returns ok:true. Rate limiting is deliberately
 * NOT here (needs device_key, which lives in different places per method) — see checkCloudRateLimit.
 *
 * @param injectedSupabase test-only seam — routes never pass this, so production always builds
 * the real client from env; cloudAdversarial.spec.ts uses it to exercise the hash-mismatch/expiry/
 * origin-check branches with a fake query builder instead of a live Cloud Supabase project.
 */
export async function authenticateCloudRequest(
  request: Request,
  env: CloudEnv,
  urlAppId: string,
  injectedSupabase?: SupabaseClient,
): Promise<CloudAuthResult> {
  const origin = request.headers.get('Origin') || '';

  const supabase = injectedSupabase ?? getCloudSupabaseClient(env);

  if (!supabase || !env.CLOUD_APP_TOKEN_SECRET) {
    return { ok: false, response: jsonError(503, '지금은 저장 기능을 쓸 수 없어요. 잠시 후 다시 시도해주세요.') };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!token) {
    return { ok: false, response: jsonError(401, '저장 기능 연결이 확인되지 않았어요.') };
  }

  const payload = await verifyCloudAppToken(token, env.CLOUD_APP_TOKEN_SECRET);

  if (!payload || payload.appId !== urlAppId) {
    return { ok: false, response: jsonError(401, '저장 기능 연결이 확인되지 않았어요.') };
  }

  const { data: app, error } = await supabase
    .from('cloud_apps')
    .select('id, app_secret_hash, deploy_origin, expires_at')
    .eq('id', urlAppId)
    .maybeSingle();

  if (error || !app) {
    return { ok: false, response: jsonError(401, '저장 기능 연결이 확인되지 않았어요.') };
  }

  const tokenHash = await hashCloudAppToken(token);

  if (tokenHash !== app.app_secret_hash) {
    return { ok: false, response: jsonError(401, '저장 기능 연결이 확인되지 않았어요.') };
  }

  if (app.expires_at && new Date(app.expires_at as string).getTime() < Date.now()) {
    return { ok: false, response: jsonError(403, '이 앱의 체험 기간이 끝났어요. 요금제를 확인하고 계속 써보세요.') };
  }

  if (!app.deploy_origin) {
    return { ok: false, response: jsonError(403, '아직 배포되지 않은 앱이에요. 먼저 배포해주세요.') };
  }

  if (origin !== app.deploy_origin) {
    return { ok: false, response: jsonError(403, '이 주소에서는 저장 기능을 쓸 수 없어요.') };
  }

  return {
    ok: true,
    context: {
      supabase,
      appId: urlAppId,
      corsHeaders: corsHeadersFor(app.deploy_origin as string),
    },
  };
}

export type VerifyOwnerTokenResult =
  | { ok: true; supabase: SupabaseClient; appId: string }
  | { ok: false; response: Response };

/**
 * The token+hash half of authenticateCloudRequest, without the origin/expiry/deploy_origin
 * checks — used by internal deploy-pipeline calls (setting deploy_origin in the first place, so
 * requiring it up front would be circular) rather than the public storage API.
 */
export async function verifyCloudAppOwnerToken(
  request: Request,
  env: CloudEnv,
  appId: string,
): Promise<VerifyOwnerTokenResult> {
  const supabase = getCloudSupabaseClient(env);

  if (!supabase || !env.CLOUD_APP_TOKEN_SECRET) {
    return { ok: false, response: jsonError(503, '지금은 저장 기능을 쓸 수 없어요. 잠시 후 다시 시도해주세요.') };
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!token) {
    return { ok: false, response: jsonError(401, '저장 기능 연결이 확인되지 않았어요.') };
  }

  const payload = await verifyCloudAppToken(token, env.CLOUD_APP_TOKEN_SECRET);

  if (!payload || payload.appId !== appId) {
    return { ok: false, response: jsonError(401, '저장 기능 연결이 확인되지 않았어요.') };
  }

  const { data: app, error } = await supabase
    .from('cloud_apps')
    .select('id, app_secret_hash')
    .eq('id', appId)
    .maybeSingle();

  if (error || !app) {
    return { ok: false, response: jsonError(401, '저장 기능 연결이 확인되지 않았어요.') };
  }

  const tokenHash = await hashCloudAppToken(token);

  if (tokenHash !== app.app_secret_hash) {
    return { ok: false, response: jsonError(401, '저장 기능 연결이 확인되지 않았어요.') };
  }

  return { ok: true, supabase, appId };
}

/**
 * CLOUD-DESIGN.md 7번 섹션 — 앱 전체 120/분, 기기별 60/분. RPC 하나가 두 카운터를 원자적으로
 * 같이 올리고 둘 다 확인(cloud_check_rate_limit, RUN-3-cloud.sql).
 */
export async function checkCloudRateLimit(
  supabase: SupabaseClient,
  appId: string,
  deviceKey: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('cloud_check_rate_limit', {
    p_app_id: appId,
    p_device_key: deviceKey,
  });

  if (error) {
    /*
     * Fail open on the rate-limit check itself failing (e.g. RPC unreachable) — a broken limiter
     * must not take the whole storage feature down; the auth/quota checks are the hard boundary.
     */
    return true;
  }

  return data === true;
}
