'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { calendarReturn } from './calendar-return';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { isFood } from './feeding-record';
import { feedingRecordSchema } from './feeding-schema';
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
export async function saveRecord(form: FormData) {
  const locale = localeOf(form);
  const { db } = await requireUser(locale);
  const parsed = feedingRecordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/records?error=invalid`);
  const v = parsed.data;
  const legacyGrams =
    isFood(v.kind) && v.version !== null && form.get('amountUnit') === 'g';
  const { error } = await db.rpc('save_feeding_record', {
    p_id: v.id,
    p_child_id: v.childId,
    p_kind: v.kind,
    p_started_at: v.startedAt,
    p_ended_at: v.endedAt,
    p_amount_ml: legacyGrams ? null : v.amount,
    p_amount_g: legacyGrams ? v.amount : null,
    p_food_name: isFood(v.kind) ? v.foodName : '',
    p_timezone: v.timezone,
    p_note: v.note,
    p_version: v.version,
  });
  redirect(`/${locale}/records?child=${v.childId}&${statusQuery(error)}`);
}
export async function deleteRecord(form: FormData) {
  const locale = localeOf(form);
  const { db } = await requireUser(locale);
  const id = uuid.safeParse(form.get('id'));
  const child = uuid.safeParse(form.get('childId'));
  if (!id.success || !child.success)
    redirect(`/${locale}/records?error=invalid`);
  const { error } = await db.rpc('delete_care_record', { p_id: id.data });
  redirect(`/${locale}/records?child=${child.data}&${statusQuery(error)}`);
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
      title: z.string().trim().min(1).max(200),
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
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/calendar?error=invalid`);
  const v = parsed.data;
  const { error } = await db.rpc('save_calendar_event', {
    p_id: v.id,
    p_child_id: v.childId,
    p_title: v.title,
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
export async function addTemplates(form: FormData) {
  const locale = localeOf(form);
  const { db } = await requireUser(locale);
  const child = uuid.safeParse(form.get('childId'));
  if (!child.success) redirect(`/${locale}/calendar?error=invalid`);
  const { error } = await db.rpc('add_preparation_tasks', {
    p_child_id: child.data,
    p_locale: locale,
  });
  redirect(
    `${calendarReturn(locale, child.data, form.get('calendarDay'))}&${statusQuery(error)}`,
  );
}
