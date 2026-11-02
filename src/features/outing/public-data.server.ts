import 'server-only';
import { unstable_cache } from 'next/cache';
import grids from './data/weather-grids.json';
import { sourceItems, text, type SourceRow } from './public-data';

async function request(path: string, params: Record<string, string>) {
  const key = process.env.OUTING_DATA_SERVICE_KEY;
  if (!key) throw new Error('public-source-not-configured');
  const url = new URL(`https://apis.data.go.kr/${path}`);
  url.search = new URLSearchParams({ serviceKey: key, ...params }).toString();
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('source-response');
    return (await response.json()) as unknown;
  } catch {
    // Do not leak a request URL, API key, or the upstream error payload.
    throw new Error('public-source-unavailable');
  }
}
export { request as publicDataRequest };

export const holidayMonth = unstable_cache(
  async (month: string) => {
    if (!/^\d{6}$/.test(month)) throw new Error('invalid-month');
    const { rows, total } = sourceItems(
      await request('B090041/openapi/service/SpcdeInfoService/getRestDeInfo', {
        solYear: month.slice(0, 4),
        solMonth: month.slice(4),
        _type: 'json',
        pageNo: '1',
        numOfRows: '100',
      }),
    );
    if (rows.length !== total) throw new Error('incomplete-holidays');
    return rows
      .filter((row) => text(row, 'isHoliday') === 'Y')
      .map((row) => text(row, 'locdate'));
  },
  ['korean-holidays-v1'],
  { revalidate: 86400 },
);

export function weatherGrid(area: string) {
  const catalogue = grids as Record<string, number[]>;
  const parts = area.split(' ');
  while (parts.length) {
    const label = parts.join(' '),
      grid = catalogue[label];
    if (grid) return { label, nx: grid[0], ny: grid[1] };
    parts.pop();
  }
  return null;
}
export const weatherObservation = unstable_cache(
  async (area: string) => {
    const grid = weatherGrid(area);
    if (!grid) throw new Error('weather-area-unavailable');
    // KMA ultra-short observations are published after the hour. Use a completed
    // observation window; subtracting 70 minutes also handles the KST date boundary.
    const slot = new Date(Date.now() + 9 * 3600000 - 70 * 60000);
    const date = slot.toISOString().slice(0, 10).replaceAll('-', '');
    const time = `${String(slot.getUTCHours()).padStart(2, '0')}00`;
    const { rows } = sourceItems(
      await request('1360000/VilageFcstInfoService_2.0/getUltraSrtNcst', {
        base_date: date,
        base_time: time,
        nx: String(grid.nx),
        ny: String(grid.ny),
        dataType: 'JSON',
        pageNo: '1',
        numOfRows: '20',
      }),
    );
    if (!rows.length) throw new Error('weather-observation-missing');
    return {
      label: grid.label,
      date,
      time,
      values: Object.fromEntries(
        rows.map((row) => [text(row, 'category'), text(row, 'obsrValue')]),
      ) as Record<string, string>,
    };
  },
  ['kma-observation-v1'],
  { revalidate: 600 },
);

// Ultra-short forecasts supply SKY; current observations do not.
export const weatherSky = unstable_cache(
  async (area: string) => {
    const grid = weatherGrid(area);
    if (!grid) throw new Error('weather-area-unavailable');
    const slot = new Date(Date.now() + 9 * 3600000 - 45 * 60000);
    const { rows } = sourceItems(
      await request('1360000/VilageFcstInfoService_2.0/getUltraSrtFcst', {
        base_date: slot.toISOString().slice(0, 10).replaceAll('-', ''),
        base_time: String(slot.getUTCHours()).padStart(2, '0') + '30',
        nx: String(grid.nx),
        ny: String(grid.ny),
        dataType: 'JSON',
        pageNo: '1',
        numOfRows: '1000',
      }),
    );
    const now = new Date(Date.now() + 9 * 3600000).toISOString();
    const target =
      now.slice(0, 10).replaceAll('-', '') + now.slice(11, 13) + '00';
    const sky = rows
      .filter((row) => text(row, 'category') === 'SKY')
      .filter((row) => text(row, 'fcstDate') + text(row, 'fcstTime') >= target)
      .sort((a, b) =>
        (text(a, 'fcstDate') + text(a, 'fcstTime')).localeCompare(
          text(b, 'fcstDate') + text(b, 'fcstTime'),
        ),
      )[0];
    return sky ? text(sky, 'fcstValue') : undefined;
  },
  ['kma-sky-v1'],
  { revalidate: 600 },
);

const airProvinces: Record<string, string> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};
export const airObservations = unstable_cache(
  async (province: string) => {
    const name = airProvinces[province];
    if (!name) throw new Error('air-area-unavailable');
    const { rows, total } = sourceItems(
      await request('B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty', {
        sidoName: name,
        returnType: 'json',
        ver: '1.3',
        numOfRows: '500',
        pageNo: '1',
      }),
    );
    if (!rows.length || rows.length !== total)
      throw new Error('air-observation-missing');
    return rows.map((row: SourceRow) => ({
      station: text(row, 'stationName'),
      time: text(row, 'dataTime'),
      pm10: text(row, 'pm10Value'),
      pm25: text(row, 'pm25Value'),
    }));
  },
  ['airkorea-observation-v1'],
  { revalidate: 1800 },
);
