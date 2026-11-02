'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { loadFamily, requireUser } from '@/lib/data';
import { postCommentsSchema, postDetailSchema } from './post-model';
const inputSchema = z.object({
  post: z.uuid(),
  child: z.uuid(),
  locale: z.enum(['ko', 'en']),
  kind: z.enum(['like', 'announce', 'vote', 'comment']),
  value: z.string().max(1000),
});
export async function interactWithPost(input: z.infer<typeof inputSchema>) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const v = parsed.data,
    context = await loadFamily(v.locale, v.child);
  if (context.child.id !== v.child) return { ok: false as const };
  const result = await context.db.rpc('parenting_post_interact', {
    p_post: v.post,
    p_child: v.child,
    p_kind: v.kind,
    p_value: v.value,
  });
  if (result.error) return { ok: false as const };
  if (v.kind !== 'vote') {
    revalidatePath(`/${v.locale}/community/boards`, 'page');
    revalidatePath(`/${v.locale}/community/neighborhood`, 'page');
  }
  const detail = await context.db.rpc('parenting_post_detail', {
    p_post: v.post,
  });
  if (detail.error) return { ok: false as const };
  return {
    ok: true as const,
    post: postDetailSchema.parse(detail.data),
    comment:
      v.kind === 'comment'
        ? postCommentsSchema.element.parse(result.data)
        : null,
  };
}
export async function readPostComments(input: {
  post: string;
  locale: 'ko' | 'en';
  after: string;
  afterId: string;
}) {
  const parsed = z
    .object({
      post: z.uuid(),
      locale: z.enum(['ko', 'en']),
      after: z.iso.datetime({ offset: true }),
      afterId: z.uuid(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const v = parsed.data,
    { db } = await requireUser(v.locale);
  const result = await db.rpc('parenting_post_comments_page', {
    p_post: v.post,
    p_after: v.after,
    p_after_id: v.afterId,
  });
  if (result.error) return { ok: false as const };
  return { ok: true as const, comments: postCommentsSchema.parse(result.data) };
}
export async function respondToComment(input: {
  comment: string;
  child: string;
  locale: 'ko' | 'en';
  kind: 'like' | 'reply';
  value: string;
}) {
  const parsed = z
    .object({
      comment: z.uuid(),
      child: z.uuid(),
      locale: z.enum(['ko', 'en']),
      kind: z.enum(['like', 'reply']),
      value: z.string().max(1000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const v = parsed.data,
    context = await loadFamily(v.locale, v.child);
  if (context.child.id !== v.child) return { ok: false as const };
  const result = await context.db.rpc('parenting_comment_interact', {
    p_comment: v.comment,
    p_child: v.child,
    p_kind: v.kind,
    p_value: v.value,
  });
  if (result.error) return { ok: false as const };
  const data = z
    .object({
      comment: postCommentsSchema.element,
      parent: postCommentsSchema.element,
      comment_count: z.number(),
    })
    .parse(result.data);
  if (v.kind === 'reply') {
    revalidatePath(`/${v.locale}/community/boards`, 'page');
    revalidatePath(`/${v.locale}/community/neighborhood`, 'page');
  }
  return { ok: true as const, ...data };
}
export async function readCommentReplies(input: {
  comment: string;
  locale: 'ko' | 'en';
  after?: string;
  afterId?: string;
}) {
  const parsed = z
    .object({
      comment: z.uuid(),
      locale: z.enum(['ko', 'en']),
      after: z.iso.datetime({ offset: true }).optional(),
      afterId: z.uuid().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const v = parsed.data,
    { db } = await requireUser(v.locale);
  const result = await db.rpc('parenting_comment_replies', {
    p_comment: v.comment,
    ...(v.after && v.afterId
      ? { p_after: v.after, p_after_id: v.afterId }
      : {}),
  });
  if (result.error) return { ok: false as const };
  return { ok: true as const, comments: postCommentsSchema.parse(result.data) };
}
export async function recordPostView(post: string, locale: 'ko' | 'en') {
  if (
    !z.uuid().safeParse(post).success ||
    !z.enum(['ko', 'en']).safeParse(locale).success
  )
    return null;
  const { db } = await requireUser(locale);
  const result = await db.rpc('record_parenting_post_view', { p_post: post });
  const parsed = z
    .object({ views: z.number(), recorded: z.boolean() })
    .safeParse(result.data);
  if (result.error || !parsed.success) return null;
  if (parsed.data.recorded) {
    revalidatePath(`/${locale}/community/boards`, 'page');
    revalidatePath(`/${locale}/community/neighborhood`, 'page');
  }
  return parsed.data.views;
}
