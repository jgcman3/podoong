'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/data';

export async function createCaregiverInvite(input: {
  childId: string;
  locale: string;
}) {
  const parsed = z
    .object({ childId: z.uuid(), locale: z.enum(['ko', 'en']) })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const { childId, locale } = parsed.data;
  const { db } = await requireUser(locale);
  // The existing RPC checks family ownership and stores only the token hash.
  const { data, error } = await db.rpc('create_invitation', {
    p_child_id: childId,
    p_role: 'editor',
  });
  if (error || !data) return { ok: false as const };
  return { ok: true as const, path: `/${locale}/invite/${data}` };
}
