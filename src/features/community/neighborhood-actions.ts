'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loadFamily } from '@/lib/data';
export async function neighborhoodAction(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = z
    .object({
      child: z.uuid(),
      feature: z.enum(['boards', 'market', 'support']),
      action: z.enum(['request', 'post']),
      title: z.string().trim().max(100).optional(),
      body: z.string().trim().max(3000).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/community?error=invalid`);
  const v = parsed.data;
  const context = await loadFamily(locale, v.child);
  const result =
    v.action === 'request'
      ? await context.db.rpc('request_neighborhood_family', {
          p_family: context.child.family_id,
        })
      : await context.db.rpc('save_neighborhood_post', {
          p_family: context.child.family_id,
          p_feature: v.feature,
          p_title: v.title ?? '',
          p_body: v.body ?? '',
        });
  revalidatePath(`/${locale}/community`, 'layout');
  redirect(
    `/${locale}/community${v.action === 'post' ? `/${v.feature}` : ''}?child=${v.child}${result.error ? '&error=invalid' : ''}`,
  );
}
