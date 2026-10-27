'use client';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { DiaryDetail } from './diary-detail';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

function DiaryNote({
  note,
  ko,
  onOpen,
}: {
  note: string;
  ko: boolean;
  onOpen: () => void;
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
  );
}

export function DiaryBody({
  note,
  date,
  photos,
  measurements,
  locale,
}: {
  note: string;
  date: string;
  photos: string[];
  measurements?: ReactNode;
  locale: 'ko' | 'en';
}) {
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
          <DiaryNote note={note} ko={ko} onOpen={() => setDetailIndex(index)} />
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
                <Image
                  src={`${url}?size=480`}
                  alt={ko ? `성장일기 사진 ${i + 1}` : `Diary photo ${i + 1}`}
                  width={480}
                  height={480}
                  unoptimized
                  draggable={false}
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
