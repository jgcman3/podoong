import { getRequestConfig } from 'next-intl/server';
import { isLocale } from '@/lib/domain';
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : 'ko';
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
