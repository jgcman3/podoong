import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { selectedKinds } from './config';
import { resolveWeek } from './model';
import { loadInsights } from './data';
import { PatternBrowser } from './pattern-browser';
import { KindPicker } from './kind-picker';
import { InsightsNavigation } from './navigation';
import { Statistics } from './statistics';
import { buildStatistics } from './statistics-model';
export async function Insights({
  context,
  locale,
  kind: rawKind,
  week: rawWeek,
  pattern,
  day,
  interval: rawInterval,
}: {
  context: CareContext;
  locale: Locale;
  kind?: string;
  week?: string;
  pattern?: string;
  day?: string;
  interval?: string;
}) {
  const selected = selectedKinds(rawKind),
    start = resolveWeek(rawWeek, context.today),
    interval = rawInterval === 'week' ? 'week' : 'day';
  const { week, weeks } = await loadInsights(
    context,
    start,
    undefined,
    pattern === 'stats' && interval === 'week' ? 6 : 1,
  );
  return (
    <InsightsNavigation selected={selected}>
      <div className="insights-page">
        <KindPicker locale={locale} />
        {selected.length ? (
          <PatternBrowser
            categories={selected.map((kind) => ({
              kind,
              days: week.categories[kind].days.map(
                ({ date, segments, untimed }) => ({ date, segments, untimed }),
              ),
            }))}
            locale={locale}
            start={start}
            today={context.today}
            birthDate={context.child.birth_date}
            mode={pattern}
            selectedDay={day}
          >
            <Statistics
              charts={buildStatistics(weeks, selected, interval)}
              locale={locale}
              interval={interval}
            />
          </PatternBrowser>
        ) : (
          <p className="insight-empty">
            {locale === 'ko'
              ? '확인할 기능을 선택해 주세요.'
              : 'Select activities to compare.'}
          </p>
        )}
      </div>
    </InsightsNavigation>
  );
}
