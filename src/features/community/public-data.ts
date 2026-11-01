export type SourceRow = Record<string, unknown>;
export type Facility = {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: Record<string, string>;
  detail?: string;
  diaperTable?: boolean;
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
    detail: text(row, 'dgidIdName'),
  };
}
export function kindergartenFacility(row: SourceRow): Facility {
  const id = text(row, 'kindercode'),
    name = text(row, 'kindername');
  if (!id || !name) throw new Error('invalid-kindergarten');
  // Upstream includes a field named key and personal principal/representative
  // names. Whitelist only the public fields needed by the facility card.
  return {
    id,
    name,
    address: text(row, 'addr'),
    phone: text(row, 'telno'),
    hours: {},
    detail: [
      text(row, 'establish'),
      text(row, 'opertime'),
      text(row, 'pbnttmng'),
    ]
      .filter(Boolean)
      .join(' · '),
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
  if (!value || !/^\d{3,4}$/.test(value)) return null;
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
): 'open' | 'closed' | 'unknown' {
  if (holiday === null) return 'unknown';
  const { day, minute } = seoulTime(now),
    index = holiday ? 8 : day;
  const start = minutes(hours[`dutyTime${index}s`]),
    end = minutes(hours[`dutyTime${index}c`]);
  if (start === null || end === null || start === end || end < start)
    return 'unknown';
  // Without yesterday's special-day schedule, pre-opening hours might be an overnight shift.
  if (minute < start) return 'unknown';
  return minute < end ? 'open' : 'closed';
}
export function readableHours(
  hours: Facility['hours'],
  holiday: boolean | null,
  now = new Date(),
) {
  if (holiday === null) return '';
  const day = holiday ? 8 : seoulTime(now).day;
  const start = minutes(hours[`dutyTime${day}s`]),
    end = minutes(hours[`dutyTime${day}c`]);
  if (start === null || end === null) return '';
  const format = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  return `${format(start)}–${format(end)}`;
}
export function mapLinks(facility: Pick<Facility, 'name' | 'address'>) {
  const query = encodeURIComponent(
    `${facility.name} ${facility.address}`.trim(),
  );
  return {
    naver: `https://map.naver.com/p/search/${query}`,
    kakao: `https://map.kakao.com/link/search/${query}`,
  };
}
export function positiveMeasurement(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '')
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
