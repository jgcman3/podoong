'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import { mealPlanSchema } from './meal-plan';

export async function saveMealPlan(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const child = z.uuid().safeParse(form.get('childId'));
  if (!child.success) redirect(`/${locale}/records?error=invalid`);
  const path = `/${locale}/records?child=${child.data}`;
  const parsed = mealPlanSchema.safeParse({
    feedingMinutes:
      form.has('feeding') && form.get('interval') !== ''
        ? Number(form.get('interval'))
        : null,
    solids: form.getAll('solids').filter(Boolean),
  });
  const zone = z
    .enum([
      'Asia/Seoul',
      'UTC',
      'America/New_York',
      'Europe/London',
      'Asia/Tokyo',
    ])
    .safeParse(form.get('timezone'));
  if (!parsed.success || !zone.success) redirect(`${path}&error=invalid`);
  const { db } = await requireUser(locale);
  const { error } = await db.from('child_meal_plans').upsert(
    {
      child_id: child.data,
      feeding_minutes: parsed.data.feedingMinutes,
      solids_times: parsed.data.solids,
      timezone: zone.data,
    },
    { onConflict: 'child_id' },
  );
  redirect(`${path}&${error ? 'error=generic' : 'notice=saved'}`);
}
