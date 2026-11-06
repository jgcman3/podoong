import { cookies } from 'next/headers';
import { z } from 'zod';
import { FeedingPushSettings } from './feeding-push-settings';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';

export async function loadPushPreferences(
  context: Pick<CareContext, 'db' | 'user'>,
) {
  const jar = await cookies(),
    device = z.uuid().safeParse(jar.get('podung-push-device')?.value);
  const [prefs, config, subscription] = await Promise.all([
    context.db
      .from('notification_preferences')
      .select('*')
      .eq('user_id', context.user.id)
      .maybeSingle(),
    context.db.rpc('get_feeding_push_config'),
    device.success
      ? context.db
          .from('web_push_subscriptions')
          .select('id')
          .eq('id', device.data)
          .eq('user_id', context.user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (prefs.error || config.error || subscription.error)
    throw new Error('Notifications unavailable');
  return {
    publicKey: config.data,
    initialDevice: subscription.data?.id ?? null,
    initialPlayground: prefs.data?.playground_enabled ?? false,
    initialPlaygroundQuiet: prefs.data?.playground_quiet ?? true,
    initialInterval: prefs.data?.feeding_interval_minutes ?? 180,
    initialMode: (prefs.data?.feeding_enabled === false
      ? 'off'
      : prefs.data?.feeding_reference === 'yesterday'
        ? 'yesterday'
        : 'interval') as 'off' | 'yesterday' | 'interval',
    initialQuiet:
      !prefs.data || prefs.data.quiet_start !== prefs.data.quiet_end,
  };
}
export async function NotificationSettings({
  context,
  locale,
}: {
  context: CareContext;
  locale: Locale;
}) {
  return (
    <FeedingPushSettings
      locale={locale}
      {...await loadPushPreferences(context)}
    />
  );
}
