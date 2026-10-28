'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
export type DeveloperRequestState = { saved: boolean; error?: boolean };
export async function submitDeveloperRequest(
  _previous: DeveloperRequestState,
  form: FormData,
): Promise<DeveloperRequestState> {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const parsed = z
    .object({
      id: z.uuid(),
      category: z.enum(['feature', 'bug', 'other']),
      body: z.string().trim().min(1).max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { saved: false, error: true };
  const { db } = await requireUser(locale);
  const result = await db.rpc('submit_developer_request', {
    p_id: parsed.data.id,
    p_category: parsed.data.category,
    p_body: parsed.data.body,
  });
  return result.error ? { saved: false, error: true } : { saved: true };
}
