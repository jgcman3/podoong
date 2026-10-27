'use client';
import { QuickDelete } from './quick-delete';
import type { Row } from '@/lib/db';
import { createRecordId } from '@/lib/record-id';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Syringe, Check } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { VaccinePicker } from '@/features/vaccination/picker';
import { quickCopy } from './quick-copy';
import type { QuickSaveState } from './quick-actions';
import { saveQuickVaccination } from './quick-vaccination-actions';
export function QuickVaccination({
  locale,
  childId,
  today,
  timezone,
  close,
  completed,
  onPending,
  record,
}: {
  record?: Row<'vaccination_records'>;
  locale: Locale;
  childId: string;
  today: string;
  timezone: string;
  close: () => void;
  completed: () => void;
  onPending: (value: boolean) => void;
}) {
  const ko = locale === 'ko',
    c = quickCopy(locale);
  const [id] = useState(() => record?.id ?? createRecordId());
  const [vaccine, setVaccine] = useState(record?.vaccine ?? '');
  const [custom, setCustom] = useState(record?.custom_name ?? '');
  const [date, setDate] = useState(record?.completed_date ?? today);
  const [state, action, pending] = useActionState<QuickSaveState, FormData>(
    saveQuickVaccination,
    { status: 'idle' },
  );
  const notified = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const busy = pending || deleting;
  useEffect(() => onPending(busy), [busy, onPending]);
  useEffect(() => {
    if (state.status === 'saved' && !notified.current) {
      notified.current = true;
      completed();
    }
  }, [state, completed]);
  return (
    <form
      action={action}
      className="quick-editor-form quick-vaccination-form"
      aria-label={ko ? '예방접종' : 'Vaccination'}
    >
      <header
        className="quick-composer-heading"
        style={{ outline: 'none', boxShadow: 'none' }}
      >
        <span className="quick-kind-badge quick-color-vaccination">
          <Syringe size={19} />
        </span>
        <h3
          id="quick-composer-title"
          tabIndex={-1}
          style={{ outline: 'none', boxShadow: 'none' }}
        >
          {ko ? '예방접종' : 'Vaccination'}
        </h3>
      </header>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={record?.version ?? ''} />
      <input type="hidden" name="season" value={record?.season ?? ''} />
      <input
        type="hidden"
        name="scheduled"
        value={record?.scheduled_date ?? ''}
      />
      <input type="hidden" name="childId" value={childId} />
      <input
        type="hidden"
        name="timezone"
        value={record?.record_timezone ?? timezone}
      />
      <input type="hidden" name="status" value="completed" />
      <input type="hidden" name="vaccine" value={vaccine} />
      {state.status === 'error' && (
        <p className="flash error" role="alert">
          {state.error === 'invalid'
            ? ko
              ? '백신과 접종일을 확인해주세요.'
              : 'Check the vaccine and vaccination date.'
            : (c.errors[state.error as keyof typeof c.errors] ??
              c.errors.generic)}
        </p>
      )}
      <fieldset className="quick-fields" disabled={busy}>
        <VaccinePicker locale={locale} value={vaccine} onChange={setVaccine} />
        {vaccine === 'other' && (
          <label>
            {ko ? '백신 이름' : 'Vaccine name'}
            <input
              name="custom"
              required
              maxLength={120}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </label>
        )}
        <details className="quick-extra">
          <summary>
            {date}
            <span>{ko ? '차수·병원·메모' : 'Dose · clinic · note'}</span>
          </summary>
          <label>
            {ko ? '접종일' : 'Vaccination date'}
            <input
              type="date"
              name="completed"
              required
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            {ko ? '차수 (선택)' : 'Dose (optional)'}
            <select
              name="dose"
              aria-label={ko ? '차수 (선택)' : 'Dose (optional)'}
              defaultValue={record?.dose ?? ''}
            >
              <option value="">{ko ? '기록 안 함' : 'Not recorded'}</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                  {ko ? '차' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            {ko ? '병원·접종 기관 (선택)' : 'Clinic (optional)'}
            <input
              name="clinic"
              maxLength={200}
              defaultValue={record?.clinic ?? ''}
            />
          </label>
          <label>
            {c.note}
            <textarea
              name="note"
              maxLength={2000}
              defaultValue={record?.note ?? ''}
            />
          </label>
        </details>
      </fieldset>
      <footer className="quick-composer-footer">
        <button
          type="button"
          className="button secondary quick-cancel"
          disabled={busy}
          onClick={close}
        >
          {ko ? '취소' : 'Cancel'}
        </button>
        {record && (
          <QuickDelete
            locale={locale}
            childId={childId}
            entry={{ id: record.id, source: 'vaccination' }}
            disabled={busy}
            completed={completed}
            onPending={setDeleting}
          />
        )}
        <button
          className="button primary quick-confirm"
          disabled={
            busy ||
            !vaccine ||
            (vaccine === 'other' && !custom.trim()) ||
            !date ||
            date > today
          }
          aria-busy={pending}
        >
          <Check size={20} />
          {pending ? c.saving : c.save}
        </button>
      </footer>
    </form>
  );
}
