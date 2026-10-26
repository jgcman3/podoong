import type { CareContext } from '@/lib/data';
import { ageInDays, dateInTimeZone } from '@/lib/domain';

export async function loadOwnDiaries(context: CareContext, page: number) {
  const { data, error } = await context.db
    .from('child_records')
    .select(
      'id,version,occurred_at,record_timezone,note,weight_kg,height_cm,head_cm,child_record_photos(id)',
    )
    .eq('child_id', context.child.id)
    .eq('service', 'growth')
    .order('occurred_at', { ascending: false })
    .order('id')
    .range(page * 20, page * 20 + 20);
  if (error) throw new Error('Child diaries unavailable');
  return data.map((record) => ({
    id: record.id,
    version: record.version,
    occurred_at: record.occurred_at,
    record_timezone: record.record_timezone,
    nickname: context.child.name,
    sex: context.child.sex,
    age_days: context.child.birth_date
      ? ageInDays(
          context.child.birth_date,
          dateInTimeZone(new Date(record.occurred_at), record.record_timezone),
        )
      : null,
    note: record.note,
    weight_kg: record.weight_kg,
    height_cm: record.height_cm,
    head_cm: record.head_cm,
    photo_ids: record.child_record_photos.map((photo) => photo.id),
  }));
}
