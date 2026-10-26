import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SocialButtons } from '@/components/social-buttons';
import { Nest } from '@/components/nest';
import { Flash } from '@/components/flash';
import { configured } from '@/lib/supabase/server';
import { safeReturnPath, type Locale } from '@/lib/domain';
export default async function Login({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations();
  const otherLocale = locale === 'ko' ? 'en' : 'ko';
  const next = safeReturnPath(query.next, locale);
  const otherNext = `/${otherLocale}${next.slice(3)}`;
  return (
    <main className="welcome-page">
      <header className="welcome-header">
        <Link href={`/${locale}/today`} className="wordmark">
          <Nest />
          {t('brand')}
        </Link>
        <Link
          className="language"
          href={`/${otherLocale}/login?next=${encodeURIComponent(otherNext)}`}
        >
          {t('language')}
        </Link>
      </header>
      <div className="welcome-grid">
        <section className="welcome-story">
          <span className="eyebrow">A LITTLE CARE, EVERY DAY</span>
          <h1>{t('welcome')}</h1>
          <p>{t('welcomeSub')}</p>
          <div className="welcome-illustration">
            <Nest large />
            <span className="float-label">{t('tagline')}</span>
          </div>
        </section>
        <section className="login-card">
          <Flash error={query.error} />
          <SocialButtons locale={locale} next={query.next} />
          {(!configured() ||
            !['google', 'kakao', 'naver'].every((p) =>
              (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? '')
                .split(',')
                .includes(p),
            )) && (
            <div className="setup-note">
              <strong>{t('setup')}</strong>
              <p>{t('setupSub')}</p>
            </div>
          )}
          <div className="login-footer">{t('helpBody')}</div>
        </section>
      </div>
    </main>
  );
}
