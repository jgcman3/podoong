import type { Metadata } from 'next';
import { Introduction } from '@/features/introduction/page';
import type { Locale } from '@/lib/domain';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://podoong.com';
  return {
    metadataBase: new URL(origin),
    openGraph: {
      type: 'website',
      siteName: 'podoong',
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      url: `${origin}/${locale}/intro`,
      title:
        locale === 'ko'
          ? '포둥 · 육아 기록부터 동네 친구까지'
          : 'podoong · Care records and parenting friends',
      description:
        locale === 'ko'
          ? '매일의 수유·수면 기록, 하루 패턴, 성장일기와 동네 놀이터. 함께 돌보는 육아를 시작해요.'
          : 'Daily care records, insights, growing memories and a neighborhood playground. Start caring together.',
      images: [
        {
          url: '/icons/podung-512.png',
          width: 512,
          height: 512,
          alt: 'podoong',
        },
      ],
    },
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
