'use server';
import { z } from 'zod';
import { loadCare } from '@/lib/data';
import type { InsightKind } from '@/features/insights/config';
import { loadInsights } from '@/features/insights/data';
import { ageInDays } from '@/lib/domain';
import { dailyFeedingTotals } from '@/features/care/quick-model';
import { loadQuickTimeline } from '@/features/care/quick-data';
import { diaryRecordRows } from './record-image-model';
type DiaryDayInput = {
  child: string;
  locale: 'ko' | 'en';
  day: string;
};
async function diaryDayContext(input: DiaryDayInput) {
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
  return { context, day, locale };
}
export async function diaryPattern(input: DiaryDayInput) {
  const { context, day } = await diaryDayContext(input);
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
    age: ageInDays(context.child.birth_date, day),
    categories,
    summary: {
      feedingMl:
        sum('breast', 'ml') + sum('formula', 'ml') + sum('solids', 'ml'),
      stoolCount: stats('stool')?.count ?? 0,
      sleepMinutes: Math.round(sum('sleep', 'minutes')),
    },
  };
}
export async function diaryDayRecords(input: DiaryDayInput) {
  const { context, day, locale } = await diaryDayContext(input);
  const entries = await loadQuickTimeline(context, day);
  return {
    age: ageInDays(context.child.birth_date, day),
    name: context.child.name,
    feeding: dailyFeedingTotals(entries, day, context.timezone),
    rows: diaryRecordRows(
      entries,
      day,
      context.today,
      context.timezone,
      locale,
    ),
  };
}
