'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/data';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { Locale } from '@/lib/domain';

export async function savePrivacyChoices(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const { error } = await db.rpc('update_health_consent', {
    p_health: form.get('health') === 'on',
    p_confirmation: String(form.get('confirmation') ?? ''),
  });
  if (error)
    return {
      error: error.message.includes('health_records_confirmation_required')
        ? 'health'
        : 'generic',
    };
  revalidatePath(`/${locale}`, 'layout');
  return { error: '' };
}

export async function chooseChildVisibility(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const child = z.uuid().parse(form.get('child'));
  const { db } = await requireUser(locale);
  const { error } = await db.rpc('set_child_visibility', {
    p_child: child,
    p_scope: 'neighborhood',
    p_enabled: form.get('enabled') === 'on',
  });
  revalidatePath(`/${locale}/community`, 'layout');
  redirect(
    `/${locale}/community/playground?child=${child}${error ? '&error=generic' : ''}`,
  );
}

export async function saveChildVisibility(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const child = z.uuid().parse(form.get('child'));
  const scope = z.enum(['public', 'neighborhood']).parse(form.get('scope'));
  const { db } = await requireUser(locale);
  const { error } = await db.rpc('set_child_visibility', {
    p_child: child,
    p_scope: scope,
    p_enabled: form.get('enabled') === 'on',
  });
  if (!error) revalidatePath(`/${locale}`, 'layout');
  return { error: Boolean(error) };
}
