import { describe, expect, it, vi } from 'vitest';
import { createGenerationChargeGate } from './generationChargeGate';

/*
 * METERING_FIX_REPORT.md — unit tests for the charge-timing fix: the free/paid generation credit
 * must be deducted exactly once on a genuine success, and never on abort/cancel or error. chargeFn
 * stands in for recordGenerationUsed() (which calls the Supabase RPC / localStorage counter) — a
 * plain vi.fn() here, so no real Supabase call happens in these tests.
 */
describe('generationChargeGate', () => {
  it('성공 시 1회 차감: arm() 후 정상 종료(isAbort/isError 둘 다 false)면 chargeFn이 정확히 1번 호출된다', () => {
    const chargeFn = vi.fn();
    const gate = createGenerationChargeGate(chargeFn);

    gate.arm();
    gate.onFinish({ isAbort: false, isError: false });

    expect(chargeFn).toHaveBeenCalledTimes(1);
  });

  it('실패 시 0회 차감: arm() 후 isError=true로 끝나면 chargeFn이 호출되지 않는다', () => {
    const chargeFn = vi.fn();
    const gate = createGenerationChargeGate(chargeFn);

    gate.arm();
    gate.onFinish({ isAbort: false, isError: true });

    expect(chargeFn).not.toHaveBeenCalled();
  });

  it('취소 시 0회 차감: arm() 후 isAbort=true로 끝나면 chargeFn이 호출되지 않는다', () => {
    const chargeFn = vi.fn();
    const gate = createGenerationChargeGate(chargeFn);

    gate.arm();
    gate.onFinish({ isAbort: true, isError: false });

    expect(chargeFn).not.toHaveBeenCalled();
  });

  it('arm()이 한 번도 없었으면(예: auto-fix처럼 애초에 과금 대상이 아닌 완료) onFinish가 와도 차감하지 않는다', () => {
    const chargeFn = vi.fn();
    const gate = createGenerationChargeGate(chargeFn);

    gate.onFinish({ isAbort: false, isError: false });

    expect(chargeFn).not.toHaveBeenCalled();
  });

  it('같은 arm()에 대해 onFinish가 여러 번 와도(예: 라이브러리 재호출) 중복 차감되지 않는다', () => {
    const chargeFn = vi.fn();
    const gate = createGenerationChargeGate(chargeFn);

    gate.arm();
    gate.onFinish({ isAbort: false, isError: false });
    gate.onFinish({ isAbort: false, isError: false });

    expect(chargeFn).toHaveBeenCalledTimes(1);
  });

  it('disarm()으로 취소한 armed 상태는 이후 onFinish가 성공으로 와도 차감하지 않는다', () => {
    const chargeFn = vi.fn();
    const gate = createGenerationChargeGate(chargeFn);

    gate.arm();
    gate.disarm();
    gate.onFinish({ isAbort: false, isError: false });

    expect(chargeFn).not.toHaveBeenCalled();
  });

  it('연속된 두 생성: 각각 arm() 후 성공하면 매번 1회씩, 총 2회 차감된다', () => {
    const chargeFn = vi.fn();
    const gate = createGenerationChargeGate(chargeFn);

    gate.arm();
    gate.onFinish({ isAbort: false, isError: false });

    gate.arm();
    gate.onFinish({ isAbort: false, isError: false });

    expect(chargeFn).toHaveBeenCalledTimes(2);
  });

  it('실패 후 재시도: 첫 시도가 에러로 끝나 0회, 재시도를 다시 arm()해서 성공하면 그 때 1회 차감된다', () => {
    const chargeFn = vi.fn();
    const gate = createGenerationChargeGate(chargeFn);

    gate.arm();
    gate.onFinish({ isAbort: false, isError: true });
    expect(chargeFn).not.toHaveBeenCalled();

    gate.arm();
    gate.onFinish({ isAbort: false, isError: false });
    expect(chargeFn).toHaveBeenCalledTimes(1);
  });
});
