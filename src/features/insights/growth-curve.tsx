'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Mars, Venus } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import {
  percentileRank,
  percentiles,
  referenceValue,
  type GrowthMetric,
  type GrowthPoint,
} from './growth-model';
type References = Record<'female' | 'male', Record<GrowthMetric, number[][]>>;
export function GrowthCurve({
  points,
  reference,
  sex,
  birthDate,
  locale,
  child,
}: {
  points: GrowthPoint[];
  reference: References;
  sex: string | null;
  birthDate: string | null;
  locale: Locale;
  child: string;
}) {
  const ko = locale === 'ko';
  const [comparison, setComparison] = useState<'female' | 'male' | null>(
    sex === 'male' || sex === 'female' ? sex : null,
  );
  const [span, setSpan] = useState(
    points.at(-1)?.day && points.at(-1)!.day > 730
      ? 1826
      : points.at(-1)?.day && points.at(-1)!.day > 365
        ? 730
        : 365,
  );
  if (!birthDate)
    return (
      <section className="panel">
        <p>
          {ko
            ? '출생일을 등록하면 성장곡선을 볼 수 있어요.'
            : 'Add a birth date to view growth curves.'}
        </p>
        <Link href={`/${locale}/family?child=${child}`}>
          {ko ? '아이 정보' : 'Child details'}
        </Link>
      </section>
    );
  return (
    <section
      className="growth-curve-panel"
      aria-label={ko ? '성장곡선' : 'Growth curves'}
    >
      <div className="growth-options">
        <fieldset className="growth-option-group">
          <legend>{ko ? '비교 기준' : 'Reference'}</legend>
          <div className="growth-option-buttons">
            {(['female', 'male'] as const).map((value) => {
              const Icon = value === 'female' ? Venus : Mars;
              return (
                <button
                  type="button"
                  key={value}
                  aria-pressed={comparison === value}
                  onClick={() => setComparison(value)}
                >
                  <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                  {value === 'female'
                    ? ko
                      ? '여아'
                      : 'Girls'
                    : ko
                      ? '남아'
                      : 'Boys'}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="growth-option-group">
          <legend>{ko ? '기간' : 'Range'}</legend>
          <div className="growth-option-buttons">
            {([365, 730, 1826] as const).map((value, index) => (
              <button
                type="button"
                key={value}
                aria-pressed={span === value}
                onClick={() => setSpan(value)}
              >
                {`0–${[1, 2, 5][index]}${ko ? '세' : 'y'}`}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      {!comparison && (
        <p className="small muted">
          {ko
            ? '성별을 선택하면 공식 기준 곡선과 비교할 수 있어요.'
            : 'Select a reference sex to show the standard curves.'}
        </p>
      )}
      <div className="growth-chart-grid">
        {(['weight', 'height', 'head'] as const).map((metric) => (
          <GrowthMetricChart
            key={metric}
            points={points}
            reference={reference}
            comparison={comparison}
            span={span}
            metric={metric}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

function GrowthMetricChart({
  points,
  reference,
  comparison,
  span,
  metric,
  locale,
}: {
  points: GrowthPoint[];
  reference: References;
  comparison: 'female' | 'male' | null;
  span: number;
  metric: GrowthMetric;
  locale: Locale;
}) {
  const ko = locale === 'ko';
  const [selected, setSelected] = useState<string | null>(null);
  const data = points.filter((p) => p[metric] !== null && p.day <= span),
    chosen = data.find((p) => p.id === selected) ?? data.at(-1);
  const table = comparison ? reference[comparison][metric] : null;
  const sampleDays = Array.from(
    new Set([
      0,
      ...Array.from({ length: Math.floor(span / 7) }, (_, i) => (i + 1) * 7),
      ...(span >= 731 ? [730, 731] : []),
      span,
    ]),
  ).sort((a, b) => a - b);
  const curves = table
    ? percentiles.map(({ p, z }) => ({
        p,
        values: sampleDays.map((day) => ({
          day,
          value: referenceValue(table[day], z),
        })),
      }))
    : [];
  const values = [
    ...data.map((p) => p[metric]!),
    ...curves.flatMap((c) => c.values.map((v) => v.value)),
  ];
  const low = values.length
    ? Math.max(0, Math.floor(Math.min(...values) * 0.9))
    : 0;
  const high = values.length
    ? Math.ceil(Math.max(...values) * 1.05)
    : metric === 'weight'
      ? 15
      : 100;
  const x = (day: number) => Number((42 + (day / span) * 304).toFixed(3)),
    y = (value: number) =>
      Number(
        (385 - ((value - low) / Math.max(1, high - low)) * 350).toFixed(3),
      );
  const unit = metric === 'weight' ? 'kg' : 'cm';
  const labels = {
    weight: ko ? '몸무게' : 'Weight',
    height: ko ? '키' : 'Length / height',
    head: ko ? '머리둘레' : 'Head circumference',
  };
  function rank(point: GrowthPoint) {
    const value = table
      ? percentileRank(table[point.day], point[metric]!)
      : null;
    return value === null
      ? ''
      : value < 0.1
        ? '<0.1'
        : value > 99.9
          ? '>99.9'
          : value.toFixed(1);
  }
  return (
    <section className="panel growth-metric-chart" aria-label={labels[metric]}>
      <h2>{labels[metric]}</h2>
      <div className="growth-selected" aria-live="polite">
        {chosen ? (
          <>
            <strong>
              {chosen[metric]} {unit}
            </strong>
            <span>
              D+{chosen.day}
              {rank(chosen) &&
                ` · ${rank(chosen)}${ko ? '백분위' : 'th percentile'}`}
            </span>
          </>
        ) : (
          <span>
            {ko
              ? '이 기간에 등록된 수치가 없어요.'
              : 'No measurements in this range.'}
          </span>
        )}
      </div>
      <svg
        className="growth-svg"
        viewBox="0 0 400 430"
        role="img"
        aria-label={`${labels[metric]} ${ko ? '성장곡선' : 'growth curve'}`}
      >
        <text x="6" y="20">
          {unit}
        </text>
        {Array.from({ length: 6 }, (_, i) => low + ((high - low) * i) / 5).map(
          (v, i) => (
            <g key={i}>
              <line
                x1="42"
                x2="346"
                y1={y(v)}
                y2={y(v)}
                className="growth-grid"
              />
              <text x="34" y={y(v) + 4} textAnchor="end">
                {v.toFixed(metric === 'weight' ? 1 : 0)}
              </text>
            </g>
          ),
        )}
        {curves.map((curve) => (
          <g key={curve.p}>
            <path
              className={
                curve.p === 50 ? 'growth-reference median' : 'growth-reference'
              }
              d={curve.values
                .map(
                  (v, i) =>
                    `${i === 0 || (metric === 'height' && v.day === 731) ? 'M' : 'L'}${x(v.day)},${y(v.value)}`,
                )
                .join(' ')}
            />
            <text x="352" y={y(curve.values.at(-1)!.value) + 3}>
              {curve.p}%
            </text>
          </g>
        ))}
        {[0, 1, 2, 3, 4].map((i) => (
          <text key={i} x={x((span * i) / 4)} y="408" textAnchor="middle">
            {Math.round((span * i) / 4)}
          </text>
        ))}
        <text x="6" y="408">
          D+
        </text>
        {chosen && (
          <line
            x1={x(chosen.day)}
            x2={x(chosen.day)}
            y1="30"
            y2="385"
            className="growth-cursor"
          />
        )}
        <path
          className="growth-child-line"
          d={data
            .map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(p[metric]!)}`)
            .join(' ')}
        />
        {data.map((p) => (
          <g
            key={p.id}
            tabIndex={0}
            role="button"
            aria-label={`D+${p.day}, ${p[metric]} ${unit}`}
            onClick={() => setSelected(p.id)}
            onFocus={() => setSelected(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelected(p.id);
              }
            }}
          >
            <circle
              cx={x(p.day)}
              cy={y(p[metric]!)}
              r="12"
              fill="transparent"
            />
            <circle
              cx={x(p.day)}
              cy={y(p[metric]!)}
              r={chosen?.id === p.id ? 5 : 3.5}
              className="growth-child-point"
            />
            <title>{`${p.date}: ${p[metric]} ${unit}`}</title>
          </g>
        ))}
      </svg>
      {metric === 'height' && (
        <p className="small muted">
          {ko
            ? '2세 미만은 누운 키, 2세부터는 선 키 기준이에요. 기록은 이 측정 방식으로 입력된 것으로 비교해요.'
            : 'Reference: recumbent length before age two, standing height thereafter. Comparisons assume measurements followed this method.'}
        </p>
      )}
      <details className="growth-record-table">
        <summary>{ko ? '기록 수치 보기' : 'View measurements'}</summary>
        <table>
          <thead>
            <tr>
              <th>D+</th>
              <th>{labels[metric]}</th>
              <th>{ko ? '백분위' : 'Percentile'}</th>
            </tr>
          </thead>
          <tbody>
            {points
              .filter((p) => p[metric] !== null)
              .map((p) => (
                <tr key={p.id}>
                  <td>{p.day}</td>
                  <td>
                    {p[metric]} {unit}
                  </td>
                  <td>{rank(p) || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
      <p className="small muted">
        {ko
          ? 'WHO 성장 기준 · D+0–1826 · 백분위는 참고용이며 진단을 대신하지 않아요. 미숙아 교정 연령은 적용하지 않았어요.'
          : 'WHO standards · days 0–1826 · Percentiles are a reference, not a diagnosis. Age is not corrected for prematurity.'}
      </p>
      <a
        className="small"
        href={`https://www.who.int/tools/child-growth-standards/standards/${metric === 'weight' ? 'weight-for-age' : metric === 'height' ? 'length-height-for-age' : 'head-circumference-for-age'}`}
        target="_blank"
        rel="noreferrer"
      >
        {ko ? 'WHO 원문 기준표' : 'WHO source tables'} ↗
      </a>
    </section>
  );
}
