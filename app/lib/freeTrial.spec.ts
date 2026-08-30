// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
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
