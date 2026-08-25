import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPlatformUserId } from './cloudPlatformAuth';

function fakeClient(behavior: (jwt: string) => { data: { user: { id: string } | null }; error: Error | null }) {
  return {
    auth: {
      getUser: async (jwt: string) => behavior(jwt),
    },
  } as unknown as SupabaseClient;
}

describe('getPlatformUserId', () => {
  it('returns null when there is no Authorization header at all', async () => {
    const request = new Request('https://x/api/whatever');
    const client = fakeClient(() => ({ data: { user: { id: 'should-not-be-reached' } }, error: null }));

    expect(await getPlatformUserId(request, client)).toBeNull();
  });

  it('returns null for an Authorization header that is not "Bearer <token>"', async () => {
    const request = new Request('https://x/api/whatever', { headers: { Authorization: 'Basic abc123' } });
    const client = fakeClient(() => ({ data: { user: { id: 'should-not-be-reached' } }, error: null }));

    expect(await getPlatformUserId(request, client)).toBeNull();
  });

  it('returns null when Supabase rejects the token', async () => {
    const request = new Request('https://x/api/whatever', { headers: { Authorization: 'Bearer forged-token' } });
    const client = fakeClient(() => ({ data: { user: null }, error: new Error('invalid JWT') }));

    expect(await getPlatformUserId(request, client)).toBeNull();
  });

  it('returns the user id for a token Supabase accepts', async () => {
    const request = new Request('https://x/api/whatever', { headers: { Authorization: 'Bearer real-session-token' } });
    const client = fakeClient((jwt) =>
      jwt === 'real-session-token'
        ? { data: { user: { id: 'user-123' } }, error: null }
        : { data: { user: null }, error: new Error('no') },
    );

    expect(await getPlatformUserId(request, client)).toBe('user-123');
  });

  it('trims incidental whitespace after "Bearer "', async () => {
    const request = new Request('https://x/api/whatever', { headers: { Authorization: 'Bearer   spaced-token  ' } });
    const client = fakeClient((jwt) =>
      jwt === 'spaced-token'
        ? { data: { user: { id: 'user-456' } }, error: null }
        : { data: { user: null }, error: new Error('no') },
    );

    expect(await getPlatformUserId(request, client)).toBe('user-456');
  });
});
