import { describe, expect, it } from 'vitest';
import {
  monthBounds,
  monthDays,
  shiftMonth,
  validMonth,
  calendarHref,
} from '../../src/features/care/month-model';
describe('calendar month navigation', () => {
  it('uses exclusive month bounds over year and leap-year boundaries', () => {
    expect(monthBounds('2026-12')).toEqual({
      start: '2026-12-01',
      end: '2027-01-01',
    });
    expect(monthBounds('2028-02')).toEqual({
      start: '2028-02-01',
      end: '2028-03-01',
    });
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('builds only the needed Sunday-first weeks including leap day and adjacent months', () => {
    const days = monthDays('2028-02');
    expect(days).toHaveLength(35);
    expect(new Date(`${days[0]}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(days).toContain('2028-02-29');
    expect(monthDays('2026-02')).toHaveLength(28);
    expect(monthDays('2026-08')).toHaveLength(42);
    expect(days.filter((day) => day.startsWith('2028-02'))).toHaveLength(29);
  });
  it('rejects malformed and unsupported months, and retains selected child/date in links', () => {
    for (const month of [
      undefined,
      '2026-00',
      '2026-13',
      '26-01',
      '0000-01',
      '9999-01',
      '2026-1',
    ])
      expect(validMonth(month)).toBe(false);
    expect(validMonth('2026-10')).toBe(true);
    expect(
      calendarHref('ko', 'child-id', '2026-12-15', { edit: 'task:id' }),
    ).toBe(
      '/ko/calendar?child=child-id&month=2026-12&day=2026-12-15&edit=task%3Aid',
    );
  });
});
