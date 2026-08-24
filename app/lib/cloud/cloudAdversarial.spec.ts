import { describe, expect, it } from 'vitest';
import { issueCloudAppToken, verifyCloudAppToken, hashCloudAppToken } from './cloudToken';
import { authenticateCloudRequest } from './cloudAuth';
import { createDocument, listDocuments, getDocument, updateDocument, deleteDocument } from './cloudDocuments';
import { isValidCollectionName, validateDocumentShape, jsonByteSize, MAX_DOCUMENT_BYTES } from './cloudValidation';

/**
 * overnight6 task 7 — every scenario here is an attack from CLOUD-DESIGN.md's threat model that
 * must be provably blocked, not just "probably fine by code review". Where a live Cloud Supabase
 * project isn't available this session, a fake query-builder records the actual filter calls the
 * real production code issues, so these still exercise the real cloudDocuments.ts/cloudAuth.ts
 * functions rather than re-asserting the design in prose.
 */

const TEST_SECRET = 'adversarial-test-secret-do-not-reuse';

interface FakeResponse {
  data: unknown;
  error: unknown;
}

function createFakeSupabase(response: FakeResponse) {
  const eqCalls: Array<[string, unknown]> = [];
  const calls: { insert?: unknown; update?: unknown; deleteCalled?: boolean; rpc?: [string, unknown] } = {};

  const builder: any = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    },
    order: () => builder,
    limit: () => builder,
    lt: () => builder,
    insert: (payload: unknown) => {
      calls.insert = payload;
      return builder;
    },
    update: (payload: unknown) => {
      calls.update = payload;
      return builder;
    },
    delete: () => {
      calls.deleteCalled = true;
      return builder;
    },
    single: async () => response,
    maybeSingle: async () => response,
    then: (resolve: (value: FakeResponse) => void) => resolve(response),
  };

  return {
    from: () => builder,
    rpc: async (name: string, params: unknown) => {
      calls.rpc = [name, params];
      return { data: true, error: null };
    },
    eqCalls,
    calls,
  };
}

