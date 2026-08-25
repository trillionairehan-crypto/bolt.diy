import { describe, expect, it, vi } from 'vitest';

/**
 * api.payment.verify.ts has no client caller yet (see the route's own comment — pricing.tsx isn't
 * wired to it this session). This only tests the auth gate added on top; PortOne itself is mocked
 * so a "success" case doesn't require a real payment ID or network call.
 */
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async (jwt: string) =>
        jwt === 'user-a-token'
          ? { data: { user: { id: 'user-a' } }, error: null }
          : { data: { user: null }, error: new Error('invalid token') },
    },
  }),
}));

const originalFetch = global.fetch;

const { action } = await import('~/routes/api.payment.verify');

function actionArgs(body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    request: new Request('https://coralred.test/api/payment/verify', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    context: { cloudflare: { env: { PORTONE_API_SECRET: 'test-secret' } } },
    params: {},
  } as any;
}

describe('api.payment.verify — auth only (no ownership check, per SECURITY_PLAN.md)', () => {
  it('401s a request with no Authorization header', async () => {
    const response = await action(actionArgs({ paymentId: 'pay_123' }));
    expect(response.status).toBe(401);

    const data = (await response.json()) as { verified: boolean };
    expect(data.verified).toBe(false);
  });

  it('401s a forged/invalid token', async () => {
    const response = await action(actionArgs({ paymentId: 'pay_123' }, 'forged-token'));
    expect(response.status).toBe(401);
  });

  it('reaches the PortOne lookup once authenticated (mocked network call)', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: 'PAID', amount: { total: 9900 }, currency: 'KRW' }), { status: 200 }),
    ) as unknown as typeof fetch;

    try {
      const response = await action(actionArgs({ paymentId: 'pay_123' }, 'user-a-token'));
      expect(response.status).toBe(200);

      const data = (await response.json()) as { verified: boolean };
      expect(data.verified).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
