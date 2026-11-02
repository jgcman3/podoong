import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { childcareList } from '@/features/community/childcare.server';
import { loadFacilityRows } from '@/features/community/facility-listing.server';
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
  officialAreaPoint,
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
  vi.stubEnv('CHILDCARE_API_KEY', 'synthetic-childcare-list-key');
  vi.stubEnv('CHILDCARE_DETAIL_API_KEY', 'synthetic-childcare-detail-key');
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
  it('defaults hospital searches to the official pediatric specialty and leaves all-specialty and pharmacy searches unrestricted', async () => {
    fetcher.mockImplementation(
      async (url: URL) =>
        new Response(
          JSON.stringify(
            answer(
              url.pathname.includes('SpcdeInfoService')
                ? []
                : [
                    {
                      hpid: 'mixed-clinic',
                      dutyName: 'Fixture internal medicine clinic',
                      dgidIdName: '내과,소아청소년과',
                    },
                  ],
            ),
          ),
        ),
    );
    for (const [kind, specialty, expected] of [
      ['hospital', undefined, 'D002'],
      ['hospital', 'all', null],
      ['pharmacy', undefined, null],
    ] as const) {
      fetcher.mockClear();
      const result = await medicalResults(kind, '서울특별시 용산구', 1, {
        specialty,
      });
      const listRequest = fetcher.mock.calls
        .map(([url]) => url as URL)
        .find((url) => url.pathname.endsWith('ListInfoInqire'))!;
      expect(listRequest.searchParams.get('QD')).toBe(expected);
      expect(result.facilities[0].name).toBe(
        'Fixture internal medicine clinic',
      );
    }
  });

  it('uses the actual available reference area instead of pretending that a district point is a dong point', () => {
    const point = officialAreaPoint('서울특별시 강남구 역삼동');
    expect(point?.label).toBe('서울특별시 강남구');
    expect(point?.coordinates.lat).toBeGreaterThan(37);
  });
  it('ranks the entire medical district before paging and filters opening hours across all pages', async () => {
    const far = Array.from({ length: 500 }, (_, i) => ({
      hpid: `far-${i}`,
      dutyName: 'Far fixture',
      wgs84Lat: 37.6,
      wgs84Lon: 127.1,
      dutyTime1s: '0900',
      dutyTime1c: '0930',
    }));
    const near = {
      hpid: 'near',
      dutyName: 'Near fixture',
      wgs84Lat: 37.5,
      wgs84Lon: 127,
      dutyTime1s: '0900',
      dutyTime1c: '1800',
    };
    fetcher.mockImplementation(async (url: URL) => {
      if (url.pathname.includes('SpcdeInfoService'))
        return new Response(JSON.stringify(answer([])));
      if (url.searchParams.has('HPID')) {
        const id = url.searchParams.get('HPID');
        return new Response(
          JSON.stringify(
            answer([
              id === 'near' ? near : far.find((row) => row.hpid === id)!,
            ]),
          ),
        );
      }
      return new Response(
        JSON.stringify(
          answer(url.searchParams.get('pageNo') === '1' ? far : [near], 501),
        ),
      );
    });
    const result = await medicalResults('hospital', '서울특별시 강남구', 1, {
      origin: { lat: 37.5, lon: 127 },
    });
    expect(result.facilities[0].id).toBe('near');
    expect(result.total).toBe(501);
    const filtered = await medicalResults('hospital', '서울특별시 강남구', 1, {
      origin: { lat: 37.5, lon: 127 },
      openOnly: true,
    });
    expect(filtered.facilities.map((row) => row.id)).toEqual(['near']);
    expect(filtered.total).toBe(1);
  });
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

