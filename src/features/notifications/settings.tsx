import { cookies } from 'next/headers';
import { z } from 'zod';
import { FeedingPushSettings } from './feeding-push-settings';
import type { CareContext } from '@/lib/data';
import type { Row } from '@/lib/db';
import type { Locale } from '@/lib/domain';
import { notificationCopy } from './copy';
import { notificationAction } from './actions';

export async function NotificationSettings({
  context,
  locale,
}: {
  context: CareContext;
  locale: Locale;
}) {
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
  return (
    <FeedingPushSettings
      locale={locale}
      publicKey={config.data}
      initialDevice={subscription.data?.id ?? null}
      initialInterval={prefs.data?.feeding_interval_minutes ?? 180}
      initialMode={
        prefs.data?.feeding_enabled === false
          ? 'off'
          : prefs.data?.feeding_reference === 'yesterday'
            ? 'yesterday'
            : 'interval'
      }
      initialQuiet={
        !prefs.data || prefs.data.quiet_start !== prefs.data.quiet_end
      }
    />
  );
}
export function NotificationPreferencesForm({
  locale,
  prefs,
  childId,
}: {
  locale: Locale;
  prefs: Row<'notification_preferences'> | null;
  childId?: string;
}) {
  const t = notificationCopy(locale);
  return (
    <form action={notificationAction} className="form-stack">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="action" value="save" />
      {childId && (
        <>
          <input type="hidden" name="returnPage" value="account" />
          <input type="hidden" name="child" value={childId} />
        </>
      )}
      {(['task', 'event', 'feeding'] as const).map((kind) => (
        <label key={kind} className="notification-setting-toggle">
          <input
            type="checkbox"
            name={kind}
            defaultChecked={
              prefs ? prefs[`${kind}_enabled`] : kind !== 'feeding'
            }
          />
          {t[kind]}
        </label>
      ))}
      <label>
        {t.quietStart}
        <input
          type="time"
          name="start"
          required
          defaultValue={(prefs?.quiet_start ?? '22:00').slice(0, 5)}
        />
      </label>
      <label>
        {t.quietEnd}
        <input
          type="time"
          name="end"
          required
          defaultValue={(prefs?.quiet_end ?? '07:00').slice(0, 5)}
        />
      </label>
      <p>{t.equal}</p>
      <label>
        {t.hour}
        <input
          type="number"
          name="hour"
          min="0"
          max="23"
          required
          defaultValue={prefs?.delivery_hour ?? 9}
        />
      </label>
      <label>
        {t.frequency}
        <input
          type="number"
          name="frequency"
          min="1"
          max="1440"
          required
          defaultValue={prefs?.frequency_minutes ?? 60}
        />
      </label>
      <label>
        {t.interval}
        <input
          type="number"
          name="interval"
          min="30"
          max="1440"
          required
          defaultValue={prefs?.feeding_interval_minutes ?? 180}
        />
      </label>
      <label>
        {t.snooze}
        <select name="snooze" defaultValue="0">
          <option value="0">{t.none}</option>
          <option value="60">{t.oneHour}</option>
          <option value="1440">{t.day}</option>
        </select>
      </label>
      <button className="button">{t.save}</button>
    </form>
  );
}
