import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { isLocale } from '@/lib/domain';
import { communityCopy } from '@/features/community/copy';
import { Action } from '@/features/community/forms';
export default async function CommunitySettings({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { db } = await requireUser(locale),
    t = communityCopy(locale);
  const [blocks, reports] = await Promise.all([
    db.from('community_blocks').select('*'),
    db
      .from('community_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  if (
    [blocks, reports].some(
      (result) => result.error && result.error.code !== 'PGRST205',
    )
  )
    throw new Error('Community settings unavailable');
  return (
    <main className="main-content">
      <Link href={`/${locale}/community`}>
        {locale === 'ko' ? '← 글 목록으로' : '← Back to posts'}
      </Link>
      <h1>{locale === 'ko' ? '커뮤니티 관리' : 'Community settings'}</h1>
      <section className="panel">
        <h2>{t.blocked}</h2>
        {!blocks.data?.length && (
          <p>
            {locale === 'ko'
              ? '차단한 사용자가 없습니다.'
              : 'No blocked accounts.'}
          </p>
        )}
        {blocks.data?.map((block) => (
          <div key={block.blocked_id}>
            <code>{block.blocked_id}</code>
            <Action
              locale={locale}
              action="unblock"
              id={block.blocked_id}
              label={t.unblock}
            />
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>{t.reports}</h2>
        {!reports.data?.length && (
          <p>{locale === 'ko' ? '신고한 내역이 없습니다.' : 'No reports.'}</p>
        )}
        {reports.data?.map((report) => (
          <p key={report.id}>
            {report.reason} · {report.status} · {report.created_at.slice(0, 10)}
          </p>
        ))}
      </section>
    </main>
  );
}
