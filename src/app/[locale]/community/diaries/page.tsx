import { DiaryComposer } from '@/features/growth-community/composer';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  BookOpen,
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
import { loadCare } from '@/lib/data';
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
    context = await loadCare(locale, q.child, []);
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
            href={href('mine')}
            aria-current={scope === 'mine' ? 'page' : undefined}
          >
            {ko ? '우리 아이 성장일기' : 'Our child’s diary'}
          </Link>
          <Link
            href={href('birth')}
            aria-current={scope === 'birth' ? 'page' : undefined}
          >
            {ko ? '출생일별 성장일기' : 'Same-birthday diaries'}
          </Link>
          <Link
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
        <div className="public-diary-list">
          {(data ?? []).slice(0, 20).map((entry) => (
            <article className="public-diary-card" key={entry.id}>
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
              <div
                className={`public-diary-body ${entry.photo_ids.length ? 'with-photos' : ''}`}
              >
                <div>
                  {scope !== 'all' && (
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
                  )}
                  {entry.note && <p className="record-note">{entry.note}</p>}
                </div>
                {entry.photo_ids.length > 0 && (
                  <div className="public-diary-photos">
                    {entry.photo_ids.map((id, index) => (
                      <a
                        key={id}
                        href={photoUrl(id)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={
                          ko
                            ? `성장일기 사진 ${index + 1} 크게 보기`
                            : `Open diary photo ${index + 1}`
                        }
                      >
                        <Image
                          src={photoUrl(id)}
                          alt={
                            ko
                              ? `성장일기 사진 ${index + 1}`
                              : `Diary photo ${index + 1}`
                          }
                          width={400}
                          height={400}
                          unoptimized
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
        {!data?.length && (
          <section className="panel diary-empty">
            <BookOpen size={30} aria-hidden="true" />
            <p>
              {scope === 'birth' && !context.child.birth_date
                ? ko
                  ? '출생일을 등록하면 같은 날 태어난 아이들의 일기를 볼 수 있어요.'
                  : 'Add a birth date to see same-birthday diaries.'
                : scope === 'mine'
                  ? ko
                    ? '아직 성장일기가 없어요.'
                    : 'No growth diary entries yet.'
                  : ko
                    ? '공개된 성장일기가 없어요.'
                    : 'No shared growth diaries yet.'}
            </p>
            {scope === 'birth' && !context.child.birth_date && (
              <Link href={`/${locale}/family?child=${context.child.id}`}>
                {ko ? '출생일 등록' : 'Add birth date'}
              </Link>
            )}
          </section>
        )}
        {scope === 'mine' && context.writable && (
          <DiaryComposer
            key={context.child.id}
            child={context.child.id}
            locale={locale}
          />
        )}
        <nav
          className="pagination"
          aria-label={ko ? '성장일기 페이지' : 'Diary pages'}
        >
          {page > 0 && (
            <Link href={href(scope, page - 1)}>{ko ? '이전' : 'Previous'}</Link>
          )}
          {data && data.length > 20 && (
            <Link href={href(scope, page + 1)}>{ko ? '다음' : 'Next'}</Link>
          )}
        </nav>
      </section>
    </Shell>
  );
}
