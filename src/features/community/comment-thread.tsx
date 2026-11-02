'use client';
import { useRef, useState } from 'react';
import { ThumbsUp, MessageCircle, Send, X, ChevronDown } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { postAuthor, type PostComment } from './post-model';
import { respondToComment, readCommentReplies } from './post-interactions';
export function CommentThread({
  initial,
  child,
  locale,
  timezone,
  onCount,
}: {
  initial: PostComment;
  child: string;
  locale: Locale;
  timezone: string | null;
  onCount: (count: number) => void;
}) {
  const ko = locale === 'ko',
    lock = useRef(false),
    input = useRef<HTMLTextAreaElement>(null);
  const [root, setRoot] = useState(initial),
    [replies, setReplies] = useState<PostComment[]>([]),
    [open, setOpen] = useState(false),
    [loaded, setLoaded] = useState(false),
    [more, setMore] = useState(false),
    [cursor, setCursor] = useState<PostComment>(),
    [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false),
    [target, setTarget] = useState<PostComment>(),
    [draft, setDraft] = useState(''),
    [error, setError] = useState('');
  const merge = (items: PostComment[]) =>
    setReplies((current) =>
      [...current, ...items]
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
  async function load(next = false) {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await readCommentReplies({
        comment: root.id,
        locale,
        ...(next && cursor
          ? { after: cursor.created_at, afterId: cursor.id }
          : {}),
      });
      if (!result.ok) throw Error();
      merge(result.comments);
      setLoaded(true);
      setMore(result.comments.length === 30);
      if (result.comments.length) setCursor(result.comments.at(-1));
    } catch {
      setError(
        ko
          ? '답글을 불러오지 못했어요. 다시 시도해 주세요.'
          : 'Could not load replies. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }
  function write(comment: PostComment) {
    setOpen(true);
    setTarget(comment);
    if (!loaded) void load();
    else input.current?.focus();
  }
  async function act(
    comment: PostComment,
    kind: 'like' | 'reply',
    value: string,
  ) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError('');
    try {
      const result = await respondToComment({
        comment: comment.id,
        child,
        locale,
        kind,
        value,
      });
      if (!result.ok) throw Error();
      setRoot(result.parent);
      onCount(result.comment_count);
      if (kind === 'reply') {
        merge([result.comment]);
        setDraft('');
        setTarget(undefined);
        setOpen(true);
      } else if (comment.id !== root.id)
        setReplies((items) =>
          items.map((item) => (item.id === comment.id ? result.comment : item)),
        );
    } catch {
      setError(
        ko ? '반영하지 못했어요. 다시 시도해 주세요.' : 'Please try again.',
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  function row(comment: PostComment) {
    return (
      <div className="parenting-comment-row">
        <strong>{postAuthor(comment.author, locale)}</strong>
        <time dateTime={comment.created_at}>
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: timezone || 'UTC',
          }).format(new Date(comment.created_at))}
        </time>
        <p>{comment.body}</p>
        <div className="parenting-comment-actions">
          <button
            type="button"
            aria-pressed={comment.liked}
            disabled={pending}
            onClick={() =>
              void act(comment, 'like', comment.liked ? 'off' : 'on')
            }
          >
            <ThumbsUp size={13} />
            {ko ? '좋아요' : 'Like'}
            {comment.likes > 0 && ` ${comment.likes}`}
          </button>
          <button type="button" onClick={() => write(comment)}>
            <MessageCircle size={13} />
            {ko ? '답글 쓰기' : 'Reply'}
          </button>
        </div>
      </div>
    );
  }
  return (
    <li className="parenting-comment-thread">
      {row(root)}
      {root.reply_count > 0 && (
        <button
          className="parenting-replies-toggle"
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen((value) => !value);
            if (!loaded) void load();
          }}
        >
          <ChevronDown size={14} />
          {ko ? `답글 ${root.reply_count}개` : `${root.reply_count} replies`}
        </button>
      )}
      {open && (
        <div className="parenting-replies">
          {replies.map((reply) => (
            <div className="parenting-reply" key={reply.id}>
              {row(reply)}
            </div>
          ))}
          {loading && (
            <p className="parenting-replies-loading" role="status">
              {ko ? '답글 불러오는 중…' : 'Loading replies…'}
            </p>
          )}
          {(!loaded || more) && !loading && (
            <button
              className="parenting-replies-toggle"
              type="button"
              onClick={() => void load(loaded)}
            >
              {ko ? '답글 더 보기' : 'More replies'}
            </button>
          )}
          {target && (
            <form
              className="parenting-reply-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (draft.trim()) void act(target, 'reply', draft.trim());
              }}
            >
              <div>
                <span>
                  {ko
                    ? `${postAuthor(target.author, locale)}님에게 답글`
                    : `Reply to ${postAuthor(target.author, locale)}`}
                </span>
                <button
                  type="button"
                  aria-label={ko ? '답글 취소' : 'Cancel reply'}
                  onClick={() => setTarget(undefined)}
                >
                  <X size={16} />
                </button>
              </div>
              <div>
                <textarea
                  ref={(node) => {
                    input.current = node;
                    if (node) node.focus();
                  }}
                  aria-label={ko ? '답글 입력' : 'Write a reply'}
                  placeholder={ko ? '답글을 입력해 주세요.' : 'Write a reply…'}
                  rows={2}
                  maxLength={1000}
                  disabled={pending}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <button
                  type="submit"
                  aria-label={ko ? '답글 등록' : 'Post reply'}
                  disabled={pending || !draft.trim()}
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="community-compose-error">
          {error}
        </p>
      )}
    </li>
  );
}
