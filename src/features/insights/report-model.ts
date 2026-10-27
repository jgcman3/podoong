import { dailyValues, type CategoryStats, type WeekStats } from './model';
import { metrics, type InsightKind } from './config';
export function recordedAverage(
  category: CategoryStats,
  metric = metrics[category.kind][0],
) {
  const values = dailyValues(category, metric).filter(
    (value): value is number => value !== null,
  );
  return {
    days: values.length,
    average: values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null,
  };
}
export function reportRows(previous: WeekStats, current: WeekStats) {
  return (
    ['breast', 'formula', 'solids', 'sleep', 'diaper', 'stool'] as InsightKind[]
  ).map((kind) => {
    const before = recordedAverage(previous.categories[kind]),
      after = recordedAverage(current.categories[kind]);
    return {
      kind,
      unit: metrics[kind][0].unit,
      before,
      after,
      change:
        before.days >= 3 &&
        after.days >= 3 &&
        before.average !== null &&
        before.average > 0 &&
        after.average !== null
          ? ((after.average - before.average) / before.average) * 100
          : null,
    };
  });
}
