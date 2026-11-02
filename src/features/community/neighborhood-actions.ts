'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { loadFamily } from '@/lib/data';
import { parentingTags } from './options';
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
      parentingTags.find(([id]) => id === v.category)?.[0] ?? 'childcare',
    p_title: v.title,
    p_body: v.body,
  });
  revalidatePath(`/${locale}/community`, 'layout');
  redirect(
    `/${locale}/community${v.feature === 'market' ? '/market' : ''}?${new URLSearchParams({ child: v.child, place: v.place, scope: v.scope, category: v.category ?? 'all', ...(result.error ? { error: 'invalid' } : {}) })}`,
  );
}

export async function saveFriendAction(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = z
    .object({
      child: z.uuid(),
      nickname: z.string().trim().min(1).max(40),
      status: z
        .string()
        .trim()
        .max(80)
        .refine((value) => !/[\r\n]/.test(value)),
      scope: z
        .enum(['all', 'city', 'district', 'locality'])
        .default('district'),
      place: z.string().max(36).default(''),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    redirect(`/${locale}/community?category=friends&error=invalid`);
  const v = parsed.data;
  const context = await loadFamily(locale, v.child);
  const result = await context.db.rpc('save_parenting_friend', {
    p_child: v.child,
    p_nickname: v.nickname,
    p_status: v.status,
    p_enabled: form.get('enabled') === 'yes',
  });
  revalidatePath(`/${locale}/community`, 'layout');
  redirect(
    `/${locale}/community?${new URLSearchParams({ child: v.child, category: 'friends', scope: v.scope, place: v.place, ...(result.error ? { error: 'invalid' } : {}) })}`,
  );
}
