import Link from 'next/link';
import { MessagesSquare, ShoppingBag, Landmark, MapPin } from 'lucide-react';
import { Flash } from '@/components/flash';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { residenceRegions } from '@/features/family/residence-regions';
import { CommunityRegionPicker } from './region-picker';
import { neighborhoodAction } from './neighborhood-actions';
import { FacilityMap } from './facility-map';
import { SupportList } from './support-list';
import { homeArea, parentingCategories, regionScopes } from './options';
export type CommunityQuery = {
  child?: string;
  error?: string;
  category?: string;
  scope?: string;
  before?: string;
  beforeId?: string;
  place?: string;
};
const tabs = [
  ['boards', '게시판', 'Board', MessagesSquare],
  ['map', '주변 시설', 'Nearby', MapPin],
  ['support', '지원금', 'Support', Landmark],
  ['market', '나눔장터', 'Marketplace', ShoppingBag],
] as const;
export async function CommunityHub({
  context,
  locale,
  area = 'boards',
  error,
  query = {},
}: {
  context: CareContext;
  locale: Locale;
  area?: 'boards' | 'map' | 'market' | 'support';
  error?: string;
  query?: CommunityQuery;
}) {
  const ko = locale === 'ko';
  const country = context.family.residence_country_code ?? 'KR';
  const globalPlaces =
    context.family.residence_country_code &&
    context.family.residence_country_code !== 'KR'
      ? ((
          await context.db
            .from('global_residence_places')
            .select('id,province,city,locality')
            .eq('country_code', context.family.residence_country_code)
            .order('province')
            .limit(1000)
        ).data ?? [])
      : [];
  const selectedKR =
    country === 'KR'
      ? residenceRegions.find((r) => r.code === query.place)
      : undefined;
  const selectedGlobal = globalPlaces.find((p) => p.id === query.place);
  const place = selectedKR?.code ?? selectedGlobal?.id ?? '';
  const family = selectedKR
    ? {
        ...context.family,
        residence_country_code: 'KR',
        residence_city: selectedKR.fullName.split(' ').slice(0, -1).join(' '),
        residence_locality: selectedKR.locality,
      }
    : selectedGlobal
      ? {
          ...context.family,
          residence_province: selectedGlobal.province,
          residence_city: selectedGlobal.city,
          residence_locality: selectedGlobal.locality,
        }
      : context.family;
  const home = homeArea(family);
  const scope =
    query.scope === 'all'
      ? 'all'
      : (regionScopes.find((value) => value === query.scope) ??
        (query.place ? 'district' : 'all'));
  const category =
    parentingCategories.find(([id]) => id === query.category)?.[0] ?? 'all';
  const path = `/${locale}/community${area === 'boards' ? '' : `/${area}`}`;
  const href = (values: Record<string, string>) =>
    `${path}?${new URLSearchParams({ child: context.child.id, scope, category, place, ...values })}`;
  const hidden = () => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="child" value={context.child.id} />
      <input type="hidden" name="feature" value={area} />
      <input type="hidden" name="place" value={place} />
      <input type="hidden" name="scope" value={scope} />
    </>
  );
  const feed =
    area === 'boards' || area === 'market'
      ? await context.db.rpc('parenting_feed', {
          p_family: context.child.family_id,
          p_scope: scope,
          p_category: area === 'market' ? 'all' : category,
          p_place: place,
          p_feature: area,
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
      : null;
  if (feed?.error) throw new Error('Community feed unavailable');
  return (
    <section className="community-hub parenting-community">
      <Flash error={error} />
      <h1>{ko ? '육아 소통' : 'Parenting community'}</h1>
      <nav
        className="parenting-tabs"
        aria-label={ko ? '육아 소통 메뉴' : 'Community sections'}
      >
        {tabs.map(([id, k, e, Icon]) => (
          <Link
            key={id}
            aria-current={area === id ? 'page' : undefined}
            href={`/${locale}/community${id === 'boards' ? '' : `/${id}`}?child=${context.child.id}&place=${place}`}
          >
            <Icon size={17} />
            {ko ? k : e}
          </Link>
        ))}
      </nav>
      <div className="community-location">
        <MapPin size={15} />
        <span>
          {home.locality || (ko ? '지역을 설정해 주세요' : 'Choose your area')}
        </span>
        {context.owner && (
          <Link
            href={`/${locale}/account?child=${context.child.id}&panel=residence`}
          >
            {ko ? '지역 설정' : 'Area settings'}
          </Link>
        )}
      </div>
      <CommunityRegionPicker
        locale={locale}
        country={country}
        place={place || context.family.residence_region_code || ''}
        child={context.child.id}
        scope={scope}
        category={category}
        path={path}
        globalPlaces={globalPlaces}
      />
      {area === 'map' ? (
        <FacilityMap locale={locale} area={home.locality} country={country} />
      ) : area === 'support' ? (
        <SupportList context={context} locale={locale} area={home} />
      ) : (
        <>
          {area === 'boards' && (
            <>
              <nav
                className="community-pills category-pills"
                aria-label={ko ? '게시판 카테고리' : 'Board categories'}
              >
                {parentingCategories.map(([id, k, e]) => (
                  <Link
                    key={id}
                    href={href({ category: id, before: '' })}
                    aria-current={category === id ? 'page' : undefined}
                  >
                    {ko ? k : e}
                  </Link>
                ))}
              </nav>
              <nav
                className="community-pills region-pills"
                aria-label={ko ? '지역 범위' : 'Area scope'}
              >
                <Link
                  href={href({ scope: 'all', place: '', before: '' })}
                  aria-current={scope === 'all' ? 'page' : undefined}
                >
                  {ko ? '전체 지역' : 'All areas'}
                </Link>
                {regionScopes.map((id, i) => (
                  <Link
                    key={id}
                    href={href({ scope: id, before: '' })}
                    aria-current={scope === id ? 'page' : undefined}
                  >
                    <span>
                      {ko
                        ? ['시 단위', '구 단위', '동 단위'][i]
                        : ['City', 'District', 'Neighborhood'][i]}
                    </span>
                    <small>{home[id].split(' ').at(-1) || '—'}</small>
                  </Link>
                ))}
              </nav>
            </>
          )}
          {!home.district ? (
            <p className="panel">
              {ko
                ? '지역을 선택하면 이야기를 나눌 수 있어요.'
                : 'Choose an area to join the conversation.'}
            </p>
          ) : (
            <>
              <details className="panel community-compose">
                <summary>{ko ? '글쓰기' : 'Write a post'}</summary>
                <form action={neighborhoodAction} className="form-stack">
                  {hidden()}
                  {area === 'boards' && (
                    <label>
                      {ko ? '카테고리' : 'Category'}
                      <select
                        name="category"
                        defaultValue={
                          category === 'all' ? 'childcare' : category
                        }
                      >
                        {parentingCategories.slice(1).map(([id, k, e]) => (
                          <option key={id} value={id}>
                            {ko ? k : e}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    {ko ? '제목' : 'Title'}
                    <input name="title" required maxLength={100} />
                  </label>
                  <label>
                    {ko ? '내용' : 'Content'}
                    <textarea name="body" required maxLength={3000} />
                  </label>
                  <button className="button primary">
                    {ko ? '등록' : 'Post'}
                  </button>
                </form>
              </details>
            </>
          )}
          {feed?.data?.length ? (
            <div className="parenting-posts">
              {feed.data.map((post) => (
                <article className="panel" key={post.id}>
                  <div className="small muted">
                    {area === 'boards' && (
                      <>
                        {
                          parentingCategories.find(
                            ([id]) => id === post.category,
                          )?.[ko ? 1 : 2]
                        }{' '}
                        ·{' '}
                      </>
                    )}
                    {post.area_label}
                  </div>
                  <h2>{post.title}</h2>
                  <p className="post-body">{post.body}</p>
                </article>
              ))}
              {feed.data.length === 50 && (
                <Link
                  className="button secondary"
                  href={href({
                    before: feed.data.at(-1)!.created_at,
                    beforeId: feed.data.at(-1)!.id,
                  })}
                >
                  {ko ? '이전 이야기' : 'Older posts'}
                </Link>
              )}
            </div>
          ) : (
            <p className="panel">
              {ko ? '아직 등록된 이야기가 없어요.' : 'No conversations yet.'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
