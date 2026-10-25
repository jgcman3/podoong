import { notFound } from 'next/navigation';
import { loadCare } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Flash } from '@/components/flash';
import {
  Today,
  Records,
  Calendar,
  Family,
  Services,
  Settings,
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
  }>;
}) {
  const { locale, section } = await params;
  const q = await searchParams;
  if (
    ![
      'today',
      'records',
      'calendar',
      'family',
      'services',
      'settings',
    ].includes(section)
  )
    notFound();
  const context = await loadCare(
    locale,
    q.child,
    section === 'today'
      ? ['records', 'tasks', 'events']
      : section === 'records'
        ? ['records']
        : section === 'calendar'
          ? ['tasks', 'events']
          : [],
    { page: q.page, todayOnly: section === 'today' },
  );
  const props = { context, locale };
  let view;
  switch (section) {
    case 'today':
      view = <Today {...props} />;
      break;
    case 'records':
      view = <Records {...props} edit={q.edit} kind={q.kind} />;
      break;
    case 'calendar':
      view = <Calendar {...props} />;
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
        section === 'calendar' && q.page ? { page: q.page } : undefined
      }
    >
      <Flash error={q.error} notice={q.notice} />
      {view}
    </Shell>
  );
}
