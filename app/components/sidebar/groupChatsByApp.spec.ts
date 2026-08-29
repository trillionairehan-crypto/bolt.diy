import { describe, expect, it } from 'vitest';
import { groupChatsByApp } from './groupChatsByApp';
import type { ChatHistoryItem } from '~/lib/persistence';

function chat(overrides: Partial<ChatHistoryItem> & { id: string }): ChatHistoryItem {
  return {
    urlId: overrides.id,
    description: overrides.id,
    messages: [],
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('groupChatsByApp', () => {
  it('groups a root chat with its forks/duplicates under one app', () => {
    const items = [
      chat({ id: '1', description: '빵집 예약', timestamp: '2026-01-01T00:00:00.000Z' }),
      chat({
        id: '2',
        description: '빵집 예약 (copy)',
        timestamp: '2026-01-02T00:00:00.000Z',
        metadata: { gitUrl: '', rootChatId: '1' },
      }),
    ];

    const groups = groupChatsByApp(items);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('1');
    expect(groups[0].name).toBe('빵집 예약');
    expect(groups[0].representativeId).toBe('1');
    expect(groups[0].items.map((i) => i.id)).toEqual(['2', '1']); // newest first
  });

  it('treats a chat without rootChatId as its own single-chat app', () => {
    const items = [chat({ id: 'a' }), chat({ id: 'b' })];

    const groups = groupChatsByApp(items);

    expect(groups.map((g) => g.key).sort()).toEqual(['a', 'b']);
    expect(groups.every((g) => g.items.length === 1)).toBe(true);
  });

  it('falls back to the oldest surviving member for the name when the root chat is gone', () => {
    const items = [
      chat({
        id: '2',
        description: '두 번째',
        timestamp: '2026-01-02T00:00:00.000Z',
        metadata: { gitUrl: '', rootChatId: '1' },
      }),
      chat({
        id: '3',
        description: '세 번째',
        timestamp: '2026-01-03T00:00:00.000Z',
        metadata: { gitUrl: '', rootChatId: '1' },
      }),
    ];

    const groups = groupChatsByApp(items);

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('두 번째');
    expect(groups[0].representativeId).toBe('2');
    expect(groups[0].items.map((i) => i.id)).toEqual(['3', '2']);
  });

  it('sorts groups by their most recent member, newest first', () => {
    const items = [
      chat({ id: 'old', timestamp: '2026-01-01T00:00:00.000Z' }),
      chat({ id: 'new', timestamp: '2026-01-05T00:00:00.000Z' }),
    ];

    const groups = groupChatsByApp(items);

    expect(groups.map((g) => g.key)).toEqual(['new', 'old']);
  });
});
