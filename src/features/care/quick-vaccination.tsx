'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Syringe, X, Check, ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { names, vaccines } from '@/features/vaccination/copy';
import { quickCopy } from './quick-copy';
import type { QuickSaveState } from './quick-actions';
import { saveQuickVaccination } from './quick-vaccination-actions';
const shortNames = {
  ko: [
    'BCG',
    'B형간염',
    'DTaP',
    '폴리오',
    'Hib',
    '폐렴구균',
    '로타',
    'MMR',
    '수두',
    'A형간염',
    '일본뇌염',
    'HPV',
    '독감',
    '기타',
  ],
  en: [
    'BCG',
    'Hep B',
    'DTaP',
    'Polio',
    'Hib',
    'PCV',
    'Rotavirus',
    'MMR',
    'Varicella',
    'Hep A',
    'JE',
    'HPV',
    'Flu',
    'Other',
  ],
};
export function QuickVaccination({
  locale,
  childId,
  today,
  timezone,
  close,
  completed,
  onPending,
}: {
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
  const [id] = useState(() => crypto.randomUUID());
  const [vaccine, setVaccine] = useState('');
  const [custom, setCustom] = useState('');
  const [date, setDate] = useState(today);
  const [state, action, pending] = useActionState<QuickSaveState, FormData>(
    saveQuickVaccination,
    { status: 'idle' },
  );
  const notified = useRef(false);
  useEffect(() => onPending(pending), [pending, onPending]);
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
      <header className="quick-composer-heading">
        <span className="quick-kind-badge quick-color-vaccination">
          <Syringe size={19} />
        </span>
        <h3 id="quick-composer-title">{ko ? '예방접종' : 'Vaccination'}</h3>
        <button
          type="button"
          className="quick-close"
          disabled={pending}
          aria-label={c.close}
          onClick={close}
        >
          <X size={21} />
        </button>
      </header>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="timezone" value={timezone} />
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
      <fieldset className="quick-fields" disabled={pending}>
        <fieldset className="quick-vaccine-choices">
          <legend>{ko ? '백신' : 'Vaccine'}</legend>
          <div>
            {vaccines.map((value, i) => (
              <button
                type="button"
                key={value}
                aria-label={names[locale][i]}
                aria-pressed={vaccine === value}
                title={names[locale][i]}
                onClick={() => setVaccine(value)}
              >
                {shortNames[locale][i]}
              </button>
            ))}
          </div>
        </fieldset>
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
              defaultValue=""
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
            <input name="clinic" maxLength={200} />
          </label>
          <label>
            {c.note}
            <textarea name="note" maxLength={2000} />
          </label>
        </details>
      </fieldset>
      <footer className="quick-composer-footer">
        <Link
          href={`/${locale}/services/vaccination?child=${childId}&tab=completed`}
          aria-disabled={pending}
          onClick={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          {ko ? '접종 기록' : 'Vaccination records'}
          <ChevronRight size={13} />
        </Link>
        <button
          className="button primary quick-confirm"
          disabled={
            pending ||
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
