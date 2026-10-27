import type { CareContext } from '@/lib/data';
import { readPages } from '@/features/care/quick-data';
import { growthPoint } from './growth-model';
export async function loadGrowthPoints(context: CareContext) {
  if (!context.child.birth_date) return [];
  const birth = context.child.birth_date;
  const rows = await readPages((from, to) =>
    context.db
      .from('child_records')
      .select('id,occurred_at,record_timezone,weight_kg,height_cm,head_cm')
      .eq('child_id', context.child.id)
      .eq('service', 'growth')
      .order('occurred_at')
      .order('id')
      .range(from, to),
  );
  return rows
    .map((row) => growthPoint(row, birth, context.today))
    .filter((point) => point !== null)
    .sort((a, b) => a.day - b.day || a.id.localeCompare(b.id));
}
