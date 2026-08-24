/**
 * Supabase API keys are JWTs whose payload carries a `role` claim — "anon" for the public,
 * client-safe key and "service_role" for the full-access key that must never leave a server.
 * Used both when a user pastes a key into the connection wizard (SupabaseConnection.tsx, via
 * useSupabaseConnection's handleSimpleConnect) and again at deploy time (CloudflareDeploy.client.tsx)
 * right before it gets written into a generated app's .env — two independent checkpoints rather
 * than trusting the first one to have always run.
 */
export function getSupabaseKeyRole(jwt: string): string | null {
  const payloadSegment = jwt.trim().split('.')[1];

  if (!payloadSegment) {
    return null;
  }

  try {
    const base64 = payloadSegment
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4), '=');
    const json = atob(base64);
    const payload = JSON.parse(json) as { role?: unknown };

    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function isServiceRoleKey(jwt: string): boolean {
  return getSupabaseKeyRole(jwt) === 'service_role';
}
