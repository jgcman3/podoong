'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
export async function reportParentingPost(input: unknown) {
  const parsed = z
    .object({
      post: z.uuid(),
      locale: z.enum(['ko', 'en']),
      reason: z.enum(['spam', 'inappropriate', 'privacy', 'other']),
      detail: z.string().trim().max(400),
    })
    .safeParse(input);
  if (!parsed.success) return false;
  const { db } = await requireUser(parsed.data.locale);
  const reasons = {
    spam: '스팸·광고',
    inappropriate: '부적절한 내용',
    privacy: '개인정보 노출',
    other: '기타',
  };
  const result = await db.rpc('report_parenting_post', {
    p_post: parsed.data.post,
    p_reason:
      reasons[parsed.data.reason] +
      (parsed.data.detail ? ` · ${parsed.data.detail}` : ''),
  });
  return !result.error;
}
