'use server';
import { createClient, configured } from '@/lib/supabase/server';
import { errorInput } from './model';
export async function reportServiceError(input: unknown) {
  const parsed = errorInput.safeParse(input);
  if (!parsed.success || !configured()) return;
  try {
    const db = await createClient(),
      { data } = await db.auth.getUser();
    if (!data.user) return;
    await db.rpc('report_service_error', {
      p_id: parsed.data.id,
      p_section: parsed.data.section,
      p_code: parsed.data.code,
      ...(parsed.data.digest ? { p_digest: parsed.data.digest } : {}),
    });
  } catch {
    /* Error reporting must never prevent retrying the original page. */
  }
}
