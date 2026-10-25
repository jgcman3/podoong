import Link from 'next/link';
import { isLocale } from '@/lib/domain';
import { notFound } from 'next/navigation';
import { communityCopy } from '@/features/community/copy';
import {
  chooseBoard,
  boardCaption,
  boardQuery,
} from '@/features/community/boards';
import { loadCommunityContext } from '@/features/community/data';
export default async function Community({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    family?: string;
    board?: string;
    page?: string;
    saved?: string;
    error?: string;
    notice?: string;
  }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const q = await searchParams;
  const { db, user, family, families, boards, residenceLink } =
    await loadCommunityContext(locale, q.family);
  const t = communityCopy(locale);
  const board = chooseBoard(boards, q.board);
  const [mod, write] = await Promise.all([
    db.rpc('is_moderator'),
    db.rpc('community_can_write'),
  ]);
  if (mod.error || write.error)
    throw new Error('Community permissions unavailable');
  const raw = Number(q.page);
  const page = Number.isSafeInteger(raw) && raw >= 0 ? Math.min(raw, 1000) : 0;
  const selected =
    q.saved === '1'
      ? db
          .from('community_posts')
          .select(
            '*,community_boards!inner(*),community_bookmarks!inner(user_id)',
          )
          .eq('community_bookmarks.user_id', user.id)
      : db.from('community_posts').select('*,community_boards!inner(*)');
  let query = selected
    .order('notice', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range(page * 20, page * 20 + 20);
  if (board) {
    query = query
      .eq('community_boards.country_code', board.countryCode)
      .eq('community_boards.scope', board.scope);
    query = board.regionCode
      ? query.eq('community_boards.region_code', board.regionCode)
      : query.eq('community_boards.topic', board.topic!);
  }
  const { data: posts, error } = board
    ? await query
    : { data: [], error: null };
  if (error) throw new Error('Community unavailable');
  const link = (key = board?.key, extra: Record<string, string> = {}) =>
    `/${locale}/community?${boardQuery(family?.id, key, extra)}`;
  return (
    <main className="main-content">
      <nav>
        <Link href={`/${locale}/today`}>{t.home}</Link> ·{' '}
        <Link
          href={`/${locale === 'ko' ? 'en' : 'ko'}/community?${boardQuery(family?.id, board?.key, { saved: q.saved ?? '' })}`}
        >
          {locale === 'ko' ? 'English' : '한국어'}
        </Link>
        {mod.data && (
          <>
            {' '}
            · <Link href={`/${locale}/moderation`}>{t.moderation}</Link>
          </>
        )}
      </nav>
      <h1>{t.title}</h1>
      {q.error && <p role="alert">{t.error}</p>}
      {q.notice && <p role="status">{t.saved}</p>}
      {families.length > 1 && (
        <nav className="board-links" aria-label={t.family}>
          {families.map((f) => (
            <Link
              key={f.id}
              href={`/${locale}/community?${boardQuery(f.id, board?.key)}`}
              aria-current={family?.id === f.id ? 'page' : undefined}
            >
              {f.name}
            </Link>
          ))}
        </nav>
      )}
      {!board ? (
        <section className="panel">
          <p>{family ? t.residenceRequired : t.familyRequired}</p>
          <Link className="button primary" href={residenceLink}>
            {t.residenceSettings}
          </Link>
        </section>
      ) : (
        <>
          <div className="board-selection">
            <details>
              <summary>{t.regional}</summary>
              <nav className="board-links" aria-label={t.regional}>
                {boards
                  .filter((b) => b.scope !== 'topic')
                  .map((b) => (
                    <Link
                      key={b.key}
                      href={`${link(b.key)}#posts`}
                      aria-current={board.key === b.key ? 'page' : undefined}
                    >
                      {b.label}
                    </Link>
                  ))}
              </nav>
            </details>
            <details>
              <summary>{t.topical}</summary>
              <nav className="board-links" aria-label={t.topical}>
                {boards
                  .filter((b) => b.scope === 'topic')
                  .map((b) => (
                    <Link
                      key={b.key}
                      href={`${link(b.key)}#posts`}
                      aria-current={board.key === b.key ? 'page' : undefined}
                    >
                      {b.label}
                    </Link>
                  ))}
              </nav>
            </details>
          </div>
          <div className="board-heading" id="posts">
            <h2>{board.label}</h2>
            {write.data && (
              <Link
                className="button primary"
                href={`/${locale}/community/new?${boardQuery(family?.id, board.key)}`}
              >
                {t.create}
              </Link>
            )}
          </div>
          <nav aria-label={t.list}>
            <Link href={link()}>{t.list}</Link> ·{' '}
            <Link
              href={link(board.key, { saved: '1' })}
              aria-current={q.saved === '1' ? 'page' : undefined}
            >
              {t.bookmark}
            </Link>{' '}
            ·{' '}
            <Link href={`/${locale}/community/settings`}>
              {locale === 'ko' ? '커뮤니티 관리' : 'Community settings'}
            </Link>
          </nav>
          {(posts ?? []).slice(0, 20).map((p) => (
            <article className="panel" key={p.id}>
              <p>
                {p.notice && `${t.notice} · `}
                {boardCaption(p.community_boards, locale)}
              </p>
              <h2>
                <Link
                  href={`/${locale}/community/${p.id}?${boardQuery(family?.id)}`}
                >
                  {p.title}
                </Link>
              </h2>
              <p>{p.body.slice(0, 150)}</p>
            </article>
          ))}
          {!posts?.length && <p>{t.empty}</p>}
          <nav>
            {page > 0 && (
              <Link
                href={link(board.key, {
                  page: String(page - 1),
                  saved: q.saved ?? '',
                })}
              >
                {t.prev}
              </Link>
            )}{' '}
            {posts && posts.length > 20 && (
              <Link
                href={link(board.key, {
                  page: String(page + 1),
                  saved: q.saved ?? '',
                })}
              >
                {t.next}
              </Link>
            )}
          </nav>
        </>
      )}
    </main>
  );
}
