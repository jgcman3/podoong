'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { feedingKinds, isFood } from './feeding-record';
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
  const parsed = z
    .object({
      id: uuid,
      childId: uuid,
      kind: z.enum(feedingKinds),
      foodName: z.string().trim().max(200),
      timezone: z
        .string()
        .min(1)
        .max(100)
        .refine((value) => {
          try {
            new Intl.DateTimeFormat('en', { timeZone: value });
            return true;
          } catch {
            return false;
          }
        }),
      startedAt: z.iso.datetime({ offset: true }),
      endedAt: z
        .union([z.literal(''), z.iso.datetime({ offset: true })])
        .transform((v) => v || null),
      amount: z
        .union([z.literal(''), z.coerce.number().min(0).max(3000)])
        .transform((v) => (v === '' ? null : v)),
      note: z.string().max(2000),
      version: z
        .union([z.literal(''), z.coerce.number().int().positive()])
        .transform((v) => (v === '' ? null : v)),
    })
    .refine(
      (v) => !v.endedAt || Date.parse(v.endedAt) >= Date.parse(v.startedAt),
    )
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/records?error=invalid`);
  const v = parsed.data;
  const { error } = await db.rpc('save_feeding_record', {
    p_id: v.id,
    p_child_id: v.childId,
    p_kind: v.kind,
    p_started_at: v.startedAt,
    p_ended_at: v.endedAt,
    p_amount_ml: isFood(v.kind) ? null : v.amount,
    p_amount_g: isFood(v.kind) ? v.amount : null,
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
  if (!parsed.success) redirect(`/${locale}/calendar?error=invalid`);
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
  redirect(`/${locale}/calendar?child=${v.childId}&${statusQuery(error)}`);
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
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/calendar?error=invalid`);
  const v = parsed.data;
  const { error } = await db.rpc('save_event', {
    p_id: v.id,
    p_child_id: v.childId,
    p_title: v.title,
    p_date: v.date,
    p_note: v.note,
  });
  redirect(`/${locale}/calendar?child=${v.childId}&${statusQuery(error)}`);
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
  redirect(`/${locale}/calendar?child=${child.data}&${statusQuery(error)}`);
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
  redirect(`/${locale}/calendar?child=${child.data}&${statusQuery(error)}`);
}
