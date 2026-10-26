'use client';
import { useState, useSyncExternalStore } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { Row } from '@/lib/db';
import type { Locale } from '@/lib/domain';
import { vaccinationCopy, names, vaccines } from './copy';
import { saveVaccination } from './actions';
const subscribe = () => () => {};
function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="button primary" disabled={pending}>
      {label}
    </button>
  );
}
export function VaccinationForm({
  locale,
  childId,
  today,
  timezone,
  record,
  returnTo,
  defaultDate,
  calendarDay,
}: {
  locale: Locale;
  childId: string;
  today: string;
  timezone: string;
  record?: Row<'vaccination_records'>;
  returnTo?: 'calendar';
  defaultDate?: string;
  calendarDay?: string;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const t = vaccinationCopy(locale);
  const [id] = useState(() => record?.id ?? crypto.randomUUID());
  const [vaccine, setVaccine] = useState(
    record?.vaccine ?? (returnTo === 'calendar' ? '' : 'influenza'),
  );
  const [status, setStatus] = useState(record?.status ?? 'planned');
  const optionalFields = (
    <>
      <label>
        {t.dose}
        <select name="dose" defaultValue={record?.dose ?? ''}>
          <option value="">{t.unknown}</option>
          {Array.from({ length: 10 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      {vaccine === 'influenza' && (
        <div>
          <label>
            {t.season}
            <input
              name="season"
              placeholder="2026-2027"
              pattern="[0-9]{4}-[0-9]{4}"
              maxLength={9}
              aria-describedby="flu-season-hint"
              defaultValue={record?.season ?? ''}
            />
          </label>
          <p id="flu-season-hint" className="small muted">
            {t.seasonHint}
          </p>
        </div>
      )}
      <label>
        {t.status}
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="planned">{t.planned}</option>
          <option value="completed">{t.completed}</option>
        </select>
      </label>
      {status === 'completed' && (
        <label>
          {t.done}
          <input
            type="date"
            name="completed"
            max={today}
            required
            defaultValue={record?.completed_date ?? today}
          />
        </label>
      )}
      <label>
        {t.clinic}
        <input
          name="clinic"
          maxLength={200}
          defaultValue={record?.clinic ?? ''}
        />
      </label>
      <label>
        {t.note}
        <textarea
          name="note"
          rows={4}
          maxLength={2000}
          defaultValue={record?.note ?? ''}
        />
      </label>
    </>
  );
  if (!ready) return null;
  return (
    <form action={saveVaccination} className="form-stack">
      <input type="hidden" name="calendarDay" value={calendarDay ?? ''} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="version" value={record?.version ?? ''} />
      <input
        type="hidden"
        name="timezone"
        value={record?.record_timezone ?? timezone}
      />
      <label>
        {t.vaccine}
        <select
          required
          name="vaccine"
          value={vaccine}
          onChange={(e) => setVaccine(e.target.value)}
        >
          {returnTo === 'calendar' && (
            <option value="">{locale === 'ko' ? '선택' : 'Select'}</option>
          )}
          {vaccines.map((v, i) => (
            <option key={v} value={v}>
              {names[locale][i]}
            </option>
          ))}
        </select>
      </label>
      {vaccine === 'other' && (
        <label>
          {t.custom}
          <input
            name="custom"
            maxLength={120}
            required
            defaultValue={record?.custom_name ?? ''}
          />
        </label>
      )}
      <label>
        {t.scheduled}
        <input
          type="date"
          name="scheduled"
          required={status === 'planned'}
          defaultValue={
            record?.scheduled_date ?? (record ? '' : (defaultDate ?? today))
          }
        />
      </label>
      {returnTo === 'calendar' ? (
        <details
          className="calendar-more-fields"
          open={record ? true : undefined}
        >
          <summary>{locale === 'ko' ? '상세 설정' : 'More options'}</summary>
          <div className="form-stack">{optionalFields}</div>
        </details>
      ) : (
        optionalFields
      )}
      <Submit label={t.save} />
      <Link
        className="text-link"
        href={
          returnTo === 'calendar'
            ? `/${locale}/calendar?child=${childId}&day=${calendarDay ?? today}&month=${(calendarDay ?? today).slice(0, 7)}`
            : `/${locale}/services/vaccination?child=${childId}`
        }
      >
        {t.cancel}
      </Link>
    </form>
  );
}
