import { createClient } from '@supabase/supabase-js';
import { storePhotoVariants } from '../src/features/growth-community/photo-variants.mjs';

// Explicit project confirmation prevents accidentally processing a different environment.
const expected = process.argv
  .find((arg) => arg.startsWith('--expected-url='))
  ?.slice(15);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || expected !== url)
  throw new Error(
    'Supply credentials and --expected-url matching the target project',
  );
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const pending = await db
  .from('child_record_photos')
  .select('id', { count: 'exact', head: true })
  .eq('variants_ready', false);
if (pending.error) throw new Error('Photo inventory unavailable');
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ pending: pending.count }));
} else {
  let cursor,
    processed = 0,
    failed = 0;
  for (;;) {
    let query = db
      .from('child_record_photos')
      .select('id,path')
      .eq('variants_ready', false)
      .order('id')
      .limit(20);
    if (cursor) query = query.gt('id', cursor);
    const rows = await query;
    if (rows.error) throw new Error('Photo inventory unavailable');
    if (!rows.data.length) break;
    for (const photo of rows.data) {
      cursor = photo.id;
      try {
        const file = await db.storage
          .from('child-care-photos')
          .download(photo.path);
        if (file.error || !file.data) throw new Error('Original unavailable');
        await storePhotoVariants(
          db,
          photo.id,
          photo.path,
          Buffer.from(await file.data.arrayBuffer()),
          true,
        );
        processed++;
      } catch {
        failed++;
      }
    }
    console.log(JSON.stringify({ processed, failed }));
  }
  if (failed) process.exitCode = 1;
}
