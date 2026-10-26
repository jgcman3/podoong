'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
const targetSchema = z.object({
  child: z.uuid(),
  record: z.uuid(),
  locale: z.enum(['ko', 'en']),
});
export async function getGrowthHistory(input: {
  child: string;
  record: string;
  locale: Locale;
  page: number;
}) {
  const parsed = targetSchema
    .extend({ page: z.number().int().min(0).max(10000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, rows: [], more: false };
  const v = parsed.data,
    { db } = await requireUser(v.locale);
  const result = await db.rpc('growth_diary_history', {
    p_child: v.child,
    p_record: v.record,
    p_page: v.page,
  });
  if (result.error) return { ok: false as const, rows: [], more: false };
  return {
    ok: true as const,
    rows: result.data.slice(0, 100),
    more: result.data.length > 100,
  };
}
export async function reportGrowthDiary(input: {
  child: string;
  record: string;
  locale: Locale;
  reason: string;
  detail: string;
}) {
  const parsed = targetSchema
    .extend({
      reason: z.enum(['spam', 'inappropriate', 'privacy', 'other']),
      detail: z.string().trim().max(400),
    })
    .safeParse(input);
  if (!parsed.success) return false;
  const v = parsed.data,
    { db } = await requireUser(v.locale);
  const reasons = {
    spam: '스팸·광고',
    inappropriate: '부적절한 내용',
    privacy: '개인정보 노출',
    other: '기타',
  };
  const result = await db.rpc('report_growth_diary', {
    p_child: v.child,
    p_record: v.record,
    p_reason: reasons[v.reason] + (v.detail ? ` · ${v.detail}` : ''),
  });
  return !result.error;
}
export async function moderateGrowthDiary(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = z
    .object({
      record: z.uuid(),
      hidden: z.enum(['true', 'false']),
      reason: z.string().trim().min(1).max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/moderation?error=invalid`);
  const { db } = await requireUser(locale),
    v = parsed.data;
  const result = await db.rpc('moderate_growth_diary', {
    p_record: v.record,
    p_hidden: v.hidden === 'true',
    p_reason: v.reason,
  });
  redirect(
    `/${locale}/moderation?${result.error ? 'error=generic' : 'notice=saved'}`,
  );
}
