'use client';
import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/domain';
import { updateAdminRequest, type AdminActionState } from './actions';
import { adminText, requestStatuses, requestPriorities } from './model';
export function RequestEditor({
  locale,
  id,
  status,
  priority,
  note,
  version,
}: {
  locale: Locale;
  id: string;
  status: string;
  priority: string;
  note: string;
  version: number;
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
      updateAdminRequest,
      {},
    ),
    router = useRouter(),
    notified = useRef(false),
    copy = adminText(locale),
    ko = locale === 'ko';
  useEffect(() => {
    if (state.saved && !notified.current) {
      notified.current = true;
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action} className="admin-request-editor">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <div className="admin-form-row">
        <label>
          {ko ? '처리 상태' : 'Status'}
          <select name="status" defaultValue={status} disabled={pending}>
            {requestStatuses.map((value) => (
              <option key={value} value={value}>
                {copy.statuses[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {ko ? '우선순위' : 'Priority'}
          <select name="priority" defaultValue={priority} disabled={pending}>
            {requestPriorities.map((value) => (
              <option key={value} value={value}>
                {copy.priorities[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {ko
          ? '운영자 메모 · 사용자에게 보이지 않음'
          : 'Internal note · not visible to the user'}
        <textarea
          name="note"
          maxLength={2000}
          rows={3}
          defaultValue={note}
          disabled={pending}
        />
      </label>
      {state.error && (
        <p className="admin-form-error" role="alert">
          {state.error === 'conflict'
            ? ko
              ? '다른 운영자가 먼저 변경했어요. 새로고침 후 다시 확인해 주세요.'
              : 'Another operator changed this request. Refresh and try again.'
            : ko
              ? '변경 내용을 저장하지 못했어요. 다시 시도해 주세요.'
              : 'Could not save changes. Please try again.'}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? (ko ? '저장 중…' : 'Saving…') : copy.save}
      </button>
    </form>
  );
}
