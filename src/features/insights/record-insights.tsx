'use client';
import { useSearchParams } from 'next/navigation';
import type { Locale } from '@/lib/domain';
import type { WeekStats } from './model';
import { useInsightsNavigation } from './navigation';
import { KindPicker } from './kind-picker';
import { PatternBrowser } from './pattern-browser';
import { Statistics } from './statistics';
import { buildStatistics, type StatisticsInterval } from './statistics-model';

export function RecordInsights({
  week,
  weeks,
  locale,
  interval,
  ...period
}: {
  week: WeekStats;
  weeks: WeekStats[];
  locale: Locale;
  interval: StatisticsInterval;
  start: string;
  today: string;
  birthDate: string | null;
  mode?: string;
  selectedDay?: string;
}) {
  const { selected } = useInsightsNavigation();
  const query = useSearchParams();
  const mode = query.get('pattern') ?? period.mode;
  const selectedDay = query.get('day') ?? period.selectedDay;
  const currentInterval =
    query.get('interval') === 'week'
      ? 'week'
      : query.has('interval')
        ? 'day'
        : interval;
  return (
    <>
      <KindPicker locale={locale} />
      {selected.length ? (
        <PatternBrowser
          {...period}
          mode={mode}
          selectedDay={selectedDay}
          locale={locale}
          categories={selected.map((kind) => ({
            kind,
            days: week.categories[kind].days.map(
              ({ date, segments, untimed }) => ({ date, segments, untimed }),
            ),
          }))}
        >
          <Statistics
            charts={buildStatistics(weeks, selected, currentInterval)}
            locale={locale}
            interval={currentInterval}
          />
        </PatternBrowser>
      ) : (
        <p className="insight-empty">
          {locale === 'ko'
            ? '확인할 기능을 선택해 주세요.'
            : 'Select activities to compare.'}
        </p>
      )}
    </>
  );
}
