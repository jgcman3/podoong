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

export type CalendarEntry = {
  id: string;
  child_id: string;
  title: string;
  date: string;
  note: string;
  event_kind: 'general' | 'hospital' | 'medication' | 'vaccination';
  event_time: string | null;
  record_timezone: string | null;
  source: 'event' | 'vaccination';
  status: 'planned' | 'completed';
  vaccine: string | null;
  custom_name: string | null;
  clinic: string | null;
};
export function calendarEntry(
  row: import('@/lib/db').Database['public']['Views']['calendar_entries']['Row'],
): CalendarEntry {
  if (
    !row.id ||
    !row.child_id ||
    !row.date ||
    row.title === null ||
    !row.event_kind ||
    !['general', 'hospital', 'medication', 'vaccination'].includes(
      row.event_kind,
    ) ||
    (row.source !== 'event' && row.source !== 'vaccination') ||
    (row.status !== 'planned' && row.status !== 'completed')
  )
    throw new Error('Invalid calendar entry');
  return {
    ...row,
    id: row.id,
    child_id: row.child_id,
    title: row.title,
    date: row.date,
    note: row.note ?? '',
    event_kind: row.event_kind as CalendarEntry['event_kind'],
    source: row.source,
    status: row.status,
  };
}
