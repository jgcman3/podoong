import { describe, it, expect } from 'vitest';
import { aggregateWeek, type InsightInput } from '@/features/insights/model';
import { buildStatistics } from '@/features/insights/statistics-model';
const feed = (
  id: string,
  at: string,
  ml: number | null,
  kind = 'formula',
  g: number | null = null,
) => ({
  id,
  kind,
  started_at: at,
  ended_at: new Date(Date.parse(at) + 600000).toISOString(),
  amount_ml: ml,
  amount_g: g,
});
const record = (
  id: string,
  at: string,
  service: string,
  kind: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  occurred_at: at,
  service,
  kind,
  ended_at: null,
  duration_minutes: null,
  temperature_c: null,
  height_cm: null,
  weight_kg: null,
  head_cm: null,
  ...extra,
});
const now = '2026-10-26T12:00:00Z';
describe('primary insight statistics', () => {
  it('combines selected feeding volumes on one chart without converting breast minutes or grams', () => {
    const input = {
      feeds: [
        feed('a', '2026-10-12T02:00:00Z', 120),
        feed('b', '2026-10-12T03:00:00Z', 60, 'solids'),
        feed('c', '2026-10-13T02:00:00Z', null, 'solids', 55),
        feed('d', '2026-10-12T04:00:00Z', null, 'breast'),
        feed('zero', '2026-10-14T02:00:00Z', 0),
      ],
      children: [],
      shots: [],
    } as InsightInput;
    const week = aggregateWeek(input, '2026-10-12', 'Asia/Seoul', now);
    const [chart] = buildStatistics(
      [week],
      ['breast', 'formula', 'solids'],
      'day',
    );
    expect(chart.total).toBe(180);
    expect(chart.breastMinutes).toBe(10);
    expect(chart.series.map((s) => s.kind)).toEqual([
      'total',
      'formula',
      'solids',
    ]);
    expect(chart.series[0].values).toEqual([
      180,
      null,
      0,
      null,
      null,
      null,
      null,
    ]);
    expect(buildStatistics([week], ['breast'], 'day')[0]).toMatchObject({
      unit: 'min',
      total: 10,
    });
    expect(buildStatistics([week], ['formula'], 'day')[0].total).toBe(120);
  });
  it('provides six independent weekly sums and primary duration/count metrics', () => {
    const input = {
      feeds: [
        feed('a', '2026-10-05T02:00:00Z', 50),
        feed('b', '2026-10-12T02:00:00Z', 120),
      ],
      children: [
        record('s', '2026-10-12T14:30:00Z', 'sleep', 'night', {
          ended_at: '2026-10-12T16:00:00Z',
        }),
        record('d', '2026-10-12T02:00:00Z', 'diaper', 'mixed'),
        record('b', '2026-10-12T02:00:00Z', 'activity', 'bath', {
          duration_minutes: 5,
        }),
      ],
      shots: [],
    } as InsightInput;
    const weeks = [
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ].map((start) => aggregateWeek(input, start, 'Asia/Seoul', now));
    const charts = buildStatistics(
      weeks,
      ['formula', 'sleep', 'diaper', 'stool', 'bath'],
      'week',
    );
    expect(charts[0].series[0].values).toEqual([
      null,
      null,
      null,
      null,
      50,
      120,
    ]);
    expect(charts[0].total).toBe(170);
    expect(charts[0].points).toHaveLength(6);
    const counts = charts.find((chart) => chart.kind === 'counts')!;
    expect(charts.find((chart) => chart.kind === 'sleep')).toMatchObject({
      unit: 'h',
      total: 1.5,
    });
    expect(counts.series.map((series) => [series.kind, series.total])).toEqual([
      ['diaper', 1],
      ['stool', 1],
      ['bath', 1],
    ]);
    expect(counts.series.map((series) => series.values.at(-1))).toEqual([
      1, 1, 1,
    ]);
    expect(charts.filter((chart) => chart.unit === 'count')).toHaveLength(1);
    expect(counts.total).toBeNull();
  });
  it('uses all temperature samples and latest growth measurements across weeks', () => {
    const input = {
      feeds: [],
      children: [
        record('a', '2026-10-05T02:00:00Z', 'activity', 'temperature', {
          temperature_c: 36,
        }),
        record('b', '2026-10-12T02:00:00Z', 'activity', 'temperature', {
          temperature_c: 39,
        }),
        record('c', '2026-10-12T03:00:00Z', 'activity', 'temperature', {
          temperature_c: 39,
        }),
        record('g1', '2026-10-05T02:00:00Z', 'growth', 'measurement', {
          weight_kg: 6,
          height_cm: 60,
        }),
        record('g2', '2026-10-12T02:00:00Z', 'growth', 'measurement', {
          weight_kg: 7,
          height_cm: 65,
        }),
      ],
      shots: [],
    } as InsightInput;
    const weeks = ['2026-10-05', '2026-10-12'].map((start) =>
      aggregateWeek(input, start, 'Asia/Seoul', now),
    );
    const charts = buildStatistics(weeks, ['temperature', 'growth'], 'week');
    expect(charts[0].total).toBe(38);
    expect(charts[0].series[0].values).toEqual([36, 39]);
    expect(charts.find((chart) => chart.kind === 'growth')).toMatchObject({
      unit: 'kg',
      total: 7,
    });
    expect(charts.find((chart) => chart.kind === 'height')).toMatchObject({
      unit: 'cm',
      total: 65,
    });
    expect(
      charts.find((chart) => chart.kind === 'height')?.series[0].values,
    ).toEqual([60, 65]);
  });
});
