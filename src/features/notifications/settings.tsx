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
  const { data: prefs, error } = await context.db
    .from('notification_preferences')
    .select('*')
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (error) throw new Error('Notifications unavailable');
  return (
    <div className="account-setting-actions">
      <NotificationPreferencesForm
        locale={locale}
        prefs={prefs}
        childId={context.child.id}
      />
    </div>
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
