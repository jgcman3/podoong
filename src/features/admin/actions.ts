'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminSession, requireAdmin } from './auth';
import { requestStatuses, requestPriorities } from './model';
export type AdminActionState = {
  error?: 'invalid' | 'conflict' | 'failed';
  saved?: boolean;
};
export async function updateAdminRequest(
  _state: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const input = z
    .object({
      locale: z.enum(['ko', 'en']),
      id: z.uuid(),
      status: z.enum(requestStatuses),
      priority: z.enum(requestPriorities),
      note: z.string().max(2000),
      version: z.coerce.number().int().min(0),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: 'invalid' };
  const r = input.data,
    { db } = await requireAdmin(r.locale);
  const result = await db.rpc('admin_update_request', {
    p_id: r.id,
    p_status: r.status,
    p_priority: r.priority,
    p_note: r.note,
    p_version: r.version,
  });
  if (result.error)
    return { error: result.error.code === '40001' ? 'conflict' : 'failed' };
  revalidatePath(`/${r.locale}/admin`, 'layout');
  return { saved: true };
}
export async function resolveAdminError(form: FormData) {
  const input = z
    .object({ locale: z.enum(['ko', 'en']), id: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return;
  const { db } = await requireAdmin(input.data.locale);
  const result = await db.rpc('admin_resolve_error', { p_id: input.data.id });
  if (result.error) throw new Error('Admin update unavailable');
  revalidatePath(`/${input.data.locale}/admin`, 'layout');
}
export async function adminLogout(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await adminSession(locale);
  await db.auth.signOut();
  redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
}
