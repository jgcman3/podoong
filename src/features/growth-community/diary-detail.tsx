'use client';

import Image from 'next/image';
import { useSettledPhoto } from './use-settled-photo';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export function DiaryDetail({
  note,
  author,
  date,
  photos,
  measurements,
  initialIndex,
  ko,
  onClose,
}: {
  note: string;
  author?: string;
  date: string;
  photos: string[];
  measurements?: ReactNode;
  initialIndex: number;
  ko: boolean;
  onClose: () => void;
}) {
  const historyId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    // A detail gets one Back step; photo changes never add history entries.
    if (window.history.state?.diaryDetail !== historyId) {
      window.history.pushState(
        { ...window.history.state, diaryDetail: historyId },
        '',
        window.location.href,
      );
    }
    const pop = () => closeRef.current();
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [historyId]);
  function back() {
    if (window.history.state?.diaryDetail === historyId) window.history.back();
    else onClose();
  }
  const dialog = useRef<HTMLDialogElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const index = useSettledPhoto(gallery, photos.length, initialIndex);
  const [galleryHeight, setGalleryHeight] = useState<number>();
  useEffect(() => {
    const image = gallery.current?.querySelectorAll('img')[index];
    if (!image) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0)
        setGalleryHeight(entry.contentRect.height + 8);
    });
    observer.observe(image);
    return () => observer.disconnect();
  }, [index]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = 'hidden';
    if (gallery.current)
      gallery.current.scrollLeft = gallery.current.clientWidth * initialIndex;
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, [initialIndex]);
  return (
    <dialog
      ref={dialog}
      className="diary-detail"
      aria-label={ko ? '성장일기' : 'Growth diary'}
      onCancel={(event) => {
        event.preventDefault();
        back();
      }}
    >
      <header className="diary-detail-toolbar">
        <button
          type="button"
          onClick={back}
          autoFocus
          aria-label={ko ? '돌아가기' : 'Back'}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          <span className="diary-back-label">{ko ? '돌아가기' : 'Back'}</span>
        </button>
        <time dateTime={date} className="diary-detail-date">
          {new Intl.DateTimeFormat(ko ? 'ko-KR' : 'en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short',
            timeZone: 'UTC',
          }).format(new Date(`${date}T00:00:00Z`))}
        </time>
        {photos.length > 1 && (
          <span aria-live="polite">
            {index + 1} / {photos.length}
          </span>
        )}
      </header>
      {photos.length > 0 && (
        <div
          ref={gallery}
          className="diary-detail-gallery"
          style={{ height: galleryHeight }}
          role="region"
          aria-label={ko ? '일기 사진' : 'Diary photos'}
          tabIndex={0}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            gallery.current?.scrollBy({
              left:
                gallery.current.clientWidth *
                (event.key === 'ArrowRight' ? 1 : -1),
              behavior: 'smooth',
            });
          }}
        >
          {photos.map((url, i) => (
            <div className="diary-detail-slide" key={url}>
              <Image
                src={`${url}?size=1600`}
                alt={ko ? `성장일기 사진 ${i + 1}` : `Diary photo ${i + 1}`}
                width={1600}
                height={1600}
                loading={i === initialIndex ? 'eager' : 'lazy'}
                unoptimized
                draggable={false}
              />
            </div>
          ))}
        </div>
      )}
      {photos.length > 1 && (
        <nav
          className="diary-detail-dots"
          aria-label={ko ? '사진 선택' : 'Choose photo'}
        >
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={ko ? `사진 ${i + 1}` : `Photo ${i + 1}`}
              aria-current={index === i ? 'true' : undefined}
              onClick={() =>
                gallery.current?.scrollTo({
                  left: gallery.current.clientWidth * i,
                  behavior: 'smooth',
                })
              }
            />
          ))}
        </nav>
      )}
      <div
        className={`diary-detail-copy ${photos.length ? 'with-photos' : ''}`}
      >
        {measurements}
        {note && <p>{note}</p>}
        {author && <p className="diary-detail-author">by {author}</p>}
      </div>
    </dialog>
  );
}
