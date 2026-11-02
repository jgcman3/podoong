import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/features/community/public-data.server', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/community/public-data.server')
  >()),
  weatherObservation: vi.fn(async () => ({ values: { T1H: '17', PTY: '0' } })),
  weatherSky: vi.fn(async () => '1'),
  airObservations: vi.fn(async () => [
    { station: '용산구', pm10: '26' },
    { station: '무관한 측정소', pm10: '300' },
  ]),
}));
import { nearbyArea, nearbySummary } from '@/features/community/nearby.server';
import { airObservations } from '@/features/community/public-data.server';
const answer = (rows: unknown[], total = rows.length) =>
  Response.json({
    response: {
      header: { resultCode: '00' },
      body: { items: { item: rows }, totalCount: total },
    },
  });
const point = { lat: 37.545, lon: 126.98 };
beforeEach(() => {
  vi.stubEnv('PUBLIC_DATA_SERVICE_KEY', 'synthetic');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) => {
      if (String(url).includes('Lcinfo'))
        return answer([
          {
            hpid: 'pharmacy',
            dutyName: '약국',
            dutyAddr: '서울특별시 용산구',
            latitude: 37.544,
            longitude: 126.98,
          },
        ]);
      expect(url.searchParams.get('QD')).toBe('D002');
      return answer([
        {
          hpid: 'other-district',
          dutyName: '이웃구 소아청소년과',
          dutyAddr: '서울특별시 중구',
          wgs84Lat: 37.544,
          wgs84Lon: 126.98,
        },
        {
          hpid: 'far',
          dutyName: '먼 소아청소년과',
          dutyAddr: '서울특별시 용산구',
          wgs84Lat: 37.56,
          wgs84Lon: 126.99,
        },
      ]);
    }),
  );
});
it('uses current position rather than home area, includes across-boundary pediatrics and rounds provider coordinates', async () => {
  const result = await nearbySummary(point);
  expect(result?.hospital?.id).toBe('other-district');
  expect(result?.pharmacy?.id).toBe('pharmacy');
  expect(result?.temperature).toBe(17);
  expect(result?.condition).toBe('clear');
  const calls = vi
    .mocked(fetch)
    .mock.calls.map(([url]) => new URL(String(url)));
  const pharmacy = calls.find((url) => url.pathname.includes('Lcinfo'))!;
  expect(pharmacy.searchParams.get('WGS84_LAT')).toBe(
    String(Math.round(point.lat * 100) / 100),
  );
  expect(pharmacy.searchParams.get('WGS84_LON')).toBe('126.98');
  expect(nearbyArea({ lat: 35, lon: -120 })).toBeNull();
});
it('does not substitute a random province station or break the summary on a source failure', async () => {
  vi.mocked(airObservations).mockResolvedValueOnce([
    { station: '무관한 측정소', pm10: '300', pm25: '100', time: '' },
  ]);
  vi.mocked(fetch).mockRejectedValue(new Error('private URL with key'));
  const result = await nearbySummary(point);
  expect(result?.dust).toBeNull();
  expect(result?.hospital).toBeNull();
  expect(result?.pharmacy).toBeNull();
  expect(result?.temperature).toBe(17);
});
