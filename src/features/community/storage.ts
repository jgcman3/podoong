import 'server-only';
import { createClient } from '@supabase/supabase-js';
// This credential is used only for Storage after a separate user-scoped authorization.
// No signed URLs are returned, and private database queries always use the user client.
export function communityStorage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (key.startsWith('eyJ')) {
    try {
      const claims = JSON.parse(
        Buffer.from(key.split('.')[1], 'base64url').toString(),
      );
      const ref = new URL(url).hostname.split('.')[0];
      if (
        claims.role !== 'service_role' ||
        (claims.ref && claims.ref !== ref) ||
        (new URL(url).hostname !== '127.0.0.1' &&
          claims.iss === 'supabase-demo')
      )
        return null;
    } catch {
      return null;
    }
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from('community-photos');
}
