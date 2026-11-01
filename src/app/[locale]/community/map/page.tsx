import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import type { CommunityQuery } from '@/features/community/hub';
export default async function LegacyFacilities({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CommunityQuery>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const values = Object.fromEntries(
    Object.entries(query).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
  redirect(`/${locale}/facilities?${new URLSearchParams(values)}`);
}
