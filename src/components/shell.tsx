import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Home,
  Milk,
  CalendarDays,
  Grid2X2,
  Users,
  Settings,
  Heart,
  ArrowRight,
} from 'lucide-react';
import { Nest } from './nest';
import { ageInDays, pregnancyWeek, type Locale } from '@/lib/domain';
import type { CareContext } from '@/lib/data';
const navigation = [
  ['today', Home],
  ['records', Milk],
  ['calendar', CalendarDays],
  ['family', Users],
  ['services', Grid2X2],
] as const;
export async function Shell({
  context,
  locale,
  section,
  children,
  languageRoute,
  childRoute,
  routeQuery,
}: {
  context: CareContext;
  locale: Locale;
  section: string;
  children: React.ReactNode;
  languageRoute?: string;
  childRoute?: string;
  routeQuery?: Record<string, string>;
}) {
  const t = await getTranslations();
  const { child, children: all, profile, today } = context;
  const date = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${today}T12:00:00Z`));
  const age = child.birth_date
    ? t('days', { days: ageInDays(child.birth_date, today) })
    : t('weeks', { weeks: pregnancyWeek(child.due_date!, today) });
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        {t('today')}
      </a>
      <aside className="sidebar">
        <Link className="wordmark" href={`/${locale}/today?child=${child.id}`}>
          <Nest />
          {t('brand')}
        </Link>
        <p className="brand-tagline">{t('tagline')}</p>
        <nav aria-label={t('services')}>
          {navigation.map(([key, Icon]) => (
            <Link
              key={key}
              href={`/${locale}/${key}?child=${child.id}`}
              className={`nav-link ${section === key ? 'active' : ''}`}
              aria-current={section === key ? 'page' : undefined}
            >
              <Icon size={20} />
              {t(key)}
              {section === key && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="gentle-note">
            <Heart size={18} />
            <strong>{t('helpTitle')}</strong>
            <p>{t('helpBody')}</p>
          </div>
          <Link
            className="nav-link"
            href={`/${locale}/settings?child=${child.id}`}
          >
            <Settings size={18} />
            {t('settings')}
          </Link>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="date">{date}</div>
          <div className="topbar-actions">
            <Link
              className="language"
              href={`/${locale === 'ko' ? 'en' : 'ko'}/${languageRoute ?? section}?${new URLSearchParams({ ...routeQuery, child: child.id })}`}
            >
              {t('language')}
            </Link>
            <Link
              className="avatar"
              href={`/${locale}/settings?child=${child.id}`}
              aria-label={t('settings')}
            >
              {profile.display_name.slice(0, 1)}
            </Link>
          </div>
        </header>
        <main id="main" className="main-content">
          <nav
            className="feature-nav"
            aria-label={locale === 'ko' ? '함께 이용하기' : 'More features'}
          >
            {(['community', 'polls', 'notifications', 'data'] as const).map(
              (key) => (
                <Link
                  key={key}
                  href={`/${locale}/${key}${key === 'community' ? `?family=${context.family.id}` : ''}`}
                >
                  {t(key)}
                </Link>
              ),
            )}
          </nav>
          <section className="child-bar">
            <div className="child-avatar">
              <Heart size={21} />
            </div>
            <div>
              <strong>{child.name}</strong>
              <span>{age}</span>
            </div>
            <details className="child-picker">
              <summary>
                {t('childSelect')} <ArrowRight size={14} />
              </summary>
              <div className="child-options">
                {all.map((c) => (
                  <Link
                    key={c.id}
                    href={`/${locale}/${childRoute ?? section}?${new URLSearchParams({ ...routeQuery, child: c.id })}`}
                  >
                    {c.name}
                    {c.id === child.id ? ' ✓' : ''}
                  </Link>
                ))}
              </div>
            </details>
          </section>
          {children}
        </main>
        <footer className="app-footer">PODUNG · {t('tagline')}</footer>
      </div>
      <nav className="mobile-nav" aria-label={t('services')}>
        {navigation.map(([key, Icon]) => (
          <Link
            key={key}
            className={section === key ? 'active' : ''}
            href={`/${locale}/${key}?child=${child.id}`}
          >
            <Icon size={21} />
            <span>{t(key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
