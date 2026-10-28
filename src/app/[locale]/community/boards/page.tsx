import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import { loadCare } from '@/lib/data';
import { Shell } from '@/components/shell';
import { CommunityHub } from '@/features/community/hub';
export default async function Community({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ child?: string; error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { child, error } = await searchParams;
  const context = await loadCare(locale, child, []);
  return (
    <Shell
      context={context}
      locale={locale}
      section="neighborhood"
      childRoute="community/boards"
    >
      <CommunityHub
        error={error}
        context={context}
        locale={locale}
        area="boards"
      />
    </Shell>
  );
}
