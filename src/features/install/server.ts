import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';

export function iconStorage() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Icon storage unavailable');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function findIcon(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data, error } = await iconStorage()
    .from('child_app_icons')
    .select('path,layout_version')
    .eq('token', token)
    .maybeSingle();
  if (error) throw new Error('Icon lookup failed');
  return data;
}
