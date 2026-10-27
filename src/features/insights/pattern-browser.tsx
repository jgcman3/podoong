'use client';
import { useRef, useState, type ReactNode } from 'react';
import { useInsightsNavigation } from './navigation';
import { ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { shiftCareDay } from '@/features/care/quick-model';
import type { PatternCategory } from './model';
import {
  PatternLegend,
  PatternTable,
  UntimedPattern,
  WeeklyPattern,
} from './pattern';
import { DailyPattern } from './daily-pattern';
export function PatternBrowser({
  categories,
  locale,
  start,
  today,
  birthDate,
  mode,
  selectedDay,
  children,
}: {
  categories: PatternCategory[];
  locale: Locale;
  start: string;
  today: string;
  birthDate: string | null;
  mode?: string;
  selectedDay?: string;
  children: ReactNode;
}) {
  const { pending, navigate: visit } = useInsightsNavigation();
  const [offset, setOffset] = useState(0);
  const drag = useRef<{
    x: number;
    y: number;
    dx: number;
    locked: boolean;
  } | null>(null);
  const daily = mode === 'daily',
    ko = locale === 'ko',
    statistics = mode === 'stats';
  const end = shiftCareDay(start, 6),
    day = categories[0]?.days.some((d) => d.date === selectedDay)
      ? selectedDay!
      : end;
  const date = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
  function navigate(direction: number) {
    let next = shiftCareDay(daily ? day : start, direction * (daily ? 1 : 7));
    if (daily && next > today) return;
    if (!daily && next > shiftCareDay(today, -6)) {
      if (start >= shiftCareDay(today, -6)) return;
      next = shiftCareDay(today, -6);
    }
    const patch: Record<string, string | null> = {
      pattern: daily ? 'daily' : statistics ? 'stats' : 'weekly',
    };
    if (daily) {
      patch.day = next;
      if (next < start) patch.week = shiftCareDay(start, -7);
      else if (next > end) {
        const nextStart = shiftCareDay(start, 7),
          latest = shiftCareDay(today, -6);
        patch.week = nextStart > latest ? latest : nextStart;
      }
    } else {
      patch.week = next;
      patch.day = null;
    }
    visit(patch);
  }
  return (
    <section className="panel insight-overlay-panel" aria-busy={pending}>
      {!statistics && (
        <nav
          className="insight-day-nav insight-period-nav"
          aria-label={ko ? '기간 선택' : 'Select period'}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={pending}
            aria-label={
              ko
                ? daily
                  ? '이전 하루'
                  : '이전 7일'
                : daily
                  ? 'Previous day'
                  : 'Previous seven days'
            }
          >
            <ChevronLeft size={19} />
          </button>
          <div>
            {daily ? (
              <time dateTime={day}>{date}</time>
            ) : (
              <>
                <time dateTime={start}>
                  {new Intl.DateTimeFormat(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${start}T00:00:00Z`))}
                </time>
                {' – '}
                <time dateTime={end}>
                  {new Intl.DateTimeFormat(locale, {
                    year:
                      start.slice(0, 4) !== end.slice(0, 4)
                        ? 'numeric'
                        : undefined,
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${end}T00:00:00Z`))}
                </time>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(1)}
            disabled={
              pending ||
              (daily ? day >= today : start >= shiftCareDay(today, -6))
            }
            aria-label={
              ko
                ? daily
                  ? '다음 하루'
                  : '다음 7일'
                : daily
                  ? 'Next day'
                  : 'Next seven days'
            }
          >
            <ChevronRight size={19} />
          </button>
        </nav>
      )}
      {statistics ? (
        <div className="insight-statistics">{children}</div>
      ) : (
        <>
          <PatternLegend categories={categories} locale={locale} />
          <div
            className={`insight-pattern-swipe ${offset ? 'is-dragging' : ''}`}
            role="group"
            aria-label={
              ko
                ? daily
                  ? '하루 패턴 넘기기'
                  : '주간 패턴 넘기기'
                : daily
                  ? 'Browse daily patterns'
                  : 'Browse weekly patterns'
            }
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                event.preventDefault();
                navigate(event.key === 'ArrowLeft' ? -1 : 1);
              }
            }}
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return;
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
              setOffset(Math.max(-70, Math.min(70, dx * 0.4)));
            }}
            onPointerUp={() => {
              const d = drag.current;
              drag.current = null;
              setOffset(0);
              if (d?.locked && Math.abs(d.dx) >= 50)
                navigate(d.dx > 0 ? -1 : 1);
            }}
            onPointerCancel={() => {
              drag.current = null;
              setOffset(0);
            }}
            onPointerLeave={() => {
              if (drag.current && !drag.current.locked) drag.current = null;
            }}
          >
            <div
              className="insight-pattern-slide"
              style={{ transform: `translateX(${offset}px)` }}
            >
              {daily ? (
                <DailyPattern
                  categories={categories}
                  locale={locale}
                  day={day}
                  birthDate={birthDate}
                />
              ) : (
                <WeeklyPattern categories={categories} locale={locale} />
              )}
            </div>
            {pending && (
              <LoaderCircle
                className="insight-pattern-loading"
                size={22}
                aria-label={ko ? '불러오는 중' : 'Loading'}
              />
            )}
          </div>
          <UntimedPattern
            categories={categories}
            locale={locale}
            day={daily ? day : undefined}
          />
          <PatternTable
            categories={categories}
            locale={locale}
            day={daily ? day : undefined}
          />
          {categories.some((c) => c.kind === 'vaccination') && (
            <p className="small muted">
              {ko
                ? '접종일 기준 · 접종 시각은 추정하지 않아요'
                : 'Vaccination dates · no estimated times'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
