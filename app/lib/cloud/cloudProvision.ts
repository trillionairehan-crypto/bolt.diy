import type { SupabaseClient } from '@supabase/supabase-js';
import { issueCloudAppToken, hashCloudAppToken } from './cloudToken';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('cloudProvision');

export const MAX_CLOUD_APPS_PER_OWNER = 5;
export const FREE_TIER_DAYS = 7;

/*
 * CLOUD_PROVISION_FIX.md — reason is split (not just 'server_error') so the two Supabase
 * operations this function does are distinguishable both in the server log line each branch
 * writes below and in the user-facing error code the route maps them to, without ever exposing
 * the actual Postgres error text (message/code/hint only ever go to console.error, never into the
 * returned result).
 */
export type ProvisionCloudAppResult =
  | { ok: true; appId: string; token: string; expiresAt: string }
  | { ok: false; reason: 'quota_exceeded' | 'quota_check_failed' | 'insert_failed' };

/**
 * Task 5's "Cloud 켜기" — one call, immediately usable. The token is returned to the caller
 * exactly once here; only its sha256 (app_secret_hash) is ever stored (CLOUD-DESIGN.md section 3).
 */
export async function provisionCloudApp(
  supabase: SupabaseClient,
  secret: string,
  ownerUserId: string,
): Promise<ProvisionCloudAppResult> {
  const { count, error: countError } = await supabase
    .from('cloud_apps')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', ownerUserId);

  if (countError) {
    /*
     * createScopedLogger joins args via string interpolation (`${acc} ${current}`), which would
     * print a raw object as the useless literal "[object Object]" — JSON.stringify it explicitly
     * so the actual Postgres error code/message/hint show up in wrangler tail.
     */
    logger.error(
      'cloud_apps quota check failed',
      JSON.stringify({ code: countError.code, message: countError.message, hint: countError.hint }),
    );

    return { ok: false, reason: 'quota_check_failed' };
  }

  if ((count ?? 0) >= MAX_CLOUD_APPS_PER_OWNER) {
    return { ok: false, reason: 'quota_exceeded' };
  }

  const appId = crypto.randomUUID();
  const token = await issueCloudAppToken(appId, secret);
  const tokenHash = await hashCloudAppToken(token);
  const expiresAt = new Date(Date.now() + FREE_TIER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from('cloud_apps').insert({
    id: appId,
    owner_user_id: ownerUserId,
    app_secret_hash: tokenHash,
    tier: 'free',
    expires_at: expiresAt,
  });

  if (insertError) {
    logger.error(
      'cloud_apps insert failed',
      JSON.stringify({ code: insertError.code, message: insertError.message, hint: insertError.hint }),
    );

    return { ok: false, reason: 'insert_failed' };
  }

  return { ok: true, appId, token, expiresAt };
}
