import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { isLocale } from '@/lib/domain';
import { notificationCopy } from '@/features/notifications/copy';
import { notificationAction } from '@/features/notifications/actions';
export default async function Notifications({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; error?: string; notice?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { db, user } = await requireUser(locale);
  const t = notificationCopy(locale);
  const q = await searchParams;
  const [
    { data: profile, error: profileError },
    { data: prefs, error: prefsError },
  ] = await Promise.all([
    db
      .from('profiles')
      .select('timezone,consented_at')
      .eq('id', user.id)
      .single(),
    db
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  if (profileError || prefsError) throw new Error('Notifications unavailable');
  if (!profile?.consented_at) redirect(`/${locale}/onboarding`);
  const sync = await db.rpc('sync_notifications');
  if (sync.error) throw new Error('Notifications unavailable');
  const raw = Number(q.page);
  const page = Number.isSafeInteger(raw) && raw >= 0 ? Math.min(raw, 1000) : 0;
  const { data: items, error } = await db
    .from('notifications')
    .select('*')
    .order('delivered_at', { ascending: false })
    .order('id')
    .range(page * 30, page * 30 + 30);
  if (error) throw new Error('Notifications unavailable');
  return (
    <main className="main-content">
      <nav>
        <Link href={`/${locale}/today`}>{t.home}</Link> ·{' '}
        <Link href={`/${locale === 'ko' ? 'en' : 'ko'}/notifications`}>
          {locale === 'ko' ? 'English' : '한국어'}
        </Link>
      </nav>
      <h1>{t.title}</h1>
      <p>{t.channel}</p>
      {q.error && <p role="alert">{t.error}</p>}
      {q.notice && <p role="status">{t.saved}</p>}
      {(items ?? []).slice(0, 30).map((item) => (
        <article key={item.id} className="panel">
          <p>
            {item.kind === 'task'
              ? t.taskMessage
              : item.kind === 'event'
                ? t.eventMessage
                : t.feedingMessage}
          </p>
          <p>
            <time dateTime={item.delivered_at ?? ''}>
              {new Intl.DateTimeFormat(locale, {
                timeZone: profile?.timezone ?? 'Asia/Seoul',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(item.delivered_at!))}
            </time>
          </p>
          <Link
            href={`/${locale}/${item.kind === 'feeding' ? 'records' : item.kind === 'event' ? 'calendar' : 'today'}?child=${item.child_id}`}
          >
            {t.open}
          </Link>
          {!item.read_at && (
            <form action={notificationAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="action" value="read" />
              <input type="hidden" name="id" value={item.id} />
              <button className="button">{t.read}</button>
            </form>
          )}
        </article>
      ))}
      {!items?.length && <p>{t.empty}</p>}
      <nav>
        {page > 0 && (
          <Link href={`/${locale}/notifications?page=${page - 1}`}>
            {t.prev}
          </Link>
        )}{' '}
        {items && items.length > 30 && (
          <Link href={`/${locale}/notifications?page=${page + 1}`}>
            {t.next}
          </Link>
        )}
      </nav>
      <section className="panel">
        <h2>{t.settings}</h2>
        <p>
          {t.timezone}: {profile?.timezone ?? 'Asia/Seoul'}
        </p>
        <form action={notificationAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="action" value="save" />
          {(['task', 'event', 'feeding'] as const).map((kind) => (
            <label key={kind}>
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
        <p>{t.privacy}</p>
      </section>
    </main>
  );
}
