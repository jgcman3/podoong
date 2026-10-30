'use server';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { invitationToken } from './join-model';

export async function openFamilyInvitation(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  await requireUser(locale);
  const token = invitationToken(form.get('invitation'));
  if (!token)
    redirect(
      form.get('settings') === 'true'
        ? `/${locale}/account?panel=join&error=invite`
        : `/${locale}/onboarding?mode=join&error=invite`,
    );
  redirect(`/${locale}/invite/${token}`);
}
