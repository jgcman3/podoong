'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import { childRecordSchema, isChildService, imageType } from './schema';

export async function saveChildRecord(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = childRecordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const service = String(form.get('service'));
    const child = z.uuid().safeParse(form.get('childId'));
    const id = z.uuid().safeParse(form.get('id'));
    const base = isChildService(service)
      ? `/${locale}/care/${service}`
      : `/${locale}/services`;
    const path = isChildService(service)
      ? `${base}/${form.get('version') && id.success ? `${id.data}/edit` : 'new'}`
      : base;
    redirect(
      `${path}?${child.success ? `child=${child.data}&` : ''}error=invalid`,
    );
  }
  const value = parsed.data;
  const { db } = await requireUser(locale);
  const measured = value.service === 'growth' && value.kind === 'measurement';
  const stool =
    value.service === 'diaper' && ['dirty', 'mixed'].includes(value.kind);
  const result = await db.rpc('save_child_record', {
    p_id: value.id,
    p_child: value.childId,
    p_service: value.service,
    p_version: value.version,
    p_data: {
      kind: value.kind,
      temperature_c:
        value.service === 'activity' && value.kind === 'temperature'
          ? value.temperature
          : null,
      medicine_name:
        value.service === 'activity' && value.kind === 'medication'
          ? value.medicine
          : '',
      dose_amount:
        value.service === 'activity' && value.kind === 'medication'
          ? value.dose
          : null,
      dose_unit:
        value.service === 'activity' && value.kind === 'medication'
          ? value.doseUnit
          : null,
      duration_minutes:
        value.service === 'activity' &&
        ['bath', 'play', 'tummy'].includes(value.kind)
          ? value.activityDuration
          : null,
      occurred_at: value.occurredAt,
      ended_at: value.service === 'sleep' ? value.endedAt : null,
      height_cm: measured ? value.height : null,
      weight_kg: measured ? value.weight : null,
      head_cm: measured ? value.head : null,
      stool_color: stool ? value.color || null : null,
      stool_texture: stool ? value.texture || null : null,
      title:
        value.service === 'activity' && value.kind === 'hospital'
          ? value.title
          : '',
      note: value.note,
      timezone: value.timezone,
    },
  });
  if (result.error) {
    const error =
      result.error.code === '23P01'
        ? 'sleepOverlap'
        : result.error.code === '23505'
          ? 'sleepRunning'
          : result.error.message.includes('conflict')
            ? 'conflict'
            : 'generic';
    redirect(
      `/${locale}/care/${value.service}/${value.version ? `${value.id}/edit` : 'new'}?child=${value.childId}&error=${error}`,
    );
  }
  redirect(
    `/${locale}/care/${value.service}/${value.id}?child=${value.childId}&notice=saved`,
  );
}
export async function deleteChildRecord(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const id = z.uuid().safeParse(form.get('id'));
  const child = z.uuid().safeParse(form.get('childId'));
  const service = String(form.get('service'));
  if (!id.success || !child.success || !isChildService(service))
    redirect(`/${locale}/services?error=invalid`);
  const { db } = await requireUser(locale);
  const result = await db.rpc('delete_child_record', { p_id: id.data });
  redirect(
    `/${locale}/services/${service}?child=${child.data}&${result.error ? 'error=generic' : 'notice=saved'}`,
  );
}
export async function uploadChildPhoto(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const record = z.uuid().safeParse(form.get('recordId'));
  const child = z.uuid().safeParse(form.get('childId'));
  if (!record.success || !child.success)
    redirect(`/${locale}/services/growth?error=invalid`);
  const path = `/${locale}/care/growth/${record.data}?child=${child.data}`;
  const file = form.get('photo');
  if (!(file instanceof File) || file.size < 1 || file.size > 5242880)
    redirect(`${path}&error=invalid`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = imageType(bytes);
  if (!type || file.type !== type) redirect(`${path}&error=invalid`);
  const { db } = await requireUser(locale);
  const id = crypto.randomUUID();
  const registration = await db.rpc('add_child_record_photo', {
    p_id: id,
    p_record: record.data,
    p_type: type,
    p_size: file.size,
  });
  if (registration.error || !registration.data)
    redirect(`${path}&error=generic`);
  const uploaded = await db.storage
    .from('child-care-photos')
    .upload(registration.data, bytes, { contentType: type, upsert: false });
  if (uploaded.error) {
    await db.rpc('remove_child_record_photo', { p_id: id });
    redirect(`${path}&error=generic`);
  }
  redirect(`${path}&notice=saved`);
}
export async function deleteChildPhoto(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const id = z.uuid().safeParse(form.get('photoId'));
  const record = z.uuid().safeParse(form.get('recordId'));
  const child = z.uuid().safeParse(form.get('childId'));
  if (!id.success || !record.success || !child.success)
    redirect(`/${locale}/services/growth?error=invalid`);
  const { db } = await requireUser(locale);
  const result = await db.rpc('remove_child_record_photo', { p_id: id.data });
  redirect(
    `/${locale}/care/growth/${record.data}?child=${child.data}&${result.error ? 'error=generic' : 'notice=saved'}`,
  );
}
