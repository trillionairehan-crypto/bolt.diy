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
 * Supabase mock. The account path (getV2AccountGenerationsRemaining) is a one-line
 * Math.min() wrapper around the already-existing getV2AccountGenerationStatus() RPC call and
 * isn't separately covered here.
 */
describe('freeTrial v2 guest remaining count', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('사용 기록이 없으면 하루 한도(1)만큼 남아있다고 본다', () => {
    expect(getV2GuestGenerationsRemaining()).toBe(1);
    expect(hasV2GuestGenerationsRemaining()).toBe(true);
  });

  it('한 번 사용하면(일일 한도 1 도달) 남은 횟수가 0이 된다', () => {
    incrementV2GuestGenerationsUsed();

    expect(getV2GuestGenerationsRemaining()).toBe(0);
    expect(hasV2GuestGenerationsRemaining()).toBe(false);
  });

  it('월/일 한도 중 더 적게 남은 쪽(더 제한적인 쪽)을 반환한다', () => {
    // 일일 한도(1)가 월간 한도(10)보다 항상 먼저 소진되므로, 사용 전엔 항상 1이 반환된다.
    expect(getV2GuestGenerationsRemaining()).toBe(1);
  });
});
