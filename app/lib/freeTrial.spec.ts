// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getV2GuestGenerationsRemaining,
  hasV2GuestGenerationsRemaining,
  incrementV2GuestGenerationsUsed,
} from './freeTrial';

/*
 * BaseChat.tsx's "N회 남았어요" display now calls these under CORALRED_NEW_METERING (see
 * METERING_FIX_REPORT.md) — covers the guest/localStorage path directly since it needs no
 * Supabase mock. The account path (getV2AccountGenerationsRemaining) is a one-line wrapper
 * around the already-existing getV2AccountGenerationStatus() RPC call and isn't separately
 * covered here.
 *
 * Corrected 08-31: the pricing page never mentioned a daily cap, only "월 10건" for accounts.
 * Guests are a separate, lower limit (월 1건) meant to nudge sign-up — no daily cap either.
 */
describe('freeTrial v2 guest remaining count', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('사용 기록이 없으면 월 한도(1)만큼 남아있다고 본다', () => {
    expect(getV2GuestGenerationsRemaining()).toBe(1);
    expect(hasV2GuestGenerationsRemaining()).toBe(true);
  });

  it('한 번 사용하면(월 한도 1 도달) 남은 횟수가 0이 된다', () => {
    incrementV2GuestGenerationsUsed();

    expect(getV2GuestGenerationsRemaining()).toBe(0);
    expect(hasV2GuestGenerationsRemaining()).toBe(false);
  });

  it('월이 바뀌면 한도가 다시 초기화된다', () => {
    incrementV2GuestGenerationsUsed();
    expect(getV2GuestGenerationsRemaining()).toBe(0);

    localStorage.setItem('coralred_free_generations_v2', JSON.stringify({ month: '2000-01', monthCount: 1 }));

    expect(getV2GuestGenerationsRemaining()).toBe(1);
  });
});

/*
 * 미터링 재로그인 초기화 버그, 원인 확정 후 수정 — 재로그인 직후 platformSupabase.rpc()가 서버에
 * auth.uid() = null(익명 취급)로 도착했다(진단 로그 실측: getSession()은 새 유저를 정확히
 * 돌려주는데 RPC 요청의 Authorization 헤더가 그걸 못 따라갔다). 그래서 getV2AccountGenerationStatus/
 * incrementV2AccountGenerationsUsed는 이제 platformSupabase.rpc()가 아니라 callPlatformRpc()로
 * 방금 읽은 access_token을 직접 Authorization 헤더에 실어 fetch한다 — 아래 테스트는 그 access_token이
 * 실제로 전달되는지를 확인한다. platformSupabase/callPlatformRpc는 모듈 top-level에서 생성되는
 * 싱글턴/함수라 vi.mock으로 갈아끼운다 — 이 스펙에서만 쓰는 로컬 모킹, 다른 파일에 영향 없음.
 */
describe('freeTrial v2 account status — 세션 동기화 가드', () => {
  afterEach(() => {
    vi.doUnmock('~/lib/supabase/platform-client');
    vi.resetModules();
  });

  it('세션이 아직 없으면(동기화 안 끝남) RPC를 부르지 않고 던진다', async () => {
    const callPlatformRpc = vi.fn();
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } });

    vi.resetModules();
    vi.doMock('~/lib/supabase/platform-client', () => ({
      platformSupabase: { auth: { getSession } },
      callPlatformRpc,
    }));

    const { getV2AccountGenerationStatus } = await import('./freeTrial');

    await expect(getV2AccountGenerationStatus()).rejects.toThrow();
    expect(callPlatformRpc).not.toHaveBeenCalled();
  });

  it('세션이 있으면 getSession으로 받은 access_token을 그대로 실어 RPC를 직접 fetch로 부른다', async () => {
    const callPlatformRpc = vi.fn().mockResolvedValue({ data: { monthRemaining: 2 }, error: null });
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'token-abc' } } });

    vi.resetModules();
    vi.doMock('~/lib/supabase/platform-client', () => ({
      platformSupabase: { auth: { getSession } },
      callPlatformRpc,
    }));

    const { getV2AccountGenerationStatus } = await import('./freeTrial');
    const result = await getV2AccountGenerationStatus();

    expect(getSession).toHaveBeenCalled();
    expect(callPlatformRpc).toHaveBeenCalledWith('get_generation_status_v2', 'token-abc');
    expect(result).toEqual({ monthRemaining: 2 });
  });

  it('증가 RPC도 같은 방식으로 access_token을 실어 보낸다', async () => {
    const callPlatformRpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { id: 'u1' }, access_token: 'token-xyz' } } });

    vi.resetModules();
    vi.doMock('~/lib/supabase/platform-client', () => ({
      platformSupabase: { auth: { getSession } },
      callPlatformRpc,
    }));

    const { incrementV2AccountGenerationsUsed } = await import('./freeTrial');
    await incrementV2AccountGenerationsUsed();

    expect(callPlatformRpc).toHaveBeenCalledWith('increment_generation_count_v2', 'token-xyz');
  });
});
