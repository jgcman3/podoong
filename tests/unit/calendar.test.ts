import { describe, it, expect } from 'vitest';
import { relativeDay } from '@/features/care/calendar-model';
describe('calendar dates', () => {
  it('counts date-only days across DST and years, using the provided local today', () => {
    expect(relativeDay('2026-10-14', '2026-10-14', 'ko')).toBe('오늘');
    expect(relativeDay('2026-10-15', '2026-10-14', 'ko')).toBe('내일');
    expect(relativeDay('2026-10-17', '2026-10-14', 'ko')).toBe('3일 후');
    expect(relativeDay('2027-01-01', '2026-12-31', 'en')).toBe('Tomorrow');
    expect(relativeDay('2026-03-09', '2026-03-07', 'en')).toBe('In 2 days');
    expect(relativeDay('2026-10-13', '2026-10-14', 'en')).toBe('1 day ago');
  });
});
