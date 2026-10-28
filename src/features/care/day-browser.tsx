'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LoaderCircle } from 'lucide-react';
import { ageInDays, type Locale } from '@/lib/domain';
import {
  dailyFeedingTotals,
  shiftCareDay,
  type QuickEntry,
} from './quick-model';
import type { loadQuickDay as readQuickDay } from './quick-history-actions';
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
  revision = 0,
}: {
  locale: Locale;
  childId: string;
  today: string;
  birthDate: string;
  timezone: string;
  entries: QuickEntry[];
  disabled: boolean;
  revision?: number;
  children: (entries: QuickEntry[], day: string) => ReactNode;
}) {
  const [past, setPast] = useState<HistoryDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const pastRef = useRef(past);
  useEffect(() => {
    pastRef.current = past;
  }, [past]);
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
      const result = await loadQuickDay({ locale, childId, day });
      if (!result.ok) throw new Error('History unavailable');
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
    const days = pastRef.current;
    if (!days.length) return;
    void Promise.all(
      days.map(async ({ day }) => {
        const result = await loadQuickDay({ locale, childId, day });
        if (!result.ok) throw new Error('History unavailable');
        return { day, ...result };
      }),
    )
      .then((updated) => {
        if (!cancelled)
          setPast((current) =>
            current.map(
              (item) => updated.find((day) => day.day === item.day) ?? item,
            ),
          );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [revision, locale, childId]);
  const days = [{ day: today, entries }, ...past];
  return (
    <div className="quick-history-feed">
      {days.map((item) => {
        const { day } = item;
        const history = item.entries.filter((entry) => !entry.running);
        const totals = dailyFeedingTotals(history, day, timezone);
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
              </div>
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
          hasMore && (
            <button
              type="button"
              className="button secondary"
              disabled={disabled}
              onClick={() => void loadMore()}
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
