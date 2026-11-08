import Link from 'next/link';
import { z } from 'zod';
import { NeighborhoodOpening } from './neighborhood-opening';
import { cookies } from 'next/headers';
import { feedPreference, feedPreferenceCookie } from './feed-preference';
import { FeedCategoryNav } from './feed-category-nav';
import { X } from 'lucide-react';
import { Flash } from '@/components/flash';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { FeedSortPicker } from './feed-sort-picker';
import { PostComposer } from './post-composer';
import { PostCard } from './post-card';
import { postDetailSchema } from './post-model';
import { neighborhoodTags } from './options';
import { NeighborhoodFriends } from './friends';
import { CommunityWelcome } from './community-welcome';
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
  area?: 'friends' | 'neighborhood';
  error?: string;
  query?: CommunityQuery;
}) {
  const ko = locale === 'ko',
    posts = area !== 'friends';
  const tags = neighborhoodTags;
  const preference = posts
    ? feedPreference(
        (await cookies()).get(feedPreferenceCookie('neighborhood'))?.value,
        tags,
      )
    : { category: 'all', sort: 'all' };
  const category =
    query.category === undefined
      ? preference.category
      : (tags.find(([id]) => id === query.category)?.[0] ?? 'all');
  const hasResidence =
    !!context.family.residence_country_code &&
    !!context.family.residence_city &&
    !!context.family.residence_locality;
  const sort =
    (query.sort ?? (query.category === undefined ? preference.sort : 'all')) ===
    'popular'
      ? 'popular'
      : 'all';
  const path = `/${locale}/community/neighborhood`;
  const href = (values: Record<string, string>) =>
    `${path}?${new URLSearchParams({ child: context.child.id, category, sort, ...values })}`;
  const boardResult =
    posts && hasResidence
      ? await context.db.rpc('neighborhood_board_status', {
          p_family: context.family.id,
        })
      : null;
  if (boardResult?.error) throw Error('Neighborhood status unavailable');
  const board = boardResult
    ? z
        .object({
          families: z.number().int().min(0).max(3),
          open: z.boolean(),
          founders: z.array(z.string()).max(3),
          reopened: z.boolean(),
        })
        .parse(boardResult.data)
    : null;
  const canReadFeed = posts && hasResidence && board?.open;
  const [feed, welcomeFeed] = await Promise.all([
    canReadFeed
      ? context.db.rpc('parenting_feed', {
          p_family: context.family.id,
          p_category: category,
          p_sort: sort,
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
        })
      : null,
    canReadFeed && !query.before && (category !== 'all' || sort !== 'all')
      ? context.db
          .rpc('parenting_feed', { p_family: context.family.id })
          .select('id')
          .limit(5)
      : null,
  ]);
  if (feed?.error || welcomeFeed?.error)
    throw Error('Community feed unavailable');
  // Filtered or popular lists must not bring back a mature neighborhood's welcome.
  const welcomePostCount = (welcomeFeed ?? feed)?.data?.length ?? 0;
  const showWelcome = posts && !query.before && welcomePostCount < 5;
  return (
    <section
      className={`community-hub parenting-community${!posts && hasResidence ? ' parenting-playground' : ''}`}
    >
      <Flash error={error} />
      <h1 className="visually-hidden">
        {ko ? '동네 육아' : 'Neighborhood community'}
      </h1>
      <nav
        className="diary-tabs parenting-tabs"
        aria-label={ko ? '동네 육아 메뉴' : 'Community sections'}
      >
        {(
          [
            ['friends', '동네 놀이터', 'Playground'],
            ['neighborhood', '동네 이야기', 'Neighborhood'],
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
      ) : !board?.open ? (
        <NeighborhoodOpening
          locale={locale}
          neighborhood={context.family.residence_locality!}
          families={board?.families ?? 0}
        />
      ) : (
        <>
          {posts && (
            <FeedCategoryNav
              area="neighborhood"
              label={ko ? '게시판 주제' : 'Post topics'}
            >
              <FeedSortPicker
                locale={locale}
                popular={sort === 'popular'}
                selected={category === 'all'}
                all={href({ category: 'all', sort: 'all' })}
                popularHref={href({ category: 'all', sort: 'popular' })}
              />
              {tags.map(([id, k, e]) => (
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
            </FeedCategoryNav>
          )}
          {sort === 'popular' && (
            <p className="community-popular-help">
              {ko
                ? '최근 7일의 공감·댓글 참여·조회수를 반영한 인기글이에요.'
                : 'Popular posts from the past 7 days, ranked by likes, commenters and views.'}
            </p>
          )}
          <PostComposer
            child={context.child.id}
            source="neighborhood"
            locale={locale}
            tags={tags}
            initialTag={category}
          />
          {showWelcome && (
            <CommunityWelcome
              neighborhood={context.family.residence_locality!}
              locale={locale}
              expanded={welcomePostCount === 0}
              founders={board?.founders ?? []}
              reopened={board?.reopened ?? false}
            />
          )}
          {feed?.data?.length ? (
            <div className="parenting-posts">
              {feed.data.map((post) => {
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
                      author_identity: postDetailSchema.shape.author.parse(
                        post.author_identity,
                      ),
                    }}
                    child={context.child.id}
                    source="neighborhood"
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
          ) : showWelcome ? null : (
            <p className="community-feed-empty">
              {ko ? '아직 등록된 이야기가 없어요.' : 'No conversations yet.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
