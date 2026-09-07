import { describe, expect, it, vi } from 'vitest';

let deleteUserResult: { error: { message: string } | null } = { error: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (jwt: string) =>
        jwt === 'user-a-token'
          ? { data: { user: { id: 'user-a' } }, error: null }
          : { data: { user: null }, error: new Error('invalid token') },
      admin: {
        deleteUser: async (_userId: string) => deleteUserResult,
      },
    },
  }),
}));

const { action } = await import('~/routes/api.account-delete');

function actionArgs(token?: string, env?: Record<string, string>) {
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    request: new Request('https://coralred.test/api/account-delete', { method: 'POST', headers }),
    context: {
      cloudflare: {
        env: {
          VITE_PLATFORM_SUPABASE_URL: 'https://platform.example.supabase.co',
          PLATFORM_SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
          ...env,
        },
      },
    },
    params: {},
  } as any;
}

describe('api.account-delete', () => {
  it('rejects a non-POST request', async () => {
    const response = await action({
      ...actionArgs('user-a-token'),
      request: new Request('https://coralred.test/api/account-delete', { method: 'GET' }),
    } as any);
    expect(response.status).toBe(405);
  });

  it('rejects with 401 when there is no Authorization header', async () => {
    const response = await action(actionArgs());
    expect(response.status).toBe(401);
  });

  it('rejects with 401 for an invalid token', async () => {
    const response = await action(actionArgs('bad-token'));
    expect(response.status).toBe(401);
  });

  it('returns 500 (not a silent success) when the service role key is missing', async () => {
    const response = await action(actionArgs('user-a-token', { PLATFORM_SUPABASE_SERVICE_ROLE_KEY: '' }));
    expect(response.status).toBe(500);

    const body = (await response.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });

  it('deletes the authenticated user and returns ok on success', async () => {
    deleteUserResult = { error: null };

    const response = await action(actionArgs('user-a-token'));
    expect(response.status).toBe(200);

    const body = (await response.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  it('returns 500 when Supabase admin.deleteUser fails', async () => {
    deleteUserResult = { error: { message: 'boom' } };

    const response = await action(actionArgs('user-a-token'));
    expect(response.status).toBe(500);
  });
});
