import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { provisionCloudApp, MAX_CLOUD_APPS_PER_OWNER } from './cloudProvision';

interface FakeClientBehavior {
  countResult?: { count: number | null; error: { code: string; message: string; hint: string } | null };
  insertError?: { code: string; message: string; hint: string } | null;
}

function fakeClient({ countResult = { count: 0, error: null }, insertError = null }: FakeClientBehavior): {
  client: SupabaseClient;
  insertedRows: unknown[];
} {
  const insertedRows: unknown[] = [];

  const client = {
    from: (_table: string) => ({
      select: (_cols: string, _opts: unknown) => ({
        eq: async (_col: string, _val: string) => countResult,
      }),
      insert: async (row: unknown) => {
        insertedRows.push(row);
        return { error: insertError };
      },
    }),
  } as unknown as SupabaseClient;

  return { client, insertedRows };
}

describe('provisionCloudApp', () => {
  it('provisions successfully when under quota and the insert succeeds', async () => {
    const { client, insertedRows } = fakeClient({ countResult: { count: 1, error: null } });

    const result = await provisionCloudApp(client, 'test-secret', 'user-a');

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.appId).toBeTruthy();
      expect(result.token).toContain(result.appId);
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    }

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({ owner_user_id: 'user-a', tier: 'free' });
  });

  it('returns quota_exceeded without attempting an insert once at the per-owner limit', async () => {
    const { client, insertedRows } = fakeClient({
      countResult: { count: MAX_CLOUD_APPS_PER_OWNER, error: null },
    });

    const result = await provisionCloudApp(client, 'test-secret', 'user-a');

    expect(result).toEqual({ ok: false, reason: 'quota_exceeded' });
    expect(insertedRows).toHaveLength(0);
  });

  /*
   * CLOUD_PROVISION_FIX.md's investigation: with RLS enabled and no policy, a SELECT is silently
   * filtered to zero rows (no Postgres error) while an INSERT is explicitly rejected. This test
   * covers the other, less likely branch (the count query itself erroring) for completeness.
   */
  it('returns quota_check_failed (not insert_failed) when the count query itself errors', async () => {
    const { client, insertedRows } = fakeClient({
      countResult: { count: null, error: { code: '42501', message: 'permission denied', hint: '' } },
    });

    const result = await provisionCloudApp(client, 'test-secret', 'user-a');

    expect(result).toEqual({ ok: false, reason: 'quota_check_failed' });
    expect(insertedRows).toHaveLength(0);
  });

  it('returns insert_failed when cloud_apps insert is rejected (e.g. by a missing RLS policy)', async () => {
    const { client } = fakeClient({
      countResult: { count: 0, error: null },
      insertError: { code: '42501', message: 'new row violates row-level security policy', hint: '' },
    });

    const result = await provisionCloudApp(client, 'test-secret', 'user-a');

    expect(result).toEqual({ ok: false, reason: 'insert_failed' });
  });

  it('never logs the token or secret, only the Postgres error fields', async () => {
    const errorSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const { client } = fakeClient({
      countResult: { count: 0, error: null },
      insertError: { code: '42501', message: 'new row violates row-level security policy', hint: '' },
    });

    await provisionCloudApp(client, 'super-secret-value', 'user-a');

    const loggedText = errorSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(loggedText).not.toContain('super-secret-value');
    expect(loggedText).toContain('row-level security policy');

    errorSpy.mockRestore();
  });
});
