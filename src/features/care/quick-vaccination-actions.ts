'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/data';
import { vaccinationSchema } from '@/features/vaccination/schema';
import type { QuickSaveState } from './quick-actions';
export async function saveQuickVaccination(
  _previous: QuickSaveState,
  form: FormData,
): Promise<QuickSaveState> {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = vaccinationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success || parsed.data.status !== 'completed')
    return { status: 'error', error: 'invalid' };
  const v = parsed.data;
  const { db } = await requireUser(locale);
  const result = await db.rpc('save_vaccination_record', {
    p_id: v.id,
    p_child: v.childId,
    p_version: v.version,
    p_data: {
      vaccine: v.vaccine,
      custom_name: v.custom,
      dose: v.dose,
      season: v.season,
      status: 'completed',
      scheduled_date: v.scheduled,
      completed_date: v.completed,
      clinic: v.clinic,
      note: v.note,
      timezone: v.timezone,
    },
  });
  if (result.error)
    return {
      status: 'error',
      error:
        result.error.code === '42501'
          ? 'readonly'
          : result.error.code === '22023'
            ? 'invalid'
            : result.error.message.includes('conflict')
              ? 'conflict'
              : 'generic',
    };
  for (const path of ['today', 'calendar', 'vaccinations'])
    revalidatePath(`/${locale}/${path}`);
  return { status: 'saved', id: v.id };
}
