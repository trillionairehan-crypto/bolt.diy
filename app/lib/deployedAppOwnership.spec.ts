import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isProjectOwnedByOther } from './deployedAppOwnership';

function fakeClient(
  behavior: (params: { p_project_name: string; p_user_id: string }) => {
    data: boolean | null;
    error: Error | null;
  },
) {
  return {
    rpc: async (_name: string, params: { p_project_name: string; p_user_id: string }) => behavior(params),
  } as unknown as SupabaseClient;
}

describe('isProjectOwnedByOther', () => {
  it('first deploy — no row exists for this project yet — is allowed (RPC returns false)', async () => {
    const client = fakeClient(() => ({ data: false, error: null }));
    expect(await isProjectOwnedByOther('coralred-app-newproject', 'user-a', client)).toBe(false);
  });

  it("re-deploying your own existing project is allowed (RPC's 'owned by OTHER' check excludes you)", async () => {
    const client = fakeClient(() => ({ data: false, error: null }));
    expect(await isProjectOwnedByOther('coralred-app-mine', 'user-a', client)).toBe(false);
  });

  it("someone else's existing project is blocked (RPC returns true)", async () => {
    const client = fakeClient(() => ({ data: true, error: null }));
    expect(await isProjectOwnedByOther('coralred-app-not-yours', 'user-b', client)).toBe(true);
  });

  it('passes the exact projectName/userId through to the RPC call', async () => {
    let seenParams: { p_project_name: string; p_user_id: string } | null = null;
    const client = fakeClient((params) => {
      seenParams = params;
      return { data: false, error: null };
    });

    await isProjectOwnedByOther('coralred-app-check-params', 'user-xyz', client);

    expect(seenParams).toEqual({ p_project_name: 'coralred-app-check-params', p_user_id: 'user-xyz' });
  });

  it('fails OPEN (allows) when the RPC errors — e.g. the migration is not applied yet', async () => {
    const client = fakeClient(() => ({ data: null, error: new Error('function does not exist') }));
    expect(await isProjectOwnedByOther('coralred-app-x', 'user-a', client)).toBe(false);
  });
});
