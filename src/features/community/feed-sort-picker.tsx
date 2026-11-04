'use client';
import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/domain';
export function FeedSortPicker({
  locale,
  popular,
  selected,
  all,
  popularHref,
}: {
  locale: Locale;
  popular: boolean;
  selected: boolean;
  all: string;
  popularHref: string;
}) {
  const router = useRouter(),
    ko = locale === 'ko';
  return (
    <span className={`community-feed-sort${selected ? ' is-selected' : ''}`}>
      <select
        aria-label={ko ? '전체·인기' : 'All or popular'}
        value={selected ? (popular ? popularHref : all) : ''}
        onChange={(event) => router.replace(event.target.value)}
      >
        {!selected && (
          <option value="" disabled hidden>
            {ko ? '전체·인기' : 'All / popular'}
          </option>
        )}
        <option value={all}>{ko ? '전체' : 'All'}</option>
        <option value={popularHref}>{ko ? '인기' : 'Popular'}</option>
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </span>
  );
}
