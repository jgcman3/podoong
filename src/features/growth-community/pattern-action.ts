'use server';
import { z } from 'zod';
import { loadCare } from '@/lib/data';
import type { InsightKind } from '@/features/insights/config';
import { loadInsights } from '@/features/insights/data';
export async function diaryPattern(input: {
  child: string;
  locale: 'ko' | 'en';
  day: string;
}) {
  const parsed = z
    .object({
      child: z.uuid(),
      locale: z.enum(['ko', 'en']),
      day: z.iso.date(),
    })
    .safeParse(input);
  if (!parsed.success) throw new Error('Invalid date');
  const { child, locale, day } = parsed.data;
  const context = await loadCare(locale, child, []);
  if (
    context.child.id !== child ||
    !context.writable ||
    day > context.today ||
    day < context.child.birth_date
  )
    throw new Error('Unavailable');
  const { week } = await loadInsights(context, day);
  const categories = Object.values(week.categories)
    .filter((category) => !['growth', 'development'].includes(category.kind))
    .map((category) => ({
      kind: category.kind,
      segments:
        category.days.find((value) => value.date === day)?.segments ?? [],
    }))
    .filter((category) => category.segments.length > 0);
  const stats = (kind: InsightKind) =>
    week.categories[kind].days.find((value) => value.date === day);
  const sum = (kind: InsightKind, metric: string) =>
    (stats(kind)?.values[metric] ?? []).reduce(
      (total, sample) => total + sample.value,
      0,
    );
  return {
    categories,
    summary: {
      feedingMl:
        sum('breast', 'ml') + sum('formula', 'ml') + sum('solids', 'ml'),
      stoolCount: stats('stool')?.count ?? 0,
      sleepMinutes: Math.round(sum('sleep', 'minutes')),
    },
  };
}
