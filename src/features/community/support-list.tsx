import { ExternalLink, Landmark } from 'lucide-react';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { homeArea } from './options';
export async function SupportList({
  context,
  locale,
  area: selectedArea,
}: {
  context: CareContext;
  locale: Locale;
  area?: ReturnType<typeof homeArea>;
}) {
  const ko = locale === 'ko';
  if ((context.family.residence_country_code ?? 'KR') !== 'KR')
    return (
      <p className="panel">
        {ko
          ? '지원금 정보는 현재 한국 지역에서 제공해요.'
          : 'Support information currently covers South Korea.'}
      </p>
    );
  const area = selectedArea ?? homeArea(context.family);
  const terms = [
    ...new Set(
      [
        area.district.split(' ')[0],
        area.city,
        area.district,
        area.locality,
      ].filter(Boolean),
    ),
  ];
  if (!terms.length)
    return (
      <p className="panel">
        {ko
          ? '지역을 설정하면 우리 지역의 지원금을 볼 수 있어요.'
          : 'Set your area to see local support.'}
      </p>
    );
  const [national, local, latest] = await Promise.all([
    context.db
      .from('parenting_support')
      .select('*')
      .eq('active', true)
      .eq('national', true)
      .order('title')
      .limit(300),
    context.db
      .from('parenting_support')
      .select('*')
      .eq('active', true)
      .overlaps('region_terms', terms)
      .order('title')
      .limit(300),
    context.db
      .from('parenting_support_sync')
      .select('finished_at')
      .eq('status', 'success')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (national.error || local.error || latest.error)
    throw new Error('Support information unavailable');
  const rows = [
    ...new Map(
      [...(local.data ?? []), ...(national.data ?? [])].map((row) => [
        row.id,
        row,
      ]),
    ).values(),
  ];
  const groups = [
    {
      label: ko ? '전국 공통' : 'National',
      rows: rows.filter((row) => row.national),
    },
    ...terms.map((term) => ({
      label: term,
      rows: rows.filter(
        (row) =>
          !row.national &&
          row.region_terms
            .filter((t) => terms.includes(t))
            .sort((a, b) => b.length - a.length)[0] === term,
      ),
    })),
  ];
  return (
    <section className="support-browser">
      <p className="small muted">
        {ko
          ? '전국 공통과 우리 시·구·동의 육아 지원을 함께 모았어요. 신청 자격·기간은 원문에서 확인해 주세요.'
          : 'National and local parenting support. Check eligibility and application periods at the source.'}
      </p>
      {latest.data?.finished_at ? (
        <p className="small muted">
          {ko ? '최근 수집' : 'Last collected'} ·{' '}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeZone: 'Asia/Seoul',
          }).format(new Date(latest.data.finished_at))}
        </p>
      ) : (
        <p className="panel">
          {ko
            ? '공식 지원금 데이터 연결을 준비하고 있어요.'
            : 'The official support data connection is being prepared.'}
        </p>
      )}
      {groups.map((group) => (
        <section key={group.label} className="support-group">
          <h2>
            <Landmark size={17} />
            {group.label}
          </h2>
          {group.rows.length ? (
            group.rows.map((row) => (
              <article key={row.id} className="panel">
                <h3>{row.title}</h3>
                <p>{row.summary}</p>
                <details>
                  <summary>
                    {ko ? '대상·지원 내용' : 'Eligibility & benefits'}
                  </summary>
                  <p className="post-body">{row.eligibility}</p>
                  <p className="post-body">{row.benefit}</p>
                  <p>{row.application_period}</p>
                </details>
                <div className="support-source">
                  <small className="muted">
                    {row.agency} · {ko ? '보조금24' : 'Gov24'}
                  </small>
                  <a href={row.url} target="_blank" rel="noreferrer">
                    {ko ? '원문 보기' : 'Official details'}
                    <ExternalLink size={13} />
                  </a>
                </div>
              </article>
            ))
          ) : (
            <p className="small muted">
              {ko
                ? '수집된 육아 지원 정보가 없어요.'
                : 'No collected parenting support information.'}
            </p>
          )}
        </section>
      ))}
      <p className="small muted">
        {ko
          ? '출처: 보조금24 공공서비스 정보. 공식 데이터에 포함된 항목을 수집하며, 별도 동 주민센터 공고 등은 누락될 수 있어요.'
          : 'Source: Gov24 public services. Coverage is limited to published data; separate neighborhood notices may be missing.'}{' '}
        <a
          href="https://www.data.go.kr/data/15113968/openapi.do"
          target="_blank"
          rel="noreferrer"
        >
          {ko ? '데이터 출처' : 'Data source'}
        </a>
      </p>
    </section>
  );
}
