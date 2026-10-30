'use server';
import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
export async function pollAction(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const action = form.get('action');
  const operator = action === 'save' || action === 'hide';
  const path = `/${locale}/${operator ? 'operations' : 'polls'}`;
  const id = z.uuid().safeParse(form.get('id') || randomUUID());
  if (!id.success) redirect(`${path}?error=1`);
  let failed = true;
  if (action === 'vote') {
    const option = z.coerce
      .number()
      .int()
      .min(0)
      .max(5)
      .safeParse(form.get('option') ?? Number.NaN);
    if (option.success) {
      const { error } = await db.rpc('vote_daily_poll', {
        p_id: id.data,
        p_option: option.data,
      });
      failed = !!error;
    }
  } else if (action === 'hide') {
    const reason = z
      .string()
      .trim()
      .min(1)
      .max(500)
      .safeParse(form.get('reason'));
    if (reason.success) {
      const { error } = await db.rpc('hide_daily_poll', {
        p_id: id.data,
        p_hidden: form.get('hidden') === 'true',
        p_reason: reason.data,
      });
      failed = !!error;
    }
  } else if (action === 'save') {
    const input = z
      .object({
        day: z.iso.date(),
        questionKo: z.string().trim().min(1).max(300),
        questionEn: z.string().trim().min(1).max(300),
        options: z
          .array(
            z.object({
              ko: z.string().trim().min(1).max(120),
              en: z.string().trim().min(1).max(120),
            }),
          )
          .min(2)
          .max(6),
      })
      .safeParse({
        day: form.get('day'),
        questionKo: form.get('questionKo'),
        questionEn: form.get('questionEn'),
        options: Array.from({ length: 6 }, (_, i) => ({
          ko: String(form.get(`ko${i}`) ?? '').trim(),
          en: String(form.get(`en${i}`) ?? '').trim(),
        })).filter((o) => o.ko || o.en),
      });
    if (input.success) {
      const { error } = await db.rpc('save_daily_poll', {
        p_id: id.data,
        p_day: input.data.day,
        p_question_ko: input.data.questionKo,
        p_question_en: input.data.questionEn,
        p_options: input.data.options,
      });
      failed = !!error;
    }
  }
  if (!failed) {
    revalidatePath('/ko/polls');
    revalidatePath('/en/polls');
    if (operator) revalidatePath(path);
  }
  redirect(`${path}?${failed ? 'error=1' : 'notice=saved'}`);
}
