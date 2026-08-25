import { platformSupabase } from '~/lib/supabase/platform-client';

/**
 * Shared by every client call to a server route protected by getPlatformUserId
 * (cloudPlatformAuth.ts) — the deploy/domain/payment APIs all expect the same
 * `Authorization: Bearer <platform session token>` header. Returns an empty object (no header)
 * when there's no active session; the server then correctly responds 401 rather than the client
 * guessing at auth state itself.
 */
export async function getPlatformAuthHeaders(): Promise<Record<string, string>> {
  if (!platformSupabase) {
    return {};
  }

  const {
    data: { session },
  } = await platformSupabase.auth.getSession();

  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}
