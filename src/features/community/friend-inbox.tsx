'use client';
import { useEffect, useState } from 'react';
import { Heart, MessageCircleHeart, X } from 'lucide-react';
import type { Locale } from '@/lib/domain';

type Reaction = {
  id: string;
  name: string;
  kind: 'wave' | 'heart' | 'comfort';
  created_at: string;
};
export function FriendInbox({
  childId,
  locale,
}: {
  childId: string;
  locale: Locale;
}) {
  const ko = locale === 'ko';
  const [open, setOpen] = useState(false),
    [items, setItems] = useState<Reaction[]>([]),
    [before, setBefore] = useState<string>(),
    [next, setNext] = useState<string>(),
    [refresh, setRefresh] = useState(0),
    [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const query = new URLSearchParams({
          child: childId,
          locale,
          ...(before ? { before } : {}),
        });
        const response = await fetch(
          `/api/community/playground/reactions?${query}`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) throw Error('Unavailable');
        const data = await response.json();
        if (controller.signal.aborted || !data.ok) return;
        const page: Reaction[] = data.inbox.items;
        setItems((previous) =>
          before ? [...previous, ...page.slice(0, 20)] : page.slice(0, 20),
        );
        setNext(page.length > 20 ? page[19].id : undefined);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [open, childId, locale, before, refresh]);
  useEffect(() => {
    if (!open || before) return;
    const timer = setInterval(() => {
      if (!document.hidden) setRefresh((value) => value + 1);
    }, 60_000);
    function resumed() {
      if (!document.hidden) setRefresh((value) => value + 1);
    }
    document.addEventListener('visibilitychange', resumed);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resumed);
    };
  }, [open, before]);
  return (
    <>
      <button
        type="button"
        className="world-inbox-toggle"
        aria-label={ko ? '받은 이력 보기' : 'View received reactions'}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setBefore(undefined);
        }}
      >
        <MessageCircleHeart size={19} />
      </button>
      {open && (
        <section
          className="world-inbox"
          aria-label={ko ? '받은 이력' : 'Received reactions'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          <header>
            <strong>
              {ko ? '오늘 받은 마음' : 'Today’s little kindnesses'}
            </strong>
            <button
              type="button"
              aria-label={ko ? '닫기' : 'Close'}
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          </header>
          {items.length === 0 && !loading && !failed && (
            <p className="world-inbox-empty">
              {ko ? '아직 받은 마음이 없어요.' : 'No reactions yet today.'}
            </p>
          )}
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <span aria-hidden="true">
                  {item.kind === 'wave' ? (
                    '👋'
                  ) : item.kind === 'comfort' ? (
                    '🤗'
                  ) : (
                    <Heart size={17} fill="currentColor" />
                  )}
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {ko
                      ? item.kind === 'wave'
                        ? '인사했어요'
                        : item.kind === 'heart'
                          ? '하트를 보냈어요'
                          : '토닥토닥, 위로를 보냈어요'
                      : item.kind === 'wave'
                        ? 'waved hello'
                        : item.kind === 'heart'
                          ? 'sent a heart'
                          : 'sent a little comfort'}
                  </small>
                </span>
                <time dateTime={item.created_at}>
                  {new Intl.DateTimeFormat(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(item.created_at))}
                </time>
              </li>
            ))}
          </ul>
          {loading && (
            <p className="world-inbox-empty" role="status">
              {ko ? '불러오는 중…' : 'Loading…'}
            </p>
          )}
          {failed && (
            <button
              type="button"
              onClick={() => setRefresh((value) => value + 1)}
            >
              {ko ? '다시 불러오기' : 'Try again'}
            </button>
          )}
          {next && !loading && (
            <button
              type="button"
              className="world-inbox-more"
              onClick={() => setBefore(next)}
            >
              {ko ? '더 보기' : 'More'}
            </button>
          )}
        </section>
      )}
    </>
  );
}
