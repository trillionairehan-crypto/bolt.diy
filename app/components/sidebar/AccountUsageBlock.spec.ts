import { describe, expect, it } from 'vitest';
import { getNextMonthResetLabel } from './AccountUsageBlock';

/**
 * D-2 "10월 1일 갱신" — 다음 달 1일 계산이 연말 롤오버(12월 -> 1월, 연도 넘어감)에서도
 * 맞는지 확인한다. 표시엔 연도를 안 쓰므로 여기서도 연도는 검증하지 않는다.
 */
describe('getNextMonthResetLabel', () => {
  it('일반적인 달은 다음 달 1일을 돌려준다', () => {
    expect(getNextMonthResetLabel(new Date(2026, 8, 15))).toBe('10월 1일');
  });

  it('월초에도 다음 달 1일 그대로다', () => {
    expect(getNextMonthResetLabel(new Date(2026, 7, 1))).toBe('9월 1일');
  });

  it('12월이면 다음 해 1월 1일로 넘어간다', () => {
    expect(getNextMonthResetLabel(new Date(2026, 11, 20))).toBe('1월 1일');
  });
});
