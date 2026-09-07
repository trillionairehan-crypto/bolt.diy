import { describe, expect, it, vi } from 'vitest';

let selectResult: { error: { code: string } | null } = { error: null };

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (_table: string) => ({
      select: async (_cols: string, _opts: unknown) => selectResult,
    }),
  }),
}));

const { checkMigrationTables, loader } = await import('./api.health');

describe('checkMigrationTables', () => {
  it('returns null when platform Supabase env vars are missing', async () => {
    const result = await checkMigrationTables(undefined);
    expect(result).toBeNull();
  });

  it('marks every expected table true when no query errors', async () => {
    selectResult = { error: null };

    const result = await checkMigrationTables({
      VITE_PLATFORM_SUPABASE_URL: 'https://x.supabase.co',
      VITE_PLATFORM_SUPABASE_ANON_KEY: 'anon-key',
    });

    expect(result).not.toBeNull();
    expect(Object.values(result!).every(Boolean)).toBe(true);
    expect(result!.utm_attribution).toBe(true);
  });

  it('marks a table false when PostgREST returns 42P01 (undefined_table)', async () => {
    selectResult = { error: { code: '42P01' } };

    const result = await checkMigrationTables({
      VITE_PLATFORM_SUPABASE_URL: 'https://x.supabase.co',
      VITE_PLATFORM_SUPABASE_ANON_KEY: 'anon-key',
    });

    expect(Object.values(result!).every((v) => v === false)).toBe(true);
  });

  it('does not treat an RLS-filtered empty result as a missing table', async () => {
    selectResult = { error: null };

    const result = await checkMigrationTables({
      VITE_PLATFORM_SUPABASE_URL: 'https://x.supabase.co',
      VITE_PLATFORM_SUPABASE_ANON_KEY: 'anon-key',
    });

    expect(Object.values(result!).every(Boolean)).toBe(true);
  });
});

describe('api.health loader', () => {
  it('always reports healthy status with a timestamp, even without Supabase env', async () => {
    const response = await loader({
      request: new Request('https://coralred.test/api/health'),
      context: { cloudflare: { env: {} } },
      params: {},
    } as any);

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(typeof body.timestamp).toBe('string');
    expect(body.migrations).toBeNull();
  });

  it('includes the migrations map when Supabase env is present', async () => {
    selectResult = { error: null };

    const response = await loader({
      request: new Request('https://coralred.test/api/health'),
      context: {
        cloudflare: {
          env: {
            VITE_PLATFORM_SUPABASE_URL: 'https://x.supabase.co',
            VITE_PLATFORM_SUPABASE_ANON_KEY: 'anon-key',
          },
        },
      },
      params: {},
    } as any);

    const body = await response.json();
    expect(body.migrations).not.toBeNull();
    expect(body.migrations!.deployed_apps).toBe(true);
  });
});
