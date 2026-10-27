'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/data';
import checklist from './reference/milestones.json';
export async function setMilestone(input: {
  child: string;
  key: string;
  achieved: boolean;
  locale: string;
}) {
  const parsed = z
    .object({
      child: z.uuid(),
      key: z
        .string()
        .refine((key) => checklist.some((item) => item.id === key)),
      achieved: z.boolean(),
      locale: z.enum(['ko', 'en']),
    })
    .safeParse(input);
  if (!parsed.success) return false;
  const { child, key, achieved, locale } = parsed.data;
  const { db } = await requireUser(locale);
  const result = await db.rpc('set_child_milestone', {
    p_child: child,
    p_key: key,
    p_achieved: achieved,
  });
  if (result.error) return false;
  revalidatePath(`/${locale}/insights`);
  return true;
}
