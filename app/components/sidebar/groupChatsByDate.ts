export type DateBucketLabel = '오늘' | '어제' | '이번 주' | '이전';

export interface DateBucket<T> {
  label: DateBucketLabel;
  items: T[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 사용자 로컬 자정 기준으로 오늘/어제/이번 주(최근 7일, 오늘·어제 제외)/이전 네 구간에 나눈다.
 * 입력 순서(이미 최신순으로 정렬돼 있다고 가정)를 그대로 보존한다 — 여기서 재정렬하지 않는다.
 * 빈 구간은 결과 배열에서 아예 빠진다(헤더를 생략하기 위해 소비자가 따로 필터링할 필요 없게).
 */
export function groupChatsByDate<T>(items: T[], getTimestamp: (item: T) => string): DateBucket<T>[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - DAY_MS;

  // "이번 주" = 오늘·어제를 제외한 최근 7일(2~8일 전) — Previous 7 days 관례와 같은 폭.
  const startOfThisWeek = startOfToday - 8 * DAY_MS;

  const buckets: Record<DateBucketLabel, T[]> = {
    오늘: [],
    어제: [],
    '이번 주': [],
    이전: [],
  };

  for (const item of items) {
    const t = new Date(getTimestamp(item)).getTime();

    if (t >= startOfToday) {
      buckets['오늘'].push(item);
    } else if (t >= startOfYesterday) {
      buckets['어제'].push(item);
    } else if (t >= startOfThisWeek) {
      buckets['이번 주'].push(item);
    } else {
      buckets['이전'].push(item);
    }
  }

  return (['오늘', '어제', '이번 주', '이전'] as const)
    .map((label) => ({ label, items: buckets[label] }))
    .filter((bucket) => bucket.items.length > 0);
}
