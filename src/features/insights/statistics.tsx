'use client';
import type { Locale } from '@/lib/domain';
import type { Statistic, StatisticsInterval } from './statistics-model';
import { useInsightsNavigation } from './navigation';
import { StatisticsChart } from './charts';
export function Statistics({
  charts,
  locale,
  interval,
}: {
  charts: Statistic[];
  locale: Locale;
  interval: StatisticsInterval;
}) {
  const { navigate } = useInsightsNavigation(),
    ko = locale === 'ko';
  return (
    <div className="insight-statistics-view">
      <div
        className="insight-statistics-interval"
        role="group"
        aria-label={ko ? '통계 단위' : 'Statistics interval'}
      >
        <button
          type="button"
          aria-pressed={interval === 'day'}
          onClick={() => navigate({ pattern: 'stats', interval: 'day' }, true)}
        >
          {ko ? '일단위 (일주일기간)' : 'Daily (7 days)'}
        </button>
        <button
          type="button"
          aria-pressed={interval === 'week'}
          onClick={() => navigate({ pattern: 'stats', interval: 'week' }, true)}
        >
          {ko ? '주단위 (6주기간)' : 'Weekly (6 weeks)'}
        </button>
      </div>
      {charts.map((chart) => (
        <StatisticsChart
          key={`${chart.kind}:${interval}:${chart.points[0]?.date}`}
          chart={chart}
          locale={locale}
        />
      ))}
    </div>
  );
}
