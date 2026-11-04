'use server';
import { requireUser } from '@/lib/data';
import { isLocale } from '@/lib/domain';
import { revalidatePath } from 'next/cache';
export async function completeServiceGuide(locale: string) {
  if (!isLocale(locale)) return { error: true };
  const { db } = await requireUser(locale);
  const { error } = await db.rpc('complete_service_tour');
  if (!error) revalidatePath(`/${locale}/today`);
  return { error: !!error };
}
