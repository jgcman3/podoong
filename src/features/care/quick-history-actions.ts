'use server';
import { z } from 'zod';
import { loadCare } from '@/lib/data';
import { loadQuickTimeline } from './quick-data';

export async function loadQuickDay(input: {
  locale: string;
  childId: string;
  day: string;
}) {
  const parsed = z
    .object({
      locale: z.enum(['ko', 'en']),
      childId: z.uuid(),
      day: z.iso.date(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const { locale, childId, day } = parsed.data;
  const context = await loadCare(locale, childId, []);
  if (context.child.id !== childId || day > context.today)
    return { ok: false as const };
  const entries = await loadQuickTimeline(context, day);
  return {
    ok: true as const,
    entries: entries.filter((entry) => !entry.running),
    writable: context.writable,
  };
}
