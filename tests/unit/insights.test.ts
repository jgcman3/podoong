import { describe, it, expect } from 'vitest';
import {
  aggregateWeek,
  dailyValues,
  weekValue,
  resolveWeek,
  type InsightInput,
  type FeedInput,
  type ChildInput,
} from '@/features/insights/model';
import { metrics, selectedKinds, toggleKind } from '@/features/insights/config';
const now = '2026-11-02T12:00:00Z',
  start = '2026-10-26';
const empty = (): InsightInput => ({ feeds: [], children: [], shots: [] });
const feed = (
  id: string,
  at: string,
  end: string | null,
  ml: number | null = null,
  g: number | null = null,
  kind = 'formula',
): FeedInput => ({
  id,
  kind,
  started_at: at,
  ended_at: end,
  amount_ml: ml,
  amount_g: g,
});
const child = (
  id: string,
  at: string,
  more: Partial<ChildInput> = {},
): ChildInput => ({
  id,
  service: 'activity',
  kind: 'bath',
  occurred_at: at,
  ended_at: null,
  duration_minutes: null,
  temperature_c: null,
  height_cm: null,
  weight_kg: null,
  head_cm: null,
  ...more,
});
describe('weekly insights from recorded data', () => {
  it('uses trailing seven days without snapping to weekdays', () => {
    expect(resolveWeek(undefined, '2026-10-29')).toBe('2026-10-23');
    expect(resolveWeek('2026-10-21', '2026-10-29')).toBe('2026-10-21');
    expect(resolveWeek('2026-10-28', '2026-10-29')).toBe('2026-10-23');
    for (const value of ['2026-12-01', '2026-02-30', 'wrong', '1900-01-01'])
      expect(resolveWeek(value, '2026-10-29')).toBe('2026-10-23');
    expect(resolveWeek('2026-01-01', '2026-01-03')).toBe('2025-12-28');
  });
  it('toggles independent activities and preserves an explicit empty selection', () => {
    expect(selectedKinds(undefined)).toEqual([
      'breast',
      'formula',
      'solids',
      'sleep',
      'diaper',
      'stool',
    ]);
    expect(selectedKinds('sleep,formula,sleep,unknown')).toEqual([
      'formula',
      'sleep',
    ]);
    expect(toggleKind(['formula'], 'sleep')).toEqual(['formula', 'sleep']);
    expect(toggleKind(['formula', 'sleep'], 'formula')).toEqual(['sleep']);
    expect(toggleKind(['sleep'], 'sleep')).toEqual([]);
    expect(selectedKinds('')).toEqual([]);
  });
  it('keeps minute-level event marks distinct within the same hour', () => {
    const input = empty();
    input.feeds = [
      feed('a', '2026-10-26T02:05:00Z', '2026-10-26T02:10:00Z', 50),
      feed('b', '2026-10-26T02:45:00Z', '2026-10-26T02:50:00Z', 80),
    ];
    const day = aggregateWeek(input, start, 'Asia/Seoul', now).categories
      .formula.days[0];
    expect(day.segments).toEqual([
      { start: 665, end: 670 },
      { start: 705, end: 710 },
    ]);
    expect(day.hours[11]).toBe(2);
  });
  it('splits feeding duration across midnight without adding a second count', () => {
    const input = empty();
    input.feeds = [
      feed('overnight', '2026-10-26T14:50:00Z', '2026-10-26T15:20:00Z', 80),
    ];
    const days = aggregateWeek(input, start, 'Asia/Seoul', now).categories
      .formula.days;
    expect(days[0].segments).toEqual([{ start: 1430, end: 1440 }]);
    expect(days[1].segments).toEqual([{ start: 0, end: 20 }]);
    expect(days[0].count).toBe(1);
    expect(days[1].count).toBe(0);
  });
  it('includes feeding with unknown duration, excludes future and deduplicates', () => {
    const input = empty();
    input.feeds = [
      feed('a', '2026-10-25T15:10:00Z', '2026-10-25T15:20:00Z', 120),
      feed('b', '2026-10-26T15:10:00Z', '2026-10-26T15:20:00Z', 80),
      feed('c', '2026-10-26T16:00:00Z', '2026-10-26T16:10:00Z'),
      feed('unknown-duration', '2026-10-26T16:00:00Z', null, 500),
      feed('future', '2026-12-01T00:00:00Z', '2026-12-01T00:10:00Z', 900),
    ];
    input.feeds.push(input.feeds[0]);
    const c = aggregateWeek(input, start, 'Asia/Seoul', now).categories.formula;
    expect(c.count).toBe(4);
    expect(c.excludedRunning).toBe(0);
    expect(c.recordedDays).toBe(2);
    expect(dailyValues(c, metrics.formula[0])).toEqual([
      120,
      580,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(weekValue(c, metrics.formula[0])).toBe(700);
  });
  it('never converts legacy grams to milliliters and keeps missing amounts distinct from zero', () => {
    const input = empty();
    input.feeds = [
      feed(
        'a',
        '2026-10-26T02:00:00Z',
        '2026-10-26T02:10:00Z',
        60,
        null,
        'solids',
      ),
      feed(
        'b',
        '2026-10-27T02:00:00Z',
        '2026-10-27T02:10:00Z',
        null,
        55,
        'solids',
      ),
      feed(
        'c',
        '2026-10-28T02:00:00Z',
        '2026-10-28T02:10:00Z',
        0,
        null,
        'solids',
      ),
    ];
    const c = aggregateWeek(input, start, 'Asia/Seoul', now).categories.solids;
    expect(dailyValues(c, metrics.solids[0])).toEqual([
      60,
      null,
      0,
      null,
      null,
      null,
      null,
    ]);
    expect(weekValue(c, metrics.solids[2])).toBe(55);
    expect(c.count).toBe(3);
  });
  it('splits overnight sleep at local midnight and merges overlap without inflating duration', () => {
    const input = empty();
    input.children = [
      child('a', '2026-10-26T14:30:00Z', {
        service: 'sleep',
        kind: 'night',
        ended_at: '2026-10-26T16:00:00Z',
      }),
      child('b', '2026-10-26T14:45:00Z', {
        service: 'sleep',
        kind: 'night',
        ended_at: '2026-10-26T15:30:00Z',
      }),
    ];
    const c = aggregateWeek(input, start, 'Asia/Seoul', now).categories.sleep;
    expect(dailyValues(c, metrics.sleep[0])).toEqual([
      30,
      60,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(c.count).toBe(2);
    expect(c.days[0].hours[23]).toBe(30);
    expect(c.days[1].hours[0]).toBe(60);
    expect(c.days[0].segments).toEqual([{ start: 1410, end: 1440 }]);
    expect(c.days[1].segments).toEqual([{ start: 0, end: 60 }]);
    expect(weekValue(c, metrics.sleep[0])).toBe(90);
  });
  it('uses actual elapsed sleep through DST repeated hours and includes carry-in sleep', () => {
    const input = empty();
    input.children = [
      child('a', '2026-11-01T04:00:00Z', {
        service: 'sleep',
        kind: 'night',
        ended_at: '2026-11-01T08:00:00Z',
      }),
      child('b', '2026-10-26T03:00:00Z', {
        service: 'sleep',
        kind: 'night',
        ended_at: '2026-10-26T05:00:00Z',
      }),
    ];
    const c = aggregateWeek(input, start, 'America/New_York', now).categories
      .sleep;
    expect(c.days[6].hours.slice(0, 3)).toEqual([60, 120, 60]);
    expect(dailyValues(c, metrics.sleep[0])[0]).toBe(60);
    expect(c.days[0].count).toBe(0);
    expect(weekValue(c, metrics.sleep[0])).toBe(300);
  });
  it('uses measurement-weighted temperatures and latest measured growth, without filling gaps', () => {
    const input = empty();
    input.children = [
      child('a', '2026-10-26T02:00:00Z', {
        kind: 'temperature',
        temperature_c: 36,
      }),
      child('b', '2026-10-26T03:00:00Z', {
        kind: 'temperature',
        temperature_c: 38,
      }),
      child('c', '2026-10-27T02:00:00Z', {
        kind: 'temperature',
        temperature_c: 40,
      }),
      child('g-new', '2026-10-28T04:00:00Z', {
        service: 'growth',
        kind: 'measurement',
        height_cm: 65,
      }),
      child('g-old', '2026-10-28T02:00:00Z', {
        service: 'growth',
        kind: 'measurement',
        height_cm: 64,
      }),
    ];
    const result = aggregateWeek(input, start, 'Asia/Seoul', now).categories;
    expect(weekValue(result.temperature, metrics.temperature[0])).toBe(38);
    expect(
      dailyValues(result.temperature, metrics.temperature[0]).slice(0, 3),
    ).toEqual([37, 40, null]);
    expect(weekValue(result.growth, metrics.growth[1])).toBe(65);
    expect(weekValue(result.growth, metrics.growth[0])).toBeNull();
  });
  it('counts mixed diapers once as a change and in the stool subset, keeping duration-less activities missing', () => {
    const input = empty();
    input.children = [
      child('a', '2026-10-26T02:00:00Z', { service: 'diaper', kind: 'mixed' }),
      child('b', '2026-10-26T03:00:00Z', { service: 'diaper', kind: 'wet' }),
      child('c', '2026-10-26T04:00:00Z', { kind: 'play' }),
    ];
    const c = aggregateWeek(input, start, 'Asia/Seoul', now).categories;
    expect(c.diaper.count).toBe(2);
    expect(c.stool.count).toBe(1);
    expect(weekValue(c.diaper, metrics.diaper[1])).toBe(2);
    expect(weekValue(c.diaper, metrics.diaper[2])).toBe(1);
    expect(c.play.count).toBe(1);
    expect(weekValue(c.play, metrics.play[0])).toBeNull();
  });
  it('keeps dirty and mixed diaper entries out of the standalone stool pattern and count', () => {
    const input = empty();
    input.children = [
      child('a', '2026-10-26T02:00:00Z', {
        service: 'diaper',
        kind: 'diaper_dirty',
      }),
      child('b', '2026-10-26T03:00:00Z', {
        service: 'diaper',
        kind: 'diaper_mixed',
      }),
    ];
    const c = aggregateWeek(input, start, 'Asia/Seoul', now).categories;
    expect(c.diaper.count).toBe(2);
    expect(c.diaper.days.flatMap((d) => d.segments)).toHaveLength(2);
    expect(weekValue(c.diaper, metrics.diaper[1])).toBe(1);
    expect(weekValue(c.diaper, metrics.diaper[2])).toBe(2);
    expect(c.stool.count).toBe(0);
    expect(c.stool.days.flatMap((d) => d.segments)).toHaveLength(0);
  });
  it('draws stool records once while retaining a separate diaper at the same time', () => {
    const input = empty();
    input.children = [
      child('a', '2026-10-26T02:00:00Z', { service: 'diaper', kind: 'dirty' }),
      child('b', '2026-10-26T02:00:00Z', { service: 'diaper', kind: 'wet' }),
      child('c', '2026-10-26T03:00:00Z', { service: 'diaper', kind: 'mixed' }),
    ];
    const c = aggregateWeek(input, start, 'Asia/Seoul', now).categories;
    expect(c.diaper.days.flatMap((d) => d.segments)).toHaveLength(1);
    expect(c.stool.days.flatMap((d) => d.segments)).toHaveLength(2);
    expect(c.diaper.count).toBe(3);
    expect(c.stool.count).toBe(2);
  });
  it('uses actual vaccination dates and never fabricates a time of day', () => {
    const input = empty();
    input.shots = [
      { id: 'a', status: 'completed', completed_date: '2026-10-27' },
      { id: 'b', status: 'planned', completed_date: null },
      { id: 'c', status: 'completed', completed_date: '2026-12-01' },
    ];
    const c = aggregateWeek(input, start, 'Asia/Seoul', now).categories
      .vaccination;
    expect(c.count).toBe(1);
    expect(c.days[1].untimed).toBe(1);
    expect(c.days[1].hours.every((n) => n === 0)).toBe(true);
  });
  it('reports empty series as missing', () => {
    const w = aggregateWeek(empty(), start, 'Asia/Seoul', now);
    expect(dailyValues(w.categories.formula, metrics.formula[0])).toEqual(
      Array(7).fill(null),
    );
    expect(weekValue(w.categories.formula, metrics.formula[0])).toBeNull();
  });
});

describe('timed play insights', () => {
  it('uses elapsed start/end time for new timers and retains manual legacy durations', () => {
    const input = empty();
    input.children = [
      child('timed', '2026-10-26T02:00:00Z', {
        kind: 'play',
        ended_at: '2026-10-26T02:10:00Z',
      }),
      child('legacy', '2026-10-26T03:00:00Z', {
        kind: 'play',
        duration_minutes: 7,
      }),
      child('tummy', '2026-10-26T04:00:00Z', {
        kind: 'tummy',
        ended_at: '2026-10-26T04:02:30Z',
      }),
    ];
    const result = aggregateWeek(input, start, 'UTC', now);
    expect(
      result.categories.play.days[0].values.minutes.map((r) => r.value),
    ).toEqual([10, 7]);
    expect(
      result.categories.tummy.days[0].values.minutes.map((r) => r.value),
    ).toEqual([2.5]);
  });
});
