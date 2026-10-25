import { ageInDays, type Locale } from '@/lib/domain';
export function relativeDay(date: string, today: string, locale: Locale) {
  const days = ageInDays(today, date);
  if (locale === 'ko')
    return days === 0
      ? '오늘'
      : days === 1
        ? '내일'
        : days > 1
          ? `${days}일 후`
          : `${Math.abs(days)}일 전`;
  return days === 0
    ? 'Today'
    : days === 1
      ? 'Tomorrow'
      : days > 1
        ? `In ${days} days`
        : `${Math.abs(days)} ${days === -1 ? 'day' : 'days'} ago`;
}
