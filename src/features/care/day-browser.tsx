'use client';
import { useRef, useState, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LoaderCircle,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import {
  dailyFeedingTotals,
  shiftCareDay,
  type QuickEntry,
} from './quick-model';
import { DayAgenda } from './day-agenda';
import type { DayAgendaData } from './day-agenda-model';
import { loadQuickDay } from './quick-history-actions';

export function DayBrowser({
  locale,
  childId,
  today,
  timezone,
  entries,
  disabled,
  agenda,
  writable,
  children,
}: {
  locale: Locale;
  childId: string;
  today: string;
  timezone: string;
  entries: QuickEntry[];
  disabled: boolean;
  agenda: DayAgendaData;
  writable: boolean;
  children: (entries: QuickEntry[], day: string) => ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [pastEntries, setPastEntries] = useState<QuickEntry[]>([]);
  const [pastAgenda, setPastAgenda] = useState<DayAgendaData>({
    tasks: [],
    events: [],
  });
  const [pastWritable, setPastWritable] = useState(writable);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const drag = useRef<{
    x: number;
    y: number;
    dx: number;
    locked: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const ko = locale === 'ko',
    day = selected ?? today;
  const history = (selected === null ? entries : pastEntries).filter(
    (entry) => !entry.running,
  );
  const totals = dailyFeedingTotals(history, day, timezone);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const label = new Intl.DateTimeFormat(locale, {
    year: day.slice(0, 4) !== today.slice(0, 4) ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
  const locked = disabled || loading;
  async function navigate(next: string) {
    if (locked || next > today || next === day) return;
    setFailed(null);
    if (next === today) {
      setSelected(null);
      return;
    }
    setLoading(true);
    try {
      const result = await loadQuickDay({ locale, childId, day: next });
      if (!result.ok) throw new Error('History unavailable');
      setPastEntries(result.entries);
      setPastAgenda(result.agenda);
      setPastWritable(result.writable);
      setSelected(next);
    } catch {
      setFailed(next);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className={`quick-day-browser ${loading ? 'is-loading' : ''} ${offset ? 'is-dragging' : ''}`}
      aria-label={ko ? '일별 돌봄 기록' : 'Daily care records'}
      aria-busy={loading}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          void navigate(shiftCareDay(day, event.key === 'ArrowLeft' ? -1 : 1));
        }
      }}
      onPointerDown={(event) => {
        suppressClick.current = false;
        if (
          locked ||
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target as HTMLElement).closest(
            'button,input,select,textarea,summary,dialog',
          )
        )
          return;
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          dx: 0,
          locked: false,
        };
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d) return;
        const dx = event.clientX - d.x,
          dy = event.clientY - d.y;
        if (!d.locked) {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
            drag.current = null;
            return;
          }
          if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
          d.locked = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        d.dx = dx;
        suppressClick.current = true;
        setOffset(Math.max(-80, Math.min(80, dx * 0.45)));
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        setOffset(0);
        if (d?.locked && Math.abs(d.dx) >= 50)
          void navigate(shiftCareDay(day, d.dx > 0 ? -1 : 1));
      }}
      onPointerCancel={() => {
        drag.current = null;
        setOffset(0);
      }}
      onPointerLeave={() => {
        if (drag.current && !drag.current.locked) drag.current = null;
      }}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="quick-timeline-heading">
        <div className="quick-date-controls">
          <button
            type="button"
            aria-label={ko ? '이전 날짜' : 'Previous day'}
            disabled={locked}
            onClick={() => void navigate(shiftCareDay(day, -1))}
          >
            <ChevronLeft size={18} />
          </button>
          <h3>
            <time dateTime={day}>{label}</time>
          </h3>
          <button
            type="button"
            aria-label={ko ? '다음 날짜' : 'Next day'}
            disabled={locked || day >= today}
            onClick={() => void navigate(shiftCareDay(day, 1))}
          >
            <ChevronRight size={18} />
          </button>
          {day !== today && (
            <button
              type="button"
              aria-label={ko ? '오늘로 돌아가기' : 'Back to today'}
              disabled={locked}
              onClick={() => void navigate(today)}
            >
              <CalendarDays size={17} />
            </button>
          )}
          {loading && (
            <LoaderCircle
              className="quick-day-spinner"
              size={16}
              aria-label={ko ? '불러오는 중' : 'Loading'}
            />
          )}
        </div>
        <div
          className="quick-day-total"
          aria-label={
            ko
              ? '기록된 분유와 이유식 섭취량'
              : 'Recorded formula and solids volume'
          }
        >
          <strong>
            {ko ? '총 ' : 'Total '}
            {number.format(totals.total)} ml
          </strong>
          <span>
            ({ko ? '분유' : 'Formula'} {number.format(totals.formula)} +{' '}
            {ko ? '이유식' : 'Solids'} {number.format(totals.solids)})
          </span>
        </div>
      </div>
      {failed && (
        <div className="flash error" role="alert">
          <span>
            {ko ? '기록을 불러오지 못했어요.' : 'Could not load records.'}
          </span>
          <button
            type="button"
            onClick={() => void navigate(failed)}
            disabled={locked}
          >
            {ko ? '다시 시도' : 'Retry'}
          </button>
        </div>
      )}
      <div
        key={day}
        className="quick-day-content"
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children(history, day)}
        <DayAgenda
          locale={locale}
          childId={childId}
          day={day}
          data={selected === null ? agenda : pastAgenda}
          writable={writable && (selected === null || pastWritable)}
          onTaskSaved={(id, status) => {
            if (selected !== null)
              setPastAgenda((current) => ({
                ...current,
                tasks: current.tasks.map((task) =>
                  task.id === id ? { ...task, status } : task,
                ),
              }));
          }}
        />
      </div>
    </section>
  );
}
