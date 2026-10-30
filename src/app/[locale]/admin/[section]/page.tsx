import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import { AdminView, type AdminQuery } from '@/features/admin/views';
import { adminSections, type AdminSection } from '@/features/admin/model';
export default async function AdminSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; section: string }>;
  searchParams: Promise<AdminQuery>;
}) {
  const { locale, section } = await params;
  if (!isLocale(locale) || !adminSections.includes(section as AdminSection))
    notFound();
  return (
    <AdminView
      locale={locale}
      section={section as AdminSection}
      query={await searchParams}
    />
  );
}
