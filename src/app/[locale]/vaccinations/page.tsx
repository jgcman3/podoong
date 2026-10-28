import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import { loadCare } from '@/lib/data';
import { Shell } from '@/components/shell';
import { VaccinationList } from '@/features/vaccination/views';
import { Flash } from '@/components/flash';
export default async function Vaccinations({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    child?: string;
    page?: string;
    tab?: string;
    error?: string;
  }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const q = await searchParams;
  const context = await loadCare(locale, q.child, []);
  return (
    <Shell
      context={context}
      locale={locale}
      section="calendar"
      childRoute="vaccinations"
    >
      <Flash error={q.error} />
      <VaccinationList
        context={context}
        locale={locale}
        page={q.page}
        tab={q.tab}
      />
    </Shell>
  );
}
