import { describe, expect, it } from 'vitest';
import {
  historyDaysToReload,
  historyRangeForEntry,
} from '@/features/care/history-change';

const days = ['2026-11-06', '2026-11-05', '2026-11-04'];

describe('care history invalidation', () => {
  it('keeps loaded past days when a new record belongs only to today', () => {
    expect(
      historyDaysToReload(
        days,
        [{ start: '2026-11-07T00:00:00Z', end: null }],
        'Asia/Seoul',
      ),
    ).toEqual([]);
  });

  it('reloads only the edited past day', () => {
    expect(
      historyDaysToReload(
        days,
        [{ start: '2026-11-05T01:00:00Z', end: '2026-11-05T01:10:00Z' }],
        'Asia/Seoul',
      ),
    ).toEqual(['2026-11-05']);
  });

  it('reloads both old and new days when a record moves', () => {
    expect(
      historyDaysToReload(
        days,
        [
          { start: '2026-11-05T01:00:00Z', end: null },
          { start: '2026-11-06T01:00:00Z', end: null },
        ],
        'Asia/Seoul',
      ),
    ).toEqual(['2026-11-06', '2026-11-05']);
  });

  it('includes every loaded day overlapped by a completed timer', () => {
    expect(
      historyDaysToReload(
        days,
        [{ start: '2026-11-04T14:00:00Z', end: '2026-11-06T01:00:00Z' }],
        'Asia/Seoul',
      ),
    ).toEqual(days);
  });

  it('uses the viewing timezone, including a daylight-saving transition', () => {
    expect(
      historyDaysToReload(
        ['2026-11-01', '2026-10-31', '2026-10-30'],
        [{ start: '2026-11-01T03:30:00Z', end: '2026-11-01T07:30:00Z' }],
        'America/New_York',
      ),
    ).toEqual(['2026-11-01', '2026-10-31']);
  });

  it('keeps vaccination calendar dates independent of the viewing timezone', () => {
    const range = historyRangeForEntry({
      startedAt: '2026-11-07T00:00:00Z',
      endedAt: null,
      recordDate: '2026-11-05',
    });
    expect(historyDaysToReload(days, [range], 'America/Los_Angeles')).toEqual([
      '2026-11-05',
    ]);
  });
});