describe('childcare facilities', () => {
  const escape = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  const xml = (rows: Record<string, string>[]) =>
    `<response>${rows
      .map(
        (row) =>
          `<item>${Object.entries(row)
            .map(([name, value]) => `<${name}>${escape(value)}</${name}>`)
            .join('')}</item>`,
      )
      .join('')}</response>`;
  const first = {
    stcode: '11170000100',
    crname: 'Fixture & daycare',
    craddr: '서울특별시 용산구 테스트로 1',
    crtel: '02-000-0000',
  };
  it('ranks the full daycare region before slicing successive ten-item pages', async () => {
    const origin = officialAreaPoint('서울특별시 용산구')!.coordinates;
    const rows = Array.from({ length: 25 }, (_, i) => ({
      stcode: `11170${String(i).padStart(6, '0')}`,
      crname: `Fixture daycare ${i}`,
      craddr: '서울특별시 용산구 테스트로',
      la: String(origin.lat + (i + 1) * 0.0001),
      lo: String(origin.lon),
    })).reverse();
    fetcher.mockImplementation(async () => new Response(xml(rows)));
    const first = await loadFacilityRows({
      kind: 'daycare',
      area: '서울특별시 용산구',
      locale: 'ko',
      page: 1,
    });
    const second = await loadFacilityRows({
      kind: 'daycare',
      area: '서울특별시 용산구',
      locale: 'ko',
      page: 2,
    });
    expect(first.unavailable).toBe(false);
    expect(first.total).toBe(25);
    expect(first.facilities.map((r) => r.name)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Fixture daycare ${i}`),
    );
    expect(second.facilities.map((r) => r.name)).toEqual(
      Array.from({ length: 10 }, (_, i) => `Fixture daycare ${i + 10}`),
    );
  });
  it('joins regional basic details onto the public list by ID and omits extra facilities, echoed keys and staff names', async () => {
    fetcher.mockImplementation(
      async (url: URL) =>
        new Response(
          xml(
            url.pathname.includes('cpmsapi021')
              ? [first]
              : [
                  {
                    ...first,
                    crname: 'Different detail name',
                    crtypename: '국공립',
                    crstatusname: '정상',
                    la: '37.55',
                    lo: '126.97',
                    crtelno: '02-000-0001',
                    CRREPNAME: 'synthetic-private-director',
                    key: 'synthetic-private-key',
                  },
                  { ...first, stcode: '11170000077', crstatusname: '휴지' },
                ],
          ),
        ),
    );
    const result = await childcareList('서울특별시 용산구');
    expect(result.facilities).toHaveLength(1);
    expect(result.facilities[0]).toMatchObject({
      id: first.stcode,
      name: 'Fixture & daycare',
      phone: '02-000-0001',
      coordinates: { lat: 37.55, lon: 126.97 },
      detail: '국공립 · 정상',
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-private');
    const urls = fetcher.mock.calls.map(([url]) => url as URL);
    expect(urls).toHaveLength(2);
    expect(urls.map((url) => url.searchParams.get('key'))).toEqual(
      expect.arrayContaining([
        'synthetic-childcare-list-key',
        'synthetic-childcare-detail-key',
      ]),
    );
    for (const url of urls) {
      expect(url.protocol).toBe('https:');
      expect(url.searchParams.get('arcode')).toBe('11170');
      expect(url.searchParams.has('stcode')).toBe(false);
      expect(url.searchParams.has('child')).toBe(false);
    }
  });
  it('still shows real list entries when detail service fails instead of adding example coordinates', async () => {
    fetcher.mockImplementation(
      async (url: URL) =>
        new Response(
          url.pathname.includes('cpmsapi021')
            ? xml([first])
            : xml([
                {
                  stcode: '03',
                  crname: '04',
                  craddr: '08',
                  la: '19',
                  lo: '20',
                },
              ]),
        ),
    );
    const result = await childcareList('서울특별시 용산구');
    expect(result.facilities).toHaveLength(1);
    expect(result.facilities[0]).toMatchObject({
      id: first.stcode,
      name: first.crname,
      phone: first.crtel,
    });
    expect(result.facilities[0].coordinates).toBeUndefined();
  });
  it('rejects provider authentication errors and duplicate list entries without exposing their payload', async () => {
    vi.stubEnv('CHILDCARE_DETAIL_API_KEY', '');
    fetcher.mockResolvedValue(
      new Response(
        '<response><errcode>INFO-100</errcode><errmsg>synthetic-private-key</errmsg></response>',
      ),
    );
    await expect(childcareList('서울특별시 용산구')).rejects.toThrow(
      'childcare-source-unavailable',
    );
    fetcher.mockImplementation(async () => new Response(xml([first, first])));
    await expect(childcareList('서울특별시 용산구')).rejects.toThrow(
      'childcare-source-unavailable',
    );
  });
  it('rejects malformed or DTD XML and does not send unknown regions upstream', async () => {
    vi.stubEnv('CHILDCARE_DETAIL_API_KEY', '');
    for (const source of [
      '<response><item></response>',
      '<!DOCTYPE response [<!ENTITY unsafe "text">]><response/>',
    ]) {
      fetcher.mockImplementation(async () => new Response(source));
      await expect(childcareList('서울특별시 용산구')).rejects.toThrow(
        'childcare-source-unavailable',
      );
    }
    fetcher.mockClear();
    await expect(childcareList('untrusted arbitrary region')).rejects.toThrow(
      'childcare-region-unavailable',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
