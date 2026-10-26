import { describe, it, expect } from 'vitest';
import { feedingRecordSchema } from '@/features/care/feeding-schema';
import {
  quickTimeline,
  durationMinutes,
  todayEntries,
  dailyFeedingTotals,
  shiftCareDay,
  type QuickEntry,
} from '@/features/care/quick-model';
import type { Row } from '@/lib/db';
describe('quick care records', () => {
  it('requires real duration or explicit running state and keeps unknown amounts unknown', () => {
    const record = {
      id: '10000000-0000-4000-8000-000000000001',
      childId: '20000000-0000-4000-8000-000000000001',
      kind: 'formula',
      foodName: '',
      timezone: 'Asia/Seoul',
      startedAt: '2026-10-25T09:00:00Z',
      endedAt: '2026-10-25T09:10:00Z',
      amount: '',
      note: '',
      version: '',
    };
    expect(feedingRecordSchema.parse(record).amount).toBeNull();
    expect(
      feedingRecordSchema.safeParse({
        ...record,
        endedAt: '2026-10-25T08:00:00Z',
      }).success,
    ).toBe(false);
    expect(
      feedingRecordSchema.parse({ ...record, endedAt: '' }).endedAt,
    ).toBeNull();
  });
  it('merges sleep, diaper and feeding in time order with separate units and stable timer identity', () => {
    const feed = {
      id: 'f',
      kind: 'solids',
      started_at: '2026-10-25T09:20:00Z',
      ended_at: '2026-10-25T09:35:00Z',
      amount_g: 80,
      amount_ml: null,
      version: 1,
    } as Row<'care_records'>;
    const sleep = {
      id: 's',
      service: 'sleep',
      kind: 'nap',
      occurred_at: '2026-10-25T08:00:00Z',
      ended_at: null,
      version: 2,
      title: '',
    } as Row<'child_records'>;
    const diaper = {
      ...sleep,
      id: 'd',
      service: 'diaper',
      kind: 'wet',
      occurred_at: '2026-10-25T09:25:00Z',
    } as Row<'child_records'>;
    const entries = quickTimeline([feed], [sleep, diaper, sleep]);
    expect(entries.map((r) => r.id)).toEqual(['d', 'f', 's']);
    expect(entries[1]).toMatchObject({ amount: 80, unit: 'g', running: false });
    expect(entries[2]).toMatchObject({ running: true, version: 2 });
    expect(entries[0].running).toBe(false);
    expect(durationMinutes(entries[1])).toBe(15);
    expect(durationMinutes(entries[2])).toBeNull();
  });
});

describe('today care timeline', () => {
  const point = (
    id: string,
    startedAt: string,
    other: Partial<QuickEntry> = {},
  ): QuickEntry => ({
    id,
    source: 'child',
    service: 'diaper',
    kind: 'wet',
    startedAt,
    endedAt: null,
    version: 1,
    amount: null,
    unit: null,
    title: '',
    running: false,
    ...other,
  });
  it('uses the configured timezone and excludes yesterday and tomorrow', () => {
    const items = [
      point('yesterday', '2026-10-24T14:59:59Z'),
      point('midnight', '2026-10-24T15:00:00Z'),
      point('last', '2026-10-25T14:59:59Z'),
      point('tomorrow', '2026-10-25T15:00:00Z'),
    ];
    expect(
      todayEntries(items, '2026-10-25', 'Asia/Seoul').map((e) => e.id),
    ).toEqual(['midnight', 'last']);
  });
  it('keeps overnight sleep and ongoing records without keeping completed old records', () => {
    const items = [
      point('overnight', '2026-10-24T13:00:00Z', {
        service: 'sleep',
        kind: 'night',
        endedAt: '2026-10-25T00:00:00Z',
      }),
      point('running', '2026-10-23T13:00:00Z', {
        service: 'sleep',
        kind: 'night',
        running: true,
      }),
      point('old', '2026-10-24T09:00:00Z', {
        service: 'sleep',
        endedAt: '2026-10-24T11:00:00Z',
      }),
    ];
    expect(
      todayEntries(items, '2026-10-25', 'Asia/Seoul').map((e) => e.id),
    ).toEqual(['overnight', 'running']);
  });
  it('includes the whole local day through a daylight-saving transition', () => {
    const items = [
      point('first', '2026-11-01T04:00:00Z'),
      point('late', '2026-11-02T04:59:59Z'),
      point('next', '2026-11-02T05:00:00Z'),
    ];
    expect(
      todayEntries(items, '2026-11-01', 'America/New_York').map((e) => e.id),
    ).toEqual(['first', 'late']);
  });
});

describe('daily volume total', () => {
  const feed = (
    kind: string,
    amount: number | null,
    extra: Partial<QuickEntry> = {},
  ): QuickEntry => ({
    id: kind,
    source: 'feeding',
    service: 'feeding',
    kind,
    amount,
    unit: 'ml',
    startedAt: '2026-10-24T15:00:00Z',
    endedAt: '2026-10-24T15:10:00Z',
    version: 1,
    title: '',
    running: false,
    ...extra,
  });
  it('adds only completed formula and solids volumes starting on the selected local date', () => {
    const items = [
      feed('formula', 120),
      feed('solids', 80),
      feed('breast', 50),
      feed('solids', 35, { unit: 'g' }),
      feed('formula', 60, { running: true, endedAt: null }),
      feed('solids', null),
      feed('formula', 100, { startedAt: '2026-10-24T14:59:59Z' }),
      feed('formula', 100, { startedAt: '2026-10-25T15:00:00Z' }),
    ];
    expect(dailyFeedingTotals(items, '2026-10-25', 'Asia/Seoul')).toEqual({
      formula: 120,
      solids: 80,
      total: 200,
    });
    expect(dailyFeedingTotals([], '2026-10-25', 'Asia/Seoul')).toEqual({
      formula: 0,
      solids: 0,
      total: 0,
    });
  });
});

describe('care date navigation', () => {
  it('moves across month, year and leap-day boundaries without timezone drift', () => {
    expect(shiftCareDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftCareDay('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftCareDay('2026-03-08', 1)).toBe('2026-03-09');
    expect(shiftCareDay('2026-11-01', 1)).toBe('2026-11-02');
  });
});

describe('date-only vaccinations in care history', () => {
  it('uses the actual vaccination date instead of the creation timestamp and excludes plans', () => {
    const record = {
      id: 'v',
      vaccine: 'bcg',
      custom_name: '',
      status: 'completed',
      completed_date: '2026-10-20',
      created_at: '2026-10-26T01:00:00Z',
      version: 1,
      clinic: 'Clinic',
      dose: 1,
    } as Row<'vaccination_records'>;
    const entries = quickTimeline(
      [],
      [],
      [record, { ...record, id: 'p', status: 'planned', completed_date: null }],
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      source: 'vaccination',
      recordDate: '2026-10-20',
      running: false,
      amount: null,
      dose: 1,
    });
    expect(todayEntries(entries, '2026-10-20', 'Asia/Seoul')).toHaveLength(1);
    expect(todayEntries(entries, '2026-10-26', 'Asia/Seoul')).toHaveLength(0);
    expect(dailyFeedingTotals(entries, '2026-10-20', 'Asia/Seoul').total).toBe(
      0,
    );
  });
});
