import { GrowthCurve } from './growth-curve';
import { Milestones } from './milestones';
import reference from './reference/who-lms.json';
import { loadGrowthPoints } from './growth-data';
import { GrowthReport } from './report';
import { InsightTabs } from './tabs';
import { DevelopmentGuide } from './development-guide';
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
  if (pattern === 'report')
    return (
      <InsightsNavigation selected={selected}>
        <div className="insights-page">
          <InsightTabs mode={pattern} locale={locale} />
          <GrowthReport context={context} locale={locale} />
        </div>
      </InsightsNavigation>
    );
  if (pattern === 'curve' || pattern === 'milestones') {
    let content;
    if (pattern === 'curve') {
      const points = await loadGrowthPoints(context);
      content = (
        <GrowthCurve
          key={context.child.id}
          points={points}
          reference={reference}
          sex={context.child.sex}
          birthDate={context.child.birth_date}
          child={context.child.id}
          locale={locale}
        />
      );
    } else {
      const { data, error } = await context.db
        .from('child_milestones')
        .select('milestone_key')
        .eq('child_id', context.child.id);
      if (error) throw new Error('Milestones unavailable');
      content = (
        <Milestones
          key={context.child.id}
          child={context.child.id}
          birthDate={context.child.birth_date}
          today={context.today}
          checked={data.map((row) => row.milestone_key)}
          writable={context.writable}
          locale={locale}
        />
      );
    }
    return (
      <InsightsNavigation selected={selected}>
        <div className="insights-page">
          <InsightTabs mode={pattern} locale={locale} />
          {content}
        </div>
      </InsightsNavigation>
    );
  }
  if (pattern === 'guide')
    return (
      <InsightsNavigation selected={selected}>
        <div className="insights-page">
          <InsightTabs mode={pattern} locale={locale} />
          <DevelopmentGuide
            key={context.child.id}
            birthDate={context.child.birth_date}
            today={context.today}
            child={context.child.id}
            locale={locale}
          />
        </div>
      </InsightsNavigation>
    );
  const { week, weeks } = await loadInsights(
    context,
    start,
    undefined,
    pattern === 'stats' && interval === 'week' ? 6 : 1,
  );
  return (
    <InsightsNavigation selected={selected}>
      <div className="insights-page">
        <InsightTabs mode={pattern} locale={locale} />
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
