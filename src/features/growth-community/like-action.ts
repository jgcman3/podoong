'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
export async function setDiaryLike(input: {
  record: string;
  liked: boolean;
  locale: Locale;
}) {
  const parsed = z
    .object({
      record: z.uuid(),
      liked: z.boolean(),
      locale: z.enum(['ko', 'en']),
    })
    .safeParse(input);
  if (!parsed.success) return null;
  const { db } = await requireUser(parsed.data.locale);
  const result = await db
    .rpc('set_growth_diary_like', {
      p_record: parsed.data.record,
      p_liked: parsed.data.liked,
    })
    .single();
  if (result.error) return null;
  revalidatePath(`/${parsed.data.locale}/community/diaries`);
  return result.data;
}
