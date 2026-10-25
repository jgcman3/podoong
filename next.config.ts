import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const config: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  allowedDevOrigins: [
    new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3187')
      .hostname,
  ],
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};
export default createNextIntlPlugin('./src/i18n/request.ts')(config);
