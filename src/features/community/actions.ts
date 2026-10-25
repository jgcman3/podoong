'use server';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import { communityStorage } from './storage';
import { communityActionSchema } from './schema';
import type { Locale } from '@/lib/domain';
import { boardQuery } from './boards';
export async function communityAction(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const action = communityActionSchema.safeParse(form.get('action'));
  const id = z.uuid().safeParse(form.get('id') || randomUUID());
  const detail = z.uuid().safeParse(form.get('postId'));
  const family = z.uuid().safeParse(form.get('familyId'));
  const familyId = family.success ? family.data : undefined;
  const board =
    typeof form.get('board') === 'string'
      ? String(form.get('board'))
      : undefined;
  const path =
    form.get('moderation') === 'true'
      ? `/${locale}/moderation`
      : detail.success
        ? `/${locale}/community/${detail.data}`
        : form.get('compose') === 'true'
          ? `/${locale}/community/new`
          : `/${locale}/community`;
  const resultPath = (target: string, status: string) =>
    `${target}?${[boardQuery(familyId, target.endsWith('/new') ? board : undefined), status].filter(Boolean).join('&')}`;
  if (!action.success || !id.success)
    redirect(resultPath(path, 'error=invalid'));
  const data: Record<string, string> = Object.fromEntries(
    [...form.entries()].flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );
  const { error } = await db.rpc('community_command', {
    p_action: action.data,
    p_id: id.data,
    p_data: data,
  });
  if (form.get('action') === 'unblock')
    redirect(
      `/${locale}/community/settings?${error ? 'error=generic' : 'notice=saved'}`,
    );
  if (!error && action.data === 'post' && !detail.success)
    redirect(resultPath(`/${locale}/community/${id.data}`, 'notice=saved'));
  redirect(
    resultPath(
      action.data === 'delete-post' ? `/${locale}/community` : path,
      error
        ? error.message.includes('conflict')
          ? 'error=conflict'
          : 'error=generic'
        : 'notice=saved',
    ),
  );
}
export async function uploadPhoto(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db, user } = await requireUser(locale);
  const parsed = z.uuid().safeParse(form.get('postId'));
  if (!parsed.success) redirect(`/${locale}/community?error=invalid`);
  const postId = parsed.data;
  const family = z.uuid().safeParse(form.get('familyId'));
  const target = `/${locale}/community/${postId}?${boardQuery(family.success ? family.data : undefined)}`;
  const file = form.get('photo');
  if (!(file instanceof File) || file.size < 1 || file.size > 5242880)
    redirect(`${target}&error=invalid`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png =
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255;
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const contentType = png
    ? 'image/png'
    : jpeg
      ? 'image/jpeg'
      : webp
        ? 'image/webp'
        : null;
  if (!contentType || file.type !== contentType)
    redirect(`${target}&error=invalid`);
  const id = randomUUID();
  const path = `${user.id}/${postId}/${id}`;
  const allowed = await db.rpc('community_photo_upload_allowed', {
    p_path: path,
  });
  const storage = communityStorage();
  if (allowed.error || !allowed.data || !storage)
    redirect(`${target}&error=generic`);
  const upload = await storage.upload(path, bytes, {
    contentType,
    upsert: false,
    cacheControl: '0',
  });
  if (upload.error) redirect(`${target}&error=generic`);
  const result = await db.rpc('community_command', {
    p_action: 'photo',
    p_id: id,
    p_data: { postId, path, contentType, size: file.size },
  });
  if (result.error) {
    await storage.remove([path]);
    redirect(`${target}&error=generic`);
  }
  redirect(`${target}&notice=saved`);
}
