'use client';
import { useState, useSyncExternalStore } from 'react';
import { useFormStatus } from 'react-dom';
import type { Row } from '@/lib/db';
import type { Locale } from '@/lib/domain';
import { endFromDuration } from '@/features/care/feeding-record';
import { childCopy, kindLabel } from './copy';
import type { ChildService } from './schema';
import { saveChildRecord } from './actions';
const subscribe = () => () => {};
export function ChildRecordForm(props: {
  locale: Locale;
  childId: string;
  service: ChildService;
  now: string;
  record?: Row<'child_records'>;
  defaultKind?: string;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return ready ? (
    <Editor {...props} />
  ) : (
    <div className="form-placeholder" aria-busy="true" />
  );
}
function localInput(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function Editor({
  locale,
  childId,
  service,
  now,
  record,
  defaultKind,
}: Parameters<typeof ChildRecordForm>[0]) {
  const t = childCopy(locale);
  const kinds =
    service === 'sleep'
      ? ['nap', 'night']
      : service === 'diaper'
        ? ['wet', 'dirty', 'mixed', 'dry']
        : ['measurement', 'observation'];
  const [id] = useState(record?.id ?? crypto.randomUUID());
  const [kind, setKind] = useState(
    record?.kind ??
      (kinds.includes(defaultKind ?? '') ? defaultKind! : kinds[0]),
  );
  const [start, setStart] = useState(localInput(record?.occurred_at ?? now));
  const [duration, setDuration] = useState(
    record?.ended_at
      ? String(
          (Date.parse(record.ended_at) - Date.parse(record.occurred_at)) /
            60000,
        )
      : '',
  );
  const [running, setRunning] = useState(
    Boolean(record && service === 'sleep' && !record.ended_at),
  );
  const startIso =
    record && start === localInput(record.occurred_at)
      ? record.occurred_at
      : start
        ? new Date(start).toISOString()
        : '';
  const endIso =
    service === 'sleep' && !running ? endFromDuration(startIso, duration) : '';
  const stool = kind === 'dirty' || kind === 'mixed';
  return (
    <form action={saveChildRecord} className="form-stack">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="service" value={service} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="version" value={record?.version ?? ''} />
      <input
        type="hidden"
        name="timezone"
        value={Intl.DateTimeFormat().resolvedOptions().timeZone}
      />
      <input type="hidden" name="occurredAt" value={startIso} />
      <input type="hidden" name="endedAt" value={endIso} />
      <label>
        {t.kind}
        <select
          name="kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {kinds.map((value) => (
            <option key={value} value={value}>
              {kindLabel(value, locale)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {service === 'sleep' ? t.start : t.date}
        <input
          type="datetime-local"
          value={start}
          onChange={(event) => setStart(event.target.value)}
          required
        />
      </label>
      {service === 'sleep' && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={running}
              onChange={(event) => setRunning(event.target.checked)}
            />
            {t.running}
          </label>
          {!running && (
            <label>
              {t.duration}
              <input
                name="duration"
                type="number"
                min="0"
                step="any"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                required
              />
            </label>
          )}
          {record && !record.ended_at && running && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setDuration(
                  String(
                    Math.max(0, (Date.now() - Date.parse(startIso)) / 60000),
                  ),
                );
                setRunning(false);
              }}
            >
              {t.stop}
            </button>
          )}
        </>
      )}
      {service === 'diaper' && stool && (
        <div className="form-row">
          {(['color', 'texture'] as const).map((field) => (
            <label key={field}>
              {field === 'color' ? t.color : t.texture}
              <select
                name={field}
                defaultValue={
                  field === 'color'
                    ? (record?.stool_color ?? '')
                    : (record?.stool_texture ?? '')
                }
              >
                <option value="">{t.unknown}</option>
                {(field === 'color'
                  ? [
                      'yellow',
                      'green',
                      'brown',
                      'red',
                      'black',
                      'white',
                      'other',
                    ]
                  : ['watery', 'soft', 'firm', 'other']
                ).map((value) => (
                  <option key={value} value={value}>
                    {kindLabel(value, locale)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {service === 'growth' && kind === 'measurement' && (
        <>
          <p className="small muted">{t.optional}</p>
          <div className="measurement-inputs">
            {(
              [
                ['height', t.height, record?.height_cm, 250],
                ['weight', t.weight, record?.weight_kg, 200],
                ['head', t.head, record?.head_cm, 100],
              ] as const
            ).map(([name, label, value, max]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  type="number"
                  min="0.01"
                  max={max}
                  step="0.01"
                  defaultValue={value ?? ''}
                />
              </label>
            ))}
          </div>
        </>
      )}
      {service === 'growth' && kind === 'observation' && (
        <label>
          {t.title}
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={record?.title}
          />
        </label>
      )}
      <label>
        {t.note}
        <textarea name="note" maxLength={2000} defaultValue={record?.note} />
      </label>
      <Submit
        label={t.save}
        disabled={!startIso || (service === 'sleep' && !running && !endIso)}
      />
    </form>
  );
}
export function Submit({
  label,
  disabled = false,
}: {
  label: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className="button primary"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {label}
    </button>
  );
}
