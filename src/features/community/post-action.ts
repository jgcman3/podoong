'use server';
import { randomUUID, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loadFamily, requireUser } from '@/lib/data';
import { imageType } from '@/features/child-care/schema';
import { renderPhotoVariant } from '@/features/growth-community/photo-variants.mjs';
import { communityStorage } from './storage';
import { parentingTags } from './options';
import {
  MAX_POST_PHOTOS,
  pollInputSchema,
  postDetailSchema,
  type PostDetail,
} from './post-model';
export async function publishParentingPost(form: FormData): Promise<{
  saved: boolean;
  post?: PostDetail;
  error?: 'invalid' | 'photos' | 'generic';
}> {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = z
    .object({
      child: z.uuid(),
      post: z.uuid().optional(),
      audience: z.enum(['country', 'neighborhood']),
      category: z
        .string()
        .refine((value) => parentingTags.some(([id]) => id === value)),
      title: z.string().trim().min(1).max(100),
      body: z.string().trim().min(1).max(3000),
    })
    .safeParse(Object.fromEntries(form));
  const photos = form
    .getAll('photo')
    .filter((file): file is File => file instanceof File && file.size > 0);
  if (!parsed.success) return { saved: false, error: 'invalid' };
  if (
    photos.length > MAX_POST_PHOTOS ||
    photos.some((photo) => photo.size > 5242880)
  )
    return { saved: false, error: 'photos' };
  let keep: string[] = [];
  try {
    keep = z
      .array(z.uuid())
      .max(MAX_POST_PHOTOS)
      .parse(JSON.parse(String(form.get('keepPhotos') || '[]')));
  } catch {
    return { saved: false, error: 'invalid' };
  }
  if (
    photos.length + keep.length > MAX_POST_PHOTOS ||
    new Set(keep).size !== keep.length
  )
    return { saved: false, error: 'photos' };
  const rawPoll = form.get('poll');
  let poll;
  if (rawPoll) {
    try {
      poll = pollInputSchema.parse(JSON.parse(String(rawPoll)));
    } catch {
      return { saved: false, error: 'invalid' };
    }
  }
  const value = parsed.data,
    context = await loadFamily(locale, value.child);
  if (context.child.id !== value.child)
    return { saved: false, error: 'generic' };
  const storage = photos.length || keep.length ? communityStorage() : null;
  if (photos.length && !storage) return { saved: false, error: 'generic' };
  if (value.post) {
    const current = await context.db.rpc('parenting_post_detail', {
      p_post: value.post,
    });
    const detail = postDetailSchema.safeParse(current.data);
    if (
      current.error ||
      !detail.success ||
      !detail.data.mine ||
      detail.data.audience !== value.audience
    )
      return { saved: false, error: 'generic' };
  } else if (keep.length) return { saved: false, error: 'invalid' };
  const postId = value.post || randomUUID(),
    photoIds: string[] = [],
    uploaded: string[] = [],
    hashes = new Set<string>(),
    uniqueKeep: string[] = [];
  try {
    if (keep.length) {
      const existing = await context.db
        .from('parenting_post_photos')
        .select('id,path')
        .eq('post_id', postId)
        .in('id', keep);
      if (existing.error || existing.data.length !== keep.length)
        throw Error('Invalid photos');
      for (const id of keep) {
        const saved = existing.data.find((photo) => photo.id === id)!;
        const file = await storage!.download(saved.path);
        if (file.error || !file.data) throw Error('Photo unavailable');
        const hash = createHash('sha256')
          .update(Buffer.from(await file.data.arrayBuffer()))
          .digest('hex');
        if (!hashes.has(hash)) {
          hashes.add(hash);
          uniqueKeep.push(id);
        }
      }
    }
    for (const photo of photos) {
      const bytes = new Uint8Array(await photo.arrayBuffer()),
        type = imageType(bytes);
      if (!type || type !== photo.type) throw Error('Invalid photo');
      const display = await renderPhotoVariant(bytes, 1600),
        hash = createHash('sha256').update(display).digest('hex');
      if (hashes.has(hash)) continue;
      hashes.add(hash);
      const id = randomUUID(),
        path = `${context.profile.id}/neighborhood/${postId}/${id}.webp`;
      for (const size of [480, 1600]) {
        const rendered =
            size === 1600 ? display : await renderPhotoVariant(bytes, size),
          name = size === 480 ? path.replace('.webp', '-480.webp') : path;
        const result = await storage!.upload(name, rendered, {
          contentType: 'image/webp',
          upsert: false,
        });
        if (result.error) throw Error('Upload unavailable');
        uploaded.push(name);
      }
      photoIds.push(id);
    }
    const fields = {
      p_category: value.category,
      p_title: value.title,
      p_body: value.body,
      ...(poll ? { p_poll: poll } : {}),
    };
    const result = value.post
      ? await context.db.rpc('edit_parenting_post', {
          ...fields,
          p_post: postId,
          p_keep: uniqueKeep,
          p_new: photoIds,
        })
      : await context.db.rpc('save_parenting_post', {
          ...fields,
          p_id: postId,
          p_family: context.family.id,
          p_photo_ids: photoIds,
          p_child: value.child,
          p_audience: value.audience,
        });
    if (result.error) throw Error('Post unavailable');
  } catch {
    if (uploaded.length) await storage!.remove(uploaded);
    return { saved: false, error: photos.length ? 'photos' : 'generic' };
  }
  revalidatePath(`/${locale}/community/boards`, 'page');
  revalidatePath(`/${locale}/community/neighborhood`, 'page');
  if (value.post) {
    const result = await context.db.rpc('parenting_post_detail', {
      p_post: postId,
    });
    if (!result.error)
      return { saved: true, post: postDetailSchema.parse(result.data) };
  }
  return { saved: true };
}

export async function deleteParentingPost(input: {
  post: string;
  locale: 'ko' | 'en';
}) {
  const v = z
    .object({ post: z.uuid(), locale: z.enum(['ko', 'en']) })
    .safeParse(input);
  if (!v.success) return false;
  const { db } = await requireUser(v.data.locale);
  const result = await db.rpc('delete_parenting_post', { p_post: v.data.post });
  if (result.error) return false;
  revalidatePath(`/${v.data.locale}/community/boards`, 'page');
  revalidatePath(`/${v.data.locale}/community/neighborhood`, 'page');
  return true;
}
