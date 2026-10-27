import { describe, it, expect } from 'vitest';
import { residenceSchema } from '@/features/family/residence-schema';
import { residenceRegions } from '@/features/family/residence-regions';
const base = {
  familyId: '10000000-0000-4000-8000-000000000001',
  childId: '20000000-0000-4000-8000-000000000001',
  version: '0',
};
describe('family residence selection', () => {
  it('accepts country-only residence and rejects unknown or mismatched country codes', () => {
    expect(
      residenceSchema.safeParse({ ...base, countryCode: 'US', regionCode: '' })
        .success,
    ).toBe(true);
    expect(
      residenceSchema.safeParse({ ...base, countryCode: 'ZZ', regionCode: '' })
        .success,
    ).toBe(false);
    expect(
      residenceSchema.safeParse({
        ...base,
        countryCode: 'US',
        regionCode: '1168010100',
      }).success,
    ).toBe(false);
  });
  it('accepts a legal locality code or explicit removal, never a label', () => {
    expect(
      residenceSchema.safeParse({ ...base, regionCode: '1168010100' }).success,
    ).toBe(true);
    expect(residenceSchema.safeParse({ ...base, regionCode: '' }).success).toBe(
      true,
    );
    for (const regionCode of [
      '역삼동',
      '116801010',
      '11680101000',
      undefined,
    ]) {
      expect(residenceSchema.safeParse({ ...base, regionCode }).success).toBe(
        false,
      );
    }
    expect(
      residenceSchema.safeParse({ ...base, regionCode: '', version: -1 })
        .success,
    ).toBe(false);
  });
  it('provides unique codes, whole district names, rural areas and Sejong', () => {
    expect(new Set(residenceRegions.map((r) => r.code)).size).toBe(
      residenceRegions.length,
    );
    expect(residenceRegions.find((r) => r.code === '1168010100')).toMatchObject(
      { province: '서울특별시', city: '강남구', locality: '역삼동' },
    );
    expect(
      residenceRegions.find((r) => r.code === '4183033000')?.locality,
    ).toBe('양서면');
    expect(residenceRegions.some((r) => r.province === '세종특별자치시')).toBe(
      true,
    );
    expect(residenceRegions.some((r) => r.city === '수원시 영통구')).toBe(true);
    expect(residenceRegions.some((r) => r.locality.endsWith('리'))).toBe(false);
    expect(residenceRegions.find((r) => r.code === '4167035000')).toMatchObject(
      { city: '여주시', locality: '대신면' },
    );
  });
});
