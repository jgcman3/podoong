import { describe, it, expect } from 'vitest';
import { vaccinationSchema } from '@/features/vaccination/schema';
const base = {
  id: '30000000-0000-4000-8000-000000000001',
  childId: '20000000-0000-4000-8000-000000000001',
  vaccine: 'influenza',
  completed: '2026-10-21',
  timezone: 'Asia/Seoul',
};
describe('vaccination entry validation', () => {
  it('requires an actual vaccination date', () => {
    for (const completed of ['', undefined, '2026-02-30'])
      expect(vaccinationSchema.safeParse({ ...base, completed }).success).toBe(
        false,
      );
    expect(vaccinationSchema.safeParse(base).success).toBe(true);
  });
  it('keeps an unknown dose null', () => {
    expect(vaccinationSchema.parse(base).dose).toBeNull();
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
