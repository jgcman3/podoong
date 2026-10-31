'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loadFamily } from '@/lib/data';
import { parentingCategories } from './options';
export async function neighborhoodAction(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = z
    .object({
      child: z.uuid(),
      feature: z.enum(['boards', 'market']),
      scope: z.enum(['all', 'city', 'district', 'locality']).default('all'),
      place: z.string().max(36).default(''),
      category: z.string().optional(),
      title: z.string().trim().min(1).max(100),
      body: z.string().trim().min(1).max(3000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/community?error=invalid`);
  const v = parsed.data;
  const context = await loadFamily(locale, v.child);
  const result = await context.db.rpc('save_parenting_post', {
    p_family: context.child.family_id,
    p_feature: v.feature,
    p_place: v.place,
    p_category:
      parentingCategories.slice(1).find(([id]) => id === v.category)?.[0] ??
      'childcare',
    p_title: v.title,
    p_body: v.body,
  });
  revalidatePath(`/${locale}/community`, 'layout');
  redirect(
    `/${locale}/community${v.feature === 'market' ? '/market' : ''}?${new URLSearchParams({ child: v.child, place: v.place, scope: v.scope, category: v.category ?? 'all', ...(result.error ? { error: 'invalid' } : {}) })}`,
  );
}
