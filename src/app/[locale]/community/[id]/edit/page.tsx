import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import { isLocale } from '@/lib/domain';
import { communityCopy } from '@/features/community/copy';
import { PostForm } from '@/features/community/forms';
import { boardCaption, boardQuery } from '@/features/community/boards';
export default async function EditPost({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ family?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success) notFound();
  const { db, user } = await requireUser(locale);
  const post = await db
    .from('community_posts')
    .select('*,community_boards!inner(*)')
    .eq('id', id)
    .maybeSingle();
  if (post.error || !post.data || post.data.author_id !== user.id) notFound();
  const write = await db.rpc('community_can_write');
  if (write.error) throw new Error('Community unavailable');
  const t = communityCopy(locale),
    q = await searchParams;
  return (
    <main className="main-content">
      <Link href={`/${locale}/community/${id}?${boardQuery(q.family)}`}>
        {locale === 'ko' ? '← 글로 돌아가기' : '← Back to post'}
      </Link>
      <h1>{t.edit}</h1>
      {q.error && <p role="alert">{t.error}</p>}
      {write.data && !post.data.hidden ? (
        <PostForm
          locale={locale}
          familyId={q.family}
          post={post.data}
          boardLabel={boardCaption(post.data.community_boards, locale)}
        />
      ) : (
        <p>{t.restricted}</p>
      )}
    </main>
  );
}
