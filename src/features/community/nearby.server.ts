import 'server-only';
import { unstable_cache } from 'next/cache';
import areaPoints from './data/area-points.json';
import {
  publicDataRequest,
  airObservations,
  weatherObservation,
  weatherSky,
} from './public-data.server';
import {
  coordinates,
  medicalFacility,
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
const pediatricPage = unstable_cache(
  async (page: number) => {
    const { rows, total } = await source(
      'B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire',
      { QD: 'D002', pageNo: String(page), numOfRows: '1000' },
    );
    return {
      total,
      facilities: rows
        .map(medicalFacility)
        .map(({ id, name, address, phone, coordinates }) => ({
          id,
          name,
          address,
          phone,
          coordinates,
          hours: {},
        })),
    };
  },
  ['nearby-pediatrics-v1'],
  { revalidate: 86400 },
);
async function pediatricFacilities() {
  const first = await pediatricPage(1);
  if (first.total > 30000) throw Error('invalid-pediatrics-count');
  const all: Facility[] = [...first.facilities];
  for (let start = 2; start <= Math.ceil(first.total / 1000); start += 4) {
    const group = await Promise.all(
      Array.from(
        { length: Math.min(4, Math.ceil(first.total / 1000) - start + 1) },
        (_, i) => pediatricPage(start + i),
      ),
    );
    for (const part of group) {
      if (part.total !== first.total) throw Error('pediatrics-source-changed');
      all.push(...part.facilities);
    }
  }
  if (all.length !== first.total) throw Error('incomplete-pediatrics');
  return all;
}
// Public results are shared by ~1 km grid, never by a user or precise GPS point.
const pharmacies = unstable_cache(
  async (lat: number, lon: number) => {
    const { rows } = await source(
      'B552657/ErmctInsttInfoInqireService/getParmacyLcinfoInqire',
      {
        WGS84_LAT: String(lat),
        WGS84_LON: String(lon),
        numOfRows: '100',
        pageNo: '1',
      },
    );
    return rows.map((row) => ({
      ...medicalFacility(row),
      coordinates: coordinates(row.latitude, row.longitude),
    }));
  },
  ['nearby-pharmacies-v1'],
  { revalidate: 3600 },
);

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
  const [weather, sky, air, hospitals, drugstores] = await Promise.all([
    weatherObservation(area).catch(() => null),
    weatherSky(area).catch(() => undefined),
    airObservations(area.split(' ')[0]).catch(() => []),
    pediatricFacilities().catch(() => []),
    pharmacies(
      Math.round(point.lat * 100) / 100,
      Math.round(point.lon * 100) / 100,
    ).catch(() => []),
  ]);
  // Use only a matching local station; never substitute an arbitrary province station.
  const station = [...area.split(' ')]
    .reverse()
    .map((name) => air.find((row) => row.station === name))
    .find(Boolean);
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
    hospital: nearest(hospitals, point),
    pharmacy: nearest(drugstores, point),
    diaper: nearest(diaperFacilities, point),
  };
}
export type NearbySummary = NonNullable<
  Awaited<ReturnType<typeof nearbySummary>>
>;
