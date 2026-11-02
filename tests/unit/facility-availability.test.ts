import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { availableFacilityKinds } from '@/features/community/facility-availability.server';
import {
  diaperFacilities,
  diaperFacilitiesInArea,
} from '@/features/community/diaper-map.server';
import { loadFacilityRows } from '@/features/community/facility-listing.server';
const kinds = (area: string) => availableFacilityKinds(area).map(([id]) => id);
it('shows diaper facilities only where actual source records exist, including outside Seoul', () => {
  expect(kinds('서울특별시 용산구')).toContain('nursing');
  expect(kinds('부산광역시 해운대구')).toContain('nursing');
  expect(kinds('경기도 하남시')).toContain('nursing');
  for (const area of ['', '부산광역시 해운대', '자료 없는 지역'])
    expect(kinds(area)).not.toContain('nursing');
  expect(kinds('부산광역시 중구')).not.toContain('kids-cafe');
});
it('imports only confirmed changing tables and does not manufacture missing coordinates', () => {
  expect(diaperFacilities).toHaveLength(9833);
  expect(new Set(diaperFacilities.map((row) => row.id)).size).toBe(9833);
  expect(diaperFacilities.every((row) => row.diaperTable)).toBe(true);
  expect(diaperFacilities.filter((row) => row.coordinates)).toHaveLength(571);
  expect(diaperFacilitiesInArea('서울특별시 중')).toEqual([]);
});
it('rebuilds changing-table catalogue from the original source files', () => {
  expect(() =>
    execFileSync(
      process.execPath,
      ['scripts/build-diaper-map.mjs', '--check'],
      { stdio: 'pipe' },
    ),
  ).not.toThrow();
}, 20000);
it('paginates complete regional diaper records without duplicates', async () => {
  const first = await loadFacilityRows({
    kind: 'nursing',
    area: '서울특별시 강남구',
    locale: 'ko',
    page: 1,
  });
  const second = await loadFacilityRows({
    kind: 'nursing',
    area: '서울특별시 강남구',
    locale: 'ko',
    page: 2,
  });
  expect(first.total).toBeGreaterThan(10);
  expect(first.facilities).toHaveLength(10);
  const ids = [...first.facilities, ...second.facilities].map((row) => row.id);
  expect(new Set(ids).size).toBe(ids.length);
});
