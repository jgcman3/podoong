'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { X } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { reportParentingPost } from './report-action';
export function PostReportDialog({
  post,
  locale,
  close,
}: {
  post: string;
  locale: Locale;
  close: () => void;
}) {
  const ko = locale === 'ko',
    dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition(),
    [sent, setSent] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => trigger?.focus({ preventScroll: true });
  }, []);
  return (
    <dialog
      ref={dialog}
      className="post-share-sheet post-report-dialog"
      aria-label={ko ? '게시글 신고' : 'Report post'}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) close();
      }}
    >
      <header>
        <h2>{ko ? '게시글 신고' : 'Report post'}</h2>
        <button
          type="button"
          aria-label={ko ? '닫기' : 'Close'}
          onClick={close}
          disabled={pending}
        >
          <X size={21} />
        </button>
      </header>
      {sent ? (
        <section>
          <p role="status">
            {ko
              ? '신고를 접수했어요. 운영자가 확인하겠습니다.'
              : 'Your report has been received for review.'}
          </p>
          <button type="button" className="button" onClick={close}>
            {ko ? '닫기' : 'Close'}
          </button>
        </section>
      ) : (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setError(false);
            start(async () => {
              try {
                const ok = await reportParentingPost({
                  post,
                  locale,
                  reason: String(data.get('reason')),
                  detail: String(data.get('detail') ?? ''),
                });
                setSent(ok);
                setError(!ok);
              } catch {
                setError(true);
              }
            });
          }}
        >
          <label>
            {ko ? '신고 사유' : 'Reason'}
            <select name="reason" required defaultValue="" disabled={pending}>
              <option value="" disabled>
                {ko ? '선택해주세요' : 'Choose a reason'}
              </option>
              {[
                ['spam', '스팸·광고', 'Spam or ads'],
                ['inappropriate', '부적절한 내용', 'Inappropriate content'],
                ['privacy', '개인정보 노출', 'Personal information'],
                ['other', '기타', 'Other'],
              ].map(([value, k, e]) => (
                <option key={value} value={value}>
                  {ko ? k : e}
                </option>
              ))}
            </select>
          </label>
          <label>
            {ko ? '추가 설명 (선택)' : 'Additional details (optional)'}
            <textarea
              name="detail"
              rows={3}
              maxLength={400}
              disabled={pending}
            />
          </label>
          <p className="small muted">
            {ko
              ? '신고자 정보는 글쓴이에게 공개되지 않아요.'
              : 'Your identity is not disclosed to the author.'}
          </p>
          {error && (
            <p role="alert">
              {ko
                ? '신고를 접수하지 못했어요. 다시 시도해주세요.'
                : 'Could not submit the report. Please try again.'}
            </p>
          )}
          <button type="submit" className="button" disabled={pending}>
            {ko ? '신고 접수' : 'Submit report'}
          </button>
        </form>
      )}
    </dialog>
  );
}
