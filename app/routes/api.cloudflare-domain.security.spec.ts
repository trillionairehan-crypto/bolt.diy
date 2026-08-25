import { describe, expect, it, vi } from 'vitest';

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
    addCustomDomain: vi.fn(async () => ({ domain: 'myapp.com', status: 'pending' })),
    getCustomDomainStatus: vi.fn(async () => ({ domain: 'myapp.com', status: 'pending' })),
  };
});

const { action, loader } = await import('~/routes/api.cloudflare-domain');

function actionArgs(body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    request: new Request('https://coralred.test/api/cloudflare-domain', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    context: { cloudflare: { env: { CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' } } },
    params: {},
  } as any;
}

function loaderArgs(projectName: string, domain: string, token?: string) {
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `https://coralred.test/api/cloudflare-domain?projectName=${encodeURIComponent(projectName)}&domain=${encodeURIComponent(domain)}`;

  return {
    request: new Request(url, { headers }),
    context: { cloudflare: { env: { CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' } } },
    params: {},
  } as any;
}

describe('api.cloudflare-domain action (connect) — auth/ownership', () => {
  it('401s with no Authorization header', async () => {
    const response = await action(actionArgs({ projectName: 'anything', domain: 'myapp.com' }));
    expect(response.status).toBe(401);
  });

  it('401s a forged token', async () => {
    const response = await action(actionArgs({ projectName: 'anything', domain: 'myapp.com' }, 'forged-token'));
    expect(response.status).toBe(401);
  });

  it("403s connecting a domain to someone else's project", async () => {
    const response = await action(actionArgs({ projectName: 'taken-project', domain: 'myapp.com' }, 'user-a-token'));
    expect(response.status).toBe(403);

    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/[가-힣]/);
  });

  it('allows the owner to connect a domain to their own project', async () => {
    const response = await action(actionArgs({ projectName: 'taken-project', domain: 'myapp.com' }, 'owner-token'));
    expect(response.status).toBe(200);
  });

  it('allows connecting a domain to a brand-new (unclaimed) project name', async () => {
    const response = await action(
      actionArgs({ projectName: 'brand-new-project', domain: 'myapp.com' }, 'user-a-token'),
    );
    expect(response.status).toBe(200);
  });
});

describe('api.cloudflare-domain loader (status polling) — auth/ownership', () => {
  it('401s with no Authorization header', async () => {
    const response = await loader(loaderArgs('anything', 'myapp.com'));
    expect(response.status).toBe(401);
  });

  it("403s polling someone else's project status", async () => {
    const response = await loader(loaderArgs('taken-project', 'myapp.com', 'user-a-token'));
    expect(response.status).toBe(403);
  });

  it('allows the owner to poll their own project status', async () => {
    const response = await loader(loaderArgs('taken-project', 'myapp.com', 'owner-token'));
    expect(response.status).toBe(200);
  });
});
