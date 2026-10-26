'use client';
import {
  useState,
  useEffect,
  useRef,
  useActionState,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Bath,
  Hospital,
  Syringe,
  Thermometer,
  Pill,
  Apple,
  Shapes,
  Smile,
  Toilet,
  Milk,
  Utensils,
  Moon,
  Baby,
  Ruler,
  Heart,
  X,
  Check,
  Clock,
  ArrowUpRight,
  Play,
  Square,
  ChevronRight,
  Minus,
  Plus,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { dateInTimeZone } from '@/lib/domain';
import { kindLabel } from '@/features/child-care/copy';
import { Timer } from './record-form';
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
import type { DayAgendaData } from './day-agenda-model';
import { DayBrowser } from './day-browser';
import { ActivityFields } from './activity-fields';
import { activityKinds } from '@/features/child-care/schema';
import { quickCopy } from './quick-copy';
const icons = {
  breast: Heart,
  formula: Milk,
  solids: Utensils,
  sleep: Moon,
  diaper: Baby,
  growth: Ruler,
  stool: Toilet,
  bath: Bath,
  hospital: Hospital,
  vaccination: Syringe,
  temperature: Thermometer,
  medication: Pill,
  snack: Apple,
  play: Shapes,
  tummy: Smile,
};
const kinds = [
  'breast',
  'formula',
  'solids',
  'diaper',
  'stool',
  'sleep',
  'bath',
  'hospital',
  'vaccination',
  'temperature',
  'medication',
  'snack',
  'play',
  'tummy',
] as const;
const shortLabels = (locale: Locale) =>
  locale === 'ko'
    ? {
        breast: '모유',
        formula: '분유',
        solids: '이유식',
        diaper: '기저귀',
        stool: '배변',
        sleep: '수면',
        bath: '목욕',
        hospital: '병원',
        vaccination: '예방접종',
        temperature: '체온',
        medication: '투약',
        snack: '간식',
        play: '놀이',
        tummy: '터미타임',
        growth: '성장',
      }
    : {
        breast: 'Breast',
        formula: 'Formula',
        solids: 'Solids',
        diaper: 'Diaper',
        stool: 'Poop',
        sleep: 'Sleep',
        bath: 'Bath',
        hospital: 'Doctor',
        vaccination: 'Vaccine',
        temperature: 'Temp',
        medication: 'Medicine',
        snack: 'Snack',
        play: 'Play',
        tummy: 'Tummy time',
        growth: 'Growth',
      };
const mobileQuery = '(max-width: 900px)';
function subscribeMobile(change: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
function entryHref(entry: QuickEntry, locale: Locale, childId: string) {
  if (entry.source === 'vaccination')
    return `/${locale}/vaccination/${entry.id}?child=${childId}`;
  return entry.source === 'feeding'
    ? `/${locale}/records?child=${childId}&edit=${entry.id}`
    : `/${locale}/care/${entry.service}/${entry.id}?child=${childId}`;
}
export function QuickCare({
  locale,
  childId,
  entries,
  writable,
  timezone,
  today,
  agenda,
}: {
  locale: Locale;
  childId: string;
  entries: QuickEntry[];
  writable: boolean;
  timezone: string;
  today: string;
  agenda: DayAgendaData;
}) {
  const c = quickCopy(locale),
    router = useRouter();
  const [selection, setSelection] = useState<{
    kind: QuickKind;
    active?: QuickEntry;
  } | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const labels = shortLabels(locale);
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; scroll: number; moved: boolean } | null>(
    null,
  );

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
    }
  }, [selection, mobile]); // Keep the same editor and its values when the viewport changes.
  const open = (kind: QuickKind, record?: QuickEntry) => {
    setSaved(false);
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
    setSaved(true);
    setHistoryRevision((value) => value + 1);
    setSelection(null);
    router.refresh();
  };
  return (
    <section
      className="quick-care"
      aria-label={locale === 'ko' ? '육아 기록' : 'Care records'}
    >
      {saved && (
        <div className="flash quick-saved" role="status">
          <Check size={18} />
          <span>{c.saved}</span>
        </div>
      )}
      <div
        className="quick-grid quick-orbit mobile-function-rail"
        ref={rail}
        role="group"
        aria-label={locale === 'ko' ? '빠른 기록 선택' : 'Choose a care record'}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' || event.button !== 0) return;
          drag.current = {
            x: event.clientX,
            scroll: rail.current!.scrollLeft,
            moved: false,
          };
        }}
        onPointerMove={(event) => {
          const d = drag.current;
          if (!d || !rail.current) return;
          const distance = event.clientX - d.x;
          if (Math.abs(distance) > 6) {
            d.moved = true;
            rail.current.setPointerCapture(event.pointerId);
          }
          if (d.moved) rail.current.scrollLeft = d.scroll - distance;
        }}
        onPointerUp={() => {
          if (drag.current?.moved)
            window.setTimeout(() => {
              drag.current = null;
            }, 0);
          else drag.current = null;
        }}
        onPointerLeave={() => {
          if (drag.current && !drag.current.moved) drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onClickCapture={(event) => {
          if (drag.current?.moved) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {kinds.map((kind) => {
          const Icon = icons[kind];
          return writable ? (
            <button
              type="button"
              key={kind}
              className={`quick-orbit-item quick-color-${kind} ${selection?.kind === kind ? 'is-current' : ''}`}
              aria-label={labels[kind]}
              onClick={() => open(kind)}
              disabled={busy}
              aria-haspopup={mobile ? 'dialog' : undefined}
              aria-expanded={selection?.kind === kind}
            >
              <span className="quick-orbit-icon">
                <Icon size={27} />
              </span>
              <strong>{labels[kind]}</strong>
            </button>
          ) : (
            <Link
              key={kind}
              className={`quick-orbit-item quick-color-${kind}`}
              draggable={false}
              href={
                kind === 'vaccination'
                  ? `/${locale}/services/vaccination?child=${childId}`
                  : kind === 'sleep' || kind === 'diaper' || kind === 'stool'
                    ? `/${locale}/services/${kind === 'stool' ? 'diaper' : kind}?child=${childId}`
                    : `/${locale}/${activityKinds.includes(kind as (typeof activityKinds)[number]) ? 'services/activity' : 'records'}?child=${childId}`
              }
            >
              <span className="quick-orbit-icon">
                <Icon size={27} />
              </span>
              <strong>{labels[kind]}</strong>
            </Link>
          );
        })}
      </div>
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
                        {labels[kind]} · {c.running}
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
                        {e.service === 'sleep' ? c.sleepStop : c.stop}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          <DayBrowser
            key={historyRevision}
            locale={locale}
            childId={childId}
            today={today}
            timezone={timezone}
            entries={visible}
            agenda={agenda}
            writable={writable}
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
                          : e.service === 'feeding'
                            ? labels[e.kind as 'breast' | 'formula' | 'solids']
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
                          <Link
                            className={`quick-timeline-entry quick-entry-${e.service} quick-color-${iconKey}`}
                            draggable={false}
                            href={entryHref(e, locale, childId)}
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
                          </Link>
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
                  key={`${childId}:vaccination`}
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
  close: () => void;
  completed: () => void;
  onPending: (pending: boolean) => void;
};
function QuickEditor({
  locale,
  childId,
  kind,
  active,
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
  const diaper = kind === 'diaper' || kind === 'stool';
  const [mode, setMode] = useState<'start' | 'record' | 'stop'>(
    active
      ? 'stop'
      : kind === 'breast' || kind === 'sleep'
        ? 'start'
        : 'record',
  );
  const [id] = useState(() => active?.id ?? crypto.randomUUID());
  const [start, setStart] = useState(() =>
    localDateInput(active?.startedAt ?? new Date().toISOString()),
  );
  const [timeEdited, setTimeEdited] = useState(false);
  const [duration, setDuration] = useState('');
  const [amount, setAmount] = useState(kind === 'solids' ? '50' : '80');
  const [recordKind, setRecordKind] = useState(
    active?.kind ??
      (kind === 'sleep'
        ? 'nap'
        : kind === 'stool'
          ? 'dirty'
          : kind === 'diaper'
            ? 'wet'
            : kind),
  );
  const [note, setNote] = useState('');
  const [state, action, pending] = useActionState<QuickSaveState, FormData>(
    saveQuickCare,
    { status: 'idle' },
  );
  useEffect(() => onPending(pending), [pending, onPending]);
  const notified = useRef(false);
  useEffect(() => {
    if (state.status === 'saved' && !notified.current) {
      notified.current = true;
      completed();
    }
  }, [state, completed]);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const startIso =
    active?.startedAt ?? (start ? new Date(start).toISOString() : '');
  const endedAt =
    mode === 'record' && (feed || kind === 'sleep')
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
  const detailed = active
    ? entryHref(active, locale, childId)
    : feed
      ? `/${locale}/records?child=${childId}&kind=${kind}`
      : `/${locale}/care/${activity ? 'activity' : diaper ? 'diaper' : kind}/new?child=${childId}&kind=${recordKind}`;
  const changeDuration = (value: number, currentTime: number) => {
    setDuration(String(value));
    if (!timeEdited)
      setStart(
        localDateInput(new Date(currentTime - value * 60000).toISOString()),
      );
  };
  const durationNeeded = mode === 'record' && (feed || kind === 'sleep');
  return (
    <form action={action} className="quick-editor-form" aria-label={title}>
      <header className="quick-composer-heading">
        <span className={`quick-kind-badge quick-color-${kind}`}>
          <Icon size={19} />
        </span>
        <h3 id="quick-composer-title">{title}</h3>
        <button
          type="button"
          className="quick-close"
          onClick={close}
          disabled={pending}
          aria-label={c.close}
        >
          <X size={21} />
        </button>
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
        value={String(!timeEdited && (mode === 'start' || diaper || activity))}
      />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="childId" value={childId} />
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
      <input type="hidden" name="foodName" value="" />
      {state.status === 'error' && (
        <p className="flash error" role="alert">
          {c.errors[state.error as keyof typeof c.errors] ?? c.errors.generic}
        </p>
      )}
      <fieldset className="quick-fields" disabled={pending}>
        {mode === 'stop' ? (
          <div className="quick-stop-view">
            <span className="quick-live-dot" />
            <p>{c.running}</p>
            <Timer start={active!.startedAt} />
            <p className="small muted">{c.shared}</p>
          </div>
        ) : (
          <>
            {(kind === 'breast' || kind === 'sleep') && (
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
                    {value === 'start'
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
                  : ['wet', 'dirty', 'mixed', 'dry']
                ).map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={recordKind === value}
                    onClick={() => setRecordKind(value)}
                  >
                    <Baby size={28} />
                    <strong>{kindLabel(value, locale)}</strong>
                  </button>
                ))}
              </div>
            )}
            {activity && (
              <ActivityFields key={kind} kind={kind} locale={locale} />
            )}
            {feed && kind !== 'breast' && (
              <AmountRuler
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
              <fieldset className="quick-duration">
                <legend>
                  {kind === 'sleep' ? c.sleepDuration : c.duration}
                </legend>
                <div className="quick-choices">
                  {(kind === 'sleep'
                    ? [15, 30, 45, 60, 90, 120, 180]
                    : [5, 10, 15, 20, 30, 45, 60]
                  ).map((value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={duration === String(value)}
                      onClick={() => changeDuration(value, Date.now())}
                    >
                      {value}
                      {c.minutes}
                    </button>
                  ))}
                </div>
                <p>{kind === 'sleep' ? c.sleepHelp : c.durationHelp}</p>
              </fieldset>
            )}
            <details className="quick-extra">
              <summary>
                <Clock size={15} />
                {diaper
                  ? c.diaperTime
                  : activity
                    ? locale === 'ko'
                      ? '기록 시각'
                      : 'Time'
                    : c.time}{' '}
                · {clock}
                <span>{c.extras}</span>
              </summary>
              <label>
                {diaper
                  ? c.diaperTime
                  : activity
                    ? locale === 'ko'
                      ? '기록 시각'
                      : 'Time'
                    : c.time}
                <input
                  aria-label={
                    diaper
                      ? c.diaperTime
                      : activity
                        ? locale === 'ko'
                          ? '기록 시각'
                          : 'Time'
                        : c.time
                  }
                  type="datetime-local"
                  value={start}
                  onChange={(event) => {
                    setStart(event.target.value);
                    setTimeEdited(true);
                  }}
                  required
                />
              </label>
              <label>
                {c.note}
                <textarea
                  name="note"
                  maxLength={2000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </details>
          </>
        )}
      </fieldset>
      {mode === 'stop' && <input type="hidden" name="note" value="" />}
      <footer className="quick-composer-footer">
        <Link
          href={detailed}
          aria-disabled={pending}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
        >
          {active ? c.editDetails : c.details}
          <ArrowUpRight size={13} />
        </Link>
        <button
          className="button primary quick-confirm"
          disabled={pending || !startIso || (durationNeeded && !endedAt)}
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
  locale,
  kind,
  value,
  onChange,
}: {
  locale: Locale;
  kind: 'formula' | 'solids';
  value: string;
  onChange: (value: string) => void;
}) {
  const c = quickCopy(locale),
    unit = 'ml',
    max = kind === 'solids' ? 500 : 600,
    step = kind === 'solids' ? 5 : 10,
    divisions = max / 100;
  const presets =
    kind === 'solids'
      ? [30, 50, 80, 100, 150, 200]
      : [60, 80, 120, 160, 200, 240];
  return (
    <div className="quick-amount-picker">
      <div className="quick-amount-heading">
        <span>{c.amount}</span>
        <output aria-live="polite">
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
      <p className="quick-ruler-help">{c.amountHelp}</p>
      <div className="quick-choices quick-amount-presets">
        {presets.map((v) => (
          <button
            type="button"
            key={v}
            aria-pressed={value === String(v)}
            onClick={() => onChange(String(v))}
          >
            {v} {unit}
          </button>
        ))}
        <button
          type="button"
          className="quick-unknown"
          aria-pressed={value === ''}
          onClick={() => onChange(value === '' ? '80' : '')}
        >
          {c.unknown}
        </button>
      </div>
    </div>
  );
}
