import { describe, expect, it } from 'vitest';
import {
  mealPlanSchema,
  nextFeeding,
  nextMealTime,
} from '@/features/care/meal-plan';

describe('next feeding estimates', () => {
  it('uses feed end rather than start and keeps overdue estimates', () => {
    expect(nextFeeding({ ended_at: '2026-10-13T01:30:00Z' }, 180)).toBe(
      Date.parse('2026-10-13T04:30:00Z'),
    );
  });
  it('does not invent a time without settings, records or a finished feed', () => {
    expect(nextFeeding(null, 180)).toBeNull();
    expect(nextFeeding({ ended_at: null }, 180)).toBeNull();
    expect(nextFeeding({ ended_at: '2026-10-13T01:30:00Z' }, null)).toBeNull();
  });
});
describe('daily meal times in the profile timezone', () => {
  it('selects the closest upcoming time regardless of input order', () => {
    expect(
      nextMealTime(
        ['18:00', '08:00', '12:00'],
        Date.parse('2026-10-13T00:00:00Z'),
        'Asia/Seoul',
      ),
    ).toBe(Date.parse('2026-10-13T03:00:00Z'));
  });
  it('moves to tomorrow after the last planned meal, across the local date boundary', () => {
    expect(
      nextMealTime(['08:00'], Date.parse('2026-10-13T14:30:00Z'), 'Asia/Seoul'),
    ).toBe(Date.parse('2026-10-13T23:00:00Z'));
  });
  it('includes a time due now and ignores invalid times', () => {
    const now = Date.parse('2026-10-13T03:00:00Z');
    expect(nextMealTime(['12:00', '99:99'], now, 'Asia/Seoul')).toBe(now);
    expect(nextMealTime([], now, 'Asia/Seoul')).toBeNull();
  });
  it('skips nonexistent daylight saving times', () => {
    expect(
      nextMealTime(
        ['02:30'],
        Date.parse('2026-03-08T06:00:00Z'),
        'America/New_York',
      ),
    ).toBe(Date.parse('2026-03-09T06:30:00Z'));
  });
  it('finds the second occurrence of a repeated daylight saving time', () => {
    expect(
      nextMealTime(
        ['01:30'],
        Date.parse('2026-11-01T05:45:00Z'),
        'America/New_York',
      ),
    ).toBe(Date.parse('2026-11-01T06:30:00Z'));
  });
  it('rejects corrupted browser settings and invalid intervals', () => {
    expect(
      mealPlanSchema.safeParse({ feedingMinutes: 0, solids: [] }).success,
    ).toBe(false);
    expect(
      mealPlanSchema.safeParse({
        feedingMinutes: 180,
        solids: ['24:00'],
      }).success,
    ).toBe(false);
    expect(
      mealPlanSchema.safeParse({ feedingMinutes: null, solids: [] }).success,
    ).toBe(true);
  });
});
