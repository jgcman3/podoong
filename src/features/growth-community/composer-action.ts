'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/data';
import { childRecordSchema, imageType } from '@/features/child-care/schema';

export async function createDiary(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const fields = Object.fromEntries(form);
  const measured = ['weight', 'height', 'head'].some((key) =>
    String(fields[key] ?? '').trim(),
  );
  const parsed = childRecordSchema.safeParse({
    ...fields,
    service: 'growth',
    kind: measured ? 'measurement' : 'observation',
  });
  const photos = form
    .getAll('photo')
    .filter((file): file is File => file instanceof File && file.size > 0);
  if (
    !parsed.success ||
    photos.length > 5 ||
    photos.some((photo) => photo.size > 5242880)
  )
    return {
      saved: false,
      error: photos.length > 5 ? 'photo-limit' : 'invalid',
    };
  const uploads = await Promise.all(
    photos.map(async (photo) => {
      const bytes = new Uint8Array(await photo.arrayBuffer());
      return { photo, bytes, type: imageType(bytes) };
    }),
  );
  if (uploads.some(({ photo, type }) => !type || photo.type !== type))
    return { saved: false, error: 'invalid' };
  const value = parsed.data;
  const { db } = await requireUser(locale);
  const existing = value.version
    ? await db
        .from('child_records')
        .select('occurred_at,record_timezone,child_record_photos(id)')
        .eq('id', value.id)
        .eq('child_id', value.childId)
        .eq('service', 'growth')
        .single()
    : null;
  if (value.version && (!existing?.data || existing.error))
    return { saved: false, error: 'generic' };
  if (
    !value.note.trim() &&
    !measured &&
    !photos.length &&
    !existing?.data?.child_record_photos.length
  )
    return { saved: false, error: 'empty' };
  if ((existing?.data?.child_record_photos.length ?? 0) + photos.length > 5)
    return { saved: false, error: 'photo-limit' };
  const result = await db.rpc('save_growth_diary', {
    p_id: value.id,
    p_child: value.childId,
    p_private: form.get('private') === 'on',
    p_version: value.version,
    p_data: {
      kind: value.kind,
      occurred_at: existing?.data?.occurred_at ?? value.occurredAt,
      timezone: existing?.data?.record_timezone ?? value.timezone,
      note: value.note,
      title: '',
      weight_kg: value.weight,
      height_cm: value.height,
      head_cm: value.head,
    },
  });
  if (result.error)
    return {
      saved: false,
      error: result.error.code === '22023' ? 'birth' : 'generic',
    };
  const uploaded = await Promise.all(
    uploads.map(async ({ photo, bytes, type }) => {
      const id = crypto.randomUUID();
      const registration = await db.rpc('add_child_record_photo', {
        p_id: id,
        p_record: value.id,
        p_type: type!,
        p_size: photo.size,
      });
      if (registration.error || !registration.data) return false;
      const result = await db.storage
        .from('child-care-photos')
        .upload(registration.data, bytes, {
          contentType: type!,
          upsert: false,
        });
      if (result.error) {
        await db.rpc('remove_child_record_photo', { p_id: id });
        return false;
      }
      return true;
    }),
  );
  const photoFailed = uploaded.some((success) => !success);
  revalidatePath(`/${locale}/community/diaries`);
  revalidatePath(`/${locale}/today`);
  revalidatePath(`/${locale}/insights`);
  return { saved: true, error: photoFailed ? 'photo' : '' };
}

export async function removeDiary(form: FormData) {
  const parsed = z
    .object({ id: z.uuid(), child: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return false;
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const record = await db
    .from('child_records')
    .select('id')
    .eq('id', parsed.data.id)
    .eq('child_id', parsed.data.child)
    .eq('service', 'growth')
    .single();
  if (!record.data || record.error) return false;
  const result = await db.rpc('delete_child_record', { p_id: parsed.data.id });
  if (result.error) return false;
  revalidatePath(`/${locale}/community/diaries`);
  revalidatePath(`/${locale}/today`);
  revalidatePath(`/${locale}/insights`);
  return true;
}
