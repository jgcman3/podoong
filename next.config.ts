import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {
  distDir: process.env.PODUNG_E2E === '1' ? '.next-e2e' : '.next',
  typescript: {
    tsconfigPath:
      process.env.PODUNG_E2E === '1' ? 'tsconfig.e2e.json' : 'tsconfig.json',
  },
  poweredByHeader: false,
  agentRules: false,
  allowedDevOrigins: [
    new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3187')
      .hostname,
  ],
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};
export default createNextIntlPlugin('./src/i18n/request.ts')(config);
