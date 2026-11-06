'use server';
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
  if (action === 'read' || action === 'retry') {
    const id = z.uuid().safeParse(form.get('id'));
    if (id.success) {
      const result =
        action === 'read'
          ? await db.rpc('read_notification', { p_id: id.data })
          : await db.rpc('retry_notification_job', { p_id: id.data });
      failed = !!result.error;
    }
  }
  redirect(`${path}?${failed ? 'error=1' : 'notice=saved'}`);
}
