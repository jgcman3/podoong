'use client';
import { QuickFieldTitle } from './quick-field-title';
import { ActivityRail } from './activity-rail';
import {
  careIcons as icons,
  careLabels as shortLabels,
} from './activity-config';
import { createRecordId } from '@/lib/record-id';
import {
  useState,
  useEffect,
  useRef,
  useActionState,
  useSyncExternalStore,
} from 'react';
import { DiaryComposer } from '@/features/growth-community/composer';
import { QuickDelete } from './quick-delete';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Moon,
  Heart,
  Check,
  Play,
  Square,
  ChevronRight,
  Minus,
  Plus,
  Ruler,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { dateInTimeZone } from '@/lib/domain';
import { kindLabel } from '@/features/child-care/copy';
import { Timer } from './timer';
import { endFromDuration } from './feeding-record';
import { saveQuickCare, type QuickSaveState } from './quick-actions';
import {
  localDateInput,
  durationMinutes,
  todayEntries,
  type QuickEntry,
  type QuickKind,
} from './quick-model';
import { QuickVaccination } from './quick-vaccination';
import { vaccineName } from '@/features/vaccination/copy';
import { DayBrowser } from './day-browser';
import { ActivityFields } from './activity-fields';
import { activityKinds } from '@/features/child-care/schema';
import { quickCopy } from './quick-copy';
const mobileQuery = '(max-width: 900px)';
function subscribeMobile(change: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
export function QuickCare({
  locale,
  childId,
  entries,
  recentAmounts,
  writable,
  timezone,
  today,
  birthDate,
}: {
  locale: Locale;
  childId: string;
  entries: QuickEntry[];
  recentAmounts: { formula: number | null; solids: number | null };
  writable: boolean;
  timezone: string;
  today: string;
  birthDate: string;
}) {
  const c = quickCopy(locale),
    router = useRouter();
  const [selection, setSelection] = useState<{
    kind: QuickKind;
    active?: QuickEntry;
  } | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const labels = shortLabels(locale);
  const visible = todayEntries(entries, today, timezone);
  const active = visible.filter((e) => e.running);
  useEffect(() => {
    const checkDay = () => {
      if (dateInTimeZone(new Date(), timezone) !== today) router.refresh();
    };
    const timer = window.setInterval(checkDay, 60000);
    window.addEventListener('focus', checkDay);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkDay);
    };
  }, [today, timezone, router]);
  const close = () => {
    if (!busy) setSelection(null);
  };
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (node.open) node.close();
    if (selection) {
      if (mobile) node.showModal();
      else {
        node.show();
        node.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 'auto'
            : 'smooth',
          block: 'nearest',
        });
      }
      if (focused && node.contains(focused))
        focused.focus({ preventScroll: true });
      else
        node
          .querySelector<HTMLElement>('#quick-composer-title')
          ?.focus({ preventScroll: true });
    }
  }, [selection, mobile]); // Keep the same editor and its values when the viewport changes.
  const open = (kind: QuickKind, record?: QuickEntry) => {
    setSelection({
      kind,
      active:
        record ??
        active.find((e) =>
          kind === 'sleep' ? e.service === 'sleep' : e.kind === kind,
        ),
    });
  };
  const completed = () => {
    setBusy(false);
    setHistoryRevision((value) => value + 1);
    setSelection(null);
    router.refresh();
  };
  return (
    <section
      className="quick-care"
      aria-label={locale === 'ko' ? '육아 기록' : 'Care records'}
    >
      <ActivityRail
        locale={locale}
        label={locale === 'ko' ? '빠른 기록 선택' : 'Choose a care record'}
        leading={
          <DiaryComposer
            locale={locale}
            child={childId}
            triggerLabel={locale === 'ko' ? '성장 기록' : 'Growth record'}
            triggerClassName="quick-orbit-item quick-color-growth"
            trigger={
              <>
                <span className="quick-orbit-icon">
                  <Ruler size={27} />
                </span>
                <strong>
                  {locale === 'ko' ? '성장 기록' : 'Growth record'}
                </strong>
              </>
            }
            disabled={!writable || busy}
            onSaved={completed}
          />
        }
        selected={selection ? [selection.kind] : []}
        onSelect={(kind) => open(kind)}
        disabled={!writable || busy}
        popup={mobile}
      />
      <div className={`quick-care-layout ${selection ? 'has-editor' : ''}`}>
        <div className="quick-timeline-panel">
          {active.length > 0 && (
            <div className="quick-running-list" aria-label={c.running}>
              {active.map((e) => {
                const kind =
                  e.service === 'sleep' ? 'sleep' : (e.kind as QuickKind);
                const Icon = icons[kind];
                return (
                  <div
                    className={`quick-running quick-color-${kind}`}
                    key={`${e.source}:${e.id}`}
                  >
                    <span className="quick-live-dot" />
                    <Icon size={19} />
                    <div>
                      <strong>
                        {labels[kind]} ·{' '}
                        {['daycare', 'kindergarten'].includes(kind)
                          ? locale === 'ko'
                            ? '머무는 중'
                            : 'Attending'
                          : c.running}
                      </strong>
                      <Timer start={e.startedAt} />
                    </div>
                    {writable ? (
                      <button
                        className="button secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => open(kind, e)}
                      >
                        <Square size={13} />
                        {['daycare', 'kindergarten'].includes(e.kind)
                          ? locale === 'ko'
                            ? '귀가'
                            : 'Finish'
                          : e.service === 'sleep'
                            ? c.sleepStop
                            : c.stop}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          <DayBrowser
            key={`${childId}:${today}`}
            birthDate={birthDate}
            revision={historyRevision}
            locale={locale}
            childId={childId}
            today={today}
            timezone={timezone}
            entries={visible}
            disabled={busy || selection !== null}
          >
            {(history, selectedDay) => (
              <>
                {history.length ? (
                  <ol className="quick-timeline">
                    {history.map((e) => {
                      const iconKey =
                        e.service === 'feeding' || e.service === 'activity'
                          ? e.kind
                          : e.service === 'diaper' &&
                              ['dirty', 'mixed'].includes(e.kind)
                            ? 'stool'
                            : e.service;
                      const Icon =
                        icons[iconKey as keyof typeof icons] ?? Heart;
                      const name =
                        e.source === 'vaccination'
                          ? vaccineName(e.kind, e.customName ?? '', locale)
                          : e.service === 'growth'
                            ? locale === 'ko'
                              ? '성장 기록'
                              : 'Growth record'
                            : e.service === 'feeding'
                              ? labels[
                                  e.kind as 'breast' | 'formula' | 'solids'
                                ]
                              : kindLabel(e.kind, locale);
                      const day = dateInTimeZone(
                        new Date(e.startedAt),
                        timezone,
                      );
                      const duration = durationMinutes(e);
                      const summary = [
                        e.amount !== null
                          ? `${new Intl.NumberFormat(locale).format(e.amount)} ${e.unit}`
                          : '',
                        duration !== null
                          ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(duration)} ${c.minutes}`
                          : '',
                        e.dose != null
                          ? `${e.dose}${locale === 'ko' ? '차' : ' dose'}`
                          : '',
                        e.childRecord?.attendance_status
                          ? e.childRecord.attendance_status === 'arrival'
                            ? locale === 'ko'
                              ? '등원'
                              : 'Drop-off'
                            : locale === 'ko'
                              ? '하원'
                              : 'Pick-up'
                          : '',
                        e.title,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <li key={`${e.source}:${e.id}`}>
                          <div className="quick-timeline-time">
                            <time dateTime={e.recordDate ?? e.startedAt}>
                              {e.recordDate
                                ? e.recordDate.slice(5).replace('-', '.')
                                : new Intl.DateTimeFormat(locale, {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false,
                                    timeZone: timezone,
                                  }).format(new Date(e.startedAt))}
                            </time>
                            {!e.recordDate && day !== selectedDay && (
                              <small>{day.slice(5).replace('-', '.')}</small>
                            )}
                          </div>
                          <span className="quick-timeline-dot" />
                          {e.service === 'growth' && e.childRecord ? (
                            <DiaryComposer
                              locale={locale}
                              child={childId}
                              record={{
                                ...e.childRecord,
                                photo_ids: e.photoIds ?? [],
                                is_private: e.isPrivate ?? true,
                              }}
                              trigger={
                                <>
                                  <span className="quick-entry-icon">
                                    <Icon size={21} />
                                  </span>
                                  <span>
                                    <strong>{name}</strong>
                                    {summary && <small>{summary}</small>}
                                  </span>
                                  <ChevronRight size={15} />
                                </>
                              }
                              triggerClassName={`quick-timeline-entry quick-entry-${e.service} quick-color-${iconKey}`}
                              disabled={!writable}
                              onSaved={completed}
                            />
                          ) : (
                            <button
                              type="button"
                              disabled={!writable || busy}
                              onClick={() =>
                                open(
                                  (e.source === 'vaccination'
                                    ? 'vaccination'
                                    : e.service === 'feeding' ||
                                        e.service === 'activity'
                                      ? e.kind
                                      : e.service === 'diaper'
                                        ? e.kind === 'dirty' ||
                                          e.kind === 'mixed'
                                          ? 'stool'
                                          : 'diaper'
                                        : 'sleep') as QuickKind,
                                  e,
                                )
                              }
                              className={`quick-timeline-entry quick-entry-${e.service} quick-color-${iconKey}`}
                              draggable={false}
                            >
                              <span
                                className={`quick-entry-icon quick-color-${iconKey}`}
                              >
                                <Icon size={21} />
                              </span>
                              <span>
                                <strong>{name}</strong>
                                {summary && <small>{summary}</small>}
                              </span>
                              <ChevronRight size={15} />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="quick-timeline-empty">
                    <Moon size={30} />
                    <strong>{c.empty}</strong>
                  </div>
                )}{' '}
              </>
            )}
          </DayBrowser>
        </div>
        {writable && (
          <div className="quick-editor-host">
            <dialog
              className="quick-composer"
              ref={dialog}
              aria-labelledby="quick-composer-title"
              onCancel={(event) => {
                event.preventDefault();
                close();
              }}
            >
              {selection?.kind === 'vaccination' ? (
                <QuickVaccination
                  key={`${childId}:vaccination:${selection.active?.id ?? 'new'}`}
                  record={selection.active?.vaccinationRecord}
                  locale={locale}
                  childId={childId}
                  today={today}
                  timezone={timezone}
                  close={close}
                  completed={completed}
                  onPending={setBusy}
                />
              ) : (
                selection && (
                  <QuickEditor
                    key={`${childId}:${selection.kind}:${selection.active?.id ?? 'new'}`}
                    locale={locale}
                    childId={childId}
                    kind={selection.kind}
                    active={selection.active}
                    initialAmount={
                      selection.kind === 'formula' ||
                      selection.kind === 'solids'
                        ? recentAmounts[selection.kind]
                        : null
                    }
                    close={close}
                    completed={completed}
                    onPending={setBusy}
                  />
                )
              )}
            </dialog>
          </div>
        )}
      </div>
    </section>
  );
}
type QuickEditorProps = {
  locale: Locale;
  childId: string;
  kind: Exclude<QuickKind, 'vaccination'>;
  active?: QuickEntry;
  initialAmount: number | null;
  close: () => void;
  completed: () => void;
  onPending: (pending: boolean) => void;
};
function QuickEditor({
  locale,
  childId,
  kind,
  active,
  initialAmount,
  close,
  completed,
  onPending,
}: QuickEditorProps) {
  const c = quickCopy(locale),
    t = useTranslations();
  const feed = kind === 'breast' || kind === 'formula' || kind === 'solids';
  const activity = activityKinds.includes(
    kind as (typeof activityKinds)[number],
  );
  const childcare = kind === 'daycare' || kind === 'kindergarten';
  const diaper = kind === 'diaper' || kind === 'stool';
  const [mode, setMode] = useState<'start' | 'record' | 'stop'>(
    active?.running
      ? 'stop'
      : active
        ? 'record'
        : kind === 'breast' || kind === 'sleep' || childcare
          ? 'start'
          : 'record',
  );
  const [id] = useState(() => active?.id ?? createRecordId());
  const [start, setStart] = useState(() =>
    localDateInput(active?.startedAt ?? new Date().toISOString()),
  );
  const [timeEdited, setTimeEdited] = useState(Boolean(active));
  const [duration, setDuration] = useState(
    active?.endedAt ? String(durationMinutes(active)) : '',
  );
  const [amount, setAmount] = useState(
    active
      ? String(active.amount ?? '')
      : String(initialAmount ?? (kind === 'solids' ? 50 : 80)),
  );
  const [recordKind, setRecordKind] = useState(
    (active?.kind === 'dry' ? 'wet' : active?.kind) ??
      (kind === 'sleep'
        ? 'nap'
        : kind === 'stool'
          ? 'dirty'
          : kind === 'diaper'
            ? 'wet'
            : kind),
  );
  const [state, action, pending] = useActionState<QuickSaveState, FormData>(
    saveQuickCare,
    { status: 'idle' },
  );
  const [deleting, setDeleting] = useState(false);
  const busy = pending || deleting;
  useEffect(() => onPending(busy), [busy, onPending]);
  const notified = useRef(false);
  useEffect(() => {
    if (state.status === 'saved' && !notified.current) {
      notified.current = true;
      completed();
    }
  }, [state, completed]);
  const timezone =
    active?.feedingRecord?.record_timezone ??
    active?.childRecord?.record_timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const startIso =
    active && (mode === 'stop' || start === localDateInput(active.startedAt))
      ? active.startedAt
      : start && Number.isFinite(new Date(start).getTime())
        ? new Date(start).toISOString()
        : '';
  const endedAt =
    mode === 'record' && (feed || kind === 'sleep' || childcare)
      ? endFromDuration(startIso, duration)
      : '';
  const title = shortLabels(locale)[kind];
  const clock = startIso
    ? new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(startIso))
    : '--:--';
  const Icon = icons[kind];
  const changeDuration = (value: number, currentTime: number) => {
    setDuration(String(value));
    if (!timeEdited)
      setStart(
        localDateInput(new Date(currentTime - value * 60000).toISOString()),
      );
  };
  const durationRequired = kind === 'breast' || kind === 'sleep' || childcare;
  const durationNeeded =
    mode === 'record' && (feed || kind === 'sleep' || childcare);
  return (
    <form action={action} className="quick-editor-form" aria-label={title}>
      <header
        className="quick-composer-heading"
        style={{ outline: 'none', boxShadow: 'none' }}
      >
        <span className={`quick-kind-badge quick-color-${kind}`}>
          <Icon size={19} />
        </span>
        <h3
          id="quick-composer-title"
          tabIndex={-1}
          style={{ outline: 'none', boxShadow: 'none' }}
        >
          {title}
        </h3>
      </header>
      <input type="hidden" name="locale" value={locale} />
      <input
        type="hidden"
        name="source"
        value={
          feed ? 'feeding' : activity ? 'activity' : diaper ? 'diaper' : kind
        }
      />
      <input type="hidden" name="mode" value={mode} />
      <input
        type="hidden"
        name="useCurrentTime"
        value={String(
          !timeEdited &&
            (mode === 'start' || diaper || (activity && !childcare)),
        )}
      />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="amountUnit" value={active?.unit ?? 'ml'} />
      <input type="hidden" name="version" value={active?.version ?? ''} />
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="kind" value={recordKind} />
      <input type="hidden" name="startedAt" value={startIso} />
      <input type="hidden" name="occurredAt" value={startIso} />
      <input type="hidden" name="endedAt" value={endedAt} />
      <input
        type="hidden"
        name="amount"
        value={kind === 'breast' || mode === 'start' ? '' : amount}
      />
      <input
        type="hidden"
        name="foodName"
        value={active?.feedingRecord?.food_name ?? ''}
      />
      <input
        type="hidden"
        name="color"
        value={active?.childRecord?.stool_color ?? ''}
      />
      <input
        type="hidden"
        name="texture"
        value={active?.childRecord?.stool_texture ?? ''}
      />
      {state.status === 'error' && (
        <p className="flash error" role="alert">
          {c.errors[state.error as keyof typeof c.errors] ?? c.errors.generic}
        </p>
      )}
      <fieldset className="quick-fields" disabled={busy}>
        {mode === 'stop' ? (
          <div className="quick-stop-view">
            <span className="quick-live-dot" />
            <p>{c.running}</p>
            <Timer start={active!.startedAt} />
            <p className="small muted">{c.shared}</p>
          </div>
        ) : (
          <>
            {!active &&
              (kind === 'breast' || kind === 'sleep' || childcare) && (
                <div className="quick-mode" role="group" aria-label={title}>
                  {(['start', 'record'] as const).map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={mode === value}
                      onClick={() => {
                        setMode(value);
                        setDuration('');
                        if (!timeEdited)
                          setStart(localDateInput(new Date().toISOString()));
                      }}
                    >
                      {childcare
                        ? value === 'start'
                          ? locale === 'ko'
                            ? '지금 등원해요'
                            : 'Starting now'
                          : locale === 'ko'
                            ? '귀가했어요'
                            : 'Already back'
                        : value === 'start'
                          ? kind === 'sleep'
                            ? c.sleepNow
                            : c.startNow
                          : kind === 'sleep'
                            ? c.recordSleep
                            : c.recordAfter}
                    </button>
                  ))}
                </div>
              )}
            {kind === 'sleep' && (
              <div
                className="quick-choices"
                role="group"
                aria-label={t('kind')}
              >
                {['nap', 'night'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={recordKind === value}
                    onClick={() => setRecordKind(value)}
                  >
                    <Moon size={17} />
                    {kindLabel(value, locale)}
                  </button>
                ))}
              </div>
            )}
            {diaper && (
              <div
                className="quick-diaper-options"
                role="group"
                aria-label={t('kind')}
              >
                {(kind === 'stool'
                  ? ['dirty', 'mixed']
                  : ['wet', 'diaper_dirty', 'diaper_mixed']
                ).map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={recordKind === value}
                    onClick={() => setRecordKind(value)}
                  >
                    <strong>{kindLabel(value, locale)}</strong>
                  </button>
                ))}
              </div>
            )}
            {activity && (
              <ActivityFields
                key={kind}
                kind={kind}
                locale={locale}
                record={active?.childRecord}
              />
            )}
            {feed && kind !== 'breast' && (
              <AmountRuler
                unit={active?.unit === 'g' ? 'g' : 'ml'}
                locale={locale}
                kind={kind}
                value={amount}
                onChange={setAmount}
              />
            )}
            {mode === 'start' && (
              <div className="quick-start-view">
                <span>
                  <Icon size={42} />
                </span>
                <p>{kind === 'sleep' ? c.sleepNow : c.startNow}</p>
                <strong>{clock}</strong>
              </div>
            )}
            {durationNeeded && (
              <fieldset
                className={`quick-duration ${feed ? 'quick-feeding-duration' : ''}`}
              >
                <legend>
                  <QuickFieldTitle>
                    {childcare
                      ? locale === 'ko'
                        ? '머문 시간'
                        : 'Time spent'
                      : kind === 'sleep'
                        ? c.sleepDuration
                        : c.duration}
                  </QuickFieldTitle>
                </legend>
                <div className="quick-choices">
                  {(childcare
                    ? [60, 120, 180, 240, 300, 360, 480]
                    : kind === 'sleep'
                      ? [15, 30, 45, 60, 90, 120, 180]
                      : [5, 10, 15, 20, 30, 45, 60]
                  ).map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={duration === String(value)}
                      onClick={() => {
                        if (!durationRequired && duration === String(value))
                          setDuration('');
                        else changeDuration(value, Date.now());
                      }}
                    >
                      {value}
                      {c.minutes}
                    </button>
                  ))}
                </div>
                {kind === 'sleep' && <p>{c.sleepHelp}</p>}
              </fieldset>
            )}
            <div className="quick-time-edit">
              <label>
                <QuickFieldTitle>
                  {diaper
                    ? c.diaperTime
                    : childcare
                      ? locale === 'ko'
                        ? '시작 시각'
                        : 'Start time'
                      : activity
                        ? locale === 'ko'
                          ? '기록 시각'
                          : 'Time'
                        : c.time}
                </QuickFieldTitle>
                <span
                  className="quick-time-control"
                  style={{
                    display: 'flex',
                    position: 'relative',
                    width: '100%',
                    minWidth: 0,
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                    height: 46,
                    alignItems: 'center',
                    marginTop: 0,
                  }}
                >
                  <span aria-hidden="true">{clock}</span>
                  <input
                    aria-label={
                      diaper
                        ? c.diaperTime
                        : childcare
                          ? locale === 'ko'
                            ? '시작 시각'
                            : 'Start time'
                          : activity
                            ? locale === 'ko'
                              ? '기록 시각'
                              : 'Time'
                            : c.time
                    }
                    type="time"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      width: '100%',
                      maxWidth: '100%',
                      minWidth: 0,
                      height: '100%',
                      boxSizing: 'border-box',
                      margin: 0,
                      padding: 0,
                      border: 0,
                    }}
                    value={start ? start.slice(11, 16) : ''}
                    onChange={(event) => {
                      const date = (
                        start || localDateInput(new Date().toISOString())
                      ).slice(0, 10);
                      setStart(
                        event.target.value
                          ? `${date}T${event.target.value}`
                          : '',
                      );
                      setTimeEdited(true);
                    }}
                    required
                  />
                </span>
              </label>
            </div>
          </>
        )}
      </fieldset>
      <input
        type="hidden"
        name="note"
        value={active?.feedingRecord?.note ?? active?.childRecord?.note ?? ''}
      />
      <footer className="quick-composer-footer">
        <button
          type="button"
          className="button secondary quick-cancel"
          onClick={close}
          disabled={busy}
        >
          {locale === 'ko' ? '취소' : 'Cancel'}
        </button>
        {active && (
          <QuickDelete
            locale={locale}
            childId={childId}
            entry={active}
            disabled={busy}
            completed={completed}
            onPending={setDeleting}
          />
        )}
        <button
          className="button primary quick-confirm"
          disabled={
            busy ||
            !startIso ||
            (durationNeeded && durationRequired && !endedAt)
          }
          aria-busy={pending}
        >
          {mode === 'start' ? (
            <Play size={17} />
          ) : mode === 'stop' ? (
            <Square size={15} />
          ) : (
            <Check size={20} />
          )}
          <span>
            {pending
              ? c.saving
              : mode === 'stop'
                ? kind === 'sleep'
                  ? c.sleepStop
                  : c.stop
                : mode === 'start'
                  ? c.start
                  : c.save}
          </span>
        </button>
      </footer>
    </form>
  );
}
function AmountRuler({
  unit = 'ml',
  locale,
  kind,
  value,
  onChange,
}: {
  locale: Locale;
  kind: 'formula' | 'solids';
  unit?: 'ml' | 'g';
  value: string;
  onChange: (value: string) => void;
}) {
  const c = quickCopy(locale),
    max = Math.max(
      kind === 'solids' ? 500 : 600,
      Math.ceil(Number(value) / 100) * 100,
    ),
    step = kind === 'solids' ? 5 : 10,
    divisions = max / 100;
  const presets =
    kind === 'solids'
      ? [30, 50, 80, 100, 150, 200]
      : [60, 80, 120, 160, 200, 240];
  return (
    <div className="quick-amount-picker">
      <div className="quick-amount-heading">
        <output aria-live="polite" aria-label={c.amount}>
          {value === '' ? (
            c.unknown
          ) : (
            <>
              {value}
              <small>{unit}</small>
            </>
          )}
        </output>
      </div>
      <div
        className="quick-ruler"
        style={
          {
            '--quick-level': `${(Number(value) / max) * 100}%`,
          } as React.CSSProperties
        }
      >
        <div className="quick-ruler-ticks" aria-hidden="true">
          {Array.from({ length: divisions + 1 }, (_, i) => (
            <span key={i}>
              <i />
              {max - i * 100}
            </span>
          ))}
        </div>
        <input
          type="range"
          aria-label={`${c.amount} (${unit})`}
          aria-valuetext={value === '' ? c.unknown : `${value} ${unit}`}
          min={0}
          max={max}
          step={step}
          value={value || 0}
          disabled={value === ''}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="quick-ruler-cue" aria-hidden="true">
          <Plus size={14} />
          <Minus size={14} />
        </div>
      </div>
      <h4 className="quick-amount-label">
        <QuickFieldTitle>{c.amount}</QuickFieldTitle>
      </h4>
      <div className="quick-choices quick-amount-presets">
        {presets.map((v) => (
          <button
            type="button"
            key={v}
            aria-label={`${v} ${unit}`}
            aria-pressed={value === String(v)}
            onClick={() => onChange(String(v))}
          >
            {v}
          </button>
        ))}
        <button
          type="button"
          className="quick-unknown"
          aria-label={c.unknown}
          aria-pressed={value === ''}
          onClick={() => onChange(value === '' ? '80' : '')}
        >
          {locale === 'ko' ? '모름' : '?'}
        </button>
      </div>
    </div>
  );
}
