'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Share2,
  Link as LinkIcon,
  Copy,
  X,
  RefreshCw,
  Link2Off,
} from 'lucide-react';
import { manageDiaryLink } from './link-actions';

export function DiaryShare({ child, ko }: { child: string; ko: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="diary-share-trigger"
        aria-label={ko ? '일기 공유' : 'Share diary'}
        onClick={() => setOpen(true)}
      >
        <Share2 size={17} aria-hidden="true" />
        <span>{ko ? '일기장 공유' : 'Share diary'}</span>
      </button>
      {open && <LinkSheet child={child} ko={ko} close={() => setOpen(false)} />}
    </>
  );
}
function LinkSheet({
  child,
  ko,
  close,
}: {
  child: string;
  ko: boolean;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    let alive = true;
    manageDiaryLink(child, 'get')
      .then((result) => {
        if (!alive) return;
        if (result.error)
          setError(
            ko ? '공유 링크를 불러오지 못했어요.' : 'Could not load the link.',
          );
        else if (result.token)
          setUrl(
            `${window.location.origin}/${ko ? 'ko' : 'en'}/share/diary/${result.token}`,
          );
      })
      .catch(() => {
        if (alive)
          setError(
            ko ? '공유 링크를 불러오지 못했어요.' : 'Could not load the link.',
          );
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
      trigger?.focus({ preventScroll: true });
    };
  }, [child, ko]);
  async function change(action: 'create' | 'revoke' | 'rotate') {
    setBusy(true);
    setError('');
    setHint('');
    try {
      const result = await manageDiaryLink(child, action);
      if (result.error) throw new Error('Share unavailable');
      setUrl(
        result.token
          ? `${window.location.origin}/${ko ? 'ko' : 'en'}/share/diary/${result.token}`
          : '',
      );
    } catch {
      setError(
        ko
          ? '공유 설정을 변경하지 못했어요. 다시 시도해 주세요.'
          : 'Could not update sharing. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setHint(ko ? '링크를 복사했어요' : 'Link copied');
    } catch {
      input.current?.focus();
      input.current?.select();
      setHint(ko ? '선택된 링크를 복사해 주세요.' : 'Copy the selected link.');
    }
  }
  async function share() {
    setBusy(true);
    setError('');
    try {
      await navigator.share({
        title: ko ? '포둥 성장일기' : 'Podung growth diary',
        url,
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setError(
          ko ? '링크를 복사해서 공유해 주세요.' : 'Copy the link to share it.',
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="diary-share-sheet"
      aria-label={ko ? '일기 공유' : 'Share diary'}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) close();
      }}
    >
      <header>
        <h2>{ko ? '일기 공유' : 'Share diary'}</h2>
        <button
          type="button"
          disabled={busy}
          onClick={close}
          aria-label={ko ? '닫기' : 'Close'}
        >
          <X size={20} />
        </button>
      </header>
      <p>
        {ko
          ? '링크를 가진 누구나 로그인 없이 이 아이의 공개된 성장일기와 사진을 볼 수 있어요. 앞으로 공개하는 일기도 함께 표시돼요. 비공개 일기는 보이지 않아요.'
          : 'Anyone with the link can view this child’s public diaries and photos, including future public entries, without signing in. Private entries stay hidden.'}
      </p>
      {url && (
        <label className="diary-share-url">
          <span>{ko ? '공유 링크' : 'Share link'}</span>
          <input
            ref={input}
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
          />
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {hint && <p role="status">{hint}</p>}
      <footer>
        {url ? (
          <>
            <button
              type="button"
              className="button secondary"
              onClick={copy}
              disabled={busy}
            >
              <Copy size={16} />
              {ko ? '링크 복사' : 'Copy link'}
            </button>
            {typeof navigator.share === 'function' && (
              <button
                type="button"
                className="button primary"
                onClick={share}
                disabled={busy}
              >
                <Share2 size={16} />
                {ko ? '앱으로 공유' : 'Share to app'}
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            className="button primary"
            onClick={() => change('create')}
            disabled={busy}
          >
            <LinkIcon size={16} />
            {busy
              ? ko
                ? '불러오는 중…'
                : 'Loading…'
              : ko
                ? '공유 링크 만들기'
                : 'Create share link'}
          </button>
        )}
      </footer>
      {url && (
        <div className="diary-share-management">
          <button
            type="button"
            className="diary-share-manage"
            disabled={busy}
            onClick={() => change('rotate')}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{ko ? '새 링크 발급' : 'Replace link'}</span>
          </button>
          <button
            type="button"
            className="diary-share-manage diary-share-disable"
            disabled={busy}
            onClick={() => change('revoke')}
          >
            <Link2Off size={16} aria-hidden="true" />
            <span>{ko ? '공유 링크 끄기' : 'Turn off link sharing'}</span>
          </button>
        </div>
      )}
    </dialog>
  );
}
