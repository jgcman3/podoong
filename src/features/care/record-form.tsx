'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { saveRecord } from './actions';
import { FeedingSelect } from './feeding-select';
import {
  feedingKinds,
  isFood,
  endFromDuration,
  type FeedingKind,
} from './feeding-record';
import type { Row } from '@/lib/db';
import type { Locale } from '@/lib/domain';
function localInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function RecordForm({
  locale,
  childId,
  record,
  now,
  defaultKind,
}: {
  locale: Locale;
  childId: string;
  record?: Row<'care_records'>;
  now: string;
  defaultKind?: FeedingKind;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!ready) return <div className="form-placeholder" aria-busy="true" />;
  return (
    <RecordEditor
      locale={locale}
      childId={childId}
      record={record}
      now={now}
      defaultKind={defaultKind}
    />
  );
}
const subscribe = () => () => {};
const durationChoices = [5, 10, 15, 20, 30, 45, 60];
function RecordEditor({
  locale,
  childId,
  record,
  now,
  defaultKind,
}: {
  locale: Locale;
  childId: string;
  record?: Row<'care_records'>;
  now: string;
  defaultKind?: FeedingKind;
}) {
  const t = useTranslations();
  const [kind, setKind] = useState(record?.kind ?? defaultKind ?? 'breast');
  const food = isFood(kind);
  const legacyGrams =
    food &&
    record?.kind === kind &&
    record?.amount_g != null &&
    record.amount_ml === null;
  const [id] = useState(() => record?.id ?? crypto.randomUUID());
  const [start, setStart] = useState(() =>
    localInput(record?.started_at ?? now),
  );
  const [duration, setDuration] = useState(() =>
    record?.ended_at
      ? String(
          (Date.parse(record.ended_at) - Date.parse(record.started_at)) / 60000,
        )
      : '',
  );
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [isTimer, setTimer] = useState(Boolean(record && !record.ended_at));
  const startIso =
    record && start === localInput(record.started_at)
      ? record.started_at
      : start
        ? new Date(start).toISOString()
        : '';
  const endIso = !isTimer ? endFromDuration(startIso, duration) : '';
  return (
    <form action={saveRecord} className="form-stack">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="timezone" value={zone} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={record?.version ?? ''} />
      <input type="hidden" name="startedAt" value={startIso} />
      <input type="hidden" name="endedAt" value={endIso} />
      <label>
        {t('kind')}
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {feedingKinds.map((k) => (
            <option key={k} value={k}>
              {t(k)}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">
        {t('timezone')}: {zone}
      </p>
      <div className="form-row">
        <label>
          {t('startedAt')}
          <input
            aria-label={t('startedAt')}
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </label>
        {!isTimer && (
          <fieldset className="feeding-duration">
            <legend>{t('feedingDuration')}</legend>
            <input type="hidden" name="duration" value={duration} />
            <div className="duration-choices">
              {[
                ...new Set([
                  ...(duration && !durationChoices.includes(Number(duration))
                    ? [Number(duration)]
                    : []),
                  ...durationChoices,
                ]),
              ].map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={`button ${Number(duration) === minutes && duration !== '' ? 'primary' : 'secondary'}`}
                  aria-pressed={Number(duration) === minutes && duration !== ''}
                  onClick={() => setDuration(String(minutes))}
                >
                  {new Intl.NumberFormat(locale, {
                    maximumFractionDigits: 2,
                  }).format(minutes)}
                  {locale === 'ko' ? '' : ' '}
                  {t('minutesUnit')}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>
      <input
        type="hidden"
        name="foodName"
        value={record?.kind === kind ? record.food_name : ''}
      />
      <input type="hidden" name="amountUnit" value={legacyGrams ? 'g' : 'ml'} />
      {kind !== 'breast' || record?.amount_ml != null ? (
        <label>
          {legacyGrams ? t('amountG') : t('amount')}
          <FeedingSelect
            key={kind}
            label={legacyGrams ? t('amountG') : t('amount')}
            name="amount"
            choices={food ? 'g' : 'ml'}
            unit={legacyGrams ? 'g' : 'ml'}
            defaultValue={
              record?.kind === kind
                ? String(
                    (legacyGrams ? record.amount_g : record.amount_ml) ?? '',
                  )
                : ''
            }
          />
          <span className="small muted">{t('amountOptional')}</span>
        </label>
      ) : (
        <>
          <input type="hidden" name="amount" value="" />
          <p className="small muted">{t('breastDurationOnly')}</p>
        </>
      )}
      <label>
        {t('note')}
        <textarea name="note" maxLength={2000} defaultValue={record?.note} />
      </label>
      {!record && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={isTimer}
            onChange={(e) => setTimer(e.target.checked)}
          />
          {t('startTimer')}
        </label>
      )}
      {record && !record.ended_at && (
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setDuration(
              String(Math.max(0, (Date.now() - Date.parse(startIso)) / 60000)),
            );
            setTimer(false);
          }}
        >
          {t('stopTimer')}
        </button>
      )}
      <button
        className="button primary"
        disabled={!start || (!isTimer && !endIso)}
      >
        {isTimer && !record ? t('startTimer') : t('save')}
      </button>
    </form>
  );
}
export function Timer({ start }: { start: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - Date.parse(start)) / 1000)),
      );
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [start]);
  return (
    <span className="timer" aria-live="off">
      {Math.floor(elapsed / 3600)
        .toString()
        .padStart(2, '0')}
      :
      {Math.floor((elapsed / 60) % 60)
        .toString()
        .padStart(2, '0')}
      :{(elapsed % 60).toString().padStart(2, '0')}
    </span>
  );
}
