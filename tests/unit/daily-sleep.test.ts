import { expect, test } from 'vitest';
import { dailySleepTotals } from '@/features/care/daily-sleep';
import type { QuickEntry } from '@/features/care/quick-model';

const sleep = (
  id: string,
  kind: string,
  start: string,
  end: string | null,
): QuickEntry => ({
  id,
  kind,
  source: 'child',
  service: 'sleep',
  startedAt: start,
  endedAt: end,
  running: end === null,
  version: 1,
  amount: null,
  unit: null,
  title: '',
});
test('clips overnight sleep at local midnight and sums naps and night sleep', () => {
  const entries = [
    sleep(
      'night',
      'night',
      '2026-11-07T21:00:00+09:00',
      '2026-11-08T06:00:00+09:00',
    ),
    sleep(
      'nap',
      'nap',
      '2026-11-08T10:00:00+09:00',
      '2026-11-08T11:30:00+09:00',
    ),
    sleep(
      'future',
      'nap',
      '2026-11-08T15:00:00+09:00',
      '2026-11-08T16:00:00+09:00',
    ),
  ];
  expect(
    dailySleepTotals(
      entries,
      '2026-11-08',
      'Asia/Seoul',
      Date.parse('2026-11-08T12:00:00+09:00'),
    ),
  ).toEqual({ nap: 90, night: 360, total: 450 });
});
test('counts running sleep only up to now and merges overlapping records', () => {
  const entries = [
    sleep('a', 'nap', '2026-11-08T10:00:00Z', null),
    sleep('b', 'nap', '2026-11-08T10:30:00Z', '2026-11-08T11:30:00Z'),
  ];
  expect(
    dailySleepTotals(
      entries,
      '2026-11-08',
      'UTC',
      Date.parse('2026-11-08T11:00:00Z'),
    ),
  ).toEqual({ nap: 60, night: 0, total: 60 });
});
test('uses elapsed time through the repeated hour when daylight saving ends', () => {
  const entries = [
    sleep(
      'night',
      'night',
      '2026-10-31T23:00:00-04:00',
      '2026-11-01T03:00:00-05:00',
    ),
  ];
  expect(
    dailySleepTotals(
      entries,
      '2026-11-01',
      'America/New_York',
      Date.parse('2026-11-02T12:00:00Z'),
    ),
  ).toEqual({ nap: 0, night: 240, total: 240 });
});
