import { describe, expect, it } from 'vitest';
import {
  completedMonths,
  developmentStage,
  sleepHours,
} from '@/features/insights/development-model';
describe('development guide ages', () => {
  it('uses completed calendar months including month-end birthdays', () => {
    expect(completedMonths('2026-01-27', '2026-10-26')).toBe(8);
    expect(completedMonths('2026-01-27', '2026-10-27')).toBe(9);
    expect(completedMonths('2026-01-31', '2026-02-28')).toBe(1);
    expect(completedMonths('2024-02-29', '2025-02-28')).toBe(12);
    expect(completedMonths(null, '2026-10-27')).toBeNull();
    expect(completedMonths('2026-11-01', '2026-10-27')).toBeNull();
  });
  it('labels the milestone age separately from the selected month', () => {
    expect(developmentStage(7).month).toBe(9);
    expect(developmentStage(9).month).toBe(9);
    expect(developmentStage(10).month).toBe(12);
    expect(developmentStage(60).month).toBe(60);
  });
  it('changes sleep reference ranges at age boundaries', () => {
    expect([0, 3, 4, 11, 12, 35, 36, 60].map(sleepHours)).toEqual([
      '14–17',
      '14–17',
      '12–16',
      '12–16',
      '11–14',
      '11–14',
      '10–13',
      '10–13',
    ]);
  });
});
