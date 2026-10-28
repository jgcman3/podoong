'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
export async function notificationAction(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const action = form.get('action');
  const path = `/${locale}/${action === 'retry' ? 'operations' : 'notifications'}`;
  let failed = true;
  if (action === 'save') {
    const schema = z.object({
      start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      hour: z.coerce.number().int().min(0).max(23),
      frequency: z.coerce.number().int().min(1).max(1440),
      interval: z.coerce.number().int().min(30).max(1440),
      snooze: z.coerce.number().int().min(0).max(1440),
    });
    const input = schema.safeParse(Object.fromEntries(form));
    if (input.success) {
      const result = await db.rpc('save_notification_preferences', {
        p_task: form.has('task'),
        p_event: form.has('event'),
        p_feeding: form.has('feeding'),
        p_quiet_start: input.data.start,
        p_quiet_end: input.data.end,
        p_hour: input.data.hour,
        p_frequency: input.data.frequency,
        p_interval: input.data.interval,
        p_snooze_minutes: input.data.snooze,
      });
      failed = !!result.error;
    }
  } else if (action === 'read' || action === 'retry') {
    const id = z.uuid().safeParse(form.get('id'));
    if (id.success) {
      const result =
        action === 'read'
          ? await db.rpc('read_notification', { p_id: id.data })
          : await db.rpc('retry_notification_job', { p_id: id.data });
      failed = !!result.error;
    }
  }
  if (action === 'save' && form.get('returnPage') === 'account') {
    revalidatePath(`/${locale}/account`);
    const child = z.uuid().safeParse(form.get('child'));
    redirect(
      `/${locale}/account?panel=notifications${child.success ? `&child=${child.data}` : ''}${failed ? '&error=generic' : ''}`,
    );
  }
  redirect(`${path}?${failed ? 'error=1' : 'notice=saved'}`);
}
