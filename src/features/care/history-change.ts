import { dateInTimeZone } from '@/lib/domain';
import type { QuickEntry } from './quick-model';

export type HistoryRange =
  { start: string; end: string | null } | { date: string };

export type HistoryChange = { revision: number; ranges: HistoryRange[] };

export function historyRangeForEntry(
  entry: Pick<QuickEntry, 'startedAt' | 'endedAt' | 'recordDate'>,
): HistoryRange {
  return entry.recordDate
    ? { date: entry.recordDate }
    : { start: entry.startedAt, end: entry.endedAt };
}

export function historyDaysToReload(
  days: string[],
  ranges: HistoryRange[],
  timezone: string,
) {
  const dates = ranges.map((range) =>
    'date' in range
      ? [range.date, range.date]
      : [
          dateInTimeZone(new Date(range.start), timezone),
          dateInTimeZone(new Date(range.end ?? range.start), timezone),
        ],
  );
  return days.filter((day) =>
    dates.some(([start, end]) => start <= day && day <= end),
  );
}
