import { afterEach, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
import snapshot from '@/features/community/data/seoul-kids-cafes.json';
import { kidsCafeList } from '@/features/community/kids-cafes';
import { coordinates } from '@/features/community/public-data';
import { loadFacilityRows } from '@/features/community/facility-listing.server';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('preserves the supplied Seoul snapshot date, unique facilities and valid coordinates', () => {
  expect(snapshot.sourceDate).toBe('2026-10-03');
  expect(snapshot.facilities).toHaveLength(151);
  expect(new Set(snapshot.facilities.map((row) => row.id)).size).toBe(151);
  expect(new Set(snapshot.facilities.map((row) => row.district)).size).toBe(25);
  for (const row of snapshot.facilities) {
    expect(coordinates(row.latitude, row.longitude)).toBeDefined();
    expect(row.name).toBeTruthy();
    expect(row.address).toMatch(/^서울특별시 /);
  }
});
it('shows only the selected district and preserves visiting information without inventing hourly status', () => {
  const facilities = kidsCafeList('서울특별시 용산구', true);
  expect(facilities).toHaveLength(4);
  for (const facility of facilities) {
    expect(facility.address).toMatch(/^서울특별시 용산구 /);
    expect(facility.detail).toMatch(/무료|유료/);
    expect(facility.visiting?.openDays).toBeTruthy();
    expect(facility.visiting?.closedDays).toBeTruthy();
    expect(facility.hours).toEqual({});
  }
  expect(kidsCafeList('부산광역시 중구', true)).toEqual([]);
  expect(kidsCafeList('서울특별시 중구', true)).toHaveLength(4);
  expect(kidsCafeList('서울특별시 용산구', false)[0].detail).toMatch(
    /admission/,
  );
});
it('sorts the full district by distance before pagination without calling the old facilities API', async () => {
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
  expect(first.total).toBe(17);
  expect(first.facilities).toHaveLength(10);
  expect(second.facilities).toHaveLength(7);
  const all = [...first.facilities, ...second.facilities];
  expect(new Set(all.map((row) => row.id)).size).toBe(17);
  expect(all.every((row) => Number.isFinite(row.distanceKm))).toBe(true);
  expect(all.map((row) => row.distanceKm)).toEqual(
    all.map((row) => row.distanceKm).sort((a, b) => a! - b!),
  );
  expect(fetcher).not.toHaveBeenCalled();
});
