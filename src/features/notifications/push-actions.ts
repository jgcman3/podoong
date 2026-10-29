'use server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
const inputSchema = z.object({
  locale: z.enum(['ko', 'en']),
  interval: z.number().int().min(30).max(1440),
  quiet: z.boolean(),
  subscription: z
    .object({
      endpoint: z.url().max(2048),
      keys: z.object({
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
      }),
    })
    .optional(),
});
export async function saveFeedingPush(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { error: true } as const;
  const value = parsed.data,
    { db } = await requireUser(value.locale);
  if (value.subscription) {
    const result = await db.rpc('enable_feeding_push', {
      p_subscription: value.subscription,
      p_interval: value.interval,
      p_quiet: value.quiet,
      p_locale: value.locale,
    });
    if (result.error) return { error: true } as const;
    (await cookies()).set('podung-push-device', result.data, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 31536000,
    });
    return { id: result.data } as const;
  }
  const result = await db.rpc('save_feeding_push_preferences', {
    p_enabled: true,
    p_interval: value.interval,
    p_quiet: value.quiet,
  });
  return { error: Boolean(result.error) } as const;
}
export async function disableFeedingPush(locale: 'ko' | 'en') {
  if (!['ko', 'en'].includes(locale)) return { error: true };
  const { db } = await requireUser(locale),
    jar = await cookies(),
    id = z.uuid().safeParse(jar.get('podung-push-device')?.value);
  if (id.success) {
    const result = await db.rpc('remove_feeding_push', { p_id: id.data });
    if (result.error) return { error: true };
  }
  jar.delete('podung-push-device');
  return { error: false };
}
