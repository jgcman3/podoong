'use client';
import { useState } from 'react';
import type { Locale } from '@/lib/domain';
import type { QuickEntry } from './quick-model';
import { deleteQuickCare } from './quick-actions';

export function QuickDelete({
  locale,
  childId,
  entry,
  disabled,
  completed,
  onPending,
}: {
  locale: Locale;
  childId: string;
  entry: Pick<QuickEntry, 'id' | 'source'>;
  disabled: boolean;
  completed: () => void;
  onPending: (pending: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function remove() {
    if (
      !window.confirm(
        locale === 'ko' ? '이 기록을 삭제할까요?' : 'Delete this record?',
      )
    )
      return;
    setPending(true);
    onPending(true);
    setError(false);
    try {
      const result = await deleteQuickCare({
        locale,
        childId,
        id: entry.id,
        source: entry.source,
      });
      if (result.status === 'saved') completed();
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
      onPending(false);
    }
  }
  return (
    <div className="quick-delete">
      <button
        type="button"
        className="button secondary"
        disabled={disabled || pending}
        onClick={remove}
      >
        {locale === 'ko' ? '삭제' : 'Delete'}
      </button>
      {error && (
        <span role="alert">
          {locale === 'ko' ? '삭제하지 못했어요.' : 'Could not delete.'}
        </span>
      )}
    </div>
  );
}
