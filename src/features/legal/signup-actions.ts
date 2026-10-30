'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/data';
import { safeReturnPath, type Locale } from '@/lib/domain';
import { signupAgreementAccepted } from './signup-model';

export async function acceptSignupAgreements(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const next = safeReturnPath(String(form.get('next') ?? ''), locale);
  const back = `/${locale}/onboarding?next=${encodeURIComponent(next)}`;
  const { db } = await requireUser(locale);
  if (!signupAgreementAccepted(form)) redirect(`${back}&error=invalid`);
  const { error } = await db.rpc('accept_signup_agreements', {
    p_locale: locale,
    p_terms_version: String(form.get('termsVersion')),
    p_collection_version: String(form.get('collectionVersion')),
    p_terms: true,
    p_collection: true,
  });
  if (!error) revalidatePath(`/${locale}/onboarding`);
  redirect(error ? `${back}&error=generic` : back);
}
