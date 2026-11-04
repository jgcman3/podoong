'use client';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/domain';
import { reviewAdminReport, type AdminActionState } from './actions';
export function ReportReview({
  locale,
  id,
  version,
  hidden,
  status,
}: {
  locale: Locale;
  id: string;
  version: number;
  hidden: boolean;
  status: string;
}) {
  const ko = locale === 'ko',
    router = useRouter();
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    reviewAdminReport,
    {},
  );
  useEffect(() => {
    if (state.saved) router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="admin-request-editor">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="hidden" value={String(hidden)} />
      <label>
        {ko ? '처리 사유' : 'Review note'}
        <textarea
          name="reason"
          rows={2}
          maxLength={500}
          required
          disabled={pending}
        />
      </label>
      <div className="admin-report-buttons">
        <button
          name="action"
          value={hidden ? 'unhide' : 'hide'}
          className="button secondary"
          disabled={pending}
        >
          {hidden
            ? ko
              ? '숨김 해제'
              : 'Restore visibility'
            : ko
              ? '글 숨기기'
              : 'Hide content'}
        </button>
        <button
          name="action"
          value={status === 'resolved' ? 'reopen' : 'resolve'}
          className="button"
          disabled={pending}
        >
          {status === 'resolved'
            ? ko
              ? '다시 검토'
              : 'Reopen'
            : ko
              ? '처리 완료'
              : 'Resolve'}
        </button>
      </div>
      {state.error && (
        <p className="admin-form-error" role="alert">
          {state.error === 'conflict'
            ? ko
              ? '다른 운영자가 먼저 변경했어요. 새로고침 후 다시 확인해 주세요.'
              : 'Another operator changed this item. Refresh and try again.'
            : ko
              ? '처리하지 못했어요. 다시 시도해주세요.'
              : 'Could not save the review. Please try again.'}
        </p>
      )}
    </form>
  );
}
