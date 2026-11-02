import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { isLocale } from '@/lib/domain';
import { loadCare } from '@/lib/data';
import { Shell } from '@/components/shell';
import { createClient } from '@/lib/supabase/server';
import { ParentingPostDetail } from '@/features/community/post-detail';
import {
  postDetailSchema,
  postCommentsSchema,
} from '@/features/community/post-model';
export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ child?: string; source?: string; edit?: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success) notFound();
  const db = await createClient();
  const { data: session } = await db.auth.getClaims();
  if (!session?.claims.sub)
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/community/posts/${id}`)}`,
    );
  const query = await searchParams,
    context = await loadCare(locale, query.child, []);
  const [post, comments] = await Promise.all([
    context.db.rpc('parenting_post_detail', { p_post: id }),
    context.db.rpc('parenting_post_comments_page', { p_post: id }),
  ]);
  if (post.error?.code === '42501' || !post.data) notFound();
  if (post.error || comments.error) throw Error('Post unavailable');
  const detail = postDetailSchema.parse(post.data);
  return (
    <Shell
      context={context}
      locale={locale}
      section="neighborhood"
      childRoute={`community/posts/${id}`}
    >
      <ParentingPostDetail
        initial={detail}
        initialComments={postCommentsSchema.parse(comments.data)}
        editing={query.edit === '1'}
        child={context.child.id}
        locale={locale}
        timezone={context.timezone}
        source={
          detail.audience === 'neighborhood' || query.source === 'neighborhood'
            ? 'neighborhood'
            : 'boards'
        }
      />
    </Shell>
  );
}
