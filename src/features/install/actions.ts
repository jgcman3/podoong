'use server';

import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { isLocale } from '@/lib/domain';
import { iconStorage } from './server';

export async function saveAppIcon(form: FormData) {
  const locale = isLocale(String(form.get('locale') || ''))
    ? (form.get('locale') as 'ko' | 'en')
    : 'ko';
  const child = String(form.get('child') || '');
  const { db } = await requireUser(locale);
  const target = `/${locale}/install?child=${encodeURIComponent(child)}`;
  const { data: record } = await db
    .from('children')
    .select('family_id')
    .eq('id', child)
    .maybeSingle();
  if (!record) redirect(`${target}&error=photo`);
  const owner = await db.rpc('is_family_owner', { fid: record.family_id });
  if (owner.error || !owner.data) redirect(`${target}&error=photo`);
  const admin = iconStorage();
  if (form.get('remove') === 'yes') {
    const removed = await admin
      .from('child_app_icons')
      .delete()
      .eq('child_id', child);
    if (removed.error) redirect(`${target}&error=photo`);
    redirect(target);
  }
  const file = form.get('photo');
  if (!(file instanceof File) || file.size <= 0 || file.size > 5 * 1024 * 1024)
    redirect(`${target}&error=photo`);
  const token = randomBytes(32).toString('hex');
  const path = `app-icons/${token}.png`;
  try {
    const bytes = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 25000000,
    })
      .rotate()
      .resize(512, 512, { fit: 'cover' })
      .flatten({ background: '#fff3e6' })
      .png()
      .toBuffer();
    const uploaded = await admin.storage
      .from('child-care-photos')
      .upload(path, bytes, { contentType: 'image/png' });
    if (uploaded.error) throw new Error('upload');
    const saved = await admin
      .from('child_app_icons')
      .upsert({ child_id: child, token, path });
    if (saved.error) {
      await admin.storage.from('child-care-photos').remove([path]);
      throw new Error('metadata');
    }
  } catch {
    redirect(`${target}&error=photo`);
  }
  // A full navigation loads the new Apple icon and manifest before installation.
  redirect(target);
}
