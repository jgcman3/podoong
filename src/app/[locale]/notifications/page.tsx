import { loadPushPreferences } from '@/features/notifications/settings';
import { FeedingPushSettings } from '@/features/notifications/feeding-push-settings';
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
  const [{ data: profile, error: profileError }, pushPreferences] =
    await Promise.all([
      db
        .from('profiles')
        .select('timezone,consented_at')
        .eq('id', user.id)
        .single(),
      loadPushPreferences({ db, user }),
    ]);
  if (profileError) throw new Error('Notifications unavailable');
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
          <p>{t.feedingMessage}</p>
          <p>
            <time dateTime={item.delivered_at ?? ''}>
              {new Intl.DateTimeFormat(locale, {
                timeZone: profile?.timezone ?? 'Asia/Seoul',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(item.delivered_at!))}
            </time>
          </p>
          <Link href={`/${locale}/records?child=${item.child_id}`}>
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
        <FeedingPushSettings locale={locale} {...pushPreferences} />
        <p>{t.privacy}</p>
      </section>
    </main>
  );
}
