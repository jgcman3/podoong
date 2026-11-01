import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
import {
  airObservations,
  holidayMonth,
  medicalList,
  medicalResults,
  kindergartenList,
  playgroundList,
  weatherGrid,
  weatherObservation,
} from '@/features/community/public-data.server';

const answer = (items: unknown[], total = items.length) => ({
  response: {
    header: { resultCode: '00' },
    body: { totalCount: total, items: { item: items } },
  },
});
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubEnv('PUBLIC_DATA_SERVICE_KEY', 'synthetic-private-key');
  vi.stubEnv('KINDERGARTEN_API_KEY', 'synthetic-kindergarten-key');
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
describe('public API adapters', () => {
  it('uses official kindergarten region codes and removes the source-echoed key before caching', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'SUCCESS',
          currentPage: 1,
          kinderInfo: [
            {
              key: 'synthetic-kindergarten-key',
              kindercode: 'fixture',
              kindername: 'Fixture kindergarten',
            },
          ],
        }),
      ),
    );
    const result = await kindergartenList('서울특별시 강남구');
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('sggCode')).toBe(
      '11680',
    );
    expect(result.facilities).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('synthetic-kindergarten-key');
  });
  it('sends only the selected district to medical APIs, preserves page counts, and returns no credential', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify(
          answer([{ hpid: 'fixture', dutyName: 'Fixture clinic' }], 29),
        ),
      ),
    );
    const result = await medicalList('hospital', '경기도 수원시 영통구', 2);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get('Q0')).toBe('경기도');
    expect(url.searchParams.get('Q1')).toBe('수원시 영통구');
    expect(url.searchParams.get('pageNo')).toBe('2');
    expect(result.total).toBe(29);
    expect(JSON.stringify(result)).not.toContain('synthetic-private-key');
  });
  it('does not expose URLs or upstream errors containing the secret', async () => {
    fetcher.mockRejectedValue(
      new Error('https://upstream.example/?serviceKey=synthetic-private-key'),
    );
    await expect(holidayMonth('202611')).rejects.toThrow(
      /^public-source-unavailable$/,
    );
  });
  it('keeps the facility list usable when holidays fail, with unknown opening status', async () => {
    fetcher.mockImplementation(async (url: URL) =>
      url.pathname.includes('SpcdeInfoService')
        ? new Response('{}', { status: 503 })
        : new Response(
            JSON.stringify(
              answer([{ hpid: 'fixture', dutyName: 'Fixture pharmacy' }]),
            ),
          ),
    );
    const result = await medicalResults('pharmacy', '서울특별시 강남구', 1);
    expect(result.holiday).toBeNull();
    expect(result.facilities).toHaveLength(1);
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
  it('reads the playground source root schema and requires the entire national snapshot before filtering a district', async () => {
    fetcher.mockImplementation(async (url: URL) => {
      const page = Number(url.searchParams.get('pageIndex'));
      return new Response(
        JSON.stringify({
          header: { resultCode: '00' },
          body: {
            totalCnt: '2',
            totalPageCnt: '2',
            items: [
              {
                pfctSn: String(page),
                pfctNm: 'Fixture playground',
                ronaAddr:
                  page === 1
                    ? '서울특별시 강남구 테스트로 1'
                    : '부산광역시 중구 테스트로 2',
              },
            ],
          },
        }),
      );
    });
    expect(await playgroundList('서울특별시 강남구')).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
