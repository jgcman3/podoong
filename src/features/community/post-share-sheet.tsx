'use client';
import { useEffect, useRef, useState } from 'react';
import { Copy, Share2, X } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/clipboard';
import type { Locale } from '@/lib/domain';
export function PostShareSheet({
  url,
  title,
  locale,
  close,
}: {
  url: string;
  title: string;
  locale: Locale;
  close: () => void;
}) {
  const ko = locale === 'ko',
    dialog = useRef<HTMLDialogElement>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const nativeShare =
    window.isSecureContext && typeof navigator.share === 'function';
  const shareHelp = !window.isSecureContext
    ? ko
      ? '다른 앱 공유는 HTTPS 주소에서 사용할 수 있어요. 현재 주소에서는 링크 복사를 이용해 주세요.'
      : 'Sharing to other apps needs HTTPS. Use Copy link at this address.'
    : ko
      ? '이 브라우저는 다른 앱 공유를 지원하지 않아요. 링크 복사를 이용해 주세요.'
      : 'This browser does not support sharing to other apps. Use Copy link.';
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => trigger?.focus({ preventScroll: true });
  }, []);
  async function copy() {
    setBusy(true);
    setMessage('');
    try {
      const ok = await copyTextToClipboard(url);
      setMessage(
        ok
          ? ko
            ? '링크를 복사했어요.'
            : 'Link copied.'
          : ko
            ? '복사하지 못했어요. 다시 시도해 주세요.'
            : 'Could not copy. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!nativeShare) {
      setMessage(shareHelp);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await navigator.share({ url, title });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setMessage(
          ko
            ? '공유하지 못했어요. 링크 복사를 이용해 주세요.'
            : 'Could not share. Try copying the link.',
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="post-share-sheet"
      aria-label={ko ? '게시글 공유' : 'Share post'}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <h2>{ko ? '게시글 공유' : 'Share post'}</h2>
        <button
          type="button"
          aria-label={ko ? '닫기' : 'Close'}
          disabled={busy}
          onClick={close}
        >
          <X size={21} />
        </button>
      </header>
      <div>
        <button type="button" disabled={busy} onClick={() => void copy()}>
          <Copy size={24} />
          <span>{ko ? '링크 복사' : 'Copy link'}</span>
        </button>
        <button
          type="button"
          disabled={busy || !nativeShare}
          onClick={() => void share()}
        >
          <Share2 size={24} />
          <span>{ko ? '다른 앱에 공유' : 'Share to another app'}</span>
        </button>
      </div>
      {!nativeShare && <p className="post-share-unavailable">{shareHelp}</p>}
      {message && <p role="status">{message}</p>}
    </dialog>
  );
}
