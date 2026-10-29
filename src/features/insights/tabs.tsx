'use client';
import { useSearchParams } from 'next/navigation';
import type { Locale } from '@/lib/domain';
import { useInsightsNavigation } from './navigation';

const tabs = [
  ['daily', '하루패턴', 'Daily'],
  ['weekly', '주간패턴', 'Weekly'],
  ['stats', '통계', 'Stats'],
  ['curve', '성장곡선', 'Growth'],
  ['milestones', '마일스톤', 'Milestones'],
  ['guide', '가이드', 'Guide'],
  ['received', '선물·용돈', 'Gifts'],
] as const;

export function InsightTabs({
  mode,
  locale,
}: {
  mode?: string;
  locale: Locale;
}) {
  const { navigate } = useInsightsNavigation();
  const query = useSearchParams();
  const requested = query.get('pattern') ?? mode;
  const active = tabs.some(([key]) => key === requested) ? requested : 'daily';
  return (
    <>
      <nav
        className="insight-navigation"
        aria-label={locale === 'ko' ? '인사이트 탐색' : 'Insight navigation'}
      >
        <div className="insight-flat-tabs" lang={locale}>
          {tabs.map(([key, ko, en]) => (
            <button
              key={key}
              type="button"
              aria-pressed={active === key}
              onClick={() => navigate({ pattern: key }, true)}
            >
              {locale === 'ko' ? ko : en}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
