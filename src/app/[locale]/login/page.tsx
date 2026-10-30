import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SocialButtons } from '@/components/social-buttons';
import { BrandImage } from '@/components/brand-image';
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
          <BrandImage />
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
            <BrandImage large />
            <span className="float-label">{t('tagline')}</span>
          </div>
        </section>
        <section className="login-card">
          <Flash error={query.error} />
          <SocialButtons locale={locale} next={query.next} />
          {(!configured() ||
            !['google', 'kakao', 'naver'].some((p) =>
              (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? '')
                .split(',')
                .includes(p),
            )) && (
            <div className="setup-note">
              <strong>{t('setup')}</strong>
              <p>{t('setupSub')}</p>
            </div>
          )}
          <div className="login-legal-links">
            <Link href={`/${locale}/intro?next=${encodeURIComponent(next)}`}>
              {locale === 'ko' ? '포둥 둘러보기' : 'Explore podoong'}
            </Link>
            <Link
              href={`/${locale}/legal/terms?source=login&next=${encodeURIComponent(next)}`}
            >
              {locale === 'ko' ? '이용약관' : 'Terms'}
            </Link>
            <Link
              href={`/${locale}/legal/privacy?source=login&next=${encodeURIComponent(next)}`}
            >
              {locale === 'ko' ? '개인정보 처리방침' : 'Privacy Policy'}
            </Link>
          </div>
          <div className="login-footer">{t('helpBody')}</div>
        </section>
      </div>
    </main>
  );
}
