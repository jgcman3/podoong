import { defineRouting } from 'next-intl/routing';
import { locales } from '@/lib/domain';
export const routing = defineRouting({ locales, defaultLocale: 'ko' });
