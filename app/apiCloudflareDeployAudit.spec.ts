import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { action } from '~/routes/api.cloudflare-deploy';

/*
 * api.cloudflare-deploy.ts's action now requires auth (getPlatformUserId) before it ever reaches
 * the file-content handling this suite tests — mocked here at the module level since the route
 * builds its own Supabase client internally (no DI seam threaded through the route itself; that
 * seam exists on getPlatformUserId/isProjectOwnedByOther for their own direct unit tests instead
 * (cloudPlatformAuth.spec.ts, deployedAppOwnership.spec.ts) and for the route-level 401/403/200
 * cases (api.cloudflare-deploy.security.spec.ts and friends). vi.mock calls are hoisted above
 * imports by vitest's transform, so this still applies even though it's written after the static
 * import above.
 */
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (jwt: string) =>
        jwt === 'valid-test-token'
          ? { data: { user: { id: 'test-user-id' } }, error: null }
          : { data: { user: null }, error: new Error('invalid token') },
    },
    rpc: async () => ({ data: false, error: null }),
  }),
}));

function actionArgs(body: unknown) {
  return {
    request: new Request('https://coralred.test/api/cloudflare-deploy', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-test-token' },
      body: JSON.stringify(body),
    }),
    context: { cloudflare: { env: {} } },
    params: {},
  } as any;
}

describe('api.cloudflare-deploy action — malformed base64 file content', () => {
  const originalAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const originalApiToken = process.env.CLOUDFLARE_API_TOKEN;

  beforeEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
    process.env.CLOUDFLARE_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    process.env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
    process.env.CLOUDFLARE_API_TOKEN = originalApiToken;
  });

  it('returns a friendly Korean 400 instead of an unhandled crash for an .html file', async () => {
    const response = await action(
      actionArgs({
        projectName: 'my-app',
        files: { 'index.html': 'not-valid-base64!!!' },
      }),
    );

    expect(response.status).toBe(400);

    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/[가-힣]/);
  });

  it('returns the same friendly 400 for a non-HTML file', async () => {
    const response = await action(
      actionArgs({
        projectName: 'my-app',
        files: { 'assets/app.js': '***not base64***' },
      }),
    );

    expect(response.status).toBe(400);

    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/[가-힣]/);
  });
});
