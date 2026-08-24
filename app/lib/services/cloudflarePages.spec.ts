import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addCustomDomain,
  CloudflareDeployError,
  deployToCloudflarePages,
  getCustomDomainStatus,
  hashFileContent,
  injectMadeWithBadge,
} from './cloudflarePages';

const enc = new TextEncoder();

describe('hashFileContent', () => {
  /*
   * Regression anchors computed with the same algorithm this file implements (blake3(base64(bytes)
   * + extension), first 16 bytes, hex) — the underlying blake3 call itself was separately verified
   * against BLAKE3's official empty-input test vector (af1349b9f5f9a1a6a0404dea36dcc949...) before
   * this module was written. These values catch accidental algorithm drift, not correctness from
   * scratch.
   */
  it('matches known values for representative paths', () => {
    expect(hashFileContent('index.html', enc.encode('<h1>hi</h1>'))).toBe('e5e943f01929441dfbb0d4956a759fda');
    expect(hashFileContent('assets/app.js', enc.encode('console.log(1);'))).toBe('9de4ebf0de975f33c87bf2b96327373b');
    expect(hashFileContent('LICENSE', enc.encode('hello'))).toBe('324ea05bea4d7f75b8d9ed695e65b2ca');
    expect(hashFileContent('.env', enc.encode('secret'))).toBe('9421fc4fcafeedf4bcc9adfc1d3a95ae');
  });

  it('is deterministic for the same path and content', () => {
    const content = enc.encode('same content');
    expect(hashFileContent('a.txt', content)).toBe(hashFileContent('a.txt', content));
  });

  it('differs when content differs', () => {
    expect(hashFileContent('a.txt', enc.encode('one'))).not.toBe(hashFileContent('a.txt', enc.encode('two')));
  });

  it('differs when only the extension differs (same content)', () => {
    const content = enc.encode('identical bytes');
    expect(hashFileContent('a.txt', content)).not.toBe(hashFileContent('a.css', content));
  });

  it('always returns 32 lowercase hex characters', () => {
    const hash = hashFileContent('weird path/with spaces.HTML', enc.encode('x'));
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('injectMadeWithBadge', () => {
  it('inserts the badge right before the closing </body> tag', () => {
    const html = '<html><body><h1>hi</h1></body></html>';
    const result = injectMadeWithBadge(html);
    expect(result.indexOf('coralred.kr')).toBeGreaterThan(0);
    expect(result.indexOf('coralred.kr')).toBeLessThan(result.indexOf('</body>'));
    expect(result.startsWith('<html><body><h1>hi</h1>')).toBe(true);
  });

  it('falls back to appending when </body> is absent', () => {
    const html = '<div>fragment, no body tag</div>';
    const result = injectMadeWithBadge(html);
    expect(result.startsWith(html)).toBe(true);
    expect(result).toContain('coralred.kr');
  });

  it('only touches the last </body> occurrence when multiple exist', () => {
    const html = '<body>first</body><body>second</body>';
    const result = injectMadeWithBadge(html);
    const firstClose = result.indexOf('</body>');
    const badgeIndex = result.indexOf('coralred.kr');
    expect(badgeIndex).toBeGreaterThan(firstClose);
  });
});

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

describe('deployToCloudflarePages', () => {
  const files = [{ path: 'index.html', content: enc.encode('<h1>hi</h1>') }];

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an empty file list without making any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      deployToCloudflarePages({ accountId: 'acc', apiToken: 'tok', projectName: 'proj', files: [] }),
    ).rejects.toThrow(CloudflareDeployError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs the full create → upload-token → check-missing → upload → deploy sequence and returns the pages.dev alias', async () => {
    const calls: Array<{ url: string; method?: string }> = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push({ url, method: init?.method });

      if (url.endsWith('/pages/projects/proj') && !init?.method) {
        // project existence check (plain GET, no method override) — already exists
        return jsonResponse({}, { ok: true });
      }

      if (url.endsWith('/upload-token')) {
        return jsonResponse({ success: true, result: { jwt: 'upload-jwt' } });
      }

      if (url.endsWith('/pages/assets/check-missing')) {
        return jsonResponse({ success: true, result: ['e5e943f01929441dfbb0d4956a759fda'] });
      }

      if (url.endsWith('/pages/assets/upload')) {
        return jsonResponse({ success: true, result: null });
      }

      if (url.endsWith('/pages/assets/upsert-hashes')) {
        return jsonResponse({ success: true, result: null });
      }

      if (url.endsWith('/pages/projects/proj/deployments')) {
        return jsonResponse({
          success: true,
          result: { id: 'deploy-1', url: 'https://abc123.proj.pages.dev', aliases: ['https://proj.pages.dev'] },
        });
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await deployToCloudflarePages({
      accountId: 'acc',
      apiToken: 'tok',
      projectName: 'proj',
      files,
    });

    expect(result).toEqual({
      url: 'https://proj.pages.dev',
      deploymentId: 'deploy-1',
      projectName: 'proj',
    });

    // project GET, upload-token, check-missing, upload (one batch), upsert-hashes, deployments
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.cloudflare.com/client/v4/accounts/acc/pages/projects/proj',
      'https://api.cloudflare.com/client/v4/accounts/acc/pages/projects/proj/upload-token',
      'https://api.cloudflare.com/client/v4/pages/assets/check-missing',
      'https://api.cloudflare.com/client/v4/pages/assets/upload',
      'https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes',
      'https://api.cloudflare.com/client/v4/accounts/acc/pages/projects/proj/deployments',
    ]);
  });

  it('creates the project when it does not exist yet (404 on the existence check)', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.endsWith('/pages/projects/proj') && !init?.method) {
        return jsonResponse({}, { ok: false, status: 404 });
      }

      if (url.endsWith('/pages/projects') && init?.method === 'POST') {
        return jsonResponse({ success: true, result: {} });
      }

      if (url.endsWith('/upload-token')) {
        return jsonResponse({ success: true, result: { jwt: 'upload-jwt' } });
      }

      if (url.endsWith('/pages/assets/check-missing')) {
        return jsonResponse({ success: true, result: [] });
      }

      if (url.endsWith('/pages/assets/upsert-hashes')) {
        return jsonResponse({ success: true, result: null });
      }

      if (url.endsWith('/pages/projects/proj/deployments')) {
        return jsonResponse({
          success: true,
          result: { id: 'deploy-2', url: 'https://xyz.proj.pages.dev', aliases: [] },
        });
      }

      throw new Error(`unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const result = await deployToCloudflarePages({ accountId: 'acc', apiToken: 'tok', projectName: 'proj', files });

    // no aliases matched .pages.dev — falls back to the deployment's own url
    expect(result.url).toBe('https://xyz.proj.pages.dev');
    expect(fetchMock.mock.calls.some(([input]) => input.toString().endsWith('/pages/projects') && true)).toBe(true);
  });

  it('surfaces a 401 as CloudflareDeployError with status 401 (expired/invalid token)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { success: false, errors: [{ code: 9109, message: 'Invalid access token' }] },
        { ok: false, status: 401 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      deployToCloudflarePages({ accountId: 'acc', apiToken: 'bad-token', projectName: 'proj', files }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('surfaces a 403 as CloudflareDeployError with status 403 (insufficient permission)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { success: false, errors: [{ code: 10000, message: 'Authentication error' }] },
        { ok: false, status: 403 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      deployToCloudflarePages({ accountId: 'acc', apiToken: 'tok', projectName: 'proj', files }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe('custom domains', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('addCustomDomain posts the domain and returns its initial status', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe('https://api.cloudflare.com/client/v4/accounts/acc/pages/projects/proj/domains');
      return jsonResponse({ success: true, result: { name: 'myapp.com', status: 'pending' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await addCustomDomain('acc', 'tok', 'proj', 'myapp.com');
    expect(result).toEqual({ domain: 'myapp.com', status: 'pending' });
  });

  it('addCustomDomain surfaces a 403 (missing DNS/domain-edit permission) as CloudflareDeployError', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        { success: false, errors: [{ code: 10000, message: 'Authentication error' }] },
        { ok: false, status: 403 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(addCustomDomain('acc', 'tok', 'proj', 'myapp.com')).rejects.toMatchObject({ status: 403 });
    await expect(addCustomDomain('acc', 'tok', 'proj', 'myapp.com')).rejects.toBeInstanceOf(CloudflareDeployError);
  });

  it('getCustomDomainStatus reports active once validated', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe(
        'https://api.cloudflare.com/client/v4/accounts/acc/pages/projects/proj/domains/myapp.com',
      );
      return jsonResponse({ success: true, result: { name: 'myapp.com', status: 'active' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await getCustomDomainStatus('acc', 'tok', 'proj', 'myapp.com');
    expect(result.status).toBe('active');
  });
});
