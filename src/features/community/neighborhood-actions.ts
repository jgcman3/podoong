'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loadFamily } from '@/lib/data';
export async function saveFriendAction(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = z
    .object({
      child: z.uuid(),
      status: z
        .string()
        .trim()
        .max(80)
        .refine((value) => !/[\r\n]/.test(value)),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/community/playground?error=invalid`);
  const v = parsed.data;
  const context = await loadFamily(locale, v.child);
  const result = await context.db.rpc('save_parenting_friend', {
    p_child: v.child,
    p_status: v.status,
  });
  revalidatePath(`/${locale}/community`, 'layout');
  redirect(
    `/${locale}/community/playground?${new URLSearchParams({ child: v.child, ...(result.error ? { error: 'invalid' } : {}) })}`,
  );
}
