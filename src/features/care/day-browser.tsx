'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LoaderCircle, Moon, ChevronDown } from 'lucide-react';
import { dailySleepTotals } from './daily-sleep';
import { formatCareDuration } from '@/lib/duration';
import { ageInDays, type Locale } from '@/lib/domain';
import {
  dailyFeedingTotals,
  shiftCareDay,
  type QuickEntry,
} from './quick-model';
import type { loadQuickDay as readQuickDay } from './quick-history-actions';
import { historyDaysToReload, type HistoryChange } from './history-change';
async function loadQuickDay(input: {
  locale: string;
  childId: string;
  day: string;
}): Promise<Awaited<ReturnType<typeof readQuickDay>>> {
  const response = await fetch(
    `/api/care/history?${new URLSearchParams(input)}`,
    { cache: 'no-store' },
  );
  if (!response.ok) throw new Error('History unavailable');
  return response.json();
}
type HistoryDay = {
  day: string;
  entries: QuickEntry[];
};
export function DayBrowser({
  locale,
  childId,
  today,
  birthDate,
  timezone,
  entries,
  disabled,
  children,
  change,
  now: initialNow,
}: {
  locale: Locale;
  childId: string;
  today: string;
  birthDate: string;
  timezone: string;
  entries: QuickEntry[];
  disabled: boolean;
  change: HistoryChange;
  now: string;
  children: (entries: QuickEntry[], day: string) => ReactNode;
}) {
  const [past, setPast] = useState<HistoryDay[]>([]);
  const [clock, setClock] = useState(() => Date.parse(initialNow));
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible') setClock(Date.now());
    };
    const timer = window.setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const revision = useRef(change.revision);
  const dirtyDays = useRef(new Map<string, number>());
  const pastRef = useRef(past);
  useEffect(() => {
    pastRef.current = past;
  }, [past]);
  useEffect(() => {
    revision.current = change.revision;
  }, [change]);
  const ko = locale === 'ko';
  const oldest = past.at(-1)?.day ?? today;
  const hasMore = oldest > birthDate;
  const loadMore = useCallback(async () => {
    if (pending.current || disabled || !hasMore) return;
    pending.current = true;
    setLoading(true);
    setFailed(false);
    const day = shiftCareDay(oldest, -1);
    try {
      let version: number;
      let result: Awaited<ReturnType<typeof loadQuickDay>>;
      do {
        version = revision.current;
        result = await loadQuickDay({ locale, childId, day });
        if (!result.ok) throw new Error('History unavailable');
      } while (version !== revision.current);
      setPast((current) =>
        current.some((item) => item.day === day)
          ? current
          : [...current, { day, ...result }],
      );
    } catch {
      setFailed(true);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }, [disabled, hasMore, oldest, locale, childId]);
  useEffect(() => {
    if (
      disabled ||
      failed ||
      loading ||
      !hasMore ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: '160px' },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [disabled, failed, loading, hasMore, loadMore]);
  useEffect(() => {
    let cancelled = false;
    for (const day of historyDaysToReload(
      pastRef.current.map((item) => item.day),
      change.ranges,
      timezone,
    ))
      dirtyDays.current.set(day, change.revision);
    const days = [...dirtyDays.current.entries()];
    if (!days.length) return;
    void Promise.all(
      days.map(async ([day, version]) => {
        const result = await loadQuickDay({ locale, childId, day });
        if (!result.ok) throw new Error('History unavailable');
        return { day, version, ...result };
      }),
    )
      .then((updated) => {
        if (cancelled) return;
        const fresh = updated.filter(
          (item) => dirtyDays.current.get(item.day) === item.version,
        );
        for (const item of fresh) dirtyDays.current.delete(item.day);
        setPast((current) =>
          current.map(
            (item) => fresh.find((day) => day.day === item.day) ?? item,
          ),
        );
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [change, locale, childId, timezone, refreshAttempt]);
  const days = [{ day: today, entries }, ...past];
  return (
    <div className="quick-history-feed">
      {days.map((item) => {
        const { day } = item;
        const history = item.entries.filter((entry) => !entry.running);
        const totals = dailyFeedingTotals(history, day, timezone);
        const sleep = dailySleepTotals(
          item.entries,
          day,
          timezone,
          Math.max(clock, Date.parse(initialNow)),
        );
        const number = new Intl.NumberFormat(locale, {
          maximumFractionDigits: 2,
        });
        const label = new Intl.DateTimeFormat(locale, {
          year: day.slice(0, 4) !== today.slice(0, 4) ? 'numeric' : undefined,
          month: 'long',
          day: 'numeric',
          weekday: 'short',
          timeZone: 'UTC',
        }).format(new Date(`${day}T00:00:00Z`));
        return (
          <section className="quick-day-browser" key={day} aria-label={label}>
            <div className="quick-timeline-heading">
              <div className="quick-date-controls">
                <h3>
                  <time dateTime={day}>{label}</time>
                  <span
                    className="quick-day-age"
                    aria-label={
                      ko
                        ? `생후 ${ageInDays(birthDate, day)}일`
                        : `${ageInDays(birthDate, day)} days old`
                    }
                  >
                    · D+{ageInDays(birthDate, day)}
                  </span>
                </h3>
              </div>
              <details className="quick-day-summary">
                <summary
                  className="quick-day-totals-trigger"
                  aria-label={
                    ko
                      ? '식사량과 수면시간 상세 보기'
                      : 'Feeding and sleep details'
                  }
                >
                  <span
                    className="quick-day-total"
                    aria-label={
                      ko
                        ? '기록된 분유와 이유식 섭취량'
                        : 'Recorded formula and solids volume'
                    }
                  >
                    <strong>
                      <span className="quick-volume-prefix">
                        {ko ? '총 ' : 'Total '}
                      </span>
                      {number.format(totals.total)} ml
                    </strong>
                    <span>
                      (
                      <span
                        className="feeding-amount-formula"
                        aria-label={`${ko ? '분유' : 'Formula'} ${number.format(totals.formula)} ml`}
                        title={ko ? '분유' : 'Formula'}
                      >
                        {number.format(totals.formula)}
                      </span>{' '}
                      +{' '}
                      <span
                        className="feeding-amount-solids"
                        aria-label={`${ko ? '이유식' : 'Solids'} ${number.format(totals.solids)} ml`}
                        title={ko ? '이유식' : 'Solids'}
                      >
                        {number.format(totals.solids)}
                      </span>
                      )
                    </span>
                  </span>
                  <span
                    className="quick-day-sleep"
                    aria-label={
                      ko
                        ? '00시 기준 기록된 수면 시간'
                        : 'Recorded sleep since midnight'
                    }
                  >
                    <Moon size={12} aria-hidden="true" />
                    <span>{ko ? '수면' : 'Sleep'}</span>
                    <strong>{formatCareDuration(sleep.total, locale)}</strong>
                  </span>
                  <ChevronDown size={11} className="quick-day-totals-chevron" aria-hidden="true" />
                </summary>
                <div className="quick-day-total-details">
                  <strong>
                    {ko
                      ? '00시 기준 기록 합계'
                      : 'Recorded totals since midnight'}
                  </strong>
                  <span>
                    {ko ? '분유' : 'Formula'}{' '}
                    <b>{number.format(totals.formula)} ml</b>
                  </span>
                  <span>
                    {ko ? '이유식' : 'Solids'}{' '}
                    <b>{number.format(totals.solids)} ml</b>
                  </span>
                  <span>
                    {ko ? '낮잠' : 'Naps'}{' '}
                    <b>{formatCareDuration(sleep.nap, locale)}</b>
                  </span>
                  <span>
                    {ko ? '밤잠' : 'Night sleep'}{' '}
                    <b>{formatCareDuration(sleep.night, locale)}</b>
                  </span>
                </div>
              </details>
            </div>
            <div className="quick-day-content">{children(history, day)}</div>
          </section>
        );
      })}
      <div ref={sentinel} className="quick-history-loader" aria-live="polite">
        {loading ? (
          <LoaderCircle
            className="quick-day-spinner"
            size={20}
            aria-label={ko ? '불러오는 중' : 'Loading'}
          />
        ) : (
          (hasMore || failed) && (
            <button
              type="button"
              className="button secondary"
              disabled={disabled}
              onClick={() => {
                if (dirtyDays.current.size)
                  setRefreshAttempt((value) => value + 1);
                else void loadMore();
              }}
            >
              {failed
                ? ko
                  ? '다시 시도'
                  : 'Retry'
                : ko
                  ? '이전 기록 보기'
                  : 'Earlier records'}
            </button>
          )
        )}
        {failed && (
          <span role="alert">
            {ko ? '기록을 불러오지 못했어요.' : 'Could not load records.'}
          </span>
        )}
      </div>
    </div>
  );
}
