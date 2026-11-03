'use client';
import { Heart } from 'lucide-react';
import type { Locale } from '@/lib/domain';
export type DiaryReaction = { likes: number; liked: boolean };
export function DiaryLike({
  reaction,
  busy,
  onClick,
  locale,
}: {
  reaction: DiaryReaction;
  busy: boolean;
  onClick: () => void;
  locale: Locale;
}) {
  return (
    <button
      type="button"
      className="diary-like"
      aria-label={locale === 'ko' ? '좋아요' : 'Like'}
      aria-pressed={reaction.liked}
      disabled={busy}
      onClick={onClick}
    >
      <Heart
        size={16}
        aria-hidden="true"
        fill={reaction.liked ? 'currentColor' : 'none'}
      />
      <span>{reaction.likes.toLocaleString(locale)}</span>
    </button>
  );
}
