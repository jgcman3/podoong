'use client';
import { DiaryLike, type DiaryReaction } from './diary-like';
import { setDiaryLike } from './like-action';
import { DiaryThumbnail } from './thumbnail';
import { createPortal } from 'react-dom';
import { DiaryDetail } from './diary-detail';
import dynamic from 'next/dynamic';
const MomentShare = dynamic(() =>
  import('./moment-share').then((module) => module.MomentShare),
);
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

function DiaryNote({
  note,
  ko,
  onOpen,
  reactions,
}: {
  note: string;
  ko: boolean;
  onOpen: () => void;
  reactions?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const text = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    const node = text.current;
    if (!node) return;
    const measure = () => {
      if (!expanded) setOverflow(node.scrollHeight > node.clientHeight + 1);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [expanded, note]);
  return (
    <div className={`diary-note ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="diary-read-trigger"
        aria-label={ko ? '일기 보기' : 'Read diary'}
        onClick={onOpen}
      >
        <span ref={text} id={id} className="record-note">
          {note}
        </span>
      </button>
      {(reactions || overflow || expanded) && (
        <div className="diary-note-actions diary-reactions">
          {reactions}
          {(overflow || expanded) && (
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={id}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (ko ? '접기' : 'Less') : ko ? '더보기' : 'More'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DiaryBody({
  note,
  author,
  date,
  photos,
  measurements,
  locale,
  photoCacheScope,
  recordId,
  reaction: initialReaction,
  moment,
}: {
  recordId?: string;
  reaction?: DiaryReaction;
  moment?: { name: string; age: number | null };
  note: string;
  author?: string;
  date: string;
  photos: string[];
  measurements?: ReactNode;
  locale: 'ko' | 'en';
  photoCacheScope: string;
}) {
  const [reaction, setReaction] = useState(
    initialReaction ?? { likes: 0, liked: false },
  );
  const [likeBusy, setLikeBusy] = useState(false);
  const likeInFlight = useRef(false);
  async function like() {
    if (!recordId || likeInFlight.current) return;
    likeInFlight.current = true;
    setLikeBusy(true);
    const previous = reaction;
    const next = !previous.liked;
    setReaction({
      liked: next,
      likes: Math.max(0, previous.likes + (next ? 1 : -1)),
    });
    try {
      const saved = await setDiaryLike({
        record: recordId,
        liked: next,
        locale,
      });
      setReaction(saved ?? previous);
    } catch {
      setReaction(previous);
    } finally {
      likeInFlight.current = false;
      setLikeBusy(false);
    }
  }
  const likeButton =
    recordId && initialReaction ? (
      <DiaryLike
        reaction={reaction}
        busy={likeBusy}
        locale={locale}
        onClick={() => {
          void like();
        }}
      />
    ) : null;
  const [index, setIndex] = useState(0);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const ko = locale === 'ko';
  return (
    <div
      className={`public-diary-body diary-story ${photos.length ? 'with-photos' : ''} ${measurements ? 'with-measurements' : ''}`}
    >
      <div className="diary-copy">
        {measurements ?? (
          <div className="diary-measurements-space" aria-hidden="true" />
        )}
        {note && (
          <DiaryNote
            note={note}
            ko={ko}
            onOpen={() => setDetailIndex(index)}
            reactions={likeButton}
          />
        )}
        {!note && likeButton && (
          <div className="diary-reactions">{likeButton}</div>
        )}
      </div>
      {photos.length > 0 && (
        <>
          <div
            ref={gallery}
            className="public-diary-photos diary-photo-carousel"
            role="region"
            aria-label={ko ? '일기 사진' : 'Diary photos'}
            tabIndex={photos.length > 1 ? 0 : undefined}
            onKeyDown={(event) => {
              if (
                !['ArrowLeft', 'ArrowRight'].includes(event.key) ||
                !gallery.current ||
                !window.matchMedia('(max-width: 760px)').matches
              )
                return;
              event.preventDefault();
              gallery.current.scrollBy({
                left:
                  gallery.current.clientWidth *
                  (event.key === 'ArrowRight' ? 1 : -1),
                behavior: 'smooth',
              });
            }}
            onScroll={(event) => {
              const node = event.currentTarget;
              setIndex(
                Math.min(
                  photos.length - 1,
                  Math.max(0, Math.round(node.scrollLeft / node.clientWidth)),
                ),
              );
            }}
          >
            {photos.map((url, i) => (
              <button
                type="button"
                key={url}
                onClick={() => setDetailIndex(i)}
                aria-label={
                  ko
                    ? `성장일기 사진 ${i + 1} 크게 보기`
                    : `Open diary photo ${i + 1}`
                }
              >
                <DiaryThumbnail
                  key={`${photoCacheScope}:${url}`}
                  source={`${url}?size=480`}
                  scope={photoCacheScope}
                  alt={ko ? `성장일기 사진 ${i + 1}` : `Diary photo ${i + 1}`}
                />
              </button>
            ))}
          </div>
          {photos.length > 1 && (
            <span className="diary-photo-position" aria-live="polite">
              {index + 1} / {photos.length}
            </span>
          )}
        </>
      )}
      {detailIndex !== null &&
        createPortal(
          <DiaryDetail
            reactions={likeButton}
            momentAction={
              moment ? (
                <MomentShare
                  name={moment.name}
                  age={moment.age}
                  note={note}
                  date={date}
                  photos={photos}
                  locale={locale}
                />
              ) : undefined
            }
            author={author}
            date={date}
            note={note}
            photos={photos}
            measurements={measurements}
            initialIndex={detailIndex}
            ko={ko}
            onClose={() => setDetailIndex(null)}
          />,
          document.body,
        )}
    </div>
  );
}
