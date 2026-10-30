import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import { AdminView } from '@/features/admin/views';
export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AdminView locale={locale} section="dashboard" query={{}} />;
}
