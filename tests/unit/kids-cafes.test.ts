import { afterEach, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
import catalogue from '../../data/facilities/kids-cafes/catalogue.json';
import manifest from '../../data/facilities/kids-cafes/manifest.json';
import { kidsCafeList, kidsCafeSources } from '@/features/community/kids-cafes';
import { coordinates } from '@/features/community/public-data';
import { loadFacilityRows } from '@/features/community/facility-listing.server';
import {
  parseCsv,
  importSource,
  mergeFacilities,
  normalizeAddress,
} from '../../scripts/lib/kids-cafe-import.mjs';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('preserves the public snapshot while adding separately dated official private sources', () => {
  const publicRows = catalogue.facilities.filter(
    (row) => row.ownership === 'public',
  );
  expect(publicRows).toHaveLength(151);
  expect(
    catalogue.sources.find((row) => row.id === 'seoul-public')?.sourceDate,
  ).toBe('2026-10-03');
  expect(new Set(publicRows.map((row) => row.address.split(' ')[1])).size).toBe(
    25,
  );
  expect(new Set(catalogue.facilities.map((row) => row.id)).size).toBe(
    catalogue.facilities.length,
  );
  for (const row of catalogue.facilities) {
    expect(row.name).toBeTruthy();
    expect(row.address).toMatch(/^(서울특별시|부산광역시) /);
    if (row.latitude !== null || row.longitude !== null)
      expect(coordinates(row.latitude, row.longitude)).toBeDefined();
    if (row.ownership === 'private') expect(row.freeAdmission).toBeNull();
  }
  expect(manifest.pendingSources[0].region).toBe('경기도');
});
it('keeps regional sources and their dates distinct without inventing hours, costs or distances', () => {
  const seoul = kidsCafeList('서울특별시 용산구', true);
  expect(seoul.filter((row) => row.detail?.startsWith('공공형'))).toHaveLength(
    4,
  );
  expect(seoul).toHaveLength(4);
  expect(seoul.every((row) => row.detail?.startsWith('공공형'))).toBe(true);
  for (const facility of seoul) {
    expect(facility.address).toMatch(/^서울특별시 용산구 /);
    expect(facility.hours).toEqual({});
  }
  const busan = kidsCafeList('부산광역시 해운대구', true);
  expect(busan).toHaveLength(8);
  expect(busan.every((row) => !row.coordinates && row.detail === '민간')).toBe(
    true,
  );
  expect(kidsCafeSources('서울특별시 강서구')).toHaveLength(1);
  expect(kidsCafeSources('부산광역시 강서구')).toHaveLength(1);
  expect(kidsCafeSources('부산광역시 기장군')[0].sourceDate).toBe('2025-11-17');
  expect(kidsCafeList('부산광역시 중구', true)).toEqual([]);
  expect(
    kidsCafeList('서울특별시 용산구', false).every((row) =>
      row.detail?.startsWith('Public'),
    ),
  ).toBe(true);
});
it('sorts a complete district before pagination without calling a facility API', async () => {
  vi.stubEnv('KAKAO_REST_API_KEY', '');
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const load = (page: number) =>
    loadFacilityRows({
      kind: 'kids-cafe',
      area: '서울특별시 동작구',
      referenceArea: '서울특별시 동작구',
      locale: 'ko',
      page,
    });
  const first = await load(1),
    second = await load(2);
  const total = kidsCafeList('서울특별시 동작구', true).length;
  expect(first.total).toBe(total);
  expect(first.facilities).toHaveLength(10);
  expect(second.facilities).toHaveLength(Math.min(10, total - 10));
  const all = [...first.facilities, ...second.facilities];
  expect(new Set(all.map((row) => row.id)).size).toBe(all.length);
  const distances = all.map((row) => row.distanceKm ?? Infinity);
  expect(distances).toEqual([...distances].sort((a, b) => a - b));
  expect(fetcher).not.toHaveBeenCalled();
});
it('rebuilds the server catalogue reproducibly from the checked-in original files', () => {
  expect(() =>
    execFileSync(
      process.execPath,
      ['scripts/build-kids-cafes.mjs', '--check'],
      { stdio: 'pipe' },
    ),
  ).not.toThrow();
});
it('parses real CSV quoting, quoted line breaks and legacy Korean files without accepting truncated rows', () => {
  expect(
    parseCsv('\uFEFFname,address\r\n"Kids ""café""","A,B\nFloor 2"\r\n'),
  ).toEqual([{ name: 'Kids "café"', address: 'A,B\nFloor 2' }]);
  expect(() => parseCsv('a,b\n"unclosed,b')).toThrow();
  expect(() => parseCsv('a,b\none')).toThrow();
  expect(
    normalizeAddress(
      '부산 강서구 명지로 1 부산 강서구 명지로 1',
      '부산광역시 강서구',
    ),
  ).toBe('부산광역시 강서구 명지로 1');
});

it('excludes named non-cafes, corrects demonstrably swapped Korean coordinates and merges duplicates without collapsing floors', () => {
  const source = {
    id: 'fixture',
    format: 'busan',
    region: '부산광역시 기장군',
  };
  const text =
    '키즈카페명,도로명주소,전화번호,위도,경도\nFixture,부산광역시 기장군 도로 1,,129.1,35.2\nUnrelated,부산광역시 기장군 도로 2,,35.2,129.1\n';
  const result = importSource(source, Buffer.from(text), {
    Unrelated: '실외시설',
  });
  expect(result.facilities).toHaveLength(1);
  expect(result.excluded.unrelated).toBe(1);
  expect(result.correctedCoordinates).toBe(1);
  const row = result.facilities[0];
  expect(row.latitude).toBe(35.2);
  expect(row.longitude).toBe(129.1);
  expect(row.freeAdmission).toBeNull();
  expect(
    mergeFacilities([row, { ...row, sourceIds: ['second'] }])[0].sourceIds,
  ).toEqual(['fixture', 'second']);
  expect(
    mergeFacilities([
      { ...row, address: row.address + ', 2층' },
      { ...row, address: row.address + ', 3층' },
    ]),
  ).toHaveLength(2);
});
