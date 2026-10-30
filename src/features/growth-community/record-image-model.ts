import { careLabels } from '@/features/care/activity-config';
import { formatCareDuration } from '@/lib/duration';
import { dateInTimeZone, type Locale } from '@/lib/domain';
import {
  durationMinutes,
  todayEntries,
  type QuickEntry,
} from '@/features/care/quick-model';
import { kindLabel } from '@/features/child-care/copy';
import { vaccineName } from '@/features/vaccination/copy';
import { receivedMoney } from '@/features/received/model';

export type DiaryRecordRow = {
  time: string;
  label: string;
  detail: string;
  color: string;
  startDay?: string;
};
export function diaryRecordRows(
  entries: QuickEntry[],
  day: string,
  today: string,
  timezone: string,
  locale: Locale,
  now = Date.now(),
): DiaryRecordRow[] {
  const ko = locale === 'ko';
  return todayEntries(entries, day, timezone)
    .filter((entry) => {
      const start = dateInTimeZone(new Date(entry.startedAt), timezone);
      return (
        (entry.recordDate
          ? entry.recordDate === day
          : Date.parse(entry.startedAt) <= now && start <= day) &&
        (!entry.running || day === today)
      );
    })
    .map((entry) => {
      const child = entry.childRecord;
      const duration =
        durationMinutes(entry) ?? child?.duration_minutes ?? null;
      const label =
        entry.source === 'vaccination'
          ? vaccineName(entry.kind, entry.customName ?? '', locale)
          : entry.service === 'growth'
            ? ko
              ? '성장 기록'
              : 'Growth record'
            : entry.source === 'feeding'
              ? careLabels(locale)[
                  entry.kind as 'breast' | 'formula' | 'solids'
                ]
              : kindLabel(entry.kind, locale);
      const color =
        entry.source === 'feeding' || entry.service === 'activity'
          ? entry.kind
          : entry.service === 'diaper'
            ? ['dirty', 'mixed'].includes(entry.kind)
              ? 'stool'
              : 'diaper'
            : entry.source === 'vaccination'
              ? 'vaccination'
              : entry.service;
      const detail = [
        entry.service !== 'growth' && child?.title !== label
          ? child?.title
          : '',
        entry.amount !== null
          ? `${new Intl.NumberFormat(locale).format(entry.amount)} ${entry.unit}`
          : '',
        duration !== null ? formatCareDuration(duration, locale) : '',
        child?.temperature_c != null ? `${child.temperature_c} °C` : '',
        child?.medicine_name ?? '',
        child?.sender_name ?? '',
        child?.received_amount != null && child.received_currency
          ? receivedMoney(
              child.received_amount,
              child.received_currency,
              locale,
            )
          : '',
        child?.weight_kg != null ? `${child.weight_kg} kg` : '',
        child?.height_cm != null ? `${child.height_cm} cm` : '',
        child?.head_cm != null ? `${child.head_cm} cm` : '',
        entry.dose != null ? `${entry.dose}${ko ? '차' : ' dose'}` : '',
        entry.running ? (ko ? '진행 중' : 'In progress') : '',
      ]
        .filter(Boolean)
        .join(' · ');
      return {
        time: entry.recordDate
          ? ko
            ? '종일'
            : 'All day'
          : new Intl.DateTimeFormat(locale, {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: timezone,
            }).format(new Date(entry.startedAt)),
        label,
        detail,
        color,
        ...(dateInTimeZone(new Date(entry.startedAt), timezone) !== day &&
        !entry.recordDate
          ? {
              startDay: dateInTimeZone(new Date(entry.startedAt), timezone)
                .slice(5)
                .replace('-', '.'),
            }
          : {}),
      };
    });
}

export const recordsPerImage = 18;
export function recordImagePages(rows: DiaryRecordRow[]) {
  return Array.from(
    { length: Math.ceil(rows.length / recordsPerImage) },
    (_, index) =>
      rows.slice(index * recordsPerImage, (index + 1) * recordsPerImage),
  );
}
