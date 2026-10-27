import Link from 'next/link';
import { Milk, Moon, Baby, TrendingUp, Ruler } from 'lucide-react';
import type { CareContext } from '@/lib/data';
import { ageInDays, type Locale } from '@/lib/domain';
import { shiftCareDay } from '@/features/care/quick-model';
import { loadInsights } from './data';
import { loadGrowthPoints } from './growth-data';
import { reportRows } from './report-model';
import { kindName } from './config';
import { percentileRank, type GrowthMetric } from './growth-model';
import reference from './reference/who-lms.json';
export async function GrowthReport({
  context,
  locale,
}: {
  context: CareContext;
  locale: Locale;
}) {
  const ko = locale === 'ko',
    start = shiftCareDay(context.today, -7),
    end = shiftCareDay(context.today, -1);
  const [{ weeks }, growth] = await Promise.all([
    loadInsights(context, start, undefined, 2),
    loadGrowthPoints(context),
  ]);
  const rows = reportRows(weeks[0], weeks[1]),
    sex = context.child.sex;
  const period = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  const url = (pattern: string) =>
    `/${locale}/insights?${new URLSearchParams({ child: context.child.id, pattern })}`;
  function value(n: number | null, unit: string) {
    if (n === null) return ko ? '미기록' : 'No data';
    if (unit === 'min') {
      const minutes = Math.round(n);
      return ko
        ? `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`
        : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    }
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 'count' ? 1 : 0 }).format(n)} ${unit === 'count' ? (ko ? '회' : 'times') : unit}`;
  }
  const measurements = (
    [
      { key: 'weight', label: ko ? '몸무게' : 'Weight', unit: 'kg' },
      { key: 'height', label: ko ? '키' : 'Height', unit: 'cm' },
      {
        key: 'head',
        label: ko ? '머리둘레' : 'Head circumference',
        unit: 'cm',
      },
    ] as const
  ).map(({ key, label, unit }) => {
    const latest = growth.findLast((point) => point[key] !== null);
    const percentile =
      latest && (sex === 'female' || sex === 'male')
        ? percentileRank(reference[sex][key][latest.day], latest[key]!)
        : null;
    return {
      key,
      label,
      unit,
      latest,
      percentile,
      old: latest ? ageInDays(latest.date, context.today) > 30 : false,
    };
  });
  const weights = growth.filter((point) => point.weight !== null);
  const range = weights.length
    ? Math.max(...weights.map((p) => p.weight!)) -
      Math.min(...weights.map((p) => p.weight!))
    : 0;
  const x = (day: number) =>
    Number(
      (
        35 +
        ((day - (weights[0]?.day ?? 0)) /
          Math.max(1, (weights.at(-1)?.day ?? 0) - (weights[0]?.day ?? 0))) *
          330
      ).toFixed(3),
    );
  const y = (weight: number) =>
    Number(
      (
        130 -
        ((weight -
          (weights.length ? Math.min(...weights.map((p) => p.weight!)) : 0)) /
          Math.max(1, range)) *
          90
      ).toFixed(3),
    );
  return (
    <section
      className="growth-report"
      aria-label={ko ? '성장 분석 보고서' : 'Growth report'}
    >
      <header className="report-heading">
        <div>
          <span>{context.child.name}</span>
          <h2>{ko ? '성장 분석 보고서' : 'Growth report'}</h2>
        </div>
        <time>
          {period(start)} – {period(end)}
        </time>
      </header>
      <section className="panel report-growth">
        <div className="report-card-heading">
          <h3>
            <Ruler size={19} />
            {ko ? '최근 성장 기록' : 'Latest growth measurements'}
          </h3>
          <Link href={url('curve')}>{ko ? '성장곡선' : 'Growth curves'} →</Link>
        </div>
        <div className="report-measurements">
          {measurements.map(({ key, label, unit, latest, percentile, old }) => (
            <article key={key}>
              <span>{label}</span>
              <strong>
                {latest
                  ? `${latest[key as GrowthMetric]} ${unit}`
                  : ko
                    ? '미기록'
                    : 'No data'}
              </strong>
              {latest && (
                <small>
                  {latest.date} · D+{latest.day}
                </small>
              )}
              {percentile !== null && (
                <small>
                  {percentile < 0.1
                    ? '<0.1'
                    : percentile > 99.9
                      ? '>99.9'
                      : percentile.toFixed(1)}
                  {ko ? '백분위' : 'th percentile'} · WHO
                </small>
              )}
              {old && (
                <small className="report-stale">
                  {ko
                    ? '최근 30일 기록 없음'
                    : 'No measurement in the last 30 days'}
                </small>
              )}
            </article>
          ))}
        </div>
        {weights.length > 0 && (
          <svg
            className="report-weight-chart"
            viewBox="0 0 400 170"
            role="img"
            aria-label={ko ? '기록된 몸무게 변화' : 'Recorded weight trend'}
          >
            <text x="8" y="20">
              kg
            </text>
            <path
              d={weights
                .map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(p.weight!)}`)
                .join(' ')}
              fill="none"
              stroke="#7489c1"
              strokeWidth="2"
            />
            {weights.map((p) => (
              <circle
                key={p.id}
                cx={x(p.day)}
                cy={y(p.weight!)}
                r="3.5"
                fill="#5267a8"
              >
                <title>{`D+${p.day}: ${p.weight} kg`}</title>
              </circle>
            ))}
            <text x="35" y="155">
              D+{weights[0].day}
            </text>
            {weights.length > 1 && (
              <text x="365" y="155" textAnchor="end">
                D+{weights.at(-1)!.day}
              </text>
            )}
          </svg>
        )}
        <p className="small muted">
          {ko
            ? '백분위는 기록 당시 일령과 등록 성별의 WHO 기준이에요. 건강 상태의 판정은 아니에요.'
            : 'Percentiles use WHO references for the recorded age and registered sex. They are not a health assessment.'}
        </p>
        {measurements.every((m) => !m.latest) && (
          <Link href={`/${locale}/community/diaries?child=${context.child.id}`}>
            {ko ? '성장일기에 수치 남기기' : 'Add measurements to the diary'} →
          </Link>
        )}
      </section>
      <div className="report-comparisons">
        {[
          {
            title: ko ? '먹이기' : 'Feeding',
            Icon: Milk,
            kinds: ['breast', 'formula', 'solids'],
          },
          { title: ko ? '수면' : 'Sleep', Icon: Moon, kinds: ['sleep'] },
          {
            title: ko ? '기저귀·배변' : 'Diapers & stools',
            Icon: Baby,
            kinds: ['diaper', 'stool'],
          },
        ].map(({ title, Icon, kinds }) => (
          <section className="panel" key={title}>
            <div className="report-card-heading">
              <h3>
                <Icon size={19} />
                {title}
              </h3>
              <span>{ko ? '기록일 평균' : 'Mean per recorded day'}</span>
            </div>
            <table className="report-table">
              <thead>
                <tr>
                  <th>
                    <span className="sr-only">{ko ? '항목' : 'Measure'}</span>
                  </th>
                  <th>
                    {ko ? '이전 7일' : 'Previous 7 days'}
                    <small>
                      {period(weeks[0].start)}–{period(shiftCareDay(start, -1))}
                    </small>
                  </th>
                  <th>
                    {ko ? '최근 7일' : 'Latest 7 days'}
                    <small>
                      {period(start)}–{period(end)}
                    </small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((row) => kinds.includes(row.kind))
                  .map((row) => (
                    <tr key={row.kind}>
                      <th scope="row">{kindName(row.kind, locale)}</th>
                      <td>
                        {value(row.before.average, row.unit)}
                        {row.before.days > 0 && (
                          <small>
                            {row.before.days}/7{ko ? '일 기록' : ' days'}
                          </small>
                        )}
                      </td>
                      <td>
                        <strong>{value(row.after.average, row.unit)}</strong>
                        {row.after.days > 0 && (
                          <small>
                            {row.after.days}/7{ko ? '일 기록' : ' days'}
                          </small>
                        )}
                        {row.change !== null && (
                          <small className="report-change">
                            {row.change > 0 ? '+' : ''}
                            {row.change.toFixed(1)}%
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <details className="report-notes">
        <summary>
          <h3>
            <TrendingUp size={17} />
            {ko ? '비교 기준' : 'About this comparison'}
          </h3>
        </summary>
        <p>
          {ko
            ? '어제까지의 최근 7일과 그 이전 7일을 비교해요. 각 항목에 수치가 기록된 날만 평균에 포함하며, 두 기간 모두 3일 이상 기록했을 때 변화율을 표시해요.'
            : 'Compares the seven days ending yesterday with the preceding seven. Averages use days with numeric records; changes appear only when both periods have at least three recorded days.'}
        </p>
        <p>
          {ko
            ? '모유는 시간, 분유·이유식은 ml로 표시해요. 진행 중 기록과 미입력 수치는 제외하고, 기록이 없는 날은 0으로 계산하지 않아요. 기저귀 횟수에는 배변 기저귀도 포함돼요.'
            : 'Breastfeeding uses duration; formula and solids use ml. Ongoing records and missing values are excluded. Missing days are not treated as zero. Diaper counts include stool diapers.'}
        </p>
        <p>
          {ko
            ? '또래 평균이나 AI 판정이 아닌 우리 아이의 기록 요약이에요. 일부만 기록한 날은 실제 하루 총량과 다를 수 있어요.'
            : 'This summarizes your child’s records, without peer averages or AI judgments. Partial-day records may differ from actual daily totals.'}
        </p>
        <a
          href="https://www.who.int/tools/child-growth-standards"
          target="_blank"
          rel="noreferrer"
        >
          WHO Child Growth Standards ↗
        </a>
      </details>
    </section>
  );
}
