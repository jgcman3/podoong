import 'server-only';
import { unstable_cache } from 'next/cache';
import grids from './data/weather-grids.json';
import kindergartenRegions from './data/kindergarten-regions.json';
import {
  medicalFacility,
  kindergartenFacility,
  seoulTime,
  sourceItems,
  text,
  type SourceRow,
} from './public-data';
import type { Facility } from './public-data';

export type MedicalKind = 'hospital' | 'pharmacy';
export const hasPublicDataKey = () =>
  Boolean(process.env.DATA_SERVICE_KEY || process.env.PUBLIC_DATA_SERVICE_KEY);

async function request(path: string, params: Record<string, string>) {
  const key =
    (path.startsWith('1741000/') ? process.env.PLAYGROUND_API_KEY : '') ||
    process.env.DATA_SERVICE_KEY ||
    process.env.PUBLIC_DATA_SERVICE_KEY;
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
const medicalPaths = {
  hospital: 'B552657/HsptlAsembySearchService/getHsptl',
  pharmacy: 'B552657/ErmctInsttInfoInqireService/getParmacy',
};
const medicalDetail = unstable_cache(
  async (kind: MedicalKind, id: string) => {
    const { rows } = sourceItems(
      await request(`${medicalPaths[kind]}BassInfoInqire`, {
        HPID: id,
        _type: 'json',
        pageNo: '1',
        numOfRows: '1',
      }),
    );
    if (!rows[0] || text(rows[0], 'hpid') !== id)
      throw new Error('missing-detail');
    return medicalFacility(rows[0]);
  },
  ['medical-detail-v1'],
  { revalidate: 86400 },
);

// Only approved administrative area names enter the cache. Never patient/family IDs.
export const medicalList = unstable_cache(
  async (kind: MedicalKind, district: string, page: number) => {
    const [province, ...rest] = district.split(' ');
    if (!province || !rest.length) throw new Error('district-required');
    const path = kind === 'hospital' ? 'MdcncListInfoInqire' : 'ListInfoInqire';
    const { rows, total } = sourceItems(
      await request(`${medicalPaths[kind]}${path}`, {
        Q0: province,
        Q1: rest.join(' '),
        _type: 'json',
        pageNo: String(page),
        numOfRows: '10',
      }),
    );
    return {
      facilities: rows.map(medicalFacility),
      total,
      checkedAt: new Date().toISOString(),
    };
  },
  ['medical-list-v1'],
  { revalidate: 86400 },
);

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

export async function medicalResults(
  kind: MedicalKind,
  district: string,
  page: number,
) {
  const now = new Date(),
    today = seoulTime(now);
  const [list, holidays] = await Promise.all([
    medicalList(kind, district, page),
    holidayMonth(today.date.slice(0, 6)).catch(() => null),
  ]);
  const holiday = holidays ? holidays.includes(today.date) : null;
  // List responses omit Sunday/holiday hours. Fetch detail only when needed;
  // each facility is independently cached so pagination does not multiply calls.
  if (holiday || today.day === 7) {
    list.facilities = await Promise.all(
      list.facilities.map(async (facility) => {
        try {
          return await medicalDetail(kind, facility.id);
        } catch {
          return facility;
        }
      }),
    );
  }
  return { ...list, holiday };
}

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

// This source does not offer an address filter. Cache its national pages once,
// then cache each district result, rather than re-downloading for every family.
// Only compact public facility fields enter the shared cache.
const playgroundPage = unstable_cache(
  async (page: number) => {
    const raw = (await request('1741000/pfc3/getPfctInfo3', {
      pageIndex: String(page),
      recordCountPerPage: '1000',
    })) as {
      response?: {
        header?: { resultCode?: unknown };
        body?: { items?: unknown; totalCnt?: unknown; totalPageCnt?: unknown };
      };
    };
    const payload =
      raw.response ?? (raw as unknown as NonNullable<typeof raw.response>);
    const body = payload?.body;
    const { rows, total } = sourceItems({
      response: {
        header: payload?.header,
        body: { ...body, totalCount: body?.totalCnt },
      },
    });
    const pages = Number(body?.totalPageCnt);
    if (
      !Number.isSafeInteger(pages) ||
      pages < 1 ||
      pages > 300 ||
      total > 300000 ||
      !rows.length
    )
      throw new Error('invalid-playground-source');
    return {
      total,
      pages,
      facilities: rows.map((row) => {
        const id = text(row, 'pfctSn'),
          name = text(row, 'pfctNm');
        if (!id || !name) throw new Error('invalid-playground');
        return {
          id,
          name,
          address: [
            text(row, 'ronaAddr') || text(row, 'lotnoAddr'),
            text(row, 'ronaDaddr') || text(row, 'lotnoDaddr'),
          ]
            .filter(Boolean)
            .join(' '),
          phone: '',
          hours: {},
          detail: [
            text(row, 'instlPlaceCdNm'),
            text(row, 'prvtPblcYnCdNm'),
            text(row, 'operYnCdNm'),
          ]
            .filter(Boolean)
            .join(' · '),
        } satisfies Facility;
      }),
    };
  },
  ['playground-national-page-v1'],
  { revalidate: 86400 },
);

export const playgroundList = unstable_cache(
  async (district: string) => {
    const first = await playgroundPage(1),
      found = [...first.facilities];
    for (let start = 2; start <= first.pages; start += 6) {
      const pages = await Promise.all(
        Array.from({ length: Math.min(6, first.pages - start + 1) }, (_, i) =>
          playgroundPage(start + i),
        ),
      );
      for (const page of pages) {
        if (page.total !== first.total || page.pages !== first.pages)
          throw new Error('playground-source-changed');
        found.push(...page.facilities);
      }
    }
    if (
      found.length !== first.total ||
      new Set(found.map((row) => row.id)).size !== first.total
    )
      throw new Error('incomplete-playground-source');
    return [
      ...new Map(
        found
          .filter((row) => row.address.startsWith(`${district} `))
          .map((row) => [row.id, row]),
      ).values(),
    ];
  },
  ['playground-district-v1'],
  { revalidate: 86400 },
);

export const kindergartenList = unstable_cache(
  async (district: string) => {
    const key = process.env.KINDERGARTEN_API_KEY;
    const codes = (kindergartenRegions as Record<string, string[]>)[district];
    if (!key || !codes) throw new Error('kindergarten-not-configured');
    const facilities: Facility[] = [],
      seen = new Set<string>();
    for (let page = 1; page <= 30; page++) {
      const url = new URL(
        'https://e-childschoolinfo.moe.go.kr/api/notice/basicInfo2.do',
      );
      url.search = new URLSearchParams({
        key,
        sidoCode: codes[0],
        sggCode: codes[1],
        pageCnt: '50',
        currentPage: String(page),
      }).toString();
      let payload: {
        status?: string;
        kinderInfo?: SourceRow[];
        currentPage?: number;
      };
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error('source-response');
        payload = await response.json();
      } catch {
        throw new Error('kindergarten-source-unavailable');
      }
      if (
        payload.status !== 'SUCCESS' ||
        !Array.isArray(payload.kinderInfo) ||
        Number(payload.currentPage) !== page
      )
        throw new Error('invalid-kindergarten-response');
      for (const row of payload.kinderInfo) {
        const facility = kindergartenFacility(row);
        if (seen.has(facility.id))
          throw new Error('kindergarten-page-repeated');
        seen.add(facility.id);
        facilities.push(facility);
      }
      if (payload.kinderInfo.length < 50)
        return { facilities, checkedAt: new Date().toISOString() };
    }
    throw new Error('kindergarten-page-limit');
  },
  ['kindergarten-district-v1'],
  { revalidate: 86400 },
);
