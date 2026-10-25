import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { loadCommunityContext } from '@/features/community/data';
import { boardCaption, boardQuery } from '@/features/community/boards';
import { isLocale, type Locale } from '@/lib/domain';
import { ArrowLeft, Heart, Bookmark, ImagePlus } from 'lucide-react';
import { communityCopy } from '@/features/community/copy';
import { Action } from '@/features/community/forms';
import { communityAction, uploadPhoto } from '@/features/community/actions';
export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{
    family?: string;
    page?: string;
    error?: string;
    notice?: string;
  }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success) notFound();
  const q = await searchParams;
  const context = await loadCommunityContext(locale);
  const { db, user } = context;
  const t = communityCopy(locale);
  const { data: post, error } = await db
    .from('community_posts')
    .select('*,community_boards!inner(*)')
    .eq('id', id)
    .maybeSingle();
  if (error || !post) notFound();
  const board = post.community_boards;
  const matching = context.locations.filter(
    (l) =>
      l.country_code === board.country_code &&
      l.scope === board.scope &&
      l.region_code === board.region_code,
  );
  const familyId =
    matching.find((l) => l.family_id === (q.family ?? context.family?.id))
      ?.family_id ??
    matching[0]?.family_id ??
    context.family?.id;
  const boardKey =
    board.scope === 'topic' ? `topic:${board.topic}` : board.scope;
  const back = `/${locale}/community?${boardQuery(familyId, boardKey)}`;
  const n = Number(q.page);
  const page = Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 1000) : 0;
  const [comments, photos, reaction, bookmark, write] = await Promise.all([
    db
      .from('community_comments')
      .select('*')
      .eq('post_id', id)
      .order('created_at')
      .order('id')
      .range(page * 30, page * 30 + 30),
    db
      .from('community_photos')
      .select('*')
      .eq('post_id', id)
      .order('created_at'),
    db
      .from('community_reactions')
      .select('post_id')
      .eq('post_id', id)
      .maybeSingle(),
    db
      .from('community_bookmarks')
      .select('post_id')
      .eq('post_id', id)
      .maybeSingle(),
    db.rpc('community_can_write'),
  ]);
  if (comments.error || photos.error)
    throw new Error('Community detail unavailable');
  return (
    <main className="main-content community-detail">
      <Link className="community-back" href={back}>
        <ArrowLeft size={16} />
        {boardCaption(board, locale)}
      </Link>
      {q.error && (
        <p className="flash error" role="alert">
          {t.error}
        </p>
      )}
      {q.notice && (
        <p className="flash" role="status">
          {t.saved}
        </p>
      )}
      <article className="panel community-post">
        <header className="community-post-header">
          <p className="community-board-name">{boardCaption(board, locale)}</p>
          <h1>{post.title}</h1>
        </header>
        <p className="community-post-body">{post.body}</p>
        {!!photos.data?.length && (
          <div className="community-post-photos">
            {photos.data.map((photo) => (
              <figure key={photo.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/community/photos/${photo.id}`} alt={t.photos} />
                {photo.owner_id === user.id && (
                  <Action
                    locale={locale}
                    familyId={familyId}
                    action="delete-photo"
                    id={photo.id}
                    postId={id}
                    label={t.delete}
                  />
                )}
              </figure>
            ))}
          </div>
        )}
        <footer className="community-post-footer">
          <div className="community-post-actions">
            <Action
              locale={locale}
              familyId={familyId}
              action="reaction"
              id={id}
              postId={id}
              label={`${t.reaction}${reaction.data ? ' ✓' : ''}`}
              fields={{ enabled: String(!reaction.data) }}
              icon={<Heart size={16} aria-hidden="true" />}
              pressed={Boolean(reaction.data)}
            />
            <Action
              locale={locale}
              familyId={familyId}
              action="bookmark"
              id={id}
              postId={id}
              label={`${t.bookmark}${bookmark.data ? ' ✓' : ''}`}
              fields={{ enabled: String(!bookmark.data) }}
              icon={<Bookmark size={16} aria-hidden="true" />}
              pressed={Boolean(bookmark.data)}
            />
          </div>
          {post.author_id === user.id ? (
            <div className="community-author-actions">
              <Link
                className="button secondary"
                href={`/${locale}/community/${id}/edit?${boardQuery(familyId)}`}
              >
                {t.edit}
              </Link>
              <Action
                locale={locale}
                familyId={familyId}
                action="delete-post"
                id={id}
                label={t.delete}
              />
            </div>
          ) : (
            <SafetyActions
              locale={locale}
              familyId={familyId}
              id={id}
              postId={id}
              authorId={post.author_id}
              kind="post"
            />
          )}
        </footer>
      </article>
      {post.author_id === user.id && write.data && (
        <details className="panel community-photo-editor">
          <summary>
            <ImagePlus size={18} aria-hidden="true" />
            {t.photoAttachment}
          </summary>
          <form action={uploadPhoto} className="form-stack">
            <p className="small muted">{t.privacy}</p>
            <input type="hidden" name="locale" value={locale} />
            {familyId && (
              <input type="hidden" name="familyId" value={familyId} />
            )}
            <input type="hidden" name="postId" value={id} />
            <label>
              {t.photos}
              <input
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
            <button className="button primary">{t.upload}</button>
          </form>
        </details>
      )}
      <section
        className="panel community-comments"
        aria-labelledby="community-comments-title"
      >
        <h2 id="community-comments-title">{t.comment}</h2>
        {!comments.data?.length && (
          <p className="small muted">{t.noComments}</p>
        )}
        {comments.data?.slice(0, 30).map((c) => (
          <article className="community-comment" key={c.id}>
            <p className="community-comment-body">{c.body}</p>
            {c.author_id === user.id ? (
              <div className="community-comment-actions">
                <details className="community-comment-edit">
                  <summary className="text-button">{t.edit}</summary>
                  <form action={communityAction} className="form-stack">
                    <input type="hidden" name="locale" value={locale} />
                    {familyId && (
                      <input type="hidden" name="familyId" value={familyId} />
                    )}
                    <input type="hidden" name="action" value="comment" />
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="postId" value={id} />
                    <label>
                      {t.edit}
                      <textarea
                        name="body"
                        defaultValue={c.body}
                        required
                        maxLength={2000}
                      />
                    </label>
                    <button className="button primary">{t.save}</button>
                  </form>
                </details>
                <Action
                  locale={locale}
                  familyId={familyId}
                  action="delete-comment"
                  id={c.id}
                  postId={id}
                  label={t.delete}
                />
              </div>
            ) : (
              <SafetyActions
                locale={locale}
                familyId={familyId}
                id={c.id}
                postId={id}
                authorId={c.author_id}
                kind="comment"
              />
            )}
          </article>
        ))}
        {(page > 0 || (comments.data?.length ?? 0) > 30) && (
          <nav className="pagination">
            {page > 0 && (
              <Link
                href={`?${boardQuery(familyId, undefined, { page: String(page - 1) })}`}
              >
                {t.prev}
              </Link>
            )}
            {(comments.data?.length ?? 0) > 30 && (
              <Link
                href={`?${boardQuery(familyId, undefined, { page: String(page + 1) })}`}
              >
                {t.next}
              </Link>
            )}
          </nav>
        )}
        {write.data && (
          <form action={communityAction} className="form-stack community-reply">
            <input type="hidden" name="locale" value={locale} />
            {familyId && (
              <input type="hidden" name="familyId" value={familyId} />
            )}
            <input type="hidden" name="action" value="comment" />
            <input type="hidden" name="id" value={randomUUID()} />
            <input type="hidden" name="postId" value={id} />
            <label>
              {t.reply}
              <textarea name="body" required maxLength={2000} rows={3} />
            </label>
            <button className="button primary">{t.save}</button>
          </form>
        )}
      </section>
    </main>
  );
}
function SafetyActions({
  locale,
  familyId,
  id,
  postId,
  authorId,
  kind,
}: {
  locale: Locale;
  familyId?: string;
  id: string;
  postId: string;
  authorId: string;
  kind: 'post' | 'comment';
}) {
  const t = communityCopy(locale);
  return (
    <div className="community-safety-actions">
      <details className="community-report">
        <summary className="text-button">{t.report}</summary>
        <Action
          locale={locale}
          familyId={familyId}
          action="report"
          id={id}
          postId={postId}
          label={t.report}
          fields={{ kind }}
        />
      </details>
      <Action
        locale={locale}
        familyId={familyId}
        action="block"
        id={authorId}
        label={t.block}
      />
    </div>
  );
}
