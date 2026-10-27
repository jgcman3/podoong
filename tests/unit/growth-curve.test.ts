import { describe, expect, it } from 'vitest';
import reference from '@/features/insights/reference/who-lms.json';
import {
  growthPoint,
  percentileRank,
  referenceValue,
  percentiles,
} from '@/features/insights/growth-model';
import checklist from '@/features/insights/reference/milestones.json';
import { readFileSync } from 'node:fs';
describe('WHO growth calculations', () => {
  it('matches published birth medians and z-score values', () => {
    expect(reference.female.weight[0]).toEqual([0.3809, 3.2322, 0.14171]);
    expect(referenceValue(reference.male.weight[0], 0)).toBe(3.3464);
    expect(referenceValue(reference.female.weight[0], -2)).toBeCloseTo(
      2.395,
      3,
    );
    expect(referenceValue(reference.male.height[0], 0)).toBeCloseTo(49.8842, 4);
    expect(referenceValue(reference.male.head[0], 0)).toBeCloseTo(34.4618, 4);
  });
  it('computes CDF and the logarithmic LMS case', () => {
    expect(percentileRank([0, 1, 1], 1)).toBeCloseTo(50, 5);
    expect(percentileRank([0, 1, 1], Math.E)).toBeCloseTo(84.13447, 4);
    expect(referenceValue([0, 1, 1], 1)).toBeCloseTo(Math.E, 10);
    expect(percentileRank(undefined, 8)).toBeNull();
    expect(percentileRank([1, 3, 0.1], 0)).toBeNull();
  });
  it('covers all days, sexes and measures without synthesizing out-of-range values', () => {
    for (const sex of Object.values(reference))
      for (const table of Object.values(sex)) {
        expect(table).toHaveLength(1827);
        for (const day of [0, 193, 365, 730, 731, 1826]) {
          const row = table[day];
          expect(row[1]).toBeGreaterThan(0);
          for (const { p, z } of percentiles)
            expect(percentileRank(row, referenceValue(row, z))).toBeCloseTo(
              p,
              4,
            );
        }
        expect(table[1827]).toBeUndefined();
      }
    expect(reference.male.height[731][1]).toBeLessThan(
      reference.male.height[730][1],
    );
  });
  it('uses record-local calendar age and excludes unborn/future records', () => {
    const record = {
      id: 'one',
      occurred_at: '2026-01-01T16:00:00Z',
      record_timezone: 'Asia/Seoul',
      weight_kg: 3,
      height_cm: null,
      head_cm: null,
    };
    expect(growthPoint(record, '2026-01-01', '2026-01-03')?.day).toBe(1);
    expect(growthPoint(record, '2026-01-03', '2026-01-03')).toBeNull();
    expect(growthPoint(record, '2026-01-01', '2026-01-01')).toBeNull();
  });
  it('keeps persisted checklist keys in sync with the database allowlist', () => {
    const sql = readFileSync(
      'supabase/migrations/202610270026_child_milestones.sql',
      'utf8',
    );
    expect(new Set(checklist.map((item) => item.id)).size).toBe(
      checklist.length,
    );
    for (const item of checklist) expect(sql).toContain(`'${item.id}'`);
  });
});
