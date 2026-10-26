import { notFound, redirect } from 'next/navigation';
import { loadCare } from '@/lib/data';
import { Shell } from '@/components/shell';
import { ServiceDetail } from '@/features/dashboard/views';
import { services, type Locale } from '@/lib/domain';
import { isChildService } from '@/features/child-care/schema';
import { Flash } from '@/components/flash';
export default async function ServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; service: string }>;
  searchParams: Promise<{
    child?: string;
    page?: string;
    error?: string;
    notice?: string;
    tab?: string;
  }>;
}) {
  const { locale, service } = await params;
  const q = await searchParams;
  if (service === 'food') {
    const query = new URLSearchParams({ kind: 'solids' });
    if (q.child) query.set('child', q.child);
    redirect(`/${locale}/records?${query}`);
  }
  if (service === 'community' || service === 'polls')
    redirect(`/${locale}/${service}`);
  if (!isChildService(service) && !services.some((v) => v[0] === service))
    notFound();
  const context = await loadCare(
    locale,
    q.child,
    service === 'feeding'
      ? ['records']
      : service === 'vaccination' ||
          isChildService(service) ||
          services.find((v) => v[0] === service)?.[2] === 'planned'
        ? []
        : ['tasks', 'events'],
    { page: q.page, service },
  );
  return (
    <Shell
      context={context}
      locale={locale}
      section="services"
      languageRoute={`services/${service}`}
      childRoute={`services/${service}`}
    >
      <Flash error={q.error} notice={q.notice} />
      <ServiceDetail
        context={context}
        locale={locale}
        service={service}
        page={q.page}
        tab={q.tab}
      />
    </Shell>
  );
}
