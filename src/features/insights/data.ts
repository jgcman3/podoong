import type { CareContext } from '@/lib/data';
import { readPages } from '@/features/care/quick-data';
import { shiftCareDay } from '@/features/care/quick-model';
import { aggregateWeek } from './model';
export async function loadInsights(
  context: CareContext,
  start: string,
  now = new Date().toISOString(),
  span: 1 | 6 = 1,
) {
  const first = shiftCareDay(start, -(span - 1) * 7),
    end = shiftCareDay(start, 7);
  const lower = new Date(
    Date.parse(`${first}T00:00:00Z`) - 86400000,
  ).toISOString();
  const upper = new Date(
    Date.parse(`${end}T00:00:00Z`) + 86400000,
  ).toISOString();
  const [feeds, children, shots] = await Promise.all([
    readPages((from, to) =>
      context.db
        .from('care_records')
        .select('id,kind,started_at,ended_at,amount_ml,amount_g')
        .eq('child_id', context.child.id)
        .gte('started_at', lower)
        .lt('started_at', upper)
        .order('started_at')
        .order('id')
        .range(from, to),
    ),
    readPages((from, to) =>
      context.db
        .from('child_records')
        .select(
          'id,service,kind,occurred_at,ended_at,duration_minutes,temperature_c,height_cm,weight_kg,head_cm',
        )
        .eq('child_id', context.child.id)
        .or(
          `and(occurred_at.gte.${lower},occurred_at.lt.${upper}),and(service.eq.sleep,occurred_at.lt.${upper},ended_at.gte.${lower})`,
        )
        .order('occurred_at')
        .order('id')
        .range(from, to),
    ),
    readPages((from, to) =>
      context.db
        .from('vaccination_records')
        .select('id,status,completed_date')
        .eq('child_id', context.child.id)
        .eq('status', 'completed')
        .gte('completed_date', first)
        .lt('completed_date', end)
        .order('completed_date')
        .order('id')
        .range(from, to),
    ),
  ]);
  const input = { feeds, children, shots };
  const weeks = Array.from({ length: span }, (_, i) =>
    aggregateWeek(input, shiftCareDay(first, i * 7), context.timezone, now),
  );
  return { week: weeks.at(-1)!, weeks };
}
