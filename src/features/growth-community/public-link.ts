import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db';
export const validDiaryToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
// Use only after diary_link_photo has authorized the token and exact photo.
export function diaryLinkPhotoClient() {
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export function diaryLinkClient(token: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-diary-link': token } },
    },
  );
}
