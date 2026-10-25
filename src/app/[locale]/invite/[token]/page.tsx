import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient, configured } from '@/lib/supabase/server';
import { acceptInvite } from '@/features/family/actions';
import { Nest } from '@/components/nest';
import { Flash } from '@/components/flash';
import type { Locale } from '@/lib/domain';
export default async function Invitation({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale, token } = await params;
  const q = await searchParams;
  const t = await getTranslations();
  const path = `/${locale}/invite/${token}`;
  if (!configured())
    redirect(`/${locale}/login?next=${encodeURIComponent(path)}`);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(path)}`);
  const { data: profile } = await db
    .from('profiles')
    .select('consented_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.consented_at)
    redirect(`/${locale}/onboarding?next=${encodeURIComponent(path)}`);
  return (
    <main className="onboarding-page">
      <section className="onboard-card">
        <Nest />
        <h1>{t('inviteTitle')}</h1>
        <p>{t('inviteBefore')}</p>
        <Flash error={q.error} />
        <form action={acceptInvite} className="form-stack">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={token} />
          <label className="check-label">
            <input type="checkbox" name="confirm" required />
            {t('consent')}
          </label>
          <button className="button primary">{t('acceptInvite')}</button>
        </form>
        <Link href={`/${locale}/today`} className="text-link">
          {t('back')}
        </Link>
      </section>
    </main>
  );
}
