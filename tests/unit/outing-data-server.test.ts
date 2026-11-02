import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
import {
  airObservations,
  holidayMonth,
  publicDataRequest,
  weatherGrid,
  weatherObservation,
  weatherSky,
} from '@/features/outing/public-data.server';
const answer = (items: unknown[], total = items.length) => ({
  response: {
    header: { resultCode: '00' },
    body: { totalCount: total, items: { item: items } },
  },
});
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubEnv('OUTING_DATA_SERVICE_KEY', 'synthetic-private-key');
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-02T01:00:00Z'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe('outing public API adapters', () => {
  it('does not expose upstream errors containing the private key', async () => {
    fetcher.mockRejectedValue(
      new Error('https://upstream.test/?key=synthetic-private-key'),
    );
    await expect(publicDataRequest('test', {})).rejects.toThrow(
      'public-source-unavailable',
    );
  });
  it('uses the outing-specific key for weather and holidays without family or location identifiers', async () => {
    fetcher.mockResolvedValue(
      Response.json(answer([{ locdate: '20261102', isHoliday: 'Y' }])),
    );
    expect(await holidayMonth('202611')).toEqual(['20261102']);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get('serviceKey')).toBe('synthetic-private-key');
    expect(url.searchParams.get('solMonth')).toBe('11');
    expect(
      [...url.searchParams.keys()].some((key) =>
        /child|family|user|lat|lon/i.test(key),
      ),
    ).toBe(false);
  });
  it('maps to official weather grids and requests a completed KST hour across midnight', async () => {
    vi.setSystemTime(new Date('2026-11-01T15:05:00Z'));
    expect(weatherGrid('서울특별시 강남구 역삼동')?.label).toBe(
      '서울특별시 강남구',
    );
    expect(weatherGrid('not a supported location')).toBeNull();
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify(answer([{ category: 'T1H', obsrValue: '-2.3' }])),
      ),
    );
    const result = await weatherObservation('서울특별시 강남구 역삼동');
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get('base_date')).toBe('20261101');
    expect(url.searchParams.get('base_time')).toBe('2200');
    expect(result.values.T1H).toBe('-2.3');
  });
  it('does not fabricate an air station or replace missing observations with zero', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify(
          answer([
            {
              stationName: 'Fixture station',
              dataTime: '2026-11-02 10:00',
              pm10Value: '-',
              pm25Value: '0',
            },
          ]),
        ),
      ),
    );
    const [station] = await airObservations('서울특별시');
    expect(station.pm10).toBe('-');
    expect(station.pm25).toBe('0');
    expect(station.station).toBe('Fixture station');
  });
});
it('selects the next sky forecast from a published KST slot across midnight', async () => {
  vi.setSystemTime(new Date('2026-11-01T15:05:00Z'));
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify(
        answer([
          {
            category: 'SKY',
            fcstDate: '20261101',
            fcstTime: '2300',
            fcstValue: '4',
          },
          {
            category: 'SKY',
            fcstDate: '20261102',
            fcstTime: '0100',
            fcstValue: '3',
          },
          {
            category: 'SKY',
            fcstDate: '20261102',
            fcstTime: '0200',
            fcstValue: '1',
          },
        ]),
      ),
    ),
  );
  expect(await weatherSky('서울특별시 강남구 역삼동')).toBe('3');
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.pathname).toContain('getUltraSrtFcst');
  expect(url.searchParams.get('base_date')).toBe('20261101');
  expect(url.searchParams.get('base_time')).toBe('2330');
});
