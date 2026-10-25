import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { isLocale } from '@/lib/domain';
import { communityCopy } from '@/features/community/copy';
import { Action } from '@/features/community/forms';
import { communityAction } from '@/features/community/actions';
export default async function Moderation({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; error?: string; notice?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { db } = await requireUser(locale);
  const mod = await db.rpc('is_moderator');
  if (!mod.data) notFound();
  const t = communityCopy(locale);
  const q = await searchParams;
  const n = Number(q.page);
  const page = Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 1000) : 0;
  const [reports, history, restrictions, posts] = await Promise.all([
    db
      .from('community_reports')
      .select('*')
      .eq('status', 'open')
      .order('created_at')
      .range(page * 30, page * 30 + 30),
    db
      .from('moderation_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * 30, page * 30 + 30),
    db
      .from('community_restrictions')
      .select('*')
      .order('until_at', { ascending: false })
      .limit(50),
    db
      .from('community_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * 30, page * 30 + 30),
  ]);
  if ([reports, history, restrictions, posts].some((r) => r.error))
    throw new Error('Moderation unavailable');
  return (
    <main className="main-content">
      <Link href={`/${locale}/community`}>{t.title}</Link>
      <h1>{t.moderation}</h1>
      {q.error && <p role="alert">{t.error}</p>}
      {q.notice && <p role="status">{t.saved}</p>}
      <h2>{t.report}</h2>
      {reports.data?.slice(0, 30).map((r) => (
        <article className="panel" key={r.id}>
          <p>
            {r.reason} · <code>{r.post_id ?? r.comment_id}</code>
          </p>
          {r.post_id && (
            <Link href={`/${locale}/community/${r.post_id}`}>
              {t.titleLabel}
            </Link>
          )}
          <Action
            locale={locale}
            moderation
            action="hide"
            id={(r.post_id ?? r.comment_id)!}
            label={t.hide}
            fields={{ kind: r.comment_id ? 'comment' : 'post' }}
          />
          <Action
            locale={locale}
            moderation
            action="unhide"
            id={(r.post_id ?? r.comment_id)!}
            label={t.unhide}
            fields={{ kind: r.comment_id ? 'comment' : 'post' }}
          />
          <Action
            locale={locale}
            moderation
            action="resolve"
            id={r.id}
            label={t.resolve}
          />
        </article>
      ))}
      <form action={communityAction} className="panel">
        <h2>{t.restrict}</h2>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="action" value="restrict" />
        <input type="hidden" name="moderation" value="true" />
        <label>
          {t.user}
          <input name="id" required pattern="[0-9a-fA-F-]{36}" />
        </label>
        <label>
          {t.days}
          <input
            name="days"
            type="number"
            min={1}
            max={365}
            defaultValue={7}
            required
          />
        </label>
        <label>
          {t.reason}
          <input name="reason" maxLength={500} required />
        </label>
        <button className="button">{t.restrict}</button>
      </form>
      {restrictions.data?.map((r) => (
        <article className="panel" key={r.user_id}>
          <p>
            <code>{r.user_id}</code> · {r.reason} · {r.until_at}
          </p>
          <Action
            locale={locale}
            moderation
            action="unrestrict"
            id={r.user_id}
            label={t.unrestrict}
          />
        </article>
      ))}
      <h2>{t.titleLabel}</h2>
      {posts.data?.slice(0, 30).map((p) => (
        <article className="panel" key={p.id}>
          <Link href={`/${locale}/community/${p.id}`}>{p.title}</Link>
          <p>
            <code>{p.author_id}</code>
          </p>
          <Action
            locale={locale}
            moderation
            action={p.hidden ? 'unhide' : 'hide'}
            id={p.id}
            label={p.hidden ? t.unhide : t.hide}
            fields={{ kind: 'post' }}
          />
          <Action
            locale={locale}
            moderation
            action="notice"
            id={p.id}
            label={`${t.notice} ${p.notice ? '−' : '+'}`}
            fields={{ enabled: String(!p.notice) }}
          />
        </article>
      ))}
      <h2>{t.history}</h2>
      {history.data?.slice(0, 30).map((h) => (
        <p key={h.id}>
          {h.action} · {h.reason} · <code>{h.subject_id}</code> · {h.created_at}
        </p>
      ))}
      <nav>
        {page > 0 && <Link href={`?page=${page - 1}`}>{t.prev}</Link>}{' '}
        {[reports, history, posts].some((r) => (r.data?.length ?? 0) > 30) && (
          <Link href={`?page=${page + 1}`}>{t.next}</Link>
        )}
      </nav>
    </main>
  );
}
