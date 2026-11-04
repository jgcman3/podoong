import type { MetadataRoute } from 'next';
import type { Locale } from '@/lib/domain';

export function appName(locale: Locale) {
  return locale === 'ko' ? '포둥이' : 'podoong';
}

export function appManifestPath(locale: Locale, token?: string) {
  return `/api/app-manifest${token ? `/${token}` : ''}?locale=${locale}`;
}

export function appManifest(
  locale: Locale,
  token?: string,
): MetadataRoute.Manifest {
  return {
    id: '/',
    name: appName(locale),
    short_name: appName(locale),
    description:
      locale === 'ko'
        ? '가족과 함께하는 육아 기록'
        : 'Care records for your family',
    start_url: `/${locale}/today`,
    lang: locale,
    scope: '/',
    display: 'standalone',
    background_color: '#f7f9fc',
    theme_color: '#f7f9fc',
    icons: token
      ? [192, 512].map((size) => ({
          src: `/api/app-icon/${token}/${size}`,
          sizes: `${size}x${size}`,
          type: 'image/png',
          purpose: 'any' as const,
        }))
      : [
          {
            src: '/icons/podung-192.png?v=full-20261029',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/podung-512.png?v=full-20261029',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/podung-maskable-512.png?v=full-20261029',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
  };
}
