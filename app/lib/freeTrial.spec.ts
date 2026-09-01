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
 * 미터링 재로그인 초기화 버그 — getV2AccountGenerationStatus()가 RPC 앞에 getSession()을 강제로
 * 끼워 넣어(재로그인 직후 세션 동기화 대기) 세션이 아직 없으면 던지는지, 있으면 RPC를 실제로
 * 호출하는지를 확인한다. platformSupabase는 모듈 top-level에서 한 번 생성되는 싱글턴이라(있으면)
 * vi.mock으로 아예 갈아끼운다 — 이 스펙에서만 쓰는 로컬 모킹, 다른 파일에 영향 없음.
 */
describe('freeTrial v2 account status — 세션 동기화 가드', () => {
  afterEach(() => {
    vi.doUnmock('~/lib/supabase/platform-client');
    vi.resetModules();
  });

  it('세션이 아직 없으면(동기화 안 끝남) RPC를 부르지 않고 던진다', async () => {
    const rpc = vi.fn();
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } });

    vi.resetModules();
    vi.doMock('~/lib/supabase/platform-client', () => ({
      platformSupabase: { auth: { getSession }, rpc },
    }));

    const { getV2AccountGenerationStatus } = await import('./freeTrial');

    await expect(getV2AccountGenerationStatus()).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('세션이 있으면 getSession으로 먼저 확인한 뒤 RPC를 불러 실제 값을 돌려준다', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { monthRemaining: 2 }, error: null });
    const getSession = vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });

    vi.resetModules();
    vi.doMock('~/lib/supabase/platform-client', () => ({
      platformSupabase: { auth: { getSession }, rpc },
    }));

    const { getV2AccountGenerationStatus } = await import('./freeTrial');
    const result = await getV2AccountGenerationStatus();

    expect(getSession).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('get_generation_status_v2');
    expect(result).toEqual({ monthRemaining: 2 });
  });
});
