'use client';
import { CalendarDays } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Database } from '@/lib/database.types';
import { SharedDiaryPhotos } from './shared-diary-photos';
import { loadSharedDiaries } from './shared-feed-action';
type Entry =
  Database['public']['Functions']['read_child_diary_link']['Returns'][number];
export function SharedDiaryFeed({
  token,
  initial,
  initialPage,
  locale,
}: {
  token: string;
  initial: Entry[];
  initialPage: number;
  locale: string;
}) {
  const ko = locale === 'ko';
  const [entries, setEntries] = useState(initial.slice(0, 20));
  const [page, setPage] = useState(initialPage);
  const [more, setMore] = useState(initial.length > 20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [closed, setClosed] = useState(false);
  const inFlight = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    if (inFlight.current || !more) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      const result = await loadSharedDiaries(token, page + 1);
      if (result.status === 'closed') {
        setClosed(true);
        setEntries([]);
        setMore(false);
        return;
      }
      if (result.status !== 'ok') throw new Error('Feed unavailable');
      setEntries((previous) => {
        const ids = new Set(previous.map((entry) => entry.id));
        return [
          ...previous,
          ...result.entries.slice(0, 20).filter((entry) => !ids.has(entry.id)),
        ];
      });
      setPage(page + 1);
      setMore(result.entries.length > 20);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [more, page, token]);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !more || error || busy) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void load();
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [load, more, error, busy]);
  return (
    <>
      <div className="shared-diary-feed">
        {entries.map((entry, index) => (
          <article className="shared-diary-card" key={entry.id}>
            <header>
              <CalendarDays size={17} strokeWidth={1.6} aria-hidden="true" />
              <time dateTime={entry.recorded_date}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'long',
                  timeZone: 'UTC',
                }).format(new Date(`${entry.recorded_date}T00:00:00Z`))}
              </time>
            </header>
            {entry.photo_ids.length > 0 && (
              <SharedDiaryPhotos
                token={token}
                photos={entry.photo_ids}
                ko={ko}
                eager={index === 0}
              />
            )}
            {entry.note && <p className="shared-diary-note">{entry.note}</p>}
          </article>
        ))}
        {!entries.length && (
          <p className="shared-diary-empty">
            {closed
              ? ko
                ? '공유가 종료되었어요.'
                : 'Sharing has ended.'
              : ko
                ? '공개된 성장일기가 없어요.'
                : 'No public diaries yet.'}
          </p>
        )}
      </div>
      {more && (
        <div ref={sentinel} className="shared-diary-load">
          {error && (
            <p role="alert">
              {ko ? '일기를 불러오지 못했어요.' : 'Could not load diaries.'}
            </p>
          )}
          <button type="button" disabled={busy} onClick={() => void load()}>
            {busy
              ? ko
                ? '불러오는 중…'
                : 'Loading…'
              : error
                ? ko
                  ? '다시 시도'
                  : 'Try again'
                : ko
                  ? '이전 일기 더 보기'
                  : 'Load earlier diaries'}
          </button>
        </div>
      )}
    </>
  );
}
