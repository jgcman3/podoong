'use server';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { operationAdmin } from './admin';
import { processOperations } from './worker';
export async function dataOperation(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db, user, recentlyAuthenticated } = await requireUser(locale);
  const action = String(form.get('action'));
  if (!['process', 'retry-job'].includes(action) && !recentlyAuthenticated)
    redirect(`/${locale}/data?error=reauth`);
  const confirmation = String(form.get('confirmation'));
  let failed = false;
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
    } catch {
      failed = true;
    }
    if (!failed) {
      await db.auth.signOut();
      redirect(`/${locale}/login?notice=deletion-requested`);
    }
  } else if (action === 'delete-child') {
    const result = await db.rpc('delete_child_data', {
      p_child: String(form.get('child')),
      p_confirmation: confirmation,
    });
    failed = !!result.error;
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
    const role = await db.rpc('is_moderator');
    if (role.error || !role.data) failed = true;
    else {
      try {
        await processOperations();
      } catch {
        failed = true;
      }
    }
  } else failed = true;
  redirect(`/${locale}/data?${failed ? 'error=operation' : 'notice=saved'}`);
}
