import type { CareContext } from '@/lib/data';
import type { Row } from '@/lib/db';
import { quickTimeline, todayEntries } from './quick-model';

export async function readPages<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await query(offset, offset + 499);
    if (result.error) throw new Error('Quick care history unavailable');
    rows.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) return rows;
  }
}

export async function loadQuickTimeline(
  context: CareContext,
  day = context.today,
) {
  // A broad UTC window covers every local date, including DST transitions.
  // Exact day membership is checked below using the profile timezone.
  const midnight = Date.parse(`${day}T00:00:00Z`);
  const lower = new Date(midnight - 86400000).toISOString();
  const upper = new Date(midnight + 2 * 86400000).toISOString();
  const [feeds, child, shots] = await Promise.all([
    readPages<Row<'care_records'>>((from, to) =>
      context.db
        .from('care_records')
        .select('*')
        .eq('child_id', context.child.id)
        .or(
          `and(started_at.gte.${lower},started_at.lt.${upper}),and(started_at.lt.${upper},ended_at.gte.${lower}),and(kind.eq.breast,ended_at.is.null)`,
        )
        .order('started_at', { ascending: false })
        .order('id')
        .range(from, to),
    ),
    readPages<Row<'child_records'>>((from, to) =>
      context.db
        .from('child_records')
        .select('*')
        .eq('child_id', context.child.id)
        .or(
          `and(occurred_at.gte.${lower},occurred_at.lt.${upper}),and(service.eq.sleep,occurred_at.lt.${upper},ended_at.gte.${lower}),and(service.eq.sleep,ended_at.is.null)`,
        )
        .order('occurred_at', { ascending: false })
        .order('id')
        .range(from, to),
    ),
    readPages<Row<'vaccination_records'>>((from, to) =>
      context.db
        .from('vaccination_records')
        .select('*')
        .eq('child_id', context.child.id)
        .eq('status', 'completed')
        .eq('completed_date', day)
        .order('created_at', { ascending: false })
        .order('id')
        .range(from, to),
    ),
  ]);
  const timeline = quickTimeline(feeds, child, shots);
  const growthIds = child
    .filter((r) => r.service === 'growth')
    .map((r) => r.id);
  if (growthIds.length) {
    const [photos, shares] = await Promise.all([
      context.db
        .from('child_record_photos')
        .select('id,record_id')
        .eq('child_id', context.child.id)
        .in('record_id', growthIds),
      context.db
        .from('growth_diary_shares')
        .select('record_id,same_birth_date,everyone')
        .in('record_id', growthIds),
    ]);
    if (shares.error) throw new Error('Diary privacy unavailable');
    if (photos.error) throw new Error('Diary photos unavailable');
    for (const entry of timeline) {
      if (entry.service === 'growth') {
        const share = shares.data.find((row) => row.record_id === entry.id);
        entry.isPrivate = !share?.same_birth_date && !share?.everyone;
        entry.photoIds = photos.data
          .filter((photo) => photo.record_id === entry.id)
          .map((photo) => photo.id);
      }
    }
  }
  return todayEntries(timeline, day, context.timezone);
}

export async function loadRecentFeedingAmounts(context: CareContext) {
  const latest = async (kind: 'formula' | 'solids') => {
    const result = await context.db
      .from('care_records')
      .select('amount_ml')
      .eq('child_id', context.child.id)
      .eq('kind', kind)
      .not('amount_ml', 'is', null)
      .lte('started_at', new Date().toISOString())
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error('Recent feeding amount unavailable');
    return result.data?.amount_ml ?? null;
  };
  const [formula, solids] = await Promise.all([
    latest('formula'),
    latest('solids'),
  ]);
  return { formula, solids };
}
