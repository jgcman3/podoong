import '@/features/growth-community/diary-actions.css';
import { relationshipLabel } from '@/features/family/relationship';
import { DiaryShare } from '@/features/growth-community/diary-share';
import { DiaryComposer } from '@/features/growth-community/composer';
import { DiaryEmptyState } from '@/features/growth-community/empty-diary';
import Link from 'next/link';
import { DiaryBody } from '@/features/growth-community/diary-body';
import { notFound } from 'next/navigation';
import {
  PenLine,
  Venus,
  Mars,
  CircleHelp,
  Weight,
  Ruler,
  ScanFace,
} from 'lucide-react';
import { DiaryCardMenu } from '@/features/growth-community/card-menu';
import { loadOwnDiaries } from '@/features/growth-community/own-diaries';
import { DiaryAgeNavigation } from '@/features/growth-community/age-navigation';
import { isLocale, ageInDays } from '@/lib/domain';
import { loadFamily } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Flash } from '@/components/flash';
export default async function Diaries({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    child?: string;
    scope?: string;
    age?: string;
    page?: string;
    error?: string;
  }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const q = await searchParams,
    context = await loadFamily(locale, q.child);
  if (q.child && q.child !== context.child.id) notFound();
  const ko = locale === 'ko',
    scope = q.scope === 'all' ? 'all' : q.scope === 'birth' ? 'birth' : 'mine';
  const raw = Number(q.page ?? 0),
    page = Number.isSafeInteger(raw) && raw >= 0 ? Math.min(raw, 10000) : 0;
  const latestAge = context.child.birth_date
    ? Math.max(0, ageInDays(context.child.birth_date, context.today))
    : 0;
  const requestedAge = q.age === undefined ? latestAge : Number(q.age);
  const age =
    Number.isSafeInteger(requestedAge) && requestedAge >= 0
      ? Math.min(requestedAge, latestAge)
      : latestAge;
  const result =
    scope === 'mine'
      ? { data: await loadOwnDiaries(context, page), error: null }
      : await context.db.rpc('growth_diary_feed', {
          p_child: context.child.id,
          p_scope: scope,
          p_page: page,
          p_age: scope === 'birth' ? age : null,
        });
  if (result.error) throw new Error('Growth diaries unavailable');
  const data = result.data;
  const reactions = await context.db.rpc('growth_diary_reactions', {
    p_records: (data ?? []).slice(0, 20).map((entry) => entry.id),
  });
  if (reactions.error) throw new Error('Diary reactions unavailable');
  const reactionById = new Map(
    reactions.data.map((reaction) => [reaction.id, reaction]),
  );
  const photoUrl = (id: string) =>
    scope === 'mine'
      ? `/api/care/photos/${id}`
      : `/api/community/diary-photos/${id}`;
  const href = (tab: string, index = 0, selectedAge = age) =>
    `/${locale}/community/diaries?${new URLSearchParams({ child: context.child.id, scope: tab, age: String(selectedAge), ...(index ? { page: String(index) } : {}) })}`;
  return (
    <Shell
      context={context}
      locale={locale}
      section="community"
      languageRoute="community/diaries"
      childRoute="community/diaries"
      routeQuery={{ scope, age: String(age) }}
    >
      <Flash error={q.error} />
      <section className="community-diaries">
        <nav
          className="diary-tabs"
          aria-label={ko ? '성장일기 종류' : 'Growth diary feeds'}
        >
          <Link
            replace
            href={href('mine')}
            aria-current={scope === 'mine' ? 'page' : undefined}
          >
            {ko ? '우리 아이 성장일기' : 'Our child’s diary'}
          </Link>
          <Link
            replace
            href={href('birth')}
            aria-current={scope === 'birth' ? 'page' : undefined}
          >
            {ko ? '출생일별 성장일기' : 'Same-birthday diaries'}
          </Link>
          <Link
            replace
            href={href('all')}
            aria-current={scope === 'all' ? 'page' : undefined}
          >
            {ko ? '전체 성장일기' : 'All growth diaries'}
          </Link>
        </nav>
        {scope === 'birth' && context.child.birth_date && (
          <DiaryAgeNavigation
            age={age}
            previous={age > 0 ? href(scope, 0, age - 1) : undefined}
            next={age < latestAge ? href(scope, 0, age + 1) : undefined}
            locale={locale}
          />
        )}
        {scope === 'mine' && context.writable && (
          <div className="diary-own-actions">
            <DiaryShare
              key={`share-${context.child.id}`}
              child={context.child.id}
              ko={locale === 'ko'}
            />
            <DiaryComposer
              privacy={context.privacy}
              key={context.child.id}
              child={context.child.id}
              locale={locale}
              firstEntry={page === 0 && !data?.length}
              triggerClassName="diary-write-button"
              trigger={
                <>
                  <PenLine size={17} aria-hidden="true" />
                  <span>{ko ? '일기 쓰기' : 'Write diary'}</span>
                </>
              }
            />
          </div>
        )}
        <div className="public-diary-list">
          {(data ?? []).slice(0, 20).map((entry) => (
            <article
              className={`public-diary-card ${scope === 'mine' ? 'diary-own-card' : ''}`}
              key={entry.id}
            >
              <header>
                {scope !== 'mine' && (
                  <>
                    <strong className="diary-nickname">{entry.nickname}</strong>
                    <span
                      className={`diary-sex ${entry.sex ?? 'unknown'}`}
                      role="img"
                      aria-label={
                        entry.sex === 'female'
                          ? ko
                            ? '여아'
                            : 'Girl'
                          : entry.sex === 'male'
                            ? ko
                              ? '남아'
                              : 'Boy'
                            : ko
                              ? '성별 미입력'
                              : 'Sex not specified'
                      }
                      title={
                        entry.sex === 'female'
                          ? ko
                            ? '여아'
                            : 'Girl'
                          : entry.sex === 'male'
                            ? ko
                              ? '남아'
                              : 'Boy'
                            : ko
                              ? '성별 미입력'
                              : 'Sex not specified'
                      }
                    >
                      {entry.sex === 'female' ? (
                        <Venus size={18} aria-hidden="true" />
                      ) : entry.sex === 'male' ? (
                        <Mars size={18} aria-hidden="true" />
                      ) : (
                        <CircleHelp size={18} aria-hidden="true" />
                      )}
                    </span>
                  </>
                )}
                {scope === 'mine' && context.writable && 'version' in entry && (
                  <DiaryComposer
                    privacy={context.privacy}
                    child={context.child.id}
                    locale={locale}
                    record={entry}
                  />
                )}
                {scope !== 'birth' &&
                  entry.age_days !== null &&
                  entry.age_days >= 0 && (
                    <span className="diary-entry-age">D+{entry.age_days}</span>
                  )}
                {scope === 'birth' && (
                  <DiaryCardMenu
                    child={context.child.id}
                    record={entry.id}
                    nickname={entry.nickname}
                    locale={locale}
                  />
                )}
              </header>
              <DiaryBody
                recordId={entry.id}
                moment={
                  scope === 'mine' && context.writable
                    ? { name: entry.nickname, age: entry.age_days }
                    : undefined
                }
                reaction={reactionById.get(entry.id)}
                photoCacheScope={`${context.user.id}:${context.user.last_sign_in_at ?? ''}`}
                author={relationshipLabel(entry.author_relationship, locale)}
                note={entry.note}
                date={entry.recorded_date}
                photos={entry.photo_ids.map(photoUrl)}
                locale={locale}
                measurements={
                  scope !== 'all' ? (
                    <dl className="diary-measurements">
                      {[
                        {
                          label: ko ? '몸무게' : 'Weight',
                          value: entry.weight_kg,
                          unit: 'kg',
                          Icon: Weight,
                        },
                        {
                          label: ko ? '키' : 'Height',
                          value: entry.height_cm,
                          unit: 'cm',
                          Icon: Ruler,
                        },
                        {
                          label: ko ? '머리둘레' : 'Head circumference',
                          value: entry.head_cm,
                          unit: 'cm',
                          Icon: ScanFace,
                        },
                      ].map(({ label, value, unit, Icon }) => (
                        <div key={label}>
                          <dt>
                            <span role="img" aria-label={label} title={label}>
                              <Icon size={18} aria-hidden="true" />
                            </span>
                          </dt>
                          <dd>{value == null ? '—' : `${value} ${unit}`}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : undefined
                }
              />
            </article>
          ))}
        </div>
        {!data?.length && (
          <DiaryEmptyState
            context={context}
            locale={locale}
            scope={scope}
            age={age}
            page={page}
            href={href}
          />
        )}

        <nav
          className="pagination"
          aria-label={ko ? '성장일기 페이지' : 'Diary pages'}
        >
          {page > 0 && (
            <Link replace href={href(scope, page - 1)}>
              {ko ? '이전' : 'Previous'}
            </Link>
          )}
          {data && data.length > 20 && (
            <Link replace href={href(scope, page + 1)}>
              {ko ? '다음' : 'Next'}
            </Link>
          )}
        </nav>
      </section>
    </Shell>
  );
}
