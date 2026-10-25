import { describe, expect, it } from 'vitest';
import {
  endFromDuration,
  feedingKinds,
  quickFeedingKinds,
  isFeedingKind,
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
  it('offers the same three feeding kinds in the form and quick actions', () => {
    expect(feedingKinds).toEqual(['breast', 'formula', 'solids']);
    expect(quickFeedingKinds).toEqual(feedingKinds);
    expect(isFeedingKind('meal')).toBe(false);
    expect(isFeedingKind('pump')).toBe(false);
    expect(isFeedingKind('expressed')).toBe(false);
  });
});
