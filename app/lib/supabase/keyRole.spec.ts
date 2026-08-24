import { describe, expect, it } from 'vitest';
import { getSupabaseKeyRole, isServiceRoleKey } from './keyRole';

// Real-shaped (but fake-signed) JWTs — header {alg:HS256,typ:JWT}, payload {role, iss:supabase}.
const ANON_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.fakesig';
const SERVICE_ROLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ.fakesig';

describe('getSupabaseKeyRole', () => {
  it('reads "anon" from an anon key', () => {
    expect(getSupabaseKeyRole(ANON_JWT)).toBe('anon');
  });

  it('reads "service_role" from a service_role key', () => {
    expect(getSupabaseKeyRole(SERVICE_ROLE_JWT)).toBe('service_role');
  });

  it('returns null for garbage input', () => {
    expect(getSupabaseKeyRole('not-a-jwt')).toBeNull();
    expect(getSupabaseKeyRole('')).toBeNull();
  });

  it('returns null for a payload segment that is not valid base64 JSON', () => {
    expect(getSupabaseKeyRole('header.%%%not-base64%%%.sig')).toBeNull();
  });

  it('returns null when the payload has no role claim', () => {
    const noRolePayload = Buffer.from(JSON.stringify({ iss: 'supabase' })).toString('base64');
    expect(getSupabaseKeyRole(`header.${noRolePayload}.sig`)).toBeNull();
  });

  it('tolerates surrounding whitespace (a common paste artifact)', () => {
    expect(getSupabaseKeyRole(`  ${ANON_JWT}  `)).toBe('anon');
  });
});

describe('isServiceRoleKey', () => {
  it('is true only for a service_role key', () => {
    expect(isServiceRoleKey(SERVICE_ROLE_JWT)).toBe(true);
    expect(isServiceRoleKey(ANON_JWT)).toBe(false);
    expect(isServiceRoleKey('garbage')).toBe(false);
  });

  it('blocks new-format sb_secret_ keys (not a JWT, so the role-claim check alone would miss them)', () => {
    expect(isServiceRoleKey('sb_secret_abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(isServiceRoleKey('  sb_secret_abcdefghijklmnopqrstuvwxyz  ')).toBe(true);
  });

  it('allows new-format sb_publishable_ keys', () => {
    expect(isServiceRoleKey('sb_publishable_abcdefghijklmnopqrstuvwxyz')).toBe(false);
  });
});