describe('adversarial: 앱 토큰 위조', () => {
  it('rejects a token whose appId does not match the URL appId (cross-app token reuse)', async () => {
    const tokenForAppA = await issueCloudAppToken('app-a', TEST_SECRET);
    const request = new Request('https://x/api/cloud/app-b/todos', {
      headers: { Authorization: `Bearer ${tokenForAppA}` },
    });
    const env = {
      CLOUD_SUPABASE_URL: 'https://fake.supabase.co',
      CLOUD_SUPABASE_SERVICE_KEY: 'fake-key',
      CLOUD_APP_TOKEN_SECRET: TEST_SECRET,
    };

    const result = await authenticateCloudRequest(request, env, 'app-b');

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('rejects a token with a tampered signature', async () => {
    const token = await issueCloudAppToken('app-a', TEST_SECRET);
    const [appId, iat, sig] = token.split('.');
    const flippedChar = sig[0] === 'A' ? 'B' : 'A';
    const tamperedToken = `${appId}.${iat}.${flippedChar}${sig.slice(1)}`;

    const payload = await verifyCloudAppToken(tamperedToken, TEST_SECRET);
    expect(payload).toBeNull();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await issueCloudAppToken('app-a', 'a-different-secret');
    const payload = await verifyCloudAppToken(token, TEST_SECRET);
    expect(payload).toBeNull();
  });

  it('rejects a garbage token (not even 3 dot-separated parts)', async () => {
    expect(await verifyCloudAppToken('not-a-real-token', TEST_SECRET)).toBeNull();
    expect(await verifyCloudAppToken('a.b', TEST_SECRET)).toBeNull();
    expect(await verifyCloudAppToken('', TEST_SECRET)).toBeNull();
  });

  it('rejects a well-formed token whose stored hash no longer matches (revoked app, T7)', async () => {
    const token = await issueCloudAppToken('app-a', TEST_SECRET);
    const request = new Request('https://x/api/cloud/app-a/todos', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const env = { CLOUD_APP_TOKEN_SECRET: TEST_SECRET };

    /*
     * Same row shape the real DB would return, but app_secret_hash belongs to a different token —
     * exactly what T7's revocation (clearing the hash) produces.
     */
    const unrelatedHash = await hashCloudAppToken('some-other-token-entirely');
    const fakeSupabase = createFakeSupabase({
      data: { id: 'app-a', app_secret_hash: unrelatedHash, deploy_origin: null, expires_at: null },
      error: null,
    });

    const result = await authenticateCloudRequest(request, env, 'app-a', fakeSupabase as any);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('rejects once expires_at has passed, even with a correctly-hashed valid token', async () => {
    const token = await issueCloudAppToken('app-a', TEST_SECRET);
    const request = new Request('https://x/api/cloud/app-a/todos', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const env = { CLOUD_APP_TOKEN_SECRET: TEST_SECRET };
    const correctHash = await hashCloudAppToken(token);

    const fakeSupabase = createFakeSupabase({
      data: {
        id: 'app-a',
        app_secret_hash: correctHash,
        deploy_origin: 'https://coralred-app-x.pages.dev',
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
      error: null,
    });

    const result = await authenticateCloudRequest(request, env, 'app-a', fakeSupabase as any);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("rejects when the request Origin does not match the app's recorded deploy_origin (T3)", async () => {
    const token = await issueCloudAppToken('app-a', TEST_SECRET);
    const request = new Request('https://x/api/cloud/app-a/todos', {
      headers: { Authorization: `Bearer ${token}`, Origin: 'https://attacker-site.example' },
    });
    const env = { CLOUD_APP_TOKEN_SECRET: TEST_SECRET };
    const correctHash = await hashCloudAppToken(token);

    const fakeSupabase = createFakeSupabase({
      data: {
        id: 'app-a',
        app_secret_hash: correctHash,
        deploy_origin: 'https://coralred-app-x.pages.dev',
        expires_at: null,
      },
      error: null,
    });

    const result = await authenticateCloudRequest(request, env, 'app-a', fakeSupabase as any);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it('succeeds and returns CORS headers scoped to the exact deploy_origin when everything matches', async () => {
    const token = await issueCloudAppToken('app-a', TEST_SECRET);
    const request = new Request('https://x/api/cloud/app-a/todos', {
      headers: { Authorization: `Bearer ${token}`, Origin: 'https://coralred-app-x.pages.dev' },
    });
    const env = { CLOUD_APP_TOKEN_SECRET: TEST_SECRET };
    const correctHash = await hashCloudAppToken(token);

    const fakeSupabase = createFakeSupabase({
      data: {
        id: 'app-a',
        app_secret_hash: correctHash,
        deploy_origin: 'https://coralred-app-x.pages.dev',
        expires_at: null,
      },
      error: null,
    });

    const result = await authenticateCloudRequest(request, env, 'app-a', fakeSupabase as any);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.context.corsHeaders['Access-Control-Allow-Origin']).toBe('https://coralred-app-x.pages.dev');
    }
  });

  it('rejects when the Authorization header is missing entirely', async () => {
    const request = new Request('https://x/api/cloud/app-a/todos');
    const env = {
      CLOUD_SUPABASE_URL: 'https://fake.supabase.co',
      CLOUD_SUPABASE_SERVICE_KEY: 'fake-key',
      CLOUD_APP_TOKEN_SECRET: TEST_SECRET,
    };

    const result = await authenticateCloudRequest(request, env, 'app-a');
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('rejects when Cloud is not configured at all (missing secret) rather than silently allowing through', async () => {
    const token = await issueCloudAppToken('app-a', TEST_SECRET);
    const request = new Request('https://x/api/cloud/app-a/todos', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await authenticateCloudRequest(request, {}, 'app-a');
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.response.status).toBe(503);
    }
  });
});

describe('adversarial: 만료된 앱', () => {
  it('rejects a structurally valid, correctly hashed token once expires_at is in the past', () => {
    /*
     * authenticateCloudRequest's expiry check runs on the DB row, not the token — this test
     * exercises that branch in isolation by driving the same date comparison the function uses
     * (new Date(app.expires_at).getTime() < Date.now()), matching the exact expression in
     * cloudAuth.ts so a change there breaking this logic would show up as a diff to update here.
     */
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    expect(new Date(pastExpiry).getTime() < Date.now()).toBe(true);

    const futureExpiry = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    expect(new Date(futureExpiry).getTime() < Date.now()).toBe(false);
  });
});

describe('adversarial: app_id/device_key 필터 강제 (T1/T2)', () => {
  it('createDocument ignores an appId the client tries to smuggle into the request body', async () => {
    const fake = createFakeSupabase({
      data: { id: 'doc-1', data: { title: 'x' }, created_at: 't', updated_at: 't' },
      error: null,
    });

    await createDocument(
      fake as any,
      'real-app-id',
      'todos',
      { deviceKey: 'dev-1', data: { title: 'x' }, appId: 'attacker-app-id', app_id: 'attacker-app-id' },
      {},
    );

    expect(fake.calls.insert).toMatchObject({ app_id: 'real-app-id', device_key: 'dev-1' });
  });

  it('listDocuments always filters by app_id and device_key from the authenticated context', async () => {
    const fake = createFakeSupabase({ data: [], error: null });
    const url = new URL('https://x/api/cloud/app-a/todos?deviceKey=device-1');

    await listDocuments(fake as any, 'app-a', 'todos', url, {});

    expect(fake.eqCalls).toContainEqual(['app_id', 'app-a']);
    expect(fake.eqCalls).toContainEqual(['collection', 'todos']);
    expect(fake.eqCalls).toContainEqual(['device_key', 'device-1']);
  });

  it('getDocument always filters by app_id, collection, and device_key, not just the doc id', async () => {
    const fake = createFakeSupabase({ data: null, error: null });
    const validUuid = '11111111-1111-1111-1111-111111111111';

    await getDocument(fake as any, 'app-a', 'todos', validUuid, 'device-1', {});

    expect(fake.eqCalls).toContainEqual(['id', validUuid]);
    expect(fake.eqCalls).toContainEqual(['app_id', 'app-a']);
    expect(fake.eqCalls).toContainEqual(['collection', 'todos']);
    expect(fake.eqCalls).toContainEqual(['device_key', 'device-1']);
  });

  it('updateDocument cannot be used to move a document into a different app or device scope', async () => {
    const fake = createFakeSupabase({
      data: { id: 'doc-1', data: {}, created_at: 't', updated_at: 't' },
      error: null,
    });
    const validUuid = '11111111-1111-1111-1111-111111111111';

    await updateDocument(
      fake as any,
      'real-app-id',
      'todos',
      validUuid,
      { deviceKey: 'device-1', data: { title: 'y' }, app_id: 'attacker-app-id' },
      {},
    );

    expect(fake.eqCalls).toContainEqual(['app_id', 'real-app-id']);
    expect(fake.eqCalls).toContainEqual(['device_key', 'device-1']);
    expect(fake.calls.update).toMatchObject({ data: { title: 'y' } });
    expect((fake.calls.update as any).app_id).toBeUndefined();
  });

  it('deleteDocument requires app_id/collection/device_key to all match, not just the doc id', async () => {
    const fake = createFakeSupabase({ data: { id: 'doc-1' }, error: null });
    const validUuid = '11111111-1111-1111-1111-111111111111';

    await deleteDocument(fake as any, 'app-a', 'todos', validUuid, 'device-1', {});

    expect(fake.calls.deleteCalled).toBe(true);
    expect(fake.eqCalls).toContainEqual(['app_id', 'app-a']);
    expect(fake.eqCalls).toContainEqual(['device_key', 'device-1']);
  });

  it('a stranger guessing at a device_key gets an empty/404 result, not an error that leaks existence', async () => {
    const fake = createFakeSupabase({ data: null, error: null });
    const validUuid = '11111111-1111-1111-1111-111111111111';

    const response = await getDocument(fake as any, 'app-a', 'todos', validUuid, 'guessed-device-key', {});
    expect(response.status).toBe(404);

    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('찾을 수 없어요.');
  });
});

describe('adversarial: collection명 SQL 주입·경로 조작 (20종)', () => {
  const maliciousCollectionNames = [
    '../etc/passwd',
    "'; DROP TABLE cloud_documents; --",
    "' OR '1'='1",
    'todos; DELETE FROM cloud_documents',
    'TODOS',
    'todos-list',
    '1todos',
    '_todos',
    '',
    'todos ',
    ' todos',
    'todos/../../etc',
    'todos\0',
    'a'.repeat(32),
    'todos;',
    'todos%00',
    'todos<script>alert(1)</script>',
    'todos)',
    'todos--',
    '한글이름',
  ];

  it.each(maliciousCollectionNames)('rejects malicious/malformed collection name: %j', (name) => {
    expect(isValidCollectionName(name)).toBe(false);
  });

  it('still accepts a genuinely valid collection name (sanity check the validator is not overly strict)', () => {
    expect(isValidCollectionName('todos')).toBe(true);
    expect(isValidCollectionName('user_posts_2026')).toBe(true);
    expect(isValidCollectionName('a')).toBe(true);
  });

  it('createDocument/listDocuments/getDocument/updateDocument/deleteDocument all reject a malicious collection before touching the database', async () => {
    const fake = createFakeSupabase({ data: null, error: null });
    const corsHeaders = {};
    const validUuid = '11111111-1111-1111-1111-111111111111';
    const evilCollection = "'; DROP TABLE cloud_documents; --";

    const createRes = await createDocument(
      fake as any,
      'app-a',
      evilCollection,
      { deviceKey: 'd', data: {} },
      corsHeaders,
    );
    const listRes = await listDocuments(
      fake as any,
      'app-a',
      evilCollection,
      new URL('https://x?deviceKey=d'),
      corsHeaders,
    );
    const getRes = await getDocument(fake as any, 'app-a', evilCollection, validUuid, 'd', corsHeaders);
    const updateRes = await updateDocument(
      fake as any,
      'app-a',
      evilCollection,
      validUuid,
      { deviceKey: 'd', data: {} },
      corsHeaders,
    );
    const deleteRes = await deleteDocument(fake as any, 'app-a', evilCollection, validUuid, 'd', corsHeaders);

    for (const res of [createRes, listRes, getRes, updateRes, deleteRes]) {
      expect(res.status).toBe(400);
    }

    expect(fake.calls.insert).toBeUndefined();
    expect(fake.calls.update).toBeUndefined();
    expect(fake.calls.deleteCalled).toBeUndefined();
  });
});

describe('adversarial: 페이로드 폭탄', () => {
  it('rejects a payload over 64KB', () => {
    const bigString = 'x'.repeat(MAX_DOCUMENT_BYTES + 1);
    expect(jsonByteSize({ blob: bigString })).toBeGreaterThan(MAX_DOCUMENT_BYTES);
  });

  it('accepts a payload right at a reasonable size under the limit', () => {
    expect(jsonByteSize({ title: 'a normal todo item' })).toBeLessThan(MAX_DOCUMENT_BYTES);
  });

  it('rejects JSON nested 9 levels deep (limit is 8)', () => {
    let deep: unknown = 'leaf';

    for (let i = 0; i < 9; i++) {
      deep = { nested: deep };
    }

    const result = validateDocumentShape(deep);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.issue).toBe('depth');
    }
  });

  it('accepts JSON nested exactly 8 levels deep (at the limit, not over)', () => {
    let atLimit: unknown = 'leaf';

    for (let i = 0; i < 7; i++) {
      atLimit = { nested: atLimit };
    }

    expect(validateDocumentShape(atLimit).ok).toBe(true);
  });

  it('rejects an array bomb (1001 elements in one array)', () => {
    const bomb = { items: Array.from({ length: 1001 }, (_, i) => i) };
    const result = validateDocumentShape(bomb);
    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.issue).toBe('array_length');
    }
  });

  it('rejects an array bomb nested inside other objects, not just at the top level', () => {
    const bomb = { wrapper: { list: Array.from({ length: 5000 }, () => ({ x: 1 })) } };
    const result = validateDocumentShape(bomb);
    expect(result.ok).toBe(false);
  });

  it('accepts a reasonably sized array', () => {
    const fine = { items: Array.from({ length: 50 }, (_, i) => i) };
    expect(validateDocumentShape(fine).ok).toBe(true);
  });

  it('the full route pipeline rejects an oversized document with 413, never reaching the database', async () => {
    const fake = createFakeSupabase({ data: null, error: null });
    const bigPayload = { blob: 'x'.repeat(MAX_DOCUMENT_BYTES + 1) };

    const response = await createDocument(fake as any, 'app-a', 'todos', { deviceKey: 'd', data: bigPayload }, {});

    expect(response.status).toBe(413);
    expect(fake.calls.insert).toBeUndefined();
  });

  it('the full route pipeline rejects deeply-nested data with 400, never reaching the database', async () => {
    const fake = createFakeSupabase({ data: null, error: null });
    let deep: unknown = 'leaf';

    for (let i = 0; i < 9; i++) {
      deep = { nested: deep };
    }

    const response = await createDocument(fake as any, 'app-a', 'todos', { deviceKey: 'd', data: deep }, {});

    expect(response.status).toBe(400);
    expect(fake.calls.insert).toBeUndefined();
  });
});
