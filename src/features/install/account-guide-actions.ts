'use server';

import { requireUser } from '@/lib/data';
import { isLocale } from '@/lib/domain';

export async function claimInstallGuide(locale: string) {
  if (!isLocale(locale)) return false;
  const { db, user } = await requireUser(locale);
  const { data, error } = await db
    .from('profiles')
    .update({ install_guide_seen_at: new Date().toISOString() })
    .eq('id', user.id)
    .is('install_guide_seen_at', null)
    .select('id');
  return !error && data?.length === 1;
}
