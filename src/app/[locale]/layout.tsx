import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import '../globals.css';
import { UsageTracker } from '@/features/admin/usage-tracker';
import { AppSplash } from '@/components/app-splash';
import { appleStartupImages } from '@/lib/app-startup.mjs';
import { InstallAppProvider } from '@/components/install-app';
import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { appName, appManifestPath } from '@/features/install/manifest';
import {
  desktopBrowser,
  devicePlatform,
  inAppBrowser,
} from '@/lib/device-platform';
import {
  AppearanceProvider,
  type ThemePreference,
} from '@/components/appearance';
const baseMetadata: Metadata = {
  description: '가족과 함께 만드는 포근한 돌봄의 하루',
  icons: {
    icon: '/icons/podung-192.png?v=full-20261029',
    apple: '/icons/podung-180.png?v=full-20261029',
  },
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const value = (await params).locale;
  const locale = value === 'en' ? 'en' : 'ko';
  const metadata: Metadata = {
    ...baseMetadata,
    title: { default: appName(locale), template: '%s · podoong' },
    applicationName: appName(locale),
    manifest: appManifestPath(locale),
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      startupImage: appleStartupImages(),
      title: appName(locale),
    },
  };
  const token = (await cookies()).get('podoong-app-icon')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return metadata;
  return {
    ...metadata,
    manifest: appManifestPath(locale, token),
    icons: {
      icon: `/api/app-icon/${token}/192`,
      apple: `/api/app-icon/${token}/180`,
    },
  };
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f9fc',
};
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const store = await cookies();
  const userAgent = (await headers()).get('user-agent') || '';
  const value = store.get('podung-theme')?.value;
  const preference: ThemePreference =
    value === 'dark' || value === 'system' ? value : 'light';
  const resolved =
    preference === 'system'
      ? store.get('podung-theme-resolved')?.value === 'dark'
        ? 'dark'
        : 'light'
      : preference;
  return (
    <html lang={locale} data-theme={resolved}>
      {/* Browser extensions can inject body attributes before hydration. */}
      <body suppressHydrationWarning>
        <NextIntlClientProvider>
          <AppearanceProvider initialPreference={preference}>
            <InstallAppProvider
              initialPlatform={devicePlatform(userAgent, '', 0)}
              initialBrowser={desktopBrowser(userAgent)}
              initialInAppBrowser={inAppBrowser(userAgent)}
            >
              <AppSplash locale={locale} />
              <UsageTracker />
              {children}
            </InstallAppProvider>
          </AppearanceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
