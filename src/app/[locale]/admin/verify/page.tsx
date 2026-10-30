import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import { requireAdmin } from '@/features/admin/auth';

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  redirect(`/${locale}/admin`);
}
