import type { ChatHistoryItem } from '~/lib/persistence';
import { formatRelativeTime } from '~/utils/relativeTime';
import styles from './ChatHome.module.scss';

interface RecentChatsCardsProps {
  chats: ChatHistoryItem[];
}

/**
 * 채팅 홈 "이어서 만들기" — 배포되지 않은 최근 대화 최대 3개(dedup은 useChatHomeSections.ts에서
 * 이미 끝냄). 배포된 대화는 여기 안 온다(내가 만든 앱 전용) — 그래서 상태 문구는 "N일 전 · 배포
 * 완료" 분기 없이 시간만 표시한다.
 */
export function RecentChatsCards({ chats }: RecentChatsCardsProps) {
  if (chats.length === 0) {
    return null;
  }

  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>이어서 만들기</p>
      <div className={styles.recentCardsWrap}>
        {chats.map((chat) => (
          <a key={chat.id} href={`/chat/${chat.urlId ?? chat.id}`} className={styles.recentCard}>
            <p className={styles.recentCardTitle}>{chat.description}</p>
            <p className={styles.recentCardStatus}>{formatRelativeTime(chat.timestamp)}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
