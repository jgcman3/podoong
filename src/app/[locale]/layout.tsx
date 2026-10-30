import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import '../globals.css';
import { InstallAppProvider } from '@/components/install-app';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import {
  AppearanceProvider,
  type ThemePreference,
} from '@/components/appearance';
const baseMetadata: Metadata = {
  title: { default: '포둥 · podoong', template: '%s · podoong' },
  description: '가족과 함께 만드는 포근한 돌봄의 하루',
  manifest: '/manifest.webmanifest',
  applicationName: '포둥',
  appleWebApp: { capable: true, title: '포둥', statusBarStyle: 'default' },
  icons: {
    icon: '/icons/podung-192.png?v=full-20261029',
    apple: '/icons/podung-180.png?v=full-20261029',
  },
};
export async function generateMetadata() {
  const token = (await cookies()).get('podoong-app-icon')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return baseMetadata;
  return {
    ...baseMetadata,
    manifest: `/api/app-manifest/${token}`,
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
