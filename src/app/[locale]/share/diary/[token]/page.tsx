import { SharedDiaryFeed } from '@/features/growth-community/shared-diary-feed';
import { SharedDiaryInvite } from '@/features/growth-community/shared-diary-invite';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isLocale } from '@/lib/domain';
import {
  SharedDiaryFrame,
  SharedDiaryHeading,
} from '@/features/growth-community/shared-diary-frame';
import {
  diaryLinkClient,
  validDiaryToken,
} from '@/features/growth-community/public-link';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3187',
  ),
  title: '함께 보는 성장일기 · 포둥',
  description: '소중한 하루를 함께 나눠요. 포둥에서 전하는 성장일기입니다.',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
  openGraph: {
    title: '포둥에서 전하는 성장일기',
    description: '소중한 하루를 함께 나눠요.',
    images: ['/icons/podung-192.png'],
  },
};
export default async function SharedDiary({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale, token } = await params;
  if (!isLocale(locale) || !validDiaryToken(token)) notFound();
  const query = await searchParams;
  const page = Math.min(
    10000,
    Math.max(0, Number.parseInt(query.page ?? '0', 10) || 0),
  );
  const db = diaryLinkClient(token);
  const [profile, feed] = await Promise.all([
    db.rpc('child_diary_link_profile', { p_token: token }).maybeSingle(),
    db.rpc('read_child_diary_link', { p_token: token, p_page: page }),
  ]);
  if (profile.error || feed.error) throw new Error('Shared diary unavailable');
  if (!profile.data) notFound();
  const entries = feed.data ?? [];
  const ko = locale === 'ko';
  return (
    <SharedDiaryFrame ko={ko}>
      <SharedDiaryHeading
        title={
          ko
            ? `${profile.data.nickname}의 성장일기`
            : `${profile.data.nickname}’s growth diary`
        }
        description={
          ko ? '하루하루, 사랑이 자라는 중' : 'A little more love, every day'
        }
      />
      <SharedDiaryInvite ko={ko} compact />
      <SharedDiaryFeed
        key={`${token}-${page}`}
        token={token}
        initial={entries}
        initialPage={page}
        locale={locale}
      />
      {page > 0 && (
        <Link
          className="shared-diary-latest"
          href={`/${locale}/share/diary/${token}`}
        >
          {ko ? '최신 일기부터 보기' : 'Back to latest diaries'}
        </Link>
      )}
    </SharedDiaryFrame>
  );
}
