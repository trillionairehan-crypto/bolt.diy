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
  /*
   * CLOUD_QC_TRACE.md — this used to be { count: 'exact', head: true } (a HEAD request). PostgREST
   * error responses are only ever readable off res.text(), and an HTTP HEAD response can never
   * carry a body at all (that's the protocol, not a postgrest-js bug) — so any error from a HEAD
   * request always lands here as the empty-body fallback `error = { message: body }` with body ===
   * '', regardless of what actually went wrong server-side. Dropping head:true (this table's owner
   * only ever has up to MAX_CLOUD_APPS_PER_OWNER=5 rows, so fetching real rows instead of just a
   * count header is free) means a real PostgREST error body — message/details/hint/code — can
   * actually reach this log line the next time this fails.
   */
  const {
    count,
    error: countError,
    status: countStatus,
    statusText: countStatusText,
  } = await supabase.from('cloud_apps').select('id', { count: 'exact' }).eq('owner_user_id', ownerUserId);

  if (countError) {
    /*
     * createScopedLogger joins args via string interpolation (`${acc} ${current}`), which would
     * print a raw object as the useless literal "[object Object]" — JSON.stringify it explicitly
     * so the actual Postgres error code/message/hint show up in wrangler tail. status/statusText
     * are the one field that's meaningful even for the empty-body HEAD-request failure mode above
     * (a bare non-2xx HTTP status is still visible even when the body is empty) — see
     * CLOUD_QC_TRACE.md.
     */
    logger.error(
      'cloud_apps quota check failed',
      JSON.stringify({
        name: (countError as { name?: string }).name,
        code: countError.code,
        message: countError.message,
        details: (countError as { details?: string }).details,
        hint: countError.hint,
        status: countStatus,
        statusText: countStatusText,
      }),
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

  const {
    error: insertError,
    status: insertStatus,
    statusText: insertStatusText,
  } = await supabase.from('cloud_apps').insert({
    id: appId,
    owner_user_id: ownerUserId,
    app_secret_hash: tokenHash,
    tier: 'free',
    expires_at: expiresAt,
  });

  if (insertError) {
    logger.error(
      'cloud_apps insert failed',
      JSON.stringify({
        name: (insertError as { name?: string }).name,
        code: insertError.code,
        message: insertError.message,
        details: (insertError as { details?: string }).details,
        hint: insertError.hint,
        status: insertStatus,
        statusText: insertStatusText,
      }),
    );

    return { ok: false, reason: 'insert_failed' };
  }

  return { ok: true, appId, token, expiresAt };
}
