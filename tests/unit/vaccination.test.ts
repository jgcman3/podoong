import { describe, it, expect } from 'vitest';
import { vaccinationSchema } from '@/features/vaccination/schema';
const base = {
  id: '30000000-0000-4000-8000-000000000001',
  childId: '20000000-0000-4000-8000-000000000001',
  vaccine: 'influenza',
  status: 'planned',
  scheduled: '2026-10-21',
  timezone: 'Asia/Seoul',
};
describe('vaccination entry validation', () => {
  it('requires the date belonging to the selected status', () => {
    expect(
      vaccinationSchema.safeParse({ ...base, scheduled: '' }).success,
    ).toBe(false);
    expect(
      vaccinationSchema.safeParse({ ...base, status: 'completed' }).success,
    ).toBe(false);
    expect(
      vaccinationSchema.safeParse({
        ...base,
        status: 'completed',
        scheduled: '',
        completed: '2026-10-14',
      }).success,
    ).toBe(true);
  });
  it('keeps unknown dose and dates null', () => {
    const r = vaccinationSchema.parse(base);
    expect(r.dose).toBeNull();
    expect(r.completed).toBeNull();
  });
  it('accepts only consecutive flu season years', () => {
    expect(
      vaccinationSchema.safeParse({ ...base, season: '2026-2027' }).success,
    ).toBe(true);
    for (const season of ['2026-2026', '2026-2028', '2026'])
      expect(vaccinationSchema.safeParse({ ...base, season }).success).toBe(
        false,
      );
  });
  it('requires a name for another or combination vaccine', () => {
    expect(
      vaccinationSchema.safeParse({ ...base, vaccine: 'other' }).success,
    ).toBe(false);
    expect(
      vaccinationSchema.safeParse({
        ...base,
        vaccine: 'other',
        custom: 'Combined vaccine',
      }).success,
    ).toBe(true);
  });
  it('rejects invalid dose numbers', () => {
    for (const dose of ['0', '11', '1.5'])
      expect(vaccinationSchema.safeParse({ ...base, dose }).success).toBe(
        false,
      );
  });
});
