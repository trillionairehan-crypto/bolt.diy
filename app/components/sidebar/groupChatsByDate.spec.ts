import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { groupChatsByDate } from './groupChatsByDate';

describe('groupChatsByDate', () => {
  beforeEach(() => {
    // 로컬 자정 기준 계산이라 시각을 고정한다: 2026-09-02 15:00:00 (수요일).
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 2, 15, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function iso(daysAgo: number, hour = 12): string {
    const d = new Date(2026, 8, 2 - daysAgo, hour, 0, 0);
    return d.toISOString();
  }

  it('오늘/어제/이번 주/이전 네 구간으로 나눈다', () => {
    const items = [
      { id: 'today', ts: iso(0) },
      { id: 'yesterday', ts: iso(1) },
      { id: 'thisWeek', ts: iso(4) },
      { id: 'old', ts: iso(30) },
    ];

    const buckets = groupChatsByDate(items, (item) => item.ts);

    expect(buckets.map((b) => b.label)).toEqual(['오늘', '어제', '이번 주', '이전']);
    expect(buckets[0].items.map((i) => i.id)).toEqual(['today']);
    expect(buckets[1].items.map((i) => i.id)).toEqual(['yesterday']);
    expect(buckets[2].items.map((i) => i.id)).toEqual(['thisWeek']);
    expect(buckets[3].items.map((i) => i.id)).toEqual(['old']);
  });

  it('빈 구간은 결과에서 빠진다', () => {
    const items = [{ id: 'today', ts: iso(0) }];
    const buckets = groupChatsByDate(items, (item) => item.ts);

    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toBe('오늘');
  });

  it('"이번 주"는 오늘·어제를 제외한 최근 7일(2~8일 전)이다 — 9일 전은 이전으로 넘어간다', () => {
    const items = [
      { id: 'day2', ts: iso(2) },
      { id: 'day8', ts: iso(8) },
      { id: 'day9', ts: iso(9) },
    ];

    const buckets = groupChatsByDate(items, (item) => item.ts);
    const thisWeek = buckets.find((b) => b.label === '이번 주');
    const old = buckets.find((b) => b.label === '이전');

    expect(thisWeek?.items.map((i) => i.id)).toEqual(['day2', 'day8']);
    expect(old?.items.map((i) => i.id)).toEqual(['day9']);
  });

  it('입력 순서를 보존한다(재정렬하지 않는다)', () => {
    const items = [
      { id: 'a', ts: iso(0, 9) },
      { id: 'b', ts: iso(0, 20) },
      { id: 'c', ts: iso(0, 3) },
    ];

    const buckets = groupChatsByDate(items, (item) => item.ts);
    expect(buckets[0].items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});
