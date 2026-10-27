export type Locale = 'ko' | 'en';
export const locales = ['ko', 'en'] as const;
export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
const day = 86_400_000;
export function ageInDays(birth: string, today: string) {
  return Math.floor(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${birth}T00:00:00Z`)) / day,
  );
}
export function dateInTimeZone(value: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}
export function safeReturnPath(
  value: string | null | undefined,
  locale: Locale,
) {
  if (
    !value ||
    !value.startsWith(`/${locale}/`) ||
    /[\\%\s]/.test(value) ||
    value.split('/').includes('..')
  )
    return `/${locale}/today`;
  return value;
}
export const services = [
  ['feeding', 'Milk', 'available'],
  ['sleep', 'Moon', 'available'],
  ['diaper', 'Baby', 'available'],
  ['growth', 'Ruler', 'available'],
  ['health', 'CalendarHeart', 'available'],
  ['vaccination', 'ShieldCheck', 'available'],
  ['support', 'HandCoins', 'available'],
  ['nursery', 'School', 'planned'],
  ['kindergarten', 'Shapes', 'planned'],
  ['community', 'MessagesSquare', 'available'],
  ['polls', 'ChartNoAxesColumn', 'available'],
] as const;
export type ServiceKey = (typeof services)[number][0];

export function hasRecentAuthentication(
  methods:
    readonly (string | { method: string; timestamp: number })[] | undefined,
  now = Date.now(),
): boolean {
  return (methods ?? []).some((entry) => {
    if (
      typeof entry === 'string' ||
      !['oauth', 'password'].includes(entry.method) ||
      !Number.isFinite(entry.timestamp)
    )
      return false;
    const authenticated = entry.timestamp * 1000;
    return now >= authenticated && now - authenticated < 5 * 60 * 1000;
  });
}
