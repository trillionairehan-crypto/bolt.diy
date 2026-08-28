import { describe, expect, it, vi } from 'vitest';

/*
 * CLOUD_PROVISION_FIX.md — this suite covers the route's error-code mapping specifically (does a
 * quota_check_failed/insert_failed/unexpected result produce the right CLOUD-* code and never leak
 * the underlying Postgres error text into the response). provisionCloudApp's own branching logic
 * has its own direct unit tests in cloudProvision.spec.ts; this only re-mocks the two Supabase
 * clients the route builds (platform auth client + cloud data client) enough to drive those
 * branches end to end.
 */
let countResult: { count: number | null; error: { code: string; message: string; hint: string } | null } = {
  count: 0,
  error: null,
};
let insertError: { code: string; message: string; hint: string } | null = null;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (jwt: string) =>
        jwt === 'user-a-token'
          ? { data: { user: { id: 'user-a' } }, error: null }
          : { data: { user: null }, error: new Error('invalid token') },
    },
    from: (_table: string) => ({
      select: (_cols: string, _opts: unknown) => ({
        eq: async (_col: string, _val: string) => countResult,
      }),
      insert: async (_row: unknown) => ({ error: insertError }),
    }),
  }),
}));

const { action } = await import('~/routes/api.cloud-provision');

function actionArgs(token?: string) {
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    request: new Request('https://coralred.test/api/cloud-provision', { method: 'POST', headers }),
    context: {
      cloudflare: {
        env: {
          CLOUD_SUPABASE_URL: 'https://cloud.example.supabase.co',
          CLOUD_SUPABASE_SERVICE_KEY: 'test-service-key',
          CLOUD_APP_TOKEN_SECRET: 'test-app-token-secret',
        },
      },
    },
    params: {},
  } as any;
}

describe('api.cloud-provision — error code mapping', () => {
  it('401s with no Authorization header', async () => {
    const response = await action(actionArgs());
    expect(response.status).toBe(401);
  });

  it('maps a quota-check failure to CLOUD-QC without leaking the Postgres error text', async () => {
    countResult = {
      count: null,
      error: { code: '42501', message: 'permission denied for table cloud_apps', hint: '' },
    };
    insertError = null;

    const response = await action(actionArgs('user-a-token'));
    expect(response.status).toBe(500);

    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('CLOUD-QC');
    expect(data.error).not.toContain('permission denied');
  });

  it('maps an insert failure to CLOUD-IN without leaking the Postgres error text', async () => {
    countResult = { count: 0, error: null };
    insertError = { code: '42501', message: 'new row violates row-level security policy', hint: '' };

    const response = await action(actionArgs('user-a-token'));
    expect(response.status).toBe(500);

    const data = (await response.json()) as { error: string };
    expect(data.error).toContain('CLOUD-IN');
    expect(data.error).not.toContain('row-level security');
  });

  it('succeeds (201) once the quota check and insert both go through', async () => {
    countResult = { count: 0, error: null };
    insertError = null;

    const response = await action(actionArgs('user-a-token'));
    expect(response.status).toBe(201);

    const data = (await response.json()) as { appId: string; token: string };
    expect(data.appId).toBeTruthy();
    expect(data.token).toBeTruthy();
  });
});
