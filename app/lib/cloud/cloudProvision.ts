import type { SupabaseClient } from '@supabase/supabase-js';
import { issueCloudAppToken, hashCloudAppToken } from './cloudToken';

export const MAX_CLOUD_APPS_PER_OWNER = 5;
export const FREE_TIER_DAYS = 7;

export type ProvisionCloudAppResult =
  | { ok: true; appId: string; token: string; expiresAt: string }
  | { ok: false; reason: 'quota_exceeded' | 'server_error' };

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
    return { ok: false, reason: 'server_error' };
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
    return { ok: false, reason: 'server_error' };
  }

  return { ok: true, appId, token, expiresAt };
}
