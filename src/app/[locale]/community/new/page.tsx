import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import { communityCopy } from '@/features/community/copy';
import { PostForm } from '@/features/community/forms';
import { loadCommunityContext } from '@/features/community/data';
import { chooseBoard, boardQuery } from '@/features/community/boards';
export default async function NewPost({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ family?: string; board?: string; error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const q = await searchParams;
  const { db, family, boards, residenceLink } = await loadCommunityContext(
    locale,
    q.family,
  );
  const t = communityCopy(locale),
    board = chooseBoard(boards, q.board);
  const write = await db.rpc('community_can_write');
  if (write.error) throw new Error('Community unavailable');
  const back = `/${locale}/community?${boardQuery(family?.id, board?.key)}`;
  return (
    <main className="main-content">
      <Link href={back}>
        {locale === 'ko' ? '← 글 목록으로' : '← Back to posts'}
      </Link>
      <h1>{t.create}</h1>
      {q.error && (
        <p role="alert">
          {q.error === 'conflict' ? t.composerChanged : t.error}
        </p>
      )}
      {!board ? (
        <section className="panel">
          <p>{t.residenceRequired}</p>
          <Link className="button primary" href={residenceLink}>
            {t.residenceSettings}
          </Link>
        </section>
      ) : write.data ? (
        <PostForm
          locale={locale}
          familyId={family!.id}
          boards={boards}
          defaultBoard={board.key}
          residenceVersion={family!.residence_version}
        />
      ) : (
        <p>{t.restricted}</p>
      )}
      <Link href={back}>{locale === 'ko' ? '취소' : 'Cancel'}</Link>
    </main>
  );
}
