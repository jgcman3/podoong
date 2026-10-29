import { GrowthCurve } from './growth-curve';
import { Milestones } from './milestones';
import reference from './reference/who-lms.json';
import { loadGrowthPoints } from './growth-data';
import { InsightTabs } from './tabs';
import { DevelopmentGuide } from './development-guide';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { selectedKinds } from './config';
import { resolveWeek } from './model';
import { loadInsights } from './data';
import { RecordInsights } from './record-insights';
import { InsightsNavigation } from './navigation';
import {
  loadReceivedRecords,
  loadReceivedOverview,
} from '@/features/received/data';
import { ReceivedLists } from '@/features/received/lists';
export async function Insights({
  context,
  locale,
  kind: rawKind,
  week: rawWeek,
  pattern = 'daily',
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
  if (pattern === 'received') {
    const overview = await loadReceivedOverview(context);
    const [gifts, allowance] = await Promise.all([
      overview.gifts.length
        ? loadReceivedRecords(
            context,
            'gift',
            undefined,
            overview.gifts[0].sender_name,
          )
        : Promise.resolve({ items: [], hasMore: false }),
      loadReceivedRecords(context, 'allowance'),
    ]);
    return (
      <InsightsNavigation selected={selected}>
        <div className="insights-page">
          <InsightTabs mode={pattern} locale={locale} />
          <ReceivedLists
            key={context.child.id}
            childId={context.child.id}
            locale={locale}
            gifts={gifts}
            overview={overview}
            allowance={allowance}
          />
        </div>
      </InsightsNavigation>
    );
  }
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
    <InsightsNavigation
      selected={selected}
      loadedStart={start}
      loadedSpan={weeks.length}
    >
      <div className="insights-page">
        <InsightTabs mode={pattern} locale={locale} />
        <RecordInsights
          week={week}
          weeks={weeks}
          locale={locale}
          start={start}
          today={context.today}
          birthDate={context.child.birth_date}
          mode={pattern}
          selectedDay={day}
          interval={interval}
        />
      </div>
    </InsightsNavigation>
  );
}
