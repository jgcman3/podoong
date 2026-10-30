import { describe, expect, it } from 'vitest';
import {
  endFromDuration,
  endFromClock,
  feedingKinds,
} from '@/features/care/feeding-record';
describe('feeding time input', () => {
  it('calculates an end time across midnight without losing start seconds', () => {
    expect(endFromDuration('2026-10-13T23:55:12.500Z', '10')).toBe(
      '2026-10-14T00:05:12.500Z',
    );
  });
  it('preserves fractional minutes and permits an explicitly entered zero', () => {
    expect(endFromDuration('2026-10-13T12:00:00Z', '1.5')).toBe(
      '2026-10-13T12:01:30.000Z',
    );
    expect(endFromDuration('2026-10-13T12:00:00Z', '0')).toBe(
      '2026-10-13T12:00:00.000Z',
    );
  });
  it.each(['', ' ', '-1', 'Infinity', 'invalid'])(
    'does not fabricate an end from %j',
    (minutes) => {
      expect(endFromDuration('2026-10-13T12:00:00Z', minutes)).toBe('');
    },
  );
  it('accepts only the three supported feeding kinds', () => {
    expect(feedingKinds).toEqual(['breast', 'formula', 'solids']);
  });
});

describe('sleep end clock', () => {
  it('resolves overnight end times to the following day without seconds', () => {
    expect(endFromClock('2026-10-28T22:00', '08:15')).toBe(
      new Date('2026-10-29T08:15').toISOString(),
    );
    expect(endFromClock('2026-10-29T08:00', '10:30')).toBe(
      new Date('2026-10-29T10:30').toISOString(),
    );
  });
  it('keeps cleared or invalid time fields empty instead of throwing', () => {
    expect(endFromClock('', '08:00')).toBe('');
    expect(endFromClock('invalid', '08:00')).toBe('');
    expect(endFromClock('2026-10-29T08:00', '')).toBe('');
  });
});
