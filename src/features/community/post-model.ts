import { z } from 'zod';
import { relationshipLabel } from '@/features/family/relationship';
export const MAX_POST_PHOTOS = 9;
// Nine photos plus form fields stay below the hosting request limit.
export const POST_PHOTO_BYTES = 350 * 1024;
export const pollInputSchema = z
  .object({
    question: z.string().trim().min(1).max(150),
    options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
  })
  .refine(
    (value) =>
      new Set(value.options.map((option) => option.toLowerCase())).size ===
      value.options.length,
  );
const authorSchema = z.object({
  family: z.string(),
  child: z.string(),
  relationship: z.string().nullable(),
  initial: z.string().optional(),
});
export const postDetailSchema = z.object({
  id: z.uuid(),
  mine: z.boolean(),
  audience: z.enum(['country', 'neighborhood']),
  title: z.string(),
  body: z.string(),
  category: z.string(),
  author: authorSchema,
  created_at: z.string(),
  area: z.string(),
  photos: z.array(z.uuid()),
  views: z.number(),
  likes: z.number(),
  liked: z.boolean(),
  announced: z.boolean(),
  comment_count: z.number(),
  poll: z
    .object({
      question: z.string(),
      options: z.array(z.string()),
      total: z.number(),
      mine: z.number().nullable(),
      counts: z.record(z.string(), z.number()),
    })
    .nullable(),
});
export const postCommentsSchema = z.array(
  z.object({
    id: z.uuid(),
    body: z.string(),
    parent_id: z.uuid().nullable(),
    likes: z.number(),
    liked: z.boolean(),
    reply_count: z.number(),
    author: authorSchema,
    created_at: z.string(),
  }),
);
export type PostDetail = z.infer<typeof postDetailSchema>;
export type PostComment = z.infer<typeof postCommentsSchema>[number];
export function postAuthor(
  author: z.infer<typeof authorSchema>,
  locale: string,
) {
  return [author.family, relationshipLabel(author.relationship, locale)]
    .filter(Boolean)
    .join(' ');
}
export function postHashtags(body: string) {
  return [
    ...new Set(
      [...body.matchAll(/(?:^|\s)#([\p{L}\p{N}_]{1,30})/gu)].map(
        (match) => match[1],
      ),
    ),
  ].slice(0, 20);
}
