import { Flash } from '@/components/flash';
import { neighborhoodAction } from './neighborhood-actions';
import Link from 'next/link';
import { MessagesSquare, ShoppingBag, Landmark, MapPin } from 'lucide-react';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
const areas = [
  {
    key: 'boards',
    ko: '육아 소통',
    en: 'Parenting chat',
    description: [
      '동네 부모들과 함께 나누는 이야기',
      'Connect with parents in your area',
    ],
    Icon: MessagesSquare,
  },
  {
    key: 'market',
    ko: '나눔 및 중고거래',
    en: 'Kids’ marketplace',
    description: [
      '아이 물건을 이웃과 나누고 거래해요',
      'Share and trade children’s items locally',
    ],
    Icon: ShoppingBag,
  },
  {
    key: 'support',
    ko: '정부·지역 지원',
    en: 'Government & local support',
    description: [
      '우리 지역의 육아 지원 정보를 살펴봐요',
      'Find parenting support in your area',
    ],
    Icon: Landmark,
  },
] as const;
export async function CommunityHub({
  context,
  locale,
  area,
  error,
}: {
  context: CareContext;
  locale: Locale;
  area?: 'boards' | 'market' | 'support';
  error?: string;
}) {
  const ko = locale === 'ko';
  const location = [
    context.family.residence_province,
    context.family.residence_city,
    context.family.residence_locality,
  ]
    .filter(Boolean)
    .join(' ');
  const selected = areas.find((item) => item.key === area);
  const status = await context.db.rpc('neighborhood_status', {
    p_family: context.child.family_id,
  });
  if (status.error) throw new Error('Neighborhood status unavailable');
  const current = status.data.find((item) => item.feature === area);
  const feed =
    area && current?.opened
      ? await context.db.rpc('neighborhood_feed', {
          p_family: context.child.family_id,
          p_feature: area,
        })
      : null;
  if (feed?.error) throw new Error('Neighborhood unavailable');
  const hidden = (feature: string, action: string) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="child" value={context.child.id} />
      <input type="hidden" name="feature" value={feature} />
      <input type="hidden" name="action" value={action} />
    </>
  );
  return (
    <section className="community-hub">
      <Flash error={error} />
      {area && (
        <Link
          className="text-link"
          href={`/${locale}/community?child=${context.child.id}`}
        >
          {ko ? '동네 생활' : 'Local life'}
        </Link>
      )}
      <h1>
        {selected
          ? ko
            ? selected.ko
            : selected.en
          : ko
            ? '동네 생활'
            : 'Local life'}
      </h1>
      <div className="community-location">
        <MapPin size={16} />
        {location || (ko ? '지역을 설정해 주세요' : 'Choose your area')}
        {context.owner && (
          <Link
            href={`/${locale}/account?child=${context.child.id}&panel=residence`}
          >
            {ko ? '지역 설정' : 'Area settings'}
          </Link>
        )}
      </div>
      <p className="small muted">
        {ko
          ? '우리 동네 10가족이 신청하면 세 기능이 함께 오픈될 예정이에요. 가족당 한 번만 집계돼요.'
          : 'All three features are planned to open when 10 local families request their neighborhood. Each family counts once.'}
      </p>
      {!status.data[0]?.opened && (
        <div className="panel neighborhood-join">
          <strong>
            {ko
              ? `${status.data[0]?.families ?? 0}/10 가족 신청`
              : `${status.data[0]?.families ?? 0}/10 families requested`}
          </strong>
          <form action={neighborhoodAction}>
            {hidden('boards', 'request')}
            <button
              className="button primary"
              disabled={
                !context.family.residence_city ||
                (context.family.residence_country_code !== 'KR' &&
                  !context.family.residence_province) ||
                status.data[0]?.requested
              }
            >
              {status.data[0]?.requested
                ? ko
                  ? '신청 완료'
                  : 'Requested'
                : ko
                  ? '우리 동네 신청하기'
                  : 'Request our neighborhood'}
            </button>
          </form>
        </div>
      )}
      {selected && current?.opened ? (
        <>
          <details className="panel">
            <summary>{ko ? '글쓰기' : 'Write a post'}</summary>
            <form action={neighborhoodAction} className="form-stack">
              {hidden(selected.key, 'post')}
              <label>
                {ko ? '제목' : 'Title'}
                <input name="title" required maxLength={100} />
              </label>
              <label>
                {ko ? '내용' : 'Content'}
                <textarea name="body" required maxLength={3000} />
              </label>
              <button className="button primary">{ko ? '등록' : 'Post'}</button>
            </form>
          </details>
          {feed?.data?.length ? (
            feed.data.map((post) => (
              <article className="panel" key={post.id}>
                <h2>{post.title}</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{post.body}</p>
              </article>
            ))
          ) : (
            <p className="panel">
              {ko
                ? '첫 이야기를 남겨 주세요.'
                : 'Start the first conversation.'}
            </p>
          )}
        </>
      ) : (
        <div className="community-hub-list">
          {areas
            .filter((item) => !area || item.key === area)
            .map(({ key, Icon, ...item }) => {
              const state = status.data.find((value) => value.feature === key)!;
              return (
                <article
                  key={key}
                  className={`panel community-hub-card community-area-${key}`}
                >
                  <span className="community-hub-icon">
                    <Icon size={25} />
                  </span>
                  <div className="neighborhood-feature">
                    <strong>{ko ? item.ko : item.en}</strong>
                    <small>{item.description[ko ? 0 : 1]}</small>
                    {state.opened ? (
                      <Link
                        className="button primary"
                        href={`/${locale}/community/${key}?child=${context.child.id}`}
                      >
                        {ko ? '이용하기' : 'Open'}
                      </Link>
                    ) : (
                      <small>
                        {ko
                          ? '10가족 신청 시 오픈 예정'
                          : 'Planned to open with 10 families'}
                      </small>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      )}
    </section>
  );
}
