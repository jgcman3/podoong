'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import { calendarReturn } from '@/features/care/calendar-return';
import { vaccinationSchema } from './schema';
export async function saveVaccination(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const calendar = form.get('returnTo') === 'calendar';
  const parsed = vaccinationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const child = z.uuid().safeParse(form.get('childId'));
    const id = z.uuid().safeParse(form.get('id'));
    redirect(
      `/${locale}/vaccination/${form.get('version') && id.success ? `${id.data}/edit` : 'new'}?${child.success ? `child=${child.data}&` : ''}error=invalid`,
    );
  }
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
      status: v.status,
      scheduled_date: v.scheduled,
      completed_date: v.status === 'completed' ? v.completed : null,
      clinic: v.clinic,
      note: v.note,
      timezone: v.timezone,
    },
  });
  if (result.error)
    redirect(
      `/${locale}/vaccination/${v.version ? `${v.id}/edit` : 'new'}?child=${v.childId}&error=${result.error.message.includes('conflict') ? 'conflict' : result.error.code === '22023' ? 'invalid' : 'generic'}`,
    );
  if (calendar)
    redirect(
      `${calendarReturn(locale, v.childId, v.status === 'completed' ? v.completed : v.scheduled)}&notice=saved`,
    );
  redirect(`/${locale}/vaccination/${v.id}?child=${v.childId}&notice=saved`);
}
export async function deleteVaccination(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const id = z.uuid().safeParse(form.get('id'));
  const child = z.uuid().safeParse(form.get('childId'));
  if (!id.success || !child.success)
    redirect(`/${locale}/services/vaccination?error=invalid`);
  const { db } = await requireUser(locale);
  const r = await db.rpc('delete_vaccination_record', { p_id: id.data });
  if (form.get('returnTo') === 'calendar')
    redirect(
      `${calendarReturn(locale, child.data, form.get('calendarDay'))}&${r.error ? 'error=generic' : 'notice=saved'}`,
    );
  redirect(
    `/${locale}/services/vaccination?child=${child.data}&${r.error ? 'error=generic' : 'notice=saved'}`,
  );
}
