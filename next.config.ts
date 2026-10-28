import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {
  distDir: process.env.PODUNG_E2E === '1' ? '.next-e2e' : '.next',
  typescript: {
    tsconfigPath:
      process.env.PODUNG_E2E === '1' ? 'tsconfig.e2e.json' : 'tsconfig.json',
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:locale/share/diary/:token',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
  ...(process.env.PODUNG_E2E === '1' ? { devIndicators: false as const } : {}),
  agentRules: false,
  allowedDevOrigins: [
    '192.168.45.85',
    new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3187')
      .hostname,
  ],
  experimental: { serverActions: { bodySizeLimit: '26mb' } },
};
export default createNextIntlPlugin('./src/i18n/request.ts')(config);
