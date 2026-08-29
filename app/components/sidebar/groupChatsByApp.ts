import type { ChatHistoryItem } from '~/lib/persistence';

export interface AppGroup {
  /** rootChatId (or the chat's own id, for chats predating this field) — stable group identity. */
  key: string;

  /** The root chat's description, or the oldest surviving member's if the root was deleted. */
  name: string;

  /** The chat `name` came from — rename the app by renaming this chat's description. */
  representativeId: string;

  /** Newest first. */
  items: ChatHistoryItem[];
  latestTimestamp: string;
}

/**
 * Groups chats by "app" — fork/duplicate lineage (see IChatMetadata.rootChatId) rather than by
 * date. A chat without rootChatId (created before this field existed) becomes a single-chat group
 * keyed by its own id.
 */
export function groupChatsByApp(items: ChatHistoryItem[]): AppGroup[] {
  const groups = new Map<string, ChatHistoryItem[]>();

  for (const item of items) {
    const key = item.metadata?.rootChatId ?? item.id;
    const existing = groups.get(key);

    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const result: AppGroup[] = [];

  for (const [key, groupItems] of groups) {
    const sorted = [...groupItems].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const root = groupItems.find((item) => item.id === key);
    const nameSource = root ?? sorted[sorted.length - 1];

    result.push({
      key,
      name: nameSource.description || '이름 없는 앱',
      representativeId: nameSource.id,
      items: sorted,
      latestTimestamp: sorted[0].timestamp,
    });
  }

  return result.sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());
}
