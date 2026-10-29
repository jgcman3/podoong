import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import '../globals.css';
import { InstallAppProvider } from '@/components/install-app';
import type { Viewport } from 'next';
import { cookies } from 'next/headers';
import {
  AppearanceProvider,
  type ThemePreference,
} from '@/components/appearance';
export const metadata = {
  title: { default: '포둥 · Podung', template: '%s · Podung' },
  description: '가족과 함께 만드는 포근한 돌봄의 하루',
  manifest: '/manifest.webmanifest',
  applicationName: '포둥',
  appleWebApp: { capable: true, title: '포둥', statusBarStyle: 'default' },
  icons: { icon: '/icons/podung-192.png', apple: '/icons/podung-180.png' },
};
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
      <body>
        <NextIntlClientProvider>
          <AppearanceProvider initialPreference={preference}>
            <InstallAppProvider>{children}</InstallAppProvider>
          </AppearanceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
