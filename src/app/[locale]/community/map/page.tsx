import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import { loadCare } from '@/lib/data';
import { Shell } from '@/components/shell';
import { CommunityHub, type CommunityQuery } from '@/features/community/hub';
export default async function Community({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CommunityQuery>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const { child, error } = query;
  const context = await loadCare(locale, child, []);
  return (
    <Shell
      context={context}
      locale={locale}
      section="neighborhood"
      childRoute="community/map"
    >
      <CommunityHub
        query={query}
        error={error}
        context={context}
        locale={locale}
        area="map"
      />
    </Shell>
  );
}
