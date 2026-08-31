import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relativeTime';

const NOW = new Date(2026, 0, 15, 12, 0, 0); // 2026-01-15 12:00

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60000).toISOString();
}

describe('formatRelativeTime', () => {
  it('under 60 minutes reads "방금 전"', () => {
    expect(formatRelativeTime(isoMinutesAgo(0), NOW)).toBe('방금 전');
    expect(formatRelativeTime(isoMinutesAgo(59), NOW)).toBe('방금 전');
  });

  it('1 to 23 hours reads "N시간 전"', () => {
    expect(formatRelativeTime(isoMinutesAgo(60), NOW)).toBe('1시간 전');
    expect(formatRelativeTime(isoMinutesAgo(60 * 23), NOW)).toBe('23시간 전');
  });

  it('1 to 6 days reads "N일 전"', () => {
    expect(formatRelativeTime(isoMinutesAgo(60 * 24), NOW)).toBe('1일 전');
    expect(formatRelativeTime(isoMinutesAgo(60 * 24 * 6), NOW)).toBe('6일 전');
  });

  it('7+ days reads "M월 D일"', () => {
    const iso = isoMinutesAgo(60 * 24 * 7);
    const result = formatRelativeTime(iso, NOW);
    expect(result).toMatch(/^\d{1,2}월 \d{1,2}일$/);
    expect(result).not.toContain('일 전');
  });
});
