import 'server-only';
import { unstable_cache } from 'next/cache';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { residenceRegions } from '@/features/family/residence-regions';
import {
  coordinates,
  text,
  type Facility,
  type SourceRow,
} from './public-data';

const parser = new XMLParser({
  parseTagValue: false,
  ignoreAttributes: true,
  isArray: (_name, path) => path === 'response.item',
});

function facilitiesFromXml(xml: string, region: string): Facility[] {
  if (
    Buffer.byteLength(xml, 'utf8') > 8 * 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new Error('invalid-childcare-source');
  const payload = parser.parse(xml) as { response?: SourceRow | string };
  if (payload.response === '') return [];
  const response = payload.response;
  if (!response || typeof response !== 'object' || text(response, 'errcode'))
    throw new Error('childcare-source-unavailable');
  const items = response.item;
  if (items === undefined) throw new Error('invalid-childcare-source');
  if (!Array.isArray(items) || items.length > 10000)
    throw new Error('invalid-childcare-source');
  const seen = new Set<string>();
  return items.map((value: unknown) => {
    if (!value || typeof value !== 'object')
      throw new Error('invalid-childcare-source');
    const row = value as SourceRow;
    const id = text(row, 'stcode'),
      name = text(row, 'crname'),
      address = text(row, 'craddr');
    // Development keys can return numbered example fields. Never publish them.
    if (
      !/^\d{11}$/.test(id) ||
      !id.startsWith(region) ||
      !name ||
      /^\d+$/.test(name) ||
      address.length < 4 ||
      /^\d+$/.test(address) ||
      seen.has(id)
    )
      throw new Error('invalid-childcare-source');
    seen.add(id);
    // Explicitly omit director names, staff statistics, the key and raw XML.
    return {
      id,
      name,
      address,
      phone: text(row, 'crtelno') || text(row, 'crtel'),
      hours: {},
      detail: [text(row, 'crtypename'), text(row, 'crstatusname')]
        .filter(Boolean)
        .join(' · '),
      coordinates: coordinates(row.la, row.lo),
    } satisfies Facility;
  });
}

async function requestChildcare(
  service: 'cpmsapi021' | 'cpmsapi030',
  key: string,
  region: string,
) {
  const url = new URL(
    `https://api.childcare.go.kr/mediate/rest/${service}/${service}/request`,
  );
  url.search = new URLSearchParams({ key, arcode: region }).toString();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (response.status >= 500 && attempt === 0) continue;
      if (!response.ok) throw new Error('source-response');
      return facilitiesFromXml(await response.text(), region);
    } catch {
      if (attempt === 1) break;
    }
  }
  // Provider errors can include URLs or credentials. Expose neither.
  throw new Error('childcare-source-unavailable');
}

const listForRegion = unstable_cache(
  async (region: string) => {
    const key = process.env.CHILDCARE_API_KEY;
    if (!key) throw new Error('childcare-not-configured');
    return {
      facilities: await requestChildcare('cpmsapi021', key, region),
      checkedAt: new Date().toISOString(),
    };
  },
  ['childcare-national-list-v1'],
  { revalidate: 86400 },
);

const detailsForRegion = unstable_cache(
  async (region: string) => {
    const key = process.env.CHILDCARE_DETAIL_API_KEY;
    if (!key) throw new Error('childcare-details-not-configured');
    return requestChildcare('cpmsapi030', key, region);
  },
  ['childcare-regional-basic-v1'],
  { revalidate: 86400 },
);

export async function childcareList(district: string) {
  const codes = new Set(
    residenceRegions
      .filter(
        (region) =>
          region.fullName.split(' ').slice(0, -1).join(' ') === district,
      )
      .map((region) => region.cityCode),
  );
  if (codes.size !== 1) throw new Error('childcare-region-unavailable');
  const region = [...codes][0];
  const [list, details] = await Promise.all([
    listForRegion(region),
    process.env.CHILDCARE_DETAIL_API_KEY
      ? detailsForRegion(region).catch(() => [])
      : [],
  ]);
  const byId = new Map(details.map((facility) => [facility.id, facility]));
  return {
    checkedAt: list.checkedAt,
    facilities: list.facilities.map((facility) => {
      const detail = byId.get(facility.id);
      if (!detail) return facility;
      return {
        ...facility,
        coordinates: detail.coordinates,
        detail: detail.detail,
        phone: detail.phone || facility.phone,
      };
    }),
  };
}
