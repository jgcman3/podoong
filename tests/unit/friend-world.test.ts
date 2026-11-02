import { describe, expect, it } from 'vitest';
import {
  babyPose,
  calendarAge,
  playgroundAgeLabel,
  preschoolAge,
  ageInDays,
  placementFor,
  stableHash,
  worldBounds,
  publicChildName,
} from '@/features/community/friend-world-model';
describe('neighborhood side-view playground', () => {
  it('uses illustrative age-specific poses', () =>
    expect([50, 180, 300, 600].map(babyPose)).toEqual([
      'lying',
      'sitting',
      'crawling',
      'standing',
    ]));
  it('uses the actual seventh birthday including leap days', () => {
    expect(
      preschoolAge(ageInDays('2019-11-03', '2026-11-02'), '2026-11-02'),
    ).toBe(true);
    expect(
      preschoolAge(ageInDays('2019-11-02', '2026-11-02'), '2026-11-02'),
    ).toBe(false);
    expect(
      preschoolAge(ageInDays('2017-03-01', '2024-02-29'), '2024-02-29'),
    ).toBe(true);
  });
  it('keeps earlier placements stable and grows near an existing neighbor', () => {
    const points = Array.from({ length: 80 }, (_, i) =>
      placementFor(i, stableHash('2026-11-02|' + i)),
    );
    for (let i = 1; i < points.length; i++)
      expect(
        Math.min(
          ...points
            .slice(0, i)
            .map((p) => Math.hypot(points[i].x - p.x, points[i].y - p.y)),
        ),
      ).toBeLessThan(320);
    expect(points[0]).toEqual(placementFor(0, stableHash('2026-11-02|0')));
    expect(worldBounds(points).width).toBeGreaterThan(
      worldBounds(points.slice(0, 3)).width,
    );
    expect(placementFor(0, stableHash('2026-11-03|0'))).not.toEqual(points[0]);
  });
  it('increments displayed age at New Year, not on the birthday', () => {
    expect(
      calendarAge(ageInDays('2026-12-31', '2026-12-31'), '2026-12-31'),
    ).toBe(0);
    expect(
      calendarAge(ageInDays('2026-12-31', '2027-01-01'), '2027-01-01'),
    ).toBe(1);
    expect(
      calendarAge(ageInDays('2024-02-29', '2026-01-01'), '2026-01-01'),
    ).toBe(2);
  });
  it('uses D+ until day 364 even across a leap anniversary', () => {
    expect(playgroundAgeLabel(364, '2024-02-29', 'ko')).toBe('D+364');
    expect(playgroundAgeLabel(365, '2024-02-29', 'ko')).toBe('1살');
    expect(playgroundAgeLabel(366, '2024-03-01', 'en')).toBe('1 year');
  });
  it('automatically composes the public name', () =>
    expect(publicChildName(' 포둥네 ', ' 지혜 ')).toBe('포둥네 지혜'));
});
