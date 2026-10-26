import { dailyValues, weekValue, reduceMetric, type WeekStats } from './model';
import { metrics, type InsightKind, type Metric } from './config';
import { shiftCareDay } from '@/features/care/quick-model';
export type StatisticsInterval = 'day' | 'week';
export type Statistic = {
  kind: InsightKind | 'feeding' | 'counts' | 'height';
  unit: string;
  total: number | null;
  points: { date: string; end: string }[];
  series: {
    kind: InsightKind | 'total';
    values: (number | null)[];
    total?: number | null;
  }[];
  breastMinutes?: number | null;
};
function totalFor(weeks: WeekStats[], kind: InsightKind, metric: Metric) {
  if (metric.key === 'count') {
    const categories = weeks.map((week) => week.categories[kind]);
    return categories.some((category) => category.recordedDays > 0)
      ? categories.reduce((sum, category) => sum + category.count, 0)
      : null;
  }
  return reduceMetric(
    weeks.flatMap((week) =>
      week.categories[kind].days.flatMap((day) => day.values[metric.key] ?? []),
    ),
    metric,
  );
}
export function buildStatistics(
  weeks: WeekStats[],
  selected: InsightKind[],
  interval: StatisticsInterval,
): Statistic[] {
  const periods = interval === 'week' ? weeks : weeks.slice(-1);
  const points =
    interval === 'week'
      ? periods.map((week) => ({
          date: week.start,
          end: shiftCareDay(week.start, 6),
        }))
      : periods.flatMap((week) =>
          week.categories.formula.days.map((day) => ({
            date: day.date,
            end: day.date,
          })),
        );
  function values(kind: InsightKind, metric: Metric) {
    return interval === 'week'
      ? periods.map((week) => weekValue(week.categories[kind], metric))
      : periods.flatMap((week) => dailyValues(week.categories[kind], metric));
  }
  const result: Statistic[] = [],
    feeding = selected.filter((kind) =>
      ['breast', 'formula', 'solids'].includes(kind),
    );
  if (feeding.length) {
    const measured = feeding.filter((kind) => kind !== 'breast');
    const series = measured.map((kind) => ({
      kind,
      values: values(kind, metrics[kind][0]),
    }));
    if (measured.length) {
      const totals = points.map((_, i) => {
        const known = series
          .map((item) => item.values[i])
          .filter((value): value is number => value !== null);
        return known.length
          ? known.reduce((sum, value) => sum + value, 0)
          : null;
      });
      result.push({
        kind: 'feeding',
        unit: 'ml',
        points,
        total: totals.some((n) => n !== null)
          ? totals.reduce<number>((sum, n) => sum + (n ?? 0), 0)
          : null,
        series: [{ kind: 'total', values: totals }, ...series],
        ...(feeding.includes('breast')
          ? { breastMinutes: totalFor(periods, 'breast', metrics.breast[0]) }
          : {}),
      });
    } else {
      result.push({
        kind: 'breast',
        unit: 'min',
        points,
        total: totalFor(periods, 'breast', metrics.breast[0]),
        series: [
          { kind: 'breast', values: values('breast', metrics.breast[0]) },
        ],
      });
    }
  }
  const counted = selected.filter((kind) => metrics[kind][0].key === 'count');
  if (counted.length) {
    result.push({
      kind: 'counts',
      unit: 'count',
      points,
      total: null,
      series: counted.map((kind) => ({
        kind,
        values: values(kind, metrics[kind][0]),
        total: totalFor(periods, kind, metrics[kind][0]),
      })),
    });
  }
  for (const kind of selected.filter(
    (kind) => !feeding.includes(kind) && !counted.includes(kind),
  )) {
    const primary =
      kind === 'growth' ? metrics.growth.slice(0, 2) : [metrics[kind][0]];
    for (const metric of primary) {
      const isSleep = kind === 'sleep',
        convert = (value: number | null) =>
          value === null ? null : isSleep ? value / 60 : value;
      result.push({
        kind: kind === 'growth' && metric.key === 'height' ? 'height' : kind,
        unit: isSleep ? 'h' : metric.unit,
        points,
        total: convert(totalFor(periods, kind, metric)),
        series: [{ kind, values: values(kind, metric).map(convert) }],
      });
    }
  }
  return result;
}
