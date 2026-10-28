import { createClient } from '@supabase/supabase-js';
// Explicit configuration only: never reads .env.local or silently selects a project.
const url = process.env.OPERATIONS_SUPABASE_URL;
const key = process.env.OPERATIONS_SUPABASE_SECRET_KEY;
if (!url || !key)
  throw new Error(
    'Set OPERATIONS_SUPABASE_URL and OPERATIONS_SUPABASE_SECRET_KEY',
  );
if (key.startsWith('eyJ')) {
  const c = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
  const host = new URL(url).hostname;
  if (
    c.role !== 'service_role' ||
    (c.ref && c.ref !== host.split('.')[0]) ||
    (host !== '127.0.0.1' && c.iss === 'supabase-demo')
  )
    throw new Error('Credential project mismatch');
}
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function check(result) {
  if (result.error) throw new Error('Operations backend failed');
  return result.data;
}
let cleaned = 0,
  completed = 0;
check(await db.rpc('queue_orphan_photos'));
for (let i = 0; i < 20; i++) {
  const rows = check(
    await db.from('community_photo_cleanup').select('path').limit(25),
  );
  if (!rows.length) break;
  const paths = rows.map((r) => r.path);
  check(await db.storage.from('community-photos').remove(paths));
  check(await db.from('community_photo_cleanup').delete().in('path', paths));
  cleaned += paths.length;
}
for (let i = 0; i < 20; i++) {
  const rows = check(
    await db.from('child_photo_cleanup').select('path').limit(25),
  );
  if (!rows.length) break;
  const paths = rows.map((row) => row.path);
  check(await db.storage.from('child-care-photos').remove(paths));
  check(await db.from('child_photo_cleanup').delete().in('path', paths));
  cleaned += paths.length;
}
for (let i = 0; i < 20; i++) {
  const job = check(await db.rpc('claim_data_operation'));
  if (!job?.id) break;
  let success = false;
  try {
    if (!check(await db.rpc('account_has_storage', { p_user: job.user_id }))) {
      const r = await db.auth.admin.deleteUser(job.user_id);
      success = !r.error || r.error.status === 404;
    }
  } catch {
    /* Persist a sanitized retry status below. */
  }
  check(
    await db.rpc('finish_data_operation', {
      p_job: job.id,
      p_lease: job.lease_token,
      p_success: success,
    }),
  );
  if (success) completed++;
}
console.log(JSON.stringify({ cleaned, completed }));
