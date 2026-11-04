import Link from 'next/link';
import Form from 'next/form';
import { Search, X } from 'lucide-react';
import { Flash } from '@/components/flash';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { FeedSortPicker } from './feed-sort-picker';
import { PostComposer } from './post-composer';
import { PostCard } from './post-card';
import { postDetailSchema } from './post-model';
import { communityTags, parentingTags } from './options';
import { NeighborhoodFriends } from './friends';
import { CommunityResidence } from './residence';
function minutesSince(createdAt: string) {
  return Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60000));
}
export type CommunityQuery = {
  child?: string;
  error?: string;
  category?: string;
  before?: string;
  beforeId?: string;
  sort?: string;
  beforeScore?: string;
  q?: string;
};
export async function CommunityHub({
  context,
  locale,
  area = 'friends',
  error,
  query = {},
}: {
  context: CareContext;
  locale: Locale;
  area?: 'friends' | 'neighborhood' | 'boards';
  error?: string;
  query?: CommunityQuery;
}) {
  const ko = locale === 'ko',
    neighborhood = area === 'neighborhood',
    posts = area !== 'friends';
  const tags = communityTags(neighborhood);
  const category = tags.find(([id]) => id === query.category)?.[0] ?? 'all';
  const hasResidence =
    !!context.family.residence_country_code &&
    (area === 'boards' ||
      (!!context.family.residence_city && !!context.family.residence_locality));
  const search = typeof query.q === 'string' ? query.q.trim().slice(0, 80) : '';
  const sort = query.sort === 'popular' ? 'popular' : 'all';
  const path = `/${locale}/community${neighborhood ? '/neighborhood' : '/boards'}`;
  const href = (values: Record<string, string>) =>
    `${path}?${new URLSearchParams({ child: context.child.id, category, sort, ...(search ? { q: search } : {}), ...values })}`;
  const [feed, topics] =
    posts && hasResidence
      ? await Promise.all([
          context.db.rpc('parenting_feed', {
            p_family: context.family.id,
            p_neighborhood: neighborhood,
            p_category: category,
            p_sort: sort,
            p_query: search,
            ...(query.beforeScore && /^\d{1,15}$/.test(query.beforeScore)
              ? { p_before_score: Number(query.beforeScore) }
              : {}),
            ...(query.before && !Number.isNaN(Date.parse(query.before))
              ? { p_before: new Date(query.before).toISOString() }
              : {}),
            ...(query.beforeId &&
            /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
              query.beforeId,
            )
              ? { p_before_id: query.beforeId }
              : {}),
          }),
          neighborhood
            ? Promise.resolve(null)
            : context.db.rpc('parenting_topics', {
                p_family: context.family.id,
              }),
        ])
      : [null, null];
  if (feed?.error || topics?.error) throw Error('Community feed unavailable');
  const orderedTags = topics?.data?.flatMap((topic) => {
    const tag = parentingTags.find(([id]) => id === topic.category);
    return tag ? [tag] : [];
  }) ?? [...tags];
  return (
    <section
      className={`community-hub parenting-community${!posts && hasResidence ? ' parenting-playground' : ''}`}
    >
      <Flash error={error} />
      <h1 className="visually-hidden">
        {ko ? '동네 소통' : 'Neighborhood community'}
      </h1>
      <nav
        className="diary-tabs parenting-tabs"
        aria-label={ko ? '동네 소통 메뉴' : 'Community sections'}
      >
        {(
          [
            ['friends', '동네 놀이터', 'Playground'],
            ['neighborhood', '동네 이야기', 'Neighborhood'],
            ['boards', '커뮤니티', 'Community'],
          ] as const
        ).map(([id, k, e]) => (
          <Link
            replace
            key={id}
            aria-current={area === id ? 'page' : undefined}
            href={`/${locale}/community${id === 'friends' ? '/playground' : `/${id}`}?child=${context.child.id}`}
          >
            {ko ? k : e}
          </Link>
        ))}
      </nav>
      {!hasResidence ? (
        <CommunityResidence context={context} locale={locale} area={area} />
      ) : !posts ? (
        <NeighborhoodFriends context={context} locale={locale} />
      ) : (
        <>
          {posts && (
            <nav
              className="community-pills category-pills"
              aria-label={ko ? '게시판 주제' : 'Post topics'}
            >
              <FeedSortPicker
                locale={locale}
                popular={sort === 'popular'}
                selected={category === 'all'}
                all={href({ category: 'all', sort: 'all' })}
                popularHref={href({ category: 'all', sort: 'popular' })}
              />
              {orderedTags.map(([id, k, e]) => (
                <Link
                  key={id}
                  href={href({
                    category: category === id ? 'all' : id,
                    sort: 'all',
                  })}
                  title={
                    category === id
                      ? ko
                        ? '선택 해제'
                        : 'Clear category'
                      : undefined
                  }
                  aria-current={category === id ? 'page' : undefined}
                >
                  {ko ? k : e}
                  {category === id && <X size={12} aria-hidden="true" />}
                </Link>
              ))}
            </nav>
          )}
          <Form
            action={path}
            className="community-search"
            role="search"
            aria-label={ko ? '게시글 검색' : 'Search posts'}
          >
            <input type="hidden" name="child" value={context.child.id} />
            <input type="hidden" name="category" value={category} />
            <input type="hidden" name="sort" value={sort} />
            <Search size={17} aria-hidden="true" />
            <input
              key={`${path}-${search}`}
              type="search"
              name="q"
              maxLength={80}
              defaultValue={search}
              aria-label={ko ? '제목·본문 검색' : 'Search titles and posts'}
              placeholder={ko ? '제목·본문 검색' : 'Search titles and posts'}
            />
            {search && (
              <Link
                href={href({ q: '' })}
                aria-label={ko ? '검색 초기화' : 'Clear search'}
              >
                {ko ? '초기화' : 'Clear'}
              </Link>
            )}
            <button type="submit">{ko ? '검색' : 'Search'}</button>
          </Form>
          {sort === 'popular' && (
            <p className="community-popular-help">
              {ko
                ? '최근 7일의 공감·댓글 참여·조회수를 반영한 인기글이에요.'
                : 'Popular posts from the past 7 days, ranked by likes, commenters and views.'}
            </p>
          )}
          <PostComposer
            child={context.child.id}
            source={neighborhood ? 'neighborhood' : 'boards'}
            locale={locale}
            tags={orderedTags}
            initialTag={category}
          />
          {feed?.data?.length ? (
            <div className="parenting-posts">
              {feed.data.map((post) => {
                const areaLabel = /^[A-Z]{2}$/.test(post.area_label)
                  ? (new Intl.DisplayNames([locale], { type: 'region' }).of(
                      post.area_label,
                    ) ?? post.area_label)
                  : post.area_label;
                const elapsed = minutesSince(post.created_at);
                const time =
                  elapsed < 1
                    ? ko
                      ? '방금 전'
                      : 'Just now'
                    : new Intl.RelativeTimeFormat(locale, {
                        numeric: 'auto',
                      }).format(
                        -(elapsed < 60
                          ? elapsed
                          : elapsed < 1440
                            ? Math.floor(elapsed / 60)
                            : Math.floor(elapsed / 1440)),
                        elapsed < 60
                          ? 'minute'
                          : elapsed < 1440
                            ? 'hour'
                            : 'day',
                      );
                return (
                  <PostCard
                    key={post.id}
                    post={{
                      ...post,
                      area_label: areaLabel,
                      author_identity: postDetailSchema.shape.author.parse(
                        post.author_identity,
                      ),
                    }}
                    child={context.child.id}
                    source={neighborhood ? 'neighborhood' : 'boards'}
                    tag={
                      tags.find(([id]) => id === post.category)?.[ko ? 1 : 2] ??
                      ''
                    }
                    time={time}
                    locale={locale}
                  />
                );
              })}
              {feed.data.length === 50 && (
                <Link
                  className="button secondary"
                  href={href({
                    before: feed.data.at(-1)!.created_at,
                    beforeId: feed.data.at(-1)!.id,
                    ...(sort === 'popular'
                      ? { beforeScore: String(feed.data.at(-1)!.rank_score) }
                      : {}),
                  })}
                >
                  {ko ? '이전 이야기' : 'Older posts'}
                </Link>
              )}
            </div>
          ) : (
            <p className="community-feed-empty">
              {search
                ? ko
                  ? '검색 결과가 없어요. 다른 검색어로 찾아보세요.'
                  : 'No matching posts. Try another search.'
                : ko
                  ? '아직 등록된 이야기가 없어요.'
                  : 'No conversations yet.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
