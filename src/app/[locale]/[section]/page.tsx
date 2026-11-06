import { Insights } from '@/features/insights/view';
import { notFound, redirect } from 'next/navigation';
import { loadFamily } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Flash } from '@/components/flash';
import {
  Today,
  Family,
  Settings,
  ChildAccount,
} from '@/features/dashboard/views';
import type { Locale } from '@/lib/domain';
import { Installation, installationMetadata } from '@/features/install/page';

export async function generateMetadata(props: {
  params: Promise<{ locale: Locale; section: string }>;
  searchParams: Promise<{
    child?: string;
    error?: string;
    ready?: string;
    guide?: string;
    install?: string;
  }>;
}) {
  const { section } = await props.params;
  if (section === 'today' && (await props.searchParams).install === '1')
    return installationMetadata(props);
  return {};
}
export default async function AppPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; section: string }>;
  searchParams: Promise<{
    child?: string;
    error?: string;
    notice?: string;
    kind?: string;
    page?: string;
    day?: string;
    week?: string;
    interval?: string;
    pattern?: string;
    panel?: string;
    install?: string;
    ready?: string;
    guide?: string;
  }>;
}) {
  const { locale, section } = await params;
  const q = await searchParams;
  if (section === 'today' && q.install === '1')
    return (
      <Installation
        params={Promise.resolve({ locale })}
        searchParams={Promise.resolve(q)}
      />
    );
  if (section === 'records')
    redirect(
      `/${locale}/today${q.child ? `?child=${encodeURIComponent(q.child)}` : ''}`,
    );
  if (!['today', 'insights', 'family', 'account', 'settings'].includes(section))
    notFound();
  const context = await loadFamily(locale, q.child);
  if (section === 'insights' && q.child && context.child.id !== q.child)
    notFound();
  const props = { context, locale };
  let view;
  switch (section) {
    case 'today':
      view = <Today {...props} guide={q.guide === '1'} />;
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
    default:
      view = <Settings {...props} />;
  }
  return (
    <Shell
      {...props}
      section={section}
      routeQuery={
        section === 'insights'
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
        notice={section === 'account' ? undefined : q.notice}
      />
      {view}
    </Shell>
  );
}
