/**
 * Shared "N시간 전" style formatter — chat-home 이어서 만들기/내가 만든 앱 카드가 공통으로 쓴다.
 * 60분 미만 "방금 전", 24시간 미만 "N시간 전", 7일 미만 "N일 전", 그 이상 "M월 D일".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = diffMs / 60000;

  if (diffMinutes < 60) {
    return '방금 전';
  }

  const diffHours = diffMs / 3600000;

  if (diffHours < 24) {
    return `${Math.floor(diffHours)}시간 전`;
  }

  const diffDays = diffMs / 86400000;

  if (diffDays < 7) {
    return `${Math.floor(diffDays)}일 전`;
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}
