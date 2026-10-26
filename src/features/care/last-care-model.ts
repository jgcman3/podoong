import type { Locale } from '@/lib/domain';
export function careDuration(minutes: number, locale: Locale) {
  const value = Math.max(0, Math.floor(minutes));
  if (value < 1) return locale === 'ko' ? '1분 미만' : 'Under 1 min';
  const hours = Math.floor(value / 60),
    rest = value % 60;
  return locale === 'ko'
    ? hours
      ? `${hours}시간${rest ? ` ${rest}분` : ''}`
      : `${value}분`
    : hours
      ? `${hours}h${rest ? ` ${rest}m` : ''}`
      : `${value} min`;
}
export function careElapsed(at: string, now: number, locale: Locale) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(at)) / 60000));
  if (minutes < 1) return locale === 'ko' ? '방금' : 'Just now';
  if (minutes >= 1440)
    return locale === 'ko'
      ? `${Math.floor(minutes / 1440)}일 전`
      : `${Math.floor(minutes / 1440)}d ago`;
  return locale === 'ko'
    ? `${careDuration(minutes, locale)} 전`
    : `${careDuration(minutes, locale)} ago`;
}
