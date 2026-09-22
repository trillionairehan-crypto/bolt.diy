/*
 * API 계약 테스트 — 코랄레드 고유 라우트가 "형식·인증·미설정" 경계에서 문서(docs/API.md)대로 응답하는지.
 * 네트워크 0: Supabase/Anthropic/Gemini/Cloudflare로 나가는 경로에 닿기 전의 분기만 본다.
 * 목적은 회귀 감지다 — 누가 라우트를 고쳐서 405가 500이 되거나, 401 게이트가 사라지거나, 응답 필드가 빠지면 여기서 잡힌다.
 *
 * getPlatformUserId()는 VITE_PLATFORM_SUPABASE_URL/ANON_KEY가 없으면 Supabase를 부르지 않고 null을 돌려준다
 * (cloudPlatformAuth.ts) — 그래서 env를 비우면 모든 요청이 게스트/401로 흐른다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/remix', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null }, error: null }), admin: { deleteUser: vi.fn() } },
    from: () => ({ select: () => ({ head: true, count: 0, error: null }) }),
    rpc: async () => ({ data: null, error: null }),
  }),
}));

type RouteModule = {
  action?: (args: any) => Promise<Response>;
  loader?: (args: any) => Promise<Response>;
};

function args(
  url: string,
  init: RequestInit = {},
  env: Record<string, string> = {},
  params: Record<string, string> = {},
) {
  return {
    request: new Request(`https://coralred.test${url}`, init),
    context: { cloudflare: { env, ctx: { waitUntil: vi.fn() } } },
    params,
  } as any;
}

const jsonPost = (url: string, body: unknown, env?: Record<string, string>, params?: Record<string, string>) =>
  args(
    url,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    env,
    params,
  );

async function bodyOf(res: Response) {
  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

describe('API 계약 — 메서드·인증·미설정 경계', () => {
  // 라우트는 env?.X || process.env.X 로 읽는다 — 로컬 .env가 vitest의 process.env로 새면 "미설정" 분기가 안 잡힌다.
  beforeEach(() => {
    for (const key of [
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'CLOUDFLARE_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      'R2_PUBLIC_BASE_URL',
      'VIDEO_PROVIDER',
      'ARK_API_KEY',
      'KLING_API_KEY',
      'KLING_ACCESS_KEY',
      'KLING_SECRET_KEY',
      'IMAGE_PROVIDER',
      'CLOUD_SUPABASE_URL',
      'CLOUD_SUPABASE_SERVICE_KEY',
      'CLOUD_APP_TOKEN_SECRET',
      'CLOUDFLARE_API_TOKEN',
      'PORTONE_API_SECRET',
      'VITE_PLATFORM_SUPABASE_URL',
      'VITE_PLATFORM_SUPABASE_ANON_KEY',
      'PLATFORM_SUPABASE_SERVICE_ROLE_KEY',
    ]) {
      vi.stubEnv(key, '');
    }
  });

  it('GET /api/health → 200 { status, timestamp, migrations }', async () => {
    const mod = (await import('~/routes/api.health')) as RouteModule;
    const res = await mod.loader!(args('/api/health'));
    const body = await bodyOf(res);

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: 'healthy' });
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('migrations');
  });

  it('POST /api/onboarding — GET은 405, chatId 없으면 200 {ok:false}', async () => {
    const mod = (await import('~/routes/api.onboarding')) as RouteModule;

    expect((await mod.action!(args('/api/onboarding', { method: 'GET' }))).status).toBe(405);

    const res = await mod.action!(jsonPost('/api/onboarding', { q1Audience: 'x' }));
    expect(res.status).toBe(200);
    expect(await bodyOf(res)).toMatchObject({ ok: false });
  });

  it('POST /api/utm-attribution — 비로그인 401, GET 405', async () => {
    const mod = (await import('~/routes/api.utm-attribution')) as RouteModule;

    expect((await mod.action!(jsonPost('/api/utm-attribution', { utmSource: 'x' }))).status).toBe(401);
    expect((await mod.action!(args('/api/utm-attribution', { method: 'GET' }))).status).toBe(405);
  });

  it('POST /api/account-delete — 비로그인 401, GET 405', async () => {
    const mod = (await import('~/routes/api.account-delete')) as RouteModule;

    expect((await mod.action!(jsonPost('/api/account-delete', {}))).status).toBe(401);
    expect((await mod.action!(args('/api/account-delete', { method: 'GET' }))).status).toBe(405);
  });

  it('POST /api/media-images — 미설정 503, 잘못된 body 400, jobId 없음 400, 예약은 200 {images, jobId}', async () => {
    const mod = (await import('~/routes/api.media-images')) as RouteModule;

    expect((await mod.action!(jsonPost('/api/media-images', { reserve: true, jobId: 'jtest0000-abc' }))).status).toBe(
      503,
    );

    const env = {
      GOOGLE_GENERATIVE_AI_API_KEY: 'k',
      CLOUDFLARE_ACCOUNT_ID: 'acc',
      R2_ACCESS_KEY_ID: 'a',
      R2_SECRET_ACCESS_KEY: 's',
      R2_BUCKET_NAME: 'b',
      R2_PUBLIC_BASE_URL: 'https://pub-test.r2.dev',
    };

    expect((await mod.action!(args('/api/media-images', { method: 'POST', body: 'not-json' }, env))).status).toBe(400);
    expect((await mod.action!(jsonPost('/api/media-images', { reserve: true }, env))).status).toBe(400);
    expect((await mod.action!(jsonPost('/api/media-images', { reserve: true, jobId: 'BAD ID' }, env))).status).toBe(
      400,
    );

    const res = await mod.action!(jsonPost('/api/media-images', { reserve: true, jobId: 'jtest0000-abcdef' }, env));
    const body = await bodyOf(res);

    expect(res.status).toBe(200);
    expect(body.jobId).toBe('jtest0000-abcdef');
    expect(Object.keys(body.images).sort()).toEqual(['ch1', 'ch2', 'ch3', 'hero']);
    expect(body.images.hero).toBe('https://pub-test.r2.dev/media/jtest0000-abcdef/hero.jpg');

    // 생성 요청에 필수값이 빠지면 400 (Gemini는 부르지 않는다)
    expect((await mod.action!(jsonPost('/api/media-images', { jobId: 'jtest0000-abcdef' }, env))).status).toBe(400);
  });

  it('POST /api/media-video — 잘못된 body 400, 필수값 400, 프로바이더 미설정 503; GET 필수 쿼리 400', async () => {
    const mod = (await import('~/routes/api.media-video')) as RouteModule;

    expect((await mod.action!(args('/api/media-video', { method: 'POST', body: '{' }))).status).toBe(400);
    expect((await mod.action!(jsonPost('/api/media-video', { jobId: 'j' }))).status).toBe(400);
    expect(
      (await mod.action!(jsonPost('/api/media-video', { jobId: 'jtest0000-abcdef', imageUrl: 'https://x/y.jpg' })))
        .status,
    ).toBe(503);
    expect((await mod.loader!(args('/api/media-video?jobId=j'))).status).toBe(400);
  });

  it('POST /api/llmcall — model/provider 없으면 400', async () => {
    const mod = (await import('~/routes/api.llmcall')) as RouteModule;

    await expect(
      mod.action!(jsonPost('/api/llmcall', { message: 'hi', provider: { name: 'Anthropic' } })),
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      mod.action!(jsonPost('/api/llmcall', { message: 'hi', model: 'claude-sonnet-5' })),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it('POST /api/cloud-provision — GET 405, 시크릿 미설정 503, 비로그인 401', async () => {
    const mod = (await import('~/routes/api.cloud-provision')) as RouteModule;

    expect((await mod.action!(args('/api/cloud-provision', { method: 'GET' }))).status).toBe(405);
    expect((await mod.action!(jsonPost('/api/cloud-provision', {}))).status).toBe(503);
    expect(
      (
        await mod.action!(
          jsonPost(
            '/api/cloud-provision',
            {},
            {
              CLOUD_SUPABASE_URL: 'https://c.supabase.co',
              CLOUD_SUPABASE_SERVICE_KEY: 'k',
              CLOUD_APP_TOKEN_SECRET: 's',
            },
          ),
        )
      ).status,
    ).toBe(401);
  });

  it('POST /api/cloud-set-origin — GET 405, 잘못된 body 400, 형식 오류 400', async () => {
    const mod = (await import('~/routes/api.cloud-set-origin')) as RouteModule;

    expect((await mod.action!(args('/api/cloud-set-origin', { method: 'GET' }))).status).toBe(405);
    expect((await mod.action!(args('/api/cloud-set-origin', { method: 'POST', body: '{' }))).status).toBe(400);
    expect((await mod.action!(jsonPost('/api/cloud-set-origin', { appId: 'x' }))).status).toBe(400);
  });

  it('/api/cloud/:appId/:collection — PUT 405, 토큰 없으면 401', async () => {
    const mod = (await import('~/routes/api.cloud.$appId.$collection')) as RouteModule;
    const params = { appId: '00000000-0000-4000-8000-000000000000', collection: 'notes' };

    expect((await mod.action!(args('/api/cloud/x/notes', { method: 'PUT' }, {}, params))).status).toBe(405);

    const res = await mod.action!(jsonPost('/api/cloud/x/notes', { deviceKey: 'd', data: {} }, {}, params));
    expect([401, 403, 503]).toContain(res.status);
  });

  it('POST /api/cloudflare-deploy — 비로그인 401', async () => {
    const mod = (await import('~/routes/api.cloudflare-deploy')) as RouteModule;
    expect((await mod.action!(jsonPost('/api/cloudflare-deploy', { projectName: 'x', files: {} }))).status).toBe(401);
  });

  it('POST|GET /api/cloudflare-domain — 비로그인 401', async () => {
    const mod = (await import('~/routes/api.cloudflare-domain')) as RouteModule;
    expect((await mod.action!(jsonPost('/api/cloudflare-domain', { projectName: 'x', domain: 'a.com' }))).status).toBe(
      401,
    );
    expect((await mod.loader!(args('/api/cloudflare-domain?projectName=x'))).status).toBe(401);
  });

  it('POST /api/payment/verify — GET 405, 비로그인 401', async () => {
    const mod = (await import('~/routes/api.payment.verify')) as RouteModule;
    expect((await mod.action!(args('/api/payment/verify', { method: 'GET' }))).status).toBe(405);
    expect((await mod.action!(jsonPost('/api/payment/verify', { paymentId: 'p' }))).status).toBe(401);
  });

  it('POST /api/payment/webhook — GET 405, POST는 200 (현재 no-op; 서명 검증이 들어오면 이 기대를 바꾼다)', async () => {
    const mod = (await import('~/routes/api.payment.webhook')) as RouteModule;
    expect((await mod.action!(args('/api/payment/webhook', { method: 'GET' }))).status).toBe(405);
    expect((await mod.action!(jsonPost('/api/payment/webhook', { type: 'Transaction.Paid' }))).status).toBe(200);
  });
});
