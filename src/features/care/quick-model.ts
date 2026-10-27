import { dateInTimeZone } from '@/lib/domain';
import type { Row } from '@/lib/db';
export type QuickKind =
  | 'breast'
  | 'formula'
  | 'solids'
  | 'sleep'
  | 'diaper'
  | 'stool'
  | 'bath'
  | 'hospital'
  | 'temperature'
  | 'medication'
  | 'snack'
  | 'play'
  | 'tummy'
  | 'vaccination';
export type QuickEntry = {
  id: string;
  source: 'feeding' | 'child' | 'vaccination';
  service: string;
  kind: string;
  startedAt: string;
  endedAt: string | null;
  version: number;
  amount: number | null;
  unit: 'ml' | 'g' | null;
  title: string;
  running: boolean;
  recordDate?: string;
  customName?: string;
  dose?: number | null;
};
export function quickTimeline(
  feeding: Row<'care_records'>[],
  child: Row<'child_records'>[],
  vaccinations: Row<'vaccination_records'>[] = [],
): QuickEntry[] {
  const feeds: QuickEntry[] = feeding.map((r) => ({
    id: r.id,
    source: 'feeding',
    service: 'feeding',
    kind: r.kind,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    version: r.version,
    amount: r.amount_ml ?? r.amount_g,
    unit: r.amount_ml === null && r.amount_g !== null ? 'g' : 'ml',
    title: '',
    running: !r.ended_at,
  }));
  const other: QuickEntry[] = child.map((r) => ({
    id: r.id,
    source: 'child',
    service: r.service,
    kind: r.kind,
    startedAt: r.occurred_at,
    endedAt: r.ended_at,
    version: r.version,
    amount: null,
    unit: null,
    title: [
      r.title,
      r.temperature_c != null ? `${r.temperature_c} °C` : '',
      r.medicine_name
        ? [
            r.medicine_name,
            r.dose_amount !== null && r.dose_unit
              ? `${r.dose_amount} ${r.dose_unit}`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : '',
      r.duration_minutes != null ? `${r.duration_minutes} min` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    running: r.service === 'sleep' && !r.ended_at,
  }));
  const shots: QuickEntry[] = vaccinations
    .filter((r) => r.status === 'completed' && r.completed_date !== null)
    .map((r) => ({
      id: r.id,
      source: 'vaccination',
      service: 'vaccination',
      kind: r.vaccine,
      startedAt: r.created_at,
      endedAt: null,
      version: r.version,
      amount: null,
      unit: null,
      title: r.clinic,
      running: false,
      recordDate: r.completed_date!,
      customName: r.custom_name,
      dose: r.dose,
    }));
  return [
    ...new Map(
      [...feeds, ...other, ...shots].map((r) => [`${r.source}:${r.id}`, r]),
    ).values(),
  ].sort(
    (a, b) =>
      b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id),
  );
}
export function localDateInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function durationMinutes(entry: QuickEntry) {
  return entry.endedAt
    ? Math.max(
        0,
        (Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / 60000,
      )
    : null;
}

export function todayEntries(
  entries: QuickEntry[],
  today: string,
  timezone: string,
) {
  return entries.filter((entry) => {
    if (entry.recordDate) return entry.recordDate === today;
    if (entry.running) return true;
    const start = dateInTimeZone(new Date(entry.startedAt), timezone);
    const end = dateInTimeZone(
      new Date(entry.endedAt ?? entry.startedAt),
      timezone,
    );
    return start <= today && end >= today;
  });
}

export function dailyFeedingTotals(
  entries: QuickEntry[],
  day: string,
  timezone: string,
) {
  const result = { formula: 0, solids: 0, total: 0 };
  for (const entry of entries) {
    if (
      entry.source !== 'feeding' ||
      entry.running ||
      entry.unit !== 'ml' ||
      entry.amount === null ||
      dateInTimeZone(new Date(entry.startedAt), timezone) !== day
    )
      continue;
    if (entry.kind === 'formula' || entry.kind === 'solids')
      result[entry.kind] += entry.amount;
  }
  result.total = result.formula + result.solids;
  return result;
}

export function shiftCareDay(day: string, offset: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
