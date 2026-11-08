import Link from 'next/link';
import { NavigationStatus } from './navigation-status';
import { getTranslations } from 'next-intl/server';
import {
  Home,
  BookOpen,
  ChartNoAxesColumn,
  MessagesSquare,
  Heart,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { BrandImage } from './brand-image';
import { TopbarChildPicker } from './topbar-child-picker';
import { ageInDays, type Locale } from '@/lib/domain';
import type { CareContext } from '@/lib/data';
const navigation = [
  ['today', Home],
  ['insights', ChartNoAxesColumn],
  ['community', BookOpen],
  ['neighborhood', MessagesSquare],
] as const;
export async function Shell({
  context,
  locale,
  section,
  children,
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
  const ageFor = (c: typeof child) =>
    c.birth_date
      ? section === 'today'
        ? `D+${ageInDays(c.birth_date, today)}`
        : t('days', { days: ageInDays(c.birth_date, today) })
      : t('birthDateMissing');
  const age = ageFor(child);
  const settingsPage = section === 'account' || section === 'settings';
  const settingsLabel = locale === 'ko' ? '설정' : 'Settings';
  const childInTopbar = [
    'today',
    'insights',
    'community',
    'family',
    'account',
    'settings',
    'neighborhood',
  ].includes(section);
  const childOptions = all.map((c) => ({
    id: c.id,
    name: c.name,
    sex: c.sex,
    age: ageFor(c),
    href: `/${locale}/${childRoute ?? section}?${new URLSearchParams({ ...routeQuery, child: c.id })}`,
  }));
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        {t('today')}
      </a>
      <aside className="sidebar">
        <Link
          replace
          className="wordmark"
          href={`/${locale}/today?child=${child.id}`}
        >
          <BrandImage />
          {t('brand')}
        </Link>
        <p className="brand-tagline">{t('tagline')}</p>
        <nav aria-label={locale === 'ko' ? '주 메뉴' : 'Main navigation'}>
          {navigation.map(([key, Icon]) => (
            <Link
              key={key}
              prefetch={true}
              replace
              href={`/${locale}/${key === 'community' ? 'community/diaries' : key === 'neighborhood' ? 'community' : key}?child=${child.id}`}
              className={`nav-link ${section === key ? 'active' : ''}`}
              aria-current={section === key ? 'page' : undefined}
            >
              <NavigationStatus locale={locale} />
              <Icon size={20} />
              {key === 'neighborhood'
                ? locale === 'ko'
                  ? '동네 육아'
                  : 'Neighborhood community'
                : t(key === 'community' ? 'growthDiary' : key)}
              {section === key && <span className="nav-dot" />}
            </Link>
          ))}
          <Link
            className={`nav-link desktop-settings-link ${['account', 'family', 'settings'].includes(section) ? 'active' : ''}`}
            href={`/${locale}/account?child=${child.id}`}
            replace
            prefetch={true}
            aria-current={
              ['account', 'family', 'settings'].includes(section)
                ? 'page'
                : undefined
            }
          >
            <NavigationStatus locale={locale} />
            <Settings size={20} aria-hidden="true" />
            <span>{settingsLabel}</span>
            {['account', 'family', 'settings'].includes(section) && (
              <span className="nav-dot" />
            )}
          </Link>
        </nav>
      </aside>
      <div className="app-content">
        <header className="topbar">
          {settingsPage ? (
            <span className="topbar-page-title">{settingsLabel}</span>
          ) : childInTopbar ? (
            <TopbarChildPicker
              key={child.id}
              current={childOptions.find((option) => option.id === child.id)!}
              options={childOptions}
              label={t('childSelect')}
            />
          ) : (
            <div className="date">{date}</div>
          )}
          <div className="topbar-actions">
            <Link
              className="avatar"
              href={`/${locale}/account?child=${child.id}&panel=account`}
              aria-label={t('settings')}
            >
              {profile.display_name.slice(0, 1)}
            </Link>
          </div>
        </header>
        <main id="main" className="main-content">
          {!childInTopbar && (
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
                      replace
                      href={`/${locale}/${childRoute ?? section}?${new URLSearchParams({ ...routeQuery, child: c.id })}`}
                    >
                      {c.name}
                      {c.id === child.id ? ' ✓' : ''}
                    </Link>
                  ))}
                </div>
              </details>
            </section>
          )}
          {children}
        </main>
        <footer className="app-footer">podoong · {t('tagline')}</footer>
      </div>
      <nav
        className="mobile-nav"
        aria-label={locale === 'ko' ? '주 메뉴' : 'Main navigation'}
      >
        {navigation.map(([key, Icon]) => (
          <Link
            key={key}
            prefetch={true}
            replace
            className={section === key ? 'active' : ''}
            aria-current={section === key ? 'page' : undefined}
            href={`/${locale}/${key === 'community' ? 'community/diaries' : key === 'neighborhood' ? 'community' : key}?child=${child.id}`}
          >
            <NavigationStatus locale={locale} />
            <Icon size={21} />
            <span>
              {key === 'neighborhood'
                ? locale === 'ko'
                  ? '동네 육아'
                  : 'Talk'
                : key === 'community' && locale === 'en'
                  ? 'Diary'
                  : t(key === 'community' ? 'growthDiary' : key)}
            </span>
          </Link>
        ))}
        <Link
          className={`mobile-settings-link ${['account', 'family', 'settings'].includes(section) ? 'active' : ''}`}
          href={`/${locale}/account?child=${child.id}`}
          replace
          prefetch={true}
          aria-current={
            ['account', 'family', 'settings'].includes(section)
              ? 'page'
              : undefined
          }
        >
          <NavigationStatus locale={locale} />
          <Settings size={21} aria-hidden="true" />
          <span>{settingsLabel}</span>
        </Link>
      </nav>
    </div>
  );
}
