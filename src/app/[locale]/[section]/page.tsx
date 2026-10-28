import { Insights } from '@/features/insights/view';
import { notFound, redirect } from 'next/navigation';
import { loadCare } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Flash } from '@/components/flash';
import {
  Today,
  Calendar,
  Family,
  Services,
  Settings,
  ChildAccount,
} from '@/features/dashboard/views';
import type { Locale } from '@/lib/domain';
export default async function AppPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; section: string }>;
  searchParams: Promise<{
    child?: string;
    error?: string;
    notice?: string;
    edit?: string;
    kind?: string;
    page?: string;
    create?: string;
    month?: string;
    day?: string;
    week?: string;
    interval?: string;
    pattern?: string;
    panel?: string;
  }>;
}) {
  const { locale, section } = await params;
  const q = await searchParams;
  if (section === 'records')
    redirect(
      `/${locale}/today${q.child ? `?child=${encodeURIComponent(q.child)}` : ''}`,
    );
  if (
    ![
      'today',
      'calendar',
      'insights',
      'family',
      'account',
      'services',
      'settings',
    ].includes(section)
  )
    notFound();
  const context = await loadCare(
    locale,
    q.child,
    section === 'today' ? ['records'] : [],
    { page: q.page, todayOnly: section === 'today' },
  );
  if (section === 'insights' && q.child && context.child.id !== q.child)
    notFound();
  const props = { context, locale };
  let view;
  switch (section) {
    case 'today':
      view = <Today {...props} />;
      break;
    case 'calendar':
      view = (
        <Calendar
          {...props}
          create={q.create}
          edit={q.edit}
          month={q.month}
          day={q.day}
        />
      );
      break;
    case 'insights':
      view = (
        <Insights
          {...props}
          kind={q.kind}
          week={q.week}
          interval={q.interval}
          pattern={q.pattern}
          day={q.day}
        />
      );
      break;
    case 'account':
      view = <ChildAccount {...props} panel={q.panel} />;
      break;
    case 'family':
      view = <Family {...props} />;
      break;
    case 'services':
      view = <Services {...props} />;
      break;
    default:
      view = <Settings {...props} />;
  }
  return (
    <Shell
      {...props}
      section={section}
      routeQuery={
        section === 'calendar'
          ? {
              ...(q.page ? { page: q.page } : {}),
              ...(q.month ? { month: q.month } : {}),
              ...(q.day ? { day: q.day } : {}),
            }
          : section === 'insights'
            ? {
                ...(q.kind !== undefined ? { kind: q.kind } : {}),
                ...(q.week ? { week: q.week } : {}),
                ...(q.interval ? { interval: q.interval } : {}),
                ...(q.pattern ? { pattern: q.pattern } : {}),
                ...(q.day ? { day: q.day } : {}),
              }
            : undefined
      }
    >
      <Flash
        error={q.error}
        notice={['calendar', 'account'].includes(section) ? undefined : q.notice}
      />
      {view}
    </Shell>
  );
}
