'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { requireUser } from '@/lib/data';
import { operationAdmin } from './admin';
import { processOperations } from './worker';
export async function dataOperation(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db, user, recentlyAuthenticated } = await requireUser(locale);
  const action = String(form.get('action'));
  const embedded = form.get('returnPage') === 'account';
  const child = z.uuid().safeParse(form.get('child'));
  const returnPath = embedded
    ? `/${locale}/account?panel=${action === 'delete-account' ? 'account' : 'data'}${child.success ? `&child=${child.data}` : ''}`
    : `/${locale}/data?`;
  if (!['process', 'retry-job'].includes(action) && !recentlyAuthenticated)
    redirect(`${returnPath}${embedded ? '&' : ''}error=reauth`);
  const confirmation = String(form.get('confirmation'));
  let failed = false;
  let errorCode = 'operation';
  if (action === 'delete-account') {
    try {
      const admin = operationAdmin();
      const checked = await admin.auth.admin.getUserById(user.id);
      if (checked.error || checked.data.user?.id !== user.id)
        throw new Error('Backend unavailable');
      const permit = await admin.rpc('permit_account_deletion', {
        p_user: user.id,
      });
      if (permit.error || !permit.data) throw new Error('Backend unavailable');
      const result = await db.rpc('request_account_deletion', {
        p_permit: permit.data,
        p_confirmation: confirmation,
      });
      failed = !!result.error;
      if (result.error?.message === 'other_caregivers_remain')
        errorCode = 'caregiversRemain';
    } catch {
      failed = true;
    }
    if (!failed) {
      after(async () => {
        try {
          await processOperations();
        } catch {
          /* Durable queues retain failed work for retry. */
        }
      });
      await db.auth.signOut();
      redirect(`/${locale}/login?notice=deletion-requested`);
    }
  } else if (action === 'delete-child') {
    const result = await db.rpc('delete_child_data', {
      p_child: String(form.get('child')),
      p_confirmation: confirmation,
    });
    failed = !!result.error;
    if (!failed)
      after(async () => {
        try {
          await processOperations();
        } catch {
          /* Durable queues retain failed work for retry. */
        }
      });
  } else if (action === 'transfer') {
    const result = await db.rpc('transfer_family_ownership', {
      p_family: String(form.get('family')),
      p_member: String(form.get('member')),
      p_confirmation: confirmation,
    });
    failed = !!result.error;
  } else if (action === 'retry-job') {
    const result = await db.rpc('retry_data_operation', {
      p_job: String(form.get('job')),
    });
    failed = !!result.error;
  } else if (action === 'process') {
    const role = await db.rpc('service_admin_access');
    if (role.error || !role.data) failed = true;
    else {
      try {
        await processOperations();
      } catch {
        failed = true;
      }
    }
  } else failed = true;
  if (!failed) revalidatePath(`/${locale}`, 'layout');
  redirect(
    `${returnPath}${embedded ? (failed ? `&error=${errorCode}` : '') : failed ? 'error=operation' : 'notice=saved'}`,
  );
}
