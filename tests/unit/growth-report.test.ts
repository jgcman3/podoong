import { describe, it, expect } from 'vitest';
import { aggregateWeek, type FeedInput } from '@/features/insights/model';
import { recordedAverage, reportRows } from '@/features/insights/report-model';
function week(start: string, feeds: FeedInput[] = []) {
  return aggregateWeek(
    { feeds, children: [], shots: [] },
    start,
    'Asia/Seoul',
    '2026-10-27T12:00:00Z',
  );
}
function feed(day: string, ml: number | null): FeedInput {
  return {
    id: day,
    kind: 'formula',
    started_at: `${day}T01:00:00Z`,
    ended_at: `${day}T01:10:00Z`,
    amount_ml: ml,
    amount_g: null,
  };
}
describe('growth report recorded-day comparisons', () => {
  it('keeps absent data distinct from zero and excludes missing quantities', () => {
    expect(recordedAverage(week('2026-10-20').categories.formula)).toEqual({
      days: 0,
      average: null,
    });
    expect(
      recordedAverage(
        week('2026-10-20', [
          feed('2026-10-20', 100),
          feed('2026-10-21', 200),
          feed('2026-10-22', null),
        ]).categories.formula,
      ),
    ).toEqual({ days: 2, average: 150 });
  });
  it('shows differences only with at least three valid days in each period', () => {
    const a = week(
      '2026-10-13',
      [13, 14, 15].map((d) => feed(`2026-10-${d}`, 100)),
    );
    const b = week(
      '2026-10-20',
      [20, 21, 22].map((d) => feed(`2026-10-${d}`, 120)),
    );
    expect(reportRows(a, b).find((row) => row.kind === 'formula')?.change).toBe(
      20,
    );
    const sparse = week('2026-10-20', [feed('2026-10-20', 120)]);
    expect(
      reportRows(a, sparse).find((row) => row.kind === 'formula')?.change,
    ).toBeNull();
  });
  it('does not count data from today in the completed seven-day report', () => {
    const result = week('2026-10-20', [
      feed('2026-10-26', 100),
      feed('2026-10-27', 900),
    ]);
    expect(recordedAverage(result.categories.formula)).toEqual({
      days: 1,
      average: 100,
    });
  });
});
