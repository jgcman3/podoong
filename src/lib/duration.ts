import type { Locale } from './domain';

export function formatCareDuration(value: number, locale: Locale) {
  const minutes = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return locale === 'ko' ? `${minutes}분` : `${minutes}m`;
  return [
    locale === 'ko' ? `${hours}시간` : `${hours}h`,
    remainder ? (locale === 'ko' ? `${remainder}분` : `${remainder}m`) : '',
  ]
    .filter(Boolean)
    .join(' ');
}
