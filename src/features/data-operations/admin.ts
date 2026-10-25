import 'server-only';
import { createClient } from '@supabase/supabase-js';
export function operationAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Deletion backend unavailable');
  if (key.startsWith('eyJ')) {
    const claims = JSON.parse(
      Buffer.from(key.split('.')[1], 'base64url').toString(),
    );
    const host = new URL(url).hostname;
    if (
      claims.role !== 'service_role' ||
      (claims.ref && claims.ref !== host.split('.')[0]) ||
      (host !== '127.0.0.1' && claims.iss === 'supabase-demo')
    )
      throw new Error('Deletion backend unavailable');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
