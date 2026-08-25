import { describe, expect, it, vi } from 'vitest';

/**
 * SECURITY_PLAN.md's auth/ownership work for api.cloudflare-deploy.ts. Both Supabase (auth +
 * ownership RPC) and the actual Cloudflare deploy call are mocked — this suite never makes a
 * real network request.
 */
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (jwt: string) => {
        const userByToken: Record<string, string> = {
          'user-a-token': 'user-a',
          'owner-token': 'owner-user',
        };
        const userId = userByToken[jwt];

        return userId
          ? { data: { user: { id: userId } }, error: null }
          : { data: { user: null }, error: new Error('invalid token') };
      },
    },
    rpc: async (_name: string, params: { p_project_name: string; p_user_id: string }) => {
      // 'taken-project' belongs to 'owner-user' — anyone else calling is "owned by other".
      if (params.p_project_name === 'taken-project' && params.p_user_id !== 'owner-user') {
        return { data: true, error: null };
      }

      return { data: false, error: null };
    },
  }),
}));

vi.mock('~/lib/services/cloudflarePages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/lib/services/cloudflarePages')>();

  return {
    ...actual,
    deployToCloudflarePages: vi.fn(async () => ({
      url: 'https://coralred-app-x.pages.dev',
      deploymentId: 'deploy-1',
      projectName: 'coralred-app-x',
      isFirstDeploy: false,
    })),
  };
});

const { action } = await import('~/routes/api.cloudflare-deploy');

function actionArgs(body: unknown, token?: string) {
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    request: new Request('https://coralred.test/api/cloudflare-deploy', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    context: { cloudflare: { env: { CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' } } },
    params: {},
  } as any;
}

describe('api.cloudflare-deploy — auth/ownership', () => {
  it('401s a request with no Authorization header at all', async () => {
    const response = await action(actionArgs({ projectName: 'anything', files: { 'a.txt': 'YQ==' } }));
    expect(response.status).toBe(401);

    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/[가-힣]/);
  });

  it('401s a request with a forged/unrecognized token', async () => {
    const response = await action(actionArgs({ projectName: 'anything', files: { 'a.txt': 'YQ==' } }, 'forged-token'));
    expect(response.status).toBe(401);
  });

  it('403s when the project already belongs to a different account', async () => {
    const response = await action(
      actionArgs({ projectName: 'taken-project', files: { 'a.txt': 'YQ==' } }, 'user-a-token'),
    );
    expect(response.status).toBe(403);

    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/[가-힣]/);
  });

  it('allows the actual owner to redeploy their own existing project', async () => {
    const response = await action(
      actionArgs({ projectName: 'taken-project', files: { 'a.txt': 'YQ==' } }, 'owner-token'),
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as { success: boolean };
    expect(data.success).toBe(true);
  });

  it('allows a brand-new project name (first deploy) for any logged-in user', async () => {
    const response = await action(
      actionArgs({ projectName: 'brand-new-project', files: { 'a.txt': 'YQ==' } }, 'user-a-token'),
    );
    expect(response.status).toBe(200);
  });
});
