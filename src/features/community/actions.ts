'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import { communityActionSchema } from './schema';
import type { Locale } from '@/lib/domain';

export async function communityAction(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const action = communityActionSchema.safeParse(form.get('action'));
  const id = z.uuid().safeParse(form.get('id'));
  const path =
    form.get('action') === 'unblock'
      ? `/${locale}/community/settings`
      : `/${locale}/moderation`;
  if (!action.success || !id.success) redirect(`${path}?error=invalid`);
  const data = Object.fromEntries(
    [...form.entries()].flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  );
  const { error } = await db.rpc('community_command', {
    p_action: action.data,
    p_id: id.data,
    p_data: data,
  });
  if (!error) {
    revalidatePath(`/${locale}/community/settings`);
    revalidatePath(`/${locale}/community/neighborhood`);
    revalidatePath(`/${locale}/moderation`);
  }
  redirect(`${path}?${error ? 'error=generic' : 'notice=saved'}`);
}
