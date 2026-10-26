'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
export async function shareGrowthDiary(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = z
    .object({
      record: z.uuid(),
      child: z.uuid(),
      sex: z.enum(['', 'female', 'male']),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/community/diaries?error=invalid`);
  const { record, child, sex } = parsed.data;
  const { db } = await requireUser(locale);
  const result = await db.rpc('share_growth_diary', {
    p_record: record,
    p_same_birth_date: form.get('birth') === 'on',
    p_everyone: form.get('all') === 'on',
    p_sex: sex,
  });
  redirect(
    `/${locale}/care/growth/${record}?child=${child}&${result.error ? 'error=generic' : 'notice=saved'}`,
  );
}
