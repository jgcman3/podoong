import 'server-only';
import { unstable_cache } from 'next/cache';
import areaPoints from './data/area-points.json';
import {
  publicDataRequest,
  airObservations,
  weatherObservation,
  weatherSky,
  holidayMonth,
} from './public-data.server';
import {
  medicalFacility,
  openingStatus,
  seoulTime,
  nearbyFacilities,
  sourceItems,
  weatherCondition,
  positiveMeasurement,
  airQuality,
  type Coordinates,
  type Facility,
} from './public-data';
import { diaperFacilities } from './diaper-map.server';

async function source(path: string, params: Record<string, string>) {
  return sourceItems(
    await publicDataRequest(path, { _type: 'json', ...params }),
  );
}
type MedicalKind = 'hospital' | 'pharmacy';
// Nationwide public catalogues are shared across users; no device location is
// sent to the medical provider or used as a medical cache key.
const medicalPage = unstable_cache(
  async (kind: MedicalKind, page: number) => {
    const path =
      kind === 'hospital'
        ? 'B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire'
        : 'B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire';
    const { rows, total } = await source(path, {
      ...(kind === 'hospital' ? { QD: 'D002' } : {}),
      pageNo: String(page),
      numOfRows: '1000',
    });
    return { total, facilities: rows.map(medicalFacility) };
  },
  ['outing-medical-hours-v1'],
  { revalidate: 86400 },
);
async function medicalFacilities(kind: MedicalKind) {
  const first = await medicalPage(kind, 1);
  if (first.total > 50000) throw Error('invalid-medical-count');
  const all: Facility[] = [...first.facilities],
    pages = Math.ceil(first.total / 1000);
  for (let start = 2; start <= pages; start += 4) {
    const group = await Promise.all(
      Array.from({ length: Math.min(4, pages - start + 1) }, (_, i) =>
        medicalPage(kind, start + i),
      ),
    );
    for (const part of group) {
      if (part.total !== first.total) throw Error('medical-source-changed');
      all.push(...part.facilities);
    }
  }
  if (
    all.length !== first.total ||
    new Set(all.map((row) => row.id)).size !== first.total
  )
    throw Error('incomplete-medical-source');
  return all;
}

export function nearbyArea(point: Coordinates) {
  const candidates = Object.entries(areaPoints)
    .filter(([label]) => label.split(' ').length >= 3)
    .map(([label, [lat, lon]]) => ({
      id: label,
      name: label,
      address: label,
      phone: '',
      hours: {},
      coordinates: { lat, lon },
    }));
  const nearest = nearbyFacilities(candidates, point)[0];
  return nearest && nearest.distanceKm !== undefined && nearest.distanceKm <= 25
    ? nearest.name
    : null;
}
function nearest(rows: Facility[], point: Coordinates) {
  return (
    nearbyFacilities(
      rows.filter((row) => row.coordinates),
      point,
    ).find((row) => row.distanceKm !== undefined && row.distanceKm <= 20) ??
    null
  );
}
export async function nearbySummary(point: Coordinates) {
  const area = nearbyArea(point);
  if (!area) return null;
  const month = seoulTime().date.slice(0, 6);
  const [weather, sky, air, hospitals, drugstores, holidays] =
    await Promise.all([
      weatherObservation(area).catch(() => null),
      weatherSky(area).catch(() => undefined),
      airObservations(area.split(' ')[0]).catch(() => []),
      medicalFacilities('hospital').catch(() => []),
      medicalFacilities('pharmacy').catch(() => []),
      holidayMonth(month).catch(() => null),
    ]);
  // Use only a matching local station; never substitute an arbitrary province station.
  const station = [...area.split(' ')]
    .reverse()
    .map((name) => air.find((row) => row.station === name))
    .find(Boolean);
  const now = new Date(),
    local = seoulTime(now);
  const holiday =
    holidays && local.date.slice(0, 6) === month
      ? holidays.includes(local.date)
      : null;
  const open = (rows: Facility[]) =>
    rows.filter((row) => openingStatus(row.hours, holiday, now) === 'open');
  const temperature = Number(weather?.values.T1H);
  const dust = airQuality(positiveMeasurement(station?.pm10), 'pm10');
  return {
    condition: weatherCondition(weather?.values.PTY, sky),
    temperature:
      weather?.values.T1H !== undefined &&
      Number.isFinite(temperature) &&
      temperature > -80 &&
      temperature < 60
        ? temperature
        : null,
    dust,
    station: station?.station ?? null,
    hospital: nearest(open(hospitals), point),
    pharmacy: nearest(open(drugstores), point),
    diaper: nearest(diaperFacilities, point),
  };
}
export type NearbySummary = NonNullable<
  Awaited<ReturnType<typeof nearbySummary>>
>;
