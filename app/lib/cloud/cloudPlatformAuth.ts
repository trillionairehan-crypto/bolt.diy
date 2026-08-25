import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Verifies "which coralred platform account is calling" for server routes that need a logged-in
 * user — separate from cloudAuth.ts, which verifies "which generated app is calling" with the
 * Cloud project's own app tokens. Platform auth uses the MAIN platform Supabase project (the one
 * behind /login), with just its anon key — getUser(jwt) only needs to validate the JWT signature,
 * not a privileged key, so no service_role is involved here at all.
 *
 * @param injectedClient test-only seam (added when this got reused by the deploy/domain/payment
 * auth work) — routes never pass this, so production always builds the real client from env.
 */
export async function getPlatformUserId(request: Request, injectedClient?: SupabaseClient): Promise<string | null> {
  const authHeader = request.headers.get('Authorization') || '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';

  if (!jwt) {
    return null;
  }

  const client = injectedClient ?? buildPlatformClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client.auth.getUser(jwt);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

/** Shared by deployedAppOwnership.ts's isProjectOwnedByOther — same platform project, same anon key. */
export function buildPlatformClient(): SupabaseClient | null {
  const platformUrl = import.meta.env.VITE_PLATFORM_SUPABASE_URL;
  const platformAnonKey = import.meta.env.VITE_PLATFORM_SUPABASE_ANON_KEY;

  if (!platformUrl || !platformAnonKey) {
    return null;
  }

  return createClient(platformUrl, platformAnonKey, { auth: { persistSession: false } });
}
