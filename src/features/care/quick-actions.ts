'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/data';
import { feedingRecordSchema } from './feeding-schema';
import { childRecordSchema } from '@/features/child-care/schema';
export type QuickSaveState = {
  status: 'idle' | 'saved' | 'error';
  error?: string;
  id?: string;
};
export async function deleteQuickCare(input: {
  locale: string;
  childId: string;
  id: string;
  source: string;
}): Promise<QuickSaveState> {
  const parsed = z
    .object({
      locale: z.enum(['ko', 'en']),
      childId: z.uuid(),
      id: z.uuid(),
      source: z.enum(['feeding', 'child', 'vaccination']),
    })
    .safeParse(input);
  if (!parsed.success) return { status: 'error', error: 'invalid' };
  const v = parsed.data;
  const { db } = await requireUser(v.locale);
  const table =
    v.source === 'feeding'
      ? 'care_records'
      : v.source === 'child'
        ? 'child_records'
        : 'vaccination_records';
  const record = await db
    .from(table)
    .select('id')
    .eq('id', v.id)
    .eq('child_id', v.childId)
    .maybeSingle();
  if (record.error || !record.data)
    return { status: 'error', error: 'generic' };
  const rpc =
    v.source === 'feeding'
      ? 'delete_care_record'
      : v.source === 'child'
        ? 'delete_child_record'
        : 'delete_vaccination_record';
  const result = await db.rpc(rpc, { p_id: v.id });
  if (result.error) return { status: 'error', error: 'generic' };
  for (const path of ['today', 'calendar', 'insights'])
    revalidatePath(`/${v.locale}/${path}`);
  return { status: 'saved' };
}
const contextSchema = z.object({
  locale: z.enum(['ko', 'en']),
  source: z.enum(['feeding', 'sleep', 'diaper', 'activity']),
  mode: z.enum(['record', 'start', 'stop']),
  id: z.uuid(),
  childId: z.uuid(),
  version: z
    .union([z.literal(''), z.coerce.number().int().positive()])
    .transform((v) => (v === '' ? null : v)),
  timezone: z.string().min(1).max(100),
});
export async function saveQuickCare(
  _previous: QuickSaveState,
  form: FormData,
): Promise<QuickSaveState> {
  const input = Object.fromEntries(form);
  const context = contextSchema.safeParse(input);
  if (!context.success) return { status: 'error', error: 'invalid' };
  const v = context.data;
  if (
    input.useCurrentTime === 'true' &&
    v.version === null &&
    (v.mode === 'start' || v.source === 'diaper' || v.source === 'activity')
  ) {
    const instant = new Date().toISOString();
    input.startedAt = instant;
    input.occurredAt = instant;
  }
  const { db } = await requireUser(v.locale);
  let error: { code?: string; message: string } | null = null;
  if (v.mode === 'stop') {
    if (!v.version || (v.source !== 'sleep' && v.source !== 'feeding'))
      return { status: 'error', error: 'invalid' };
    if (v.source === 'feeding') {
      const existing = await db
        .from('care_records')
        .select('*')
        .eq('id', v.id)
        .eq('child_id', v.childId)
        .maybeSingle();
      const r = existing.data;
      if (existing.error || !r || r.ended_at || r.version !== v.version)
        return { status: 'error', error: 'conflict' };
      const result = await db.rpc('save_feeding_record', {
        p_id: r.id,
        p_child_id: v.childId,
        p_kind: r.kind,
        p_started_at: r.started_at,
        p_ended_at: new Date().toISOString(),
        p_amount_ml: r.amount_ml,
        p_amount_g: r.amount_g,
        p_food_name: r.food_name,
        p_timezone: r.record_timezone ?? v.timezone,
        p_note: r.note,
        p_version: v.version,
      });
      error = result.error;
    } else {
      const existing = await db
        .from('child_records')
        .select('*')
        .eq('id', v.id)
        .eq('child_id', v.childId)
        .eq('service', 'sleep')
        .maybeSingle();
      const r = existing.data;
      if (existing.error || !r || r.ended_at || r.version !== v.version)
        return { status: 'error', error: 'conflict' };
      const result = await db.rpc('save_child_record', {
        p_id: r.id,
        p_child: v.childId,
        p_service: 'sleep',
        p_version: v.version,
        p_data: {
          kind: r.kind,
          occurred_at: r.occurred_at,
          ended_at: new Date().toISOString(),
          note: r.note,
          timezone: r.record_timezone,
        },
      });
      error = result.error;
    }
  } else if (v.source === 'feeding') {
    const parsed = feedingRecordSchema.safeParse(input);
    if (
      !parsed.success ||
      (v.mode === 'record' && !parsed.data.endedAt) ||
      (v.mode === 'start' && (parsed.data.endedAt || v.version !== null))
    )
      return { status: 'error', error: 'invalid' };
    const r = parsed.data;
    const result = await db.rpc('save_feeding_record', {
      p_id: r.id,
      p_child_id: r.childId,
      p_kind: r.kind,
      p_started_at: r.startedAt,
      p_ended_at: r.endedAt,
      p_amount_ml:
        r.kind === 'solids' && input.amountUnit === 'g' ? null : r.amount,
      p_amount_g:
        r.kind === 'solids' && input.amountUnit === 'g' ? r.amount : null,
      p_food_name: r.foodName,
      p_timezone: r.timezone,
      p_note: r.note,
      p_version: v.version,
    });
    error = result.error;
  } else {
    const parsed = childRecordSchema.safeParse({ ...input, service: v.source });
    if (
      !parsed.success ||
      (v.source === 'sleep' &&
        ((v.mode === 'record' && !parsed.data.endedAt) ||
          (v.mode === 'start' &&
            (parsed.data.endedAt || v.version !== null)))) ||
      ((v.source === 'diaper' || v.source === 'activity') &&
        v.mode !== 'record')
    )
      return { status: 'error', error: 'invalid' };
    const r = parsed.data;
    const result = await db.rpc('save_child_record', {
      p_id: r.id,
      p_child: r.childId,
      p_service: r.service,
      p_version: v.version,
      p_data: {
        kind: r.kind,
        temperature_c:
          r.service === 'activity' && r.kind === 'temperature'
            ? r.temperature
            : null,
        medicine_name:
          r.service === 'activity' && r.kind === 'medication' ? r.medicine : '',
        dose_amount:
          r.service === 'activity' && r.kind === 'medication' ? r.dose : null,
        dose_unit:
          r.service === 'activity' && r.kind === 'medication'
            ? r.doseUnit
            : null,
        duration_minutes:
          r.service === 'activity' && ['bath', 'play', 'tummy'].includes(r.kind)
            ? r.activityDuration
            : null,
        title: r.service === 'activity' && r.kind === 'hospital' ? r.title : '',
        occurred_at: r.occurredAt,
        ended_at: r.service === 'sleep' ? r.endedAt : null,
        stool_color: r.color || null,
        stool_texture: r.texture || null,
        note: r.note,
        timezone: r.timezone,
      },
    });
    error = result.error;
  }
  if (error)
    return {
      status: 'error',
      error: error.message.includes('conflict')
        ? 'conflict'
        : error.code === '42501'
          ? 'readonly'
          : error.code === '23505'
            ? 'running'
            : error.code === '23P01'
              ? 'overlap'
              : 'generic',
    };
  revalidatePath(`/${v.locale}/today`);
  revalidatePath(`/${v.locale}/insights`);
  if (v.source !== 'feeding')
    revalidatePath(`/${v.locale}/services/${v.source}`);
  return { status: 'saved', id: v.id };
}
