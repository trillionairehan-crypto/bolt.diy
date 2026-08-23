import { format, isAfter, isThisWeek, isThisYear, isToday, isYesterday, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { ChatHistoryItem } from '~/lib/persistence';

type Bin = { category: string; items: ChatHistoryItem[] };

export function binDates(_list: ChatHistoryItem[]) {
  const list = _list.toSorted((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const binLookup: Record<string, Bin> = {};
  const bins: Array<Bin> = [];

  list.forEach((item) => {
    const category = dateCategory(new Date(item.timestamp));

    if (!(category in binLookup)) {
      const bin = {
        category,
        items: [item],
      };

      binLookup[category] = bin;

      bins.push(bin);
    } else {
      binLookup[category].items.push(item);
    }
  });

  return bins;
}

function dateCategory(date: Date) {
  if (isToday(date)) {
    return '오늘';
  }

  if (isYesterday(date)) {
    return '어제';
  }

  if (isThisWeek(date, { locale: ko })) {
    // e.g., "월" instead of "월요일"
    return format(date, 'EEE', { locale: ko });
  }

  const thirtyDaysAgo = subDays(new Date(), 30);

  if (isAfter(date, thirtyDaysAgo)) {
    return '지난 30일';
  }

  if (isThisYear(date)) {
    // e.g., "1월"
    return format(date, 'M월', { locale: ko });
  }

  // e.g., "2023년 1월"
  return format(date, 'yyyy년 M월', { locale: ko });
}
