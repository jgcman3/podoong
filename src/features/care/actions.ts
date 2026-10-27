'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { calendarReturn } from './calendar-return';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
const optionalDate = z
  .union([z.literal(''), z.iso.date()])
  .transform((v) => v || null);
const uuid = z.uuid();
function statusQuery(error: { message: string; code?: string } | null) {
  if (!error) return 'notice=saved';
  return `error=${error.message.includes('conflict') ? 'conflict' : error.code === '23505' ? 'timer' : 'generic'}`;
}
function localeOf(form: FormData): Locale {
  return form.get('locale') === 'en' ? 'en' : 'ko';
}
export async function saveTask(form: FormData) {
  const locale = localeOf(form);
  const target = form.get('returnTo') === 'today' ? 'today' : 'calendar';
  const { db } = await requireUser(locale);
  const parsed = z
    .object({
      id: uuid,
      childId: uuid,
      title: z.string().trim().min(1).max(200),
      service: z.string().min(1).max(40),
      date: optionalDate,
      status: z.enum(['todo', 'done', 'snoozed']),
      assignee: z.union([z.literal(''), uuid]).transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const child = uuid.safeParse(form.get('childId'));
    redirect(
      `/${locale}/${target}?${child.success ? `child=${child.data}&` : ''}error=invalid`,
    );
  }
  const v = parsed.data;
  const { error } = await db.rpc('save_task', {
    p_id: v.id,
    p_child_id: v.childId,
    p_title: v.title,
    p_service: v.service,
    p_due_date: v.date,
    p_status: v.status,
    p_assignee_id: v.assignee,
  });
  if (!error && form.get('intent') === 'toggle') {
    revalidatePath(`/${locale}/today`);
    revalidatePath(`/${locale}/calendar`);
    return;
  }
  redirect(
    `${target === 'today' ? `/${locale}/today?child=${v.childId}` : calendarReturn(locale, v.childId, v.date ?? form.get('calendarDay'))}&${statusQuery(error)}`,
  );
}
export async function saveEvent(form: FormData) {
  const locale = localeOf(form);
  const { db } = await requireUser(locale);
  const parsed = z
    .object({
      id: uuid,
      childId: uuid,
      title: z.string().trim().max(200),
      date: z.iso.date(),
      note: z.string().max(2000),
      eventKind: z
        .enum(['general', 'hospital', 'medication'])
        .default('general'),
      eventTime: z
        .union([
          z.literal(''),
          z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
        ])
        .default(''),
      eventTimezone: z.string().max(100).default(''),
    })
    .refine(
      (value) => value.eventKind === 'hospital' || value.title.length > 0,
      { path: ['title'], message: 'Required' },
    )
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/calendar?error=invalid`);
  const v = parsed.data;
  const { error } = await db.rpc('save_calendar_event', {
    p_id: v.id,
    p_child_id: v.childId,
    p_title: v.title || (locale === 'ko' ? '병원' : 'Doctor'),
    p_date: v.date,
    p_note: v.note,
    p_event_kind: v.eventKind,
    p_event_time: v.eventTime,
    p_event_timezone: v.eventTimezone,
  });
  redirect(
    `${calendarReturn(locale, v.childId, v.date)}&${statusQuery(error)}`,
  );
}
export async function deleteCalendar(form: FormData) {
  const locale = localeOf(form);
  const { db } = await requireUser(locale);
  const id = uuid.safeParse(form.get('id'));
  const child = uuid.safeParse(form.get('childId'));
  const kind = z.enum(['task', 'event']).safeParse(form.get('kind'));
  if (!id.success || !child.success || !kind.success)
    redirect(`/${locale}/calendar?error=invalid`);
  const { error } = await db.rpc('delete_calendar_item', {
    p_id: id.data,
    p_kind: kind.data,
  });
  redirect(
    `${calendarReturn(locale, child.data, form.get('calendarDay'))}&${statusQuery(error)}`,
  );
}
