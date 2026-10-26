import type { Row } from '@/lib/db';
import { insightKinds, type InsightKind, type Metric } from './config';
import { shiftCareDay } from '@/features/care/quick-model';
export type FeedInput = Pick<
  Row<'care_records'>,
  'id' | 'kind' | 'started_at' | 'ended_at' | 'amount_ml' | 'amount_g'
>;
export type ChildInput = Pick<
  Row<'child_records'>,
  | 'id'
  | 'service'
  | 'kind'
  | 'occurred_at'
  | 'ended_at'
  | 'duration_minutes'
  | 'temperature_c'
  | 'height_cm'
  | 'weight_kg'
  | 'head_cm'
>;
export type ShotInput = Pick<
  Row<'vaccination_records'>,
  'id' | 'status' | 'completed_date'
>;
export type InsightInput = {
  feeds: FeedInput[];
  children: ChildInput[];
  shots: ShotInput[];
};
export type Sample = { value: number; at: number };
export type DayStats = {
  date: string;
  count: number;
  observed: boolean;
  values: Record<string, Sample[]>;
  hours: number[];
  untimed: number;
  segments: { start: number; end: number }[];
};
export type CategoryStats = {
  kind: InsightKind;
  days: DayStats[];
  excludedRunning: number;
  count: number;
  recordedDays: number;
};
export type PatternCategory = {
  kind: InsightKind;
  days: Pick<DayStats, 'date' | 'segments' | 'untimed'>[];
};
export type WeekStats = {
  start: string;
  end: string;
  asOf: string;
  timezone: string;
  categories: Record<InsightKind, CategoryStats>;
};
export function resolveWeek(value: unknown, today: string) {
  const current = shiftCareDay(today, -6);
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value ||
    value < '2000-01-01'
  )
    return current;
  return value > current ? current : value;
}
export function reduceMetric(samples: Sample[], metric: Metric): number | null {
  if (!samples.length) return null;
  if (metric.mode === 'latest')
    return samples.reduce((a, b) => (a.at > b.at ? a : b)).value;
  if (metric.mode === 'max') return Math.max(...samples.map((s) => s.value));
  const sum = samples.reduce((n, s) => n + s.value, 0);
  return metric.mode === 'average' ? sum / samples.length : sum;
}
export function dailyValues(category: CategoryStats, metric: Metric) {
  return category.days.map((d) =>
    metric.key === 'count'
      ? d.observed
        ? d.count
        : null
      : reduceMetric(d.values[metric.key] ?? [], metric),
  );
}
export function weekValue(category: CategoryStats, metric: Metric) {
  return metric.key === 'count'
    ? category.recordedDays
      ? category.count
      : null
    : reduceMetric(
        category.days.flatMap((d) => d.values[metric.key] ?? []),
        metric,
      );
}
export function aggregateWeek(
  input: InsightInput,
  start: string,
  timezone: string,
  now: string,
): WeekStats {
  const nowMs = Date.parse(now),
    end = shiftCareDay(start, 7);
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const hourFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const minuteFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const minuteOfDay = (ms: number) => {
    const [h, m, sec] = minuteFmt.format(new Date(ms)).split(':').map(Number);
    return h * 60 + m + sec / 60 + (ms % 1000) / 60000;
  };
  const categories = Object.fromEntries(
    insightKinds.map((kind) => [
      kind,
      {
        kind,
        days: Array.from({ length: 7 }, (_, i): DayStats => ({
          date: shiftCareDay(start, i),
          count: 0,
          observed: false,
          values: {},
          hours: Array(24).fill(0),
          untimed: 0,
          segments: [],
        })),
        excludedRunning: 0,
        count: 0,
        recordedDays: 0,
      },
    ]),
  ) as Record<InsightKind, CategoryStats>;
  const index = (date: string) =>
    date >= start && date < end
      ? Math.round((Date.parse(date) - Date.parse(start)) / 86400000)
      : -1;
  const locate = (kind: InsightKind, ms: number) => {
    const i = index(dateFmt.format(new Date(ms)));
    return i < 0 ? null : categories[kind].days[i];
  };
  const add = (
    day: DayStats,
    key: string,
    value: number | null,
    at: number,
  ) => {
    if (value !== null && Number.isFinite(value)) {
      (day.values[key] ??= []).push({ value, at });
    }
  };
  const point = (
    kind: InsightKind,
    ms: number,
    values: Record<string, number | null> = {},
  ) => {
    if (!Number.isFinite(ms) || ms > nowMs) return;
    const d = locate(kind, ms);
    if (!d) return;
    d.observed = true;
    d.count++;
    if (kind !== 'sleep') {
      d.hours[Number(hourFmt.format(new Date(ms)))]++;
      const minute = minuteOfDay(ms);
      d.segments.push({ start: minute, end: minute });
    }
    for (const [key, value] of Object.entries(values)) add(d, key, value, ms);
  };
  const running = (kind: InsightKind, ms: number) => {
    if (Number.isFinite(ms) && ms <= nowMs && locate(kind, ms))
      categories[kind].excludedRunning++;
  };
  for (const r of new Map(input.feeds.map((r) => [r.id, r])).values()) {
    if (!['breast', 'formula', 'solids'].includes(r.kind)) continue;
    const kind = r.kind as InsightKind,
      at = Date.parse(r.started_at),
      finished = r.ended_at ? Date.parse(r.ended_at) : null;
    if (finished === null) {
      running(kind, at);
      continue;
    }
    if (!Number.isFinite(finished) || finished < at || finished > nowMs)
      continue;
    point(kind, at, {
      ml: r.amount_ml,
      g: r.amount_g,
      minutes: (finished - at) / 60000,
    });
  }
  const sleepIntervals: [number, number][] = [];
  for (const r of new Map(input.children.map((r) => [r.id, r])).values()) {
    const at = Date.parse(r.occurred_at);
    if (!Number.isFinite(at) || at > nowMs) continue;
    if (r.service === 'sleep') {
      if (!r.ended_at) {
        running('sleep', at);
        continue;
      }
      const finished = Date.parse(r.ended_at);
      if (!Number.isFinite(finished) || finished < at || finished > nowMs)
        continue;
      point('sleep', at);
      sleepIntervals.push([at, finished]);
    } else if (r.service === 'diaper') {
      point('diaper', at, {
        wet: ['wet', 'mixed'].includes(r.kind) ? 1 : 0,
        dirty: ['dirty', 'mixed'].includes(r.kind) ? 1 : 0,
      });
      if (['dirty', 'mixed'].includes(r.kind)) point('stool', at);
    } else if (r.service === 'growth') {
      if (r.kind === 'measurement')
        point('growth', at, {
          height: r.height_cm,
          weight: r.weight_kg,
          head: r.head_cm,
        });
      else if (r.kind === 'observation') point('development', at);
    } else if (
      r.service === 'activity' &&
      insightKinds.includes(r.kind as InsightKind)
    ) {
      point(r.kind as InsightKind, at, {
        minutes: r.duration_minutes,
        temperature: r.temperature_c,
        maxTemperature: r.temperature_c,
      });
    }
  }
  // Merge intervals so overlapping imports cannot inflate sleep duration. Clip first,
  // then split at actual minute boundaries; local dates/hours remain correct through DST.
  const lower = Date.parse(`${start}T00:00:00Z`) - 86400000,
    upper = Math.min(nowMs, Date.parse(`${end}T00:00:00Z`) + 86400000);
  const merged: [number, number][] = [];
  for (const [a, b] of sleepIntervals
    .map(
      ([a, b]) => [Math.max(a, lower), Math.min(b, upper)] as [number, number],
    )
    .filter(([a, b]) => a < b)
    .sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  for (const [a, b] of merged) {
    for (let at = a; at < b;) {
      const next = Math.min(b, (Math.floor(at / 60000) + 1) * 60000),
        day = locate('sleep', at);
      if (day) {
        const minutes = (next - at) / 60000;
        day.observed = true;
        day.hours[Number(hourFmt.format(new Date(at)))] += minutes;
        add(day, 'minutes', minutes, at);
        const startMinute = minuteOfDay(at),
          endMinute = Math.min(1440, startMinute + minutes);
        const last = day.segments.at(-1);
        if (last && Math.abs(last.end - startMinute) < 0.00001)
          last.end = endMinute;
        else day.segments.push({ start: startMinute, end: endMinute });
      }
      at = next;
    }
  }
  for (const r of new Map(input.shots.map((r) => [r.id, r])).values()) {
    if (
      r.status !== 'completed' ||
      !r.completed_date ||
      r.completed_date > dateFmt.format(new Date(nowMs))
    )
      continue;
    const i = index(r.completed_date);
    if (i < 0) continue;
    const d = categories.vaccination.days[i];
    d.count++;
    d.observed = true;
    d.untimed++;
  }
  for (const kind of insightKinds) {
    const c = categories[kind];
    c.count = c.days.reduce((n, d) => n + d.count, 0);
    c.recordedDays = c.days.filter((d) => d.observed).length;
  }
  return {
    start,
    end,
    asOf: dateFmt.format(new Date(nowMs)),
    timezone,
    categories,
  };
}
