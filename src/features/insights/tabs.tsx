'use client';
import { useRef } from 'react';
import type { Locale } from '@/lib/domain';
import { useInsightsNavigation } from './navigation';
const groups = [
  {
    key: 'records',
    ko: '기록 분석',
    en: 'Record analysis',
    modes: [
      ['daily', '하루 패턴', 'Daily pattern'],
      ['weekly', '주간 패턴', 'Weekly pattern'],
      ['stats', '통계 정보', 'Statistics'],
    ],
  },
  {
    key: 'growth',
    ko: '성장·발달',
    en: 'Growth & development',
    modes: [
      ['report', '성장 보고서', 'Growth report'],
      ['curve', '성장곡선', 'Growth curves'],
      ['milestones', '마일스톤', 'Milestones'],
    ],
  },
  {
    key: 'guide',
    ko: '육아 가이드',
    en: 'Care guide',
    modes: [['guide', '육아·발달', 'Care & development']],
  },
] as const;
export function InsightTabs({
  mode,
  locale,
}: {
  mode?: string;
  locale: Locale;
}) {
  const { navigate } = useInsightsNavigation();
  const active = groups.some((group) =>
    group.modes.some(([key]) => key === mode),
  )
    ? mode!
    : 'weekly';
  const current = groups.find((group) =>
    group.modes.some(([key]) => key === active),
  )!;
  const remembered = useRef<Record<string, string>>({
    records: 'weekly',
    growth: 'curve',
    guide: 'guide',
  });
  function go(next: string) {
    remembered.current[current.key] = active;
    navigate({ pattern: next }, true);
  }
  return (
    <nav
      className="insight-navigation"
      aria-label={locale === 'ko' ? '인사이트 탐색' : 'Insight navigation'}
    >
      <div
        className="insight-group-tabs"
        role="group"
        aria-label={locale === 'ko' ? '인사이트 분류' : 'Insight categories'}
      >
        {groups.map((group) => (
          <button
            type="button"
            key={group.key}
            aria-pressed={group.key === current.key}
            onClick={() => {
              if (group.key !== current.key) go(remembered.current[group.key]);
            }}
          >
            {locale === 'ko' ? group.ko : group.en}
          </button>
        ))}
      </div>
      {current.modes.length > 1 && (
        <div
          className="insight-pattern-tabs"
          role="group"
          aria-label={locale === 'ko' ? '인사이트 보기' : 'Insight view'}
        >
          {current.modes.map(([key, ko, en]) => (
            <button
              key={key}
              type="button"
              aria-pressed={active === key}
              onClick={() => go(key)}
            >
              {locale === 'ko' ? ko : en}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
