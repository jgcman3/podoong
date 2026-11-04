'use client';
import './posts.css';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Share2,
  ThumbsUp,
  Repeat2,
  MessageCircle,
  Send,
  Eye,
  ListChecks,
  Check,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { PostRowMenu } from './post-row-menu';
import { PostComposer } from './post-composer';
import { PostShareSheet } from './post-share-sheet';
import { communityTags } from './options';
import {
  postAuthor,
  postHashtags,
  type PostDetail,
  type PostComment,
} from './post-model';
import { CommentThread } from './comment-thread';
import {
  interactWithPost,
  readPostComments,
  recordPostView,
} from './post-interactions';
export function ParentingPostDetail({
  initial,
  initialComments,
  child,
  locale,
  source,
  timezone,
  editing = false,
}: {
  initial: PostDetail;
  initialComments: PostComment[];
  child: string;
  locale: Locale;
  source: 'boards' | 'neighborhood';
  timezone: string | null;
  editing?: boolean;
}) {
  const ko = locale === 'ko',
    input = useRef<HTMLTextAreaElement>(null),
    commentsArea = useRef<HTMLElement>(null);
  const [post, setPost] = useState(initial),
    [editorVersion, setEditorVersion] = useState(0),
    [startEditing, setStartEditing] = useState(editing),
    [comments, setComments] = useState(initialComments),
    [draft, setDraft] = useState(''),
    [pending, setPending] = useState(false),
    [loadingMore, setLoadingMore] = useState(false),
    [hasMore, setHasMore] = useState(initialComments.length === 30),
    [error, setError] = useState(''),
    [shareOpen, setShareOpen] = useState(false),
    [cursor, setCursor] = useState(initialComments.at(-1));
  const lock = useRef(false);
  const viewRequest = useRef<{
    id: string;
    promise: Promise<number | null>;
  } | null>(null);
  useEffect(() => {
    let active = true;
    function record() {
      if (document.visibilityState !== 'visible') return;
      if (viewRequest.current?.id !== initial.id)
        viewRequest.current = {
          id: initial.id,
          promise: recordPostView(initial.id, locale).catch(() => null),
        };
      viewRequest.current!.promise.then((views) => {
        if (active && views !== null) setPost((post) => ({ ...post, views }));
      });
    }
    record();
    document.addEventListener('visibilitychange', record);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', record);
    };
  }, [initial.id, locale]);
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || 'UTC',
    }).format(new Date(value));
  async function act(
    kind: 'like' | 'announce' | 'vote' | 'comment',
    value: string,
  ) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError('');
    try {
      const result = await interactWithPost({
        post: post.id,
        child,
        locale,
        kind,
        value,
      });
      if (!result.ok) {
        setError(
          kind === 'announce'
            ? ko
              ? '거주 동네 설정을 확인한 뒤 다시 시도해 주세요.'
              : 'Check your neighborhood settings and try again.'
            : ko
              ? '반영하지 못했어요. 다시 시도해 주세요.'
              : 'Please try again.',
        );
        return;
      }
      setPost(result.post);
      if (result.comment) {
        setComments((items) =>
          [...items, result.comment!].filter(
            (item, index, all) =>
              all.findIndex((x) => x.id === item.id) === index,
          ),
        );
        setDraft('');
      }
    } catch {
      setError(
        ko ? '반영하지 못했어요. 다시 시도해 주세요.' : 'Please try again.',
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function more() {
    const last = cursor;
    if (!last || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const result = await readPostComments({
        post: post.id,
        locale,
        after: last.created_at,
        afterId: last.id,
      });
      if (!result.ok) throw Error();
      setComments((items) =>
        [...items, ...result.comments]
          .filter(
            (item, index, all) =>
              all.findIndex((x) => x.id === item.id) === index,
          )
          .sort(
            (a, b) =>
              a.created_at.localeCompare(b.created_at) ||
              a.id.localeCompare(b.id),
          ),
      );
      if (result.comments.length) setCursor(result.comments.at(-1));
      setHasMore(result.comments.length === 30);
    } catch {
      setError(ko ? '댓글을 불러오지 못했어요.' : 'Could not load comments.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <article className="parenting-post-page">
      {shareOpen && (
        <PostShareSheet
          url={
            new URL(
              `/${locale}/community/posts/${post.id}`,
              window.location.origin,
            ).href
          }
          title={post.title}
          locale={locale}
          close={() => setShareOpen(false)}
        />
      )}
      <header className="parenting-post-toolbar">
        <Link
          href={`/${locale}/community/${source}?child=${child}`}
          aria-label={ko ? '목록으로 돌아가기' : 'Back to posts'}
        >
          <ArrowLeft size={24} />
        </Link>
        <span>{ko ? '이야기' : 'Story'}</span>
        <div className="parenting-toolbar-actions">
          <button
            type="button"
            aria-label={ko ? '공유하기' : 'Share'}
            onClick={() => setShareOpen(true)}
          >
            <Share2 size={23} />
          </button>
          {!post.mine && (
            <PostRowMenu
              id={post.id}
              child={child}
              locale={locale}
              source={source}
              mine={false}
              row={false}
            />
          )}
          {post.mine && (
            <PostComposer
              key={JSON.stringify([
                editorVersion,
                post.title,
                post.body,
                post.category,
                post.photos,
                post.poll,
              ])}
              child={child}
              locale={locale}
              tags={communityTags(post.audience === 'neighborhood')}
              initialTag={post.category}
              source={
                post.audience === 'neighborhood' ? 'neighborhood' : 'boards'
              }
              edit={post}
              autoOpen={startEditing}
              onSaved={(value) => {
                setPost(value);
                setStartEditing(false);
                setEditorVersion((version) => version + 1);
              }}
            />
          )}
        </div>
      </header>
      <div className="parenting-post-content">
        <span className="community-post-tag">
          {
            communityTags(post.audience === 'neighborhood').find(
              ([id]) => id === post.category,
            )?.[ko ? 1 : 2]
          }
        </span>
        <div className="parenting-post-author">
          <span className="parenting-author-avatar">
            <span>
              {post.author.initial || Array.from(post.author.family)[0] || '?'}
            </span>
          </span>
          <div>
            <strong>{postAuthor(post.author, locale)}</strong>
            <small>
              {post.area} ·{' '}
              <time dateTime={post.created_at}>{date(post.created_at)}</time>
            </small>
          </div>
        </div>
        <h1>{post.title}</h1>
        <p className="community-post-full-text">{post.body}</p>
        {!!post.photos.length && (
          <div className="community-post-images">
            {post.photos.map((id, index) => (
              <div key={id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/community/post-photos/${id}`}
                  alt={
                    ko ? `게시글 사진 ${index + 1}` : `Post photo ${index + 1}`
                  }
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>
        )}
        {post.poll && (
          <section className="parenting-poll" aria-label={ko ? '투표' : 'Poll'}>
            <h2>
              <ListChecks size={19} />
              {post.poll.question}
            </h2>
            <div>
              {post.poll.options.map((option, index) => {
                const count = post.poll!.counts[String(index)] ?? 0,
                  percent = post.poll!.total
                    ? Math.round((count / post.poll!.total) * 100)
                    : 0;
                return (
                  <button
                    type="button"
                    key={index}
                    disabled={pending}
                    aria-pressed={post.poll!.mine === index}
                    onClick={() => void act('vote', String(index))}
                  >
                    <span
                      className="poll-fill"
                      style={{ width: `${percent}%` }}
                    />
                    <span>
                      {post.poll!.mine === index && <Check size={16} />}{' '}
                      {option}
                    </span>
                    <small>
                      {count} · {percent}%
                    </small>
                  </button>
                );
              })}
            </div>
            <p>
              {ko
                ? `${post.poll.total}명 참여 · 한 사람당 한 표`
                : `${post.poll.total} votes · One vote per person`}
            </p>
          </section>
        )}
        {!!postHashtags(post.body).length && (
          <div className="parenting-hashtags">
            {postHashtags(post.body).map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
        <p className="parenting-post-views">
          <Eye size={15} />
          {ko ? `조회 ${post.views}` : `${post.views} views`}
        </p>
        <div className="parenting-post-actions">
          <button
            type="button"
            aria-pressed={post.liked}
            disabled={pending}
            onClick={() => void act('like', post.liked ? 'off' : 'on')}
          >
            <ThumbsUp size={17} />
            {ko ? '공감하기' : 'Like'} {post.likes > 0 && post.likes}
          </button>
          {post.audience === 'country' && (
            <button
              type="button"
              aria-pressed={post.announced}
              disabled={pending}
              onClick={() =>
                void act('announce', post.announced ? 'off' : 'on')
              }
            >
              <Repeat2 size={17} />
              {post.announced
                ? ko
                  ? '동네에 알림'
                  : 'Shared locally'
                : ko
                  ? '동네에 알리기'
                  : 'Tell neighbors'}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              commentsArea.current?.scrollIntoView({ behavior: 'smooth' })
            }
          >
            <MessageCircle size={17} />
            {ko ? '댓글' : 'Comments'} {post.comment_count}
          </button>
        </div>
        {error && (
          <p role="alert" className="community-compose-error">
            {error}
          </p>
        )}
      </div>
      <section
        className="parenting-comments"
        ref={commentsArea}
        aria-label={ko ? '댓글 목록' : 'Comments'}
      >
        <h2>
          {ko ? '댓글' : 'Comments'} {post.comment_count}
        </h2>
        {!comments.length ? (
          <div className="parenting-comments-empty">
            <p>{ko ? '첫 댓글을 남겨보세요.' : 'Be the first to comment.'}</p>
            <button type="button" onClick={() => input.current?.focus()}>
              <MessageCircle size={17} />
              {ko ? '댓글 쓰기' : 'Write a comment'}
            </button>
          </div>
        ) : (
          <ul>
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                initial={comment}
                child={child}
                locale={locale}
                timezone={timezone}
                onCount={(count) =>
                  setPost((current) => ({ ...current, comment_count: count }))
                }
              />
            ))}
          </ul>
        )}
        {hasMore && (
          <button
            className="parenting-comments-more"
            type="button"
            disabled={loadingMore}
            onClick={() => void more()}
          >
            {ko ? '댓글 더 보기' : 'More comments'}
          </button>
        )}
      </section>
      <form
        className="parenting-comment-composer"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) void act('comment', draft.trim());
        }}
      >
        <textarea
          ref={input}
          aria-label={ko ? '댓글 입력' : 'Write a comment'}
          placeholder={ko ? '댓글을 입력해 주세요.' : 'Write a comment…'}
          maxLength={1000}
          rows={1}
          value={draft}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          aria-label={ko ? '댓글 등록' : 'Post comment'}
          disabled={pending || !draft.trim()}
        >
          <Send size={20} />
        </button>
      </form>
    </article>
  );
}
