export type SourceRow = Record<string, unknown>;
export type Coordinates = { lat: number; lon: number };
export type Facility = {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: Record<string, string>;
  coordinates?: Coordinates;
  distanceKm?: number;
};
export function text(row: SourceRow, field: string) {
  const value = row[field];
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}
export function sourceItems(payload: unknown): {
  rows: SourceRow[];
  total: number;
} {
  const data = payload as {
    response?: {
      header?: { resultCode?: unknown };
      body?: {
        items?: { item?: unknown } | unknown[] | '';
        totalCount?: unknown;
      };
    };
  };
  const response = data?.response;
  if (!['00', '0'].includes(String(response?.header?.resultCode)))
    throw new Error('public-source-unavailable');
  const body = response?.body;
  if (!body || body.totalCount === undefined || body.totalCount === null)
    throw new Error('invalid-public-source');
  const items = Array.isArray(body?.items)
    ? body.items
    : body?.items && typeof body.items === 'object'
      ? body.items.item
      : [];
  const rows = Array.isArray(items)
    ? items
    : items && typeof items === 'object'
      ? [items]
      : [];
  const total = Number(body?.totalCount ?? rows.length);
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    rows.some((row) => !row || typeof row !== 'object')
  )
    throw new Error('invalid-public-source');
  return { rows: rows as SourceRow[], total };
}
export function medicalFacility(row: SourceRow): Facility {
  const id = text(row, 'hpid'),
    name = text(row, 'dutyName');
  if (!id || !name) throw new Error('invalid-facility');
  const hours: Record<string, string> = {};
  for (let day = 1; day <= 8; day++)
    for (const end of ['s', 'c']) {
      const field = `dutyTime${day}${end}`;
      if (text(row, field)) hours[field] = text(row, field);
    }
  return {
    id,
    name,
    address: text(row, 'dutyAddr'),
    phone: text(row, 'dutyTel1'),
    hours,
    coordinates: coordinates(row.wgs84Lat, row.wgs84Lon),
  };
}
export function seoulTime(now = new Date()) {
  const local = new Date(now.getTime() + 9 * 3600000);
  return {
    date: local.toISOString().slice(0, 10).replaceAll('-', ''),
    day: local.getUTCDay() || 7,
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}
function minutes(value: string | undefined) {
  if (!value || !/^\d{1,4}$/.test(value)) return null;
  const full = value.padStart(4, '0'),
    hour = Number(full.slice(0, 2)),
    minute = Number(full.slice(2));
  return hour <= 24 && minute < 60 && (hour < 24 || minute === 0)
    ? hour * 60 + minute
    : null;
}
// Published hours describe scheduled opening, not live availability. Missing hours
// (including holiday hours) never imply closed. Overnight carry-over is unknown.
export function openingStatus(
  hours: Facility['hours'],
  holiday: boolean | null,
  now = new Date(),
): 'open' | 'closed' | 'before' | 'unknown' {
  if (holiday === null) return 'unknown';
  const { day, minute } = seoulTime(now),
    index = holiday ? 8 : day;
  const start = minutes(hours[`dutyTime${index}s`]),
    end = minutes(hours[`dutyTime${index}c`]);
  if (start === null || end === null || start === end || end < start)
    return 'unknown';
  // This describes today's posted schedule, not live availability.
  if (minute < start) return 'before';
  return minute < end ? 'open' : 'closed';
}
export function facilityArea(address: string) {
  const parenthetical = address.match(/\(([^)]+)\)/)?.[1] ?? '';
  const dong =
    /(?:^|[\s,])([가-힣0-9·]+(?:동|읍|면))(?=$|[\s,])/.exec(
      parenthetical,
    )?.[1] ??
    address
      .split(/\s+/)
      .find((part) => /^[가-힣0-9·]+(?:동|읍|면)$/.test(part));
  const district = address
    .split(/\s+/)
    .filter((part) => /^[가-힣]+[구군]$/.test(part))
    .at(-1);
  return (
    dong ||
    district ||
    address.split(/\s+/).find((part) => /시$/.test(part)) ||
    ''
  );
}
export function mapLinks(facility: Pick<Facility, 'name' | 'address'>) {
  const query = encodeURIComponent(
    [facility.name, facilityArea(facility.address)].filter(Boolean).join(' '),
  );
  return {
    naver: `https://map.naver.com/p/search/${query}`,
    kakao: `https://map.kakao.com/link/search/${query}`,
  };
}
export function coordinates(
  latitude: unknown,
  longitude: unknown,
): Coordinates | undefined {
  if (
    latitude === '' ||
    longitude === '' ||
    latitude == null ||
    longitude == null
  )
    return undefined;
  const lat = Number(latitude),
    lon = Number(longitude);
  return Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat > 30 &&
    lat < 45 &&
    lon > 120 &&
    lon < 135
    ? { lat, lon }
    : undefined;
}
export function distanceKm(a: Coordinates, b: Coordinates) {
  const radians = (n: number) => (n * Math.PI) / 180;
  const value =
    Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(radians(b.lon - a.lon) / 2) ** 2;
  return (
    6371 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, value)), Math.sqrt(Math.max(0, 1 - value)))
  );
}
export function nearbyFacilities(rows: Facility[], origin?: Coordinates) {
  return rows
    .map((row) => ({
      ...row,
      distanceKm:
        origin && row.coordinates
          ? distanceKm(origin, row.coordinates)
          : undefined,
    }))
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}
export function distanceLabel(km: number, ko: boolean) {
  if (km < 0.1) return ko ? '약 100m 이내' : 'Within ~100 m';
  if (km < 1) return `${ko ? '약 ' : '~'}${Math.round(km * 10) * 100} m`;
  return `${ko ? '약 ' : '~'}${km.toFixed(1)} km`;
}
export function positiveMeasurement(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '')
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// AirKorea concentration bands (µg/m³); missing readings have no grade.
export function airQuality(value: number | null, kind: 'pm10' | 'pm25') {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  const limits = kind === 'pm10' ? [30, 80, 150] : [15, 35, 75];
  const index = limits.findIndex((limit) => value <= limit);
  return (['good', 'moderate', 'bad', 'very-bad'] as const)[
    index < 0 ? 3 : index
  ];
}
export function weatherCondition(precipitation?: string, sky?: string) {
  if (['1', '5'].includes(precipitation ?? '')) return 'rain';
  if (['2', '6'].includes(precipitation ?? '')) return 'sleet';
  if (['3', '7'].includes(precipitation ?? '')) return 'snow';
  if (precipitation && precipitation !== '0') return null;
  if (sky === '1') return 'clear';
  if (sky === '3') return 'cloudy';
  if (sky === '4') return 'overcast';
  return null;
}
