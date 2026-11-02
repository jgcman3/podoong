import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/features/outing/public-data.server', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/features/outing/public-data.server')
  >()),
  weatherObservation: vi.fn(async () => ({ values: { T1H: '17', PTY: '0' } })),
  weatherSky: vi.fn(async () => '1'),
  airObservations: vi.fn(async () => [
    { station: '용산구', pm10: '26' },
    { station: '무관한 측정소', pm10: '300' },
  ]),
}));
import { nearbyArea, nearbySummary } from '@/features/outing/nearby.server';
import { airObservations } from '@/features/outing/public-data.server';
const answer = (rows: unknown[], total = rows.length) =>
  Response.json({
    response: {
      header: { resultCode: '00' },
      body: { items: { item: rows }, totalCount: total },
    },
  });
const point = { lat: 37.545, lon: 126.98 };
const row = (
  id: string,
  lat: number,
  hours: Record<string, string> = { dutyTime1s: '0900', dutyTime1c: '1800' },
) => ({
  hpid: id,
  dutyName: id,
  dutyAddr: '서울특별시 용산구',
  wgs84Lat: lat,
  wgs84Lon: 126.98,
  ...hours,
});
let holiday = false,
  holidayFailure = false;
beforeEach(() => {
  vi.stubEnv('OUTING_DATA_SERVICE_KEY', 'synthetic');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-02T01:00:00Z'));
  holiday = false;
  holidayFailure = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) => {
      if (url.pathname.includes('getRestDeInfo')) {
        if (holidayFailure) throw Error('private provider error');
        return answer(holiday ? [{ locdate: '20261102', isHoliday: 'Y' }] : []);
      }
      expect(url.searchParams.has('WGS84_LAT')).toBe(false);
      expect(url.searchParams.has('WGS84_LON')).toBe(false);
      const pharmacy = url.pathname.includes('getParmacy');
      if (!pharmacy) expect(url.searchParams.get('QD')).toBe('D002');
      return answer([
        row('closed-nearest', 37.5451, {
          dutyTime1s: '1100',
          dutyTime1c: '1800',
        }),
        row('unknown-nearest', 37.5452, {}),
        row(pharmacy ? 'open-pharmacy' : 'open-pediatrics', 37.546, {
          dutyTime1s: '0900',
          dutyTime1c: '1800',
          dutyTime8s: '1000',
          dutyTime8c: '1200',
        }),
        row('farther-open', 37.55),
      ]);
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('ranks currently open facilities across administrative boundaries without sending device coordinates upstream', async () => {
  const result = await nearbySummary(point);
  expect(result?.hospital?.id).toBe('open-pediatrics');
  expect(result?.pharmacy?.id).toBe('open-pharmacy');
  expect(result?.temperature).toBe(17);
  expect(result?.condition).toBe('clear');
  expect(nearbyArea({ lat: 35, lon: -120 })).toBeNull();
});
it('uses holiday hours and never substitutes ordinary weekday hours', async () => {
  holiday = true;
  const result = await nearbySummary(point);
  expect(result?.hospital?.id).toBe('open-pediatrics');
  expect(result?.pharmacy?.id).toBe('open-pharmacy');
  vi.setSystemTime(new Date('2026-11-02T03:00:00Z'));
  const closed = await nearbySummary(point);
  expect(closed?.hospital).toBeNull();
  expect(closed?.pharmacy).toBeNull();
});
it('does not recommend medical facilities if the holiday calendar cannot be confirmed', async () => {
  holidayFailure = true;
  const result = await nearbySummary(point);
  expect(result?.hospital).toBeNull();
  expect(result?.pharmacy).toBeNull();
  expect(result?.temperature).toBe(17);
});
it('stops recommending a facility at its closing minute', async () => {
  vi.setSystemTime(new Date('2026-11-02T09:00:00Z'));
  const result = await nearbySummary(point);
  expect(result?.hospital).toBeNull();
  expect(result?.pharmacy).toBeNull();
});
it('does not substitute a random province station and isolates provider failures', async () => {
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
