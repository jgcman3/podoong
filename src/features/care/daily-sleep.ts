import type { QuickEntry } from './quick-model';
import { shiftCareDay } from './quick-model';

function careDayStart(day: string, timezone: string) {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const utc = Date.parse(`${day}T00:00:00Z`);
  let before = utc - 86400000,
    after = utc + 86400000;
  // Find the actual local date boundary, including daylight-saving changes.
  while (after - before > 1) {
    const middle = Math.floor((before + after) / 2);
    if (format.format(new Date(middle)) < day) before = middle;
    else after = middle;
  }
  return after;
}

export function dailySleepTotals(
  entries: QuickEntry[],
  day: string,
  timezone: string,
  now: number,
) {
  const start = careDayStart(day, timezone);
  const end = Math.min(now, careDayStart(shiftCareDay(day, 1), timezone));
  const intervals = entries
    .filter((entry) => entry.service === 'sleep')
    .map((entry) => ({
      kind: entry.kind === 'night' ? ('night' as const) : ('nap' as const),
      start: Math.max(start, Date.parse(entry.startedAt)),
      end: Math.min(end, entry.endedAt ? Date.parse(entry.endedAt) : now),
    }))
    .filter((entry) => entry.start < entry.end)
    .sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind));
  const minutes = { nap: 0, night: 0 };
  let coveredUntil = start;
  for (const interval of intervals) {
    // Shared or overlapping entries must not count the same time twice.
    const from = Math.max(coveredUntil, interval.start);
    if (from < interval.end)
      minutes[interval.kind] += (interval.end - from) / 60000;
    coveredUntil = Math.max(coveredUntil, interval.end);
  }
  const nap = Math.floor(minutes.nap),
    night = Math.floor(minutes.night);
  return { nap, night, total: nap + night };
}
