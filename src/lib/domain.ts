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
export function pregnancyWeek(due: string, today: string) {
  return Math.max(0, Math.floor((280 - ageInDays(today, due)) / 7));
}
export function recommendedDate(anchor: string, offset: number) {
  return new Date(Date.parse(`${anchor}T00:00:00Z`) + offset * day)
    .toISOString()
    .slice(0, 10);
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
  ['pregnancy', 'Sparkles', 'available'],
  ['birth', 'Backpack', 'available'],
  ['administration', 'FileCheck', 'available'],
  ['postpartum', 'HeartHandshake', 'available'],
  ['feeding', 'Milk', 'available'],
  ['sleep', 'Moon', 'available'],
  ['diaper', 'Baby', 'available'],
  ['growth', 'Ruler', 'available'],
  ['health', 'CalendarHeart', 'available'],
  ['vaccination', 'ShieldCheck', 'available'],
  ['support', 'HandCoins', 'available'],
  ['nursery', 'School', 'planned'],
  ['kindergarten', 'Shapes', 'planned'],
  ['school', 'BookOpen', 'planned'],
  ['community', 'MessagesSquare', 'available'],
  ['polls', 'ChartNoAxesColumn', 'available'],
] as const;
export type ServiceKey = (typeof services)[number][0];

const preparationTitles: Record<string, Record<Locale, string>> = {
  bag: { ko: '출산 가방 목록 확인', en: 'Review your hospital bag checklist' },
  roles: { ko: '가족 돌봄 역할 상의', en: 'Discuss family care roles' },
  admin: {
    ko: '출생 후 행정 공식 안내 확인',
    en: 'Check official birth registration guidance',
  },
};
export function preparationTitle(
  task: { title: string; template_key: string | null },
  locale: Locale,
): string {
  const titles = task.template_key
    ? preparationTitles[task.template_key]
    : undefined;
  return titles && Object.values(titles).includes(task.title)
    ? titles[locale]
    : task.title;
}

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
