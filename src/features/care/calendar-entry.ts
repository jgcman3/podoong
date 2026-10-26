import type { Locale } from '@/lib/domain';
import type { CalendarEntry } from './calendar-model';
import { vaccineName } from '@/features/vaccination/copy';
export function calendarTitle(event: CalendarEntry, locale: Locale) {
  return event.source === 'vaccination'
    ? vaccineName(event.vaccine!, event.custom_name ?? '', locale)
    : event.title;
}
export function calendarKind(
  kind: CalendarEntry['event_kind'],
  locale: Locale,
) {
  return locale === 'ko'
    ? {
        general: '일정',
        hospital: '병원',
        medication: '투약',
        vaccination: '예방접종',
      }[kind]
    : {
        general: 'Event',
        hospital: 'Doctor',
        medication: 'Medicine',
        vaccination: 'Vaccine',
      }[kind];
}
