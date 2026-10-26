import { z } from 'zod';
import type { Locale } from '@/lib/domain';
export function calendarReturn(
  locale: Locale,
  childId: string,
  value: unknown,
) {
  const day = z.iso.date().safeParse(value);
  const query = new URLSearchParams({ child: childId });
  if (day.success) {
    query.set('month', day.data.slice(0, 7));
    query.set('day', day.data);
  }
  return `/${locale}/calendar?${query}`;
}
