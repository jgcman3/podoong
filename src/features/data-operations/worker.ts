import 'server-only';
import { operationAdmin } from './admin';
export async function processOperations() {
  const admin = operationAdmin();
  const queued = await admin.rpc('queue_orphan_photos');
  if (queued.error) throw new Error('Operations unavailable');
  let cleaned = 0;
  for (let batch = 0; batch < 20; batch++) {
    const { data, error } = await admin
      .from('community_photo_cleanup')
      .select('path')
      .limit(100);
    if (error) throw new Error('Operations unavailable');
    if (!data?.length) break;
    const paths = data.map((p: { path: string }) => p.path);
    const removed = await admin.storage.from('community-photos').remove(paths);
    if (removed.error) break;
    const ack = await admin
      .from('community_photo_cleanup')
      .delete()
      .in('path', paths);
    if (ack.error) throw new Error('Operations unavailable');
    cleaned += paths.length;
  }
  for (let batch = 0; batch < 20; batch++) {
    const rows = await admin
      .from('child_photo_cleanup')
      .select('path')
      .limit(100);
    if (rows.error) throw new Error('Operations unavailable');
    if (!rows.data?.length) break;
    const paths = rows.data.map((row) => row.path);
    const removed = await admin.storage.from('child-care-photos').remove(paths);
    if (removed.error) break;
    const ack = await admin
      .from('child_photo_cleanup')
      .delete()
      .in('path', paths);
    if (ack.error) throw new Error('Operations unavailable');
    cleaned += paths.length;
  }
  let completed = 0;
  for (let i = 0; i < 20; i++) {
    const claim = await admin.rpc('claim_data_operation');
    if (claim.error) throw new Error('Operations unavailable');
    const job = claim.data;
    if (!job?.id) break;
    // Queue acknowledgement alone is insufficient: recheck Storage metadata itself.
    const pending = await admin.rpc('account_has_storage', {
      p_user: job.user_id,
    });
    let success = false;
    if (!pending.error && !pending.data) {
      const result = await admin.auth.admin.deleteUser(job.user_id);
      success = !result.error || result.error.status === 404;
    }
    const finish = await admin.rpc('finish_data_operation', {
      p_job: job.id,
      p_lease: job.lease_token,
      p_success: success,
    });
    if (finish.error) throw new Error('Operations unavailable');
    if (success) completed++;
  }
  return { cleaned, completed };
}
