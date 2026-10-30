import type { Metadata } from 'next';
import { Introduction } from '@/features/introduction/page';
import type { Locale } from '@/lib/domain';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title:
      locale === 'ko'
        ? '함께 돌보는, 포근한 둥지'
        : 'Care together. Grow closer.',
    description:
      locale === 'ko'
        ? '수유·수면·기저귀 기록, 하루 패턴과 성장일기까지. 가족과 함께 돌보는 육아 기록 서비스 포둥.'
        : 'Feeding, sleep, diapers, daily patterns and a growth diary. Care for your little one together with podoong.',
  };
}

export default async function IntroPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params,
    query = await searchParams;
  return <Introduction locale={locale} next={query.next} />;
}
