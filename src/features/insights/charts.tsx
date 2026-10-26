'use client';
import { useState } from 'react';
import type { Locale } from '@/lib/domain';
import { kindName, unitName } from './config';
import type { Statistic } from './statistics-model';
function title(kind: Statistic['kind'], locale: Locale) {
  const ko = locale === 'ko';
  if (kind === 'counts') return ko ? '횟수' : 'Record counts';
  if (kind === 'height') return ko ? '성장 키' : 'Growth height';
  if (kind === 'feeding') return ko ? '먹인 양' : 'Feeding volume';
  const point =
    kind === 'sleep'
      ? ko
        ? '총시간'
        : 'Total duration'
      : kind === 'breast' || kind === 'play' || kind === 'tummy'
        ? ko
          ? '시간'
          : 'Duration'
        : kind === 'temperature'
          ? ko
            ? '평균'
            : 'Mean'
          : kind === 'growth'
            ? ko
              ? '몸무게'
              : 'Weight'
            : ko
              ? '횟수'
              : 'Count';
  return `${kindName(kind, locale)} ${point}`;
}
export function StatisticsChart({
  chart,
  locale,
}: {
  chart: Statistic;
  locale: Locale;
}) {
  const [selected, setSelected] = useState(() => {
    const latest = chart.points.findLastIndex((_, i) =>
      chart.series.some((series) => series.values[i] !== null),
    );
    return latest >= 0 ? latest : 0;
  });
  const ko = locale === 'ko',
    fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    unit = unitName(chart.unit, locale);
  const known = chart.series.flatMap((series) =>
    series.values.filter((n): n is number => n !== null),
  );
  const max = Math.max(1, ...known),
    upper =
      chart.unit === 'count' ? Math.max(2, Math.ceil(max / 2) * 2) : max * 1.1;
  const x = (i: number) => 64 + (i + 0.5) * (580 / chart.points.length),
    y = (value: number) => 202 - (value / upper) * 164;
  const label = (kind: Statistic['series'][number]['kind']) =>
    kind === 'total' ? (ko ? '전체' : 'Total') : kindName(kind, locale);
  return (
    <article
      className={`insight-statistic-chart ${chart.kind === 'feeding' || chart.kind === 'counts' ? 'quick-color-total' : chart.kind === 'height' ? 'quick-color-growth' : `quick-color-${chart.kind}`}`}
      data-statistic={chart.kind}
    >
      <header>
        <h3>{title(chart.kind, locale)}</h3>
        {chart.kind !== 'counts' && (
          <strong data-testid="statistic-total">
            {chart.total === null ? '—' : fmt.format(chart.total)}
            <small>{unit}</small>
          </strong>
        )}
      </header>
      <div className="insight-overlay-legend">
        {chart.series.map((series) => (
          <span key={series.kind} className={`quick-color-${series.kind}`}>
            <i />
            {label(series.kind)}
            {chart.kind === 'counts' && (
              <small data-count-total={series.kind}>
                {series.total === null ? '—' : fmt.format(series.total!)} {unit}
              </small>
            )}
          </span>
        ))}
      </div>
      <div className="insight-statistic-selection" aria-live="polite">
        <span>{chart.points[selected].date.slice(5).replace('-', '/')}</span>
        {chart.series.map((series) => (
          <strong key={series.kind} className={`quick-color-${series.kind}`}>
            {label(series.kind)}{' '}
            {series.values[selected] === null
              ? '—'
              : fmt.format(series.values[selected]!)}{' '}
            {unit}
          </strong>
        ))}
      </div>
      <svg
        className="insight-statistic-svg"
        viewBox="0 0 680 238"
        role="img"
        aria-label={`${title(chart.kind, locale)} ${ko ? '선그래프' : 'line chart'}`}
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1="64"
              x2="644"
              y1={38 + fraction * 164}
              y2={38 + fraction * 164}
              stroke="#e4ebf3"
              strokeDasharray="4 5"
            />
            <text x="53" y={43 + fraction * 164} textAnchor="end">
              {fmt.format(upper * (1 - fraction))}
            </text>
          </g>
        ))}
        {chart.series.map((series) => (
          <g
            key={series.kind}
            className={`quick-color-${series.kind}`}
            data-statistic-series={series.kind}
          >
            {series.values.map(
              (value, i) =>
                value !== null && (
                  <g key={chart.points[i].date}>
                    {i > 0 && series.values[i - 1] !== null && (
                      <line
                        x1={x(i - 1)}
                        x2={x(i)}
                        y1={y(series.values[i - 1]!)}
                        y2={y(value)}
                        stroke="var(--care-ink)"
                        strokeWidth={series.kind === 'total' ? 3.5 : 2.5}
                        strokeDasharray={
                          series.kind === 'total' ? '7 5' : undefined
                        }
                      />
                    )}
                    <circle
                      cx={x(i)}
                      cy={y(value)}
                      r={i === selected ? 5 : 3.5}
                      fill="var(--care-ink)"
                    />
                    <title>{`${chart.points[i].date} ${label(series.kind)} ${fmt.format(value)} ${unit}`}</title>
                  </g>
                ),
            )}
          </g>
        ))}
      </svg>
      <div
        className="insight-statistic-dates"
        style={{
          gridTemplateColumns: `repeat(${chart.points.length},minmax(0,1fr))`,
        }}
      >
        {chart.points.map((point, i) => (
          <button
            type="button"
            key={point.date}
            aria-pressed={selected === i}
            onClick={() => setSelected(i)}
            aria-label={`${point.date}${point.end !== point.date ? `–${point.end}` : ''}`}
          >
            <span>
              {Number(point.date.slice(5, 7))}/{Number(point.date.slice(8))}
            </span>
            {point.end !== point.date && (
              <small>
                –{Number(point.end.slice(5, 7))}/{Number(point.end.slice(8))}
              </small>
            )}
          </button>
        ))}
      </div>
      {chart.breastMinutes !== undefined && (
        <p className="insight-data-note">
          {ko
            ? `모유 수유 ${chart.breastMinutes === null ? '기록 없음' : `${fmt.format(chart.breastMinutes)}분`}`
            : `Breastfeeding ${chart.breastMinutes === null ? 'not recorded' : `${fmt.format(chart.breastMinutes)} min`}`}
        </p>
      )}
      <details className="insight-table">
        <summary>{ko ? '표로 보기' : 'View data table'}</summary>
        <div className="insight-pattern-table">
          <table>
            <thead>
              <tr>
                <th>{ko ? '날짜' : 'Date'}</th>
                {chart.series.map((series) => (
                  <th key={series.kind}>
                    {label(series.kind)} ({unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.points.map((point, i) => (
                <tr key={point.date}>
                  <td>
                    {point.date}
                    {point.end !== point.date ? `–${point.end}` : ''}
                  </td>
                  {chart.series.map((series) => (
                    <td key={series.kind}>
                      {series.values[i] === null
                        ? '—'
                        : fmt.format(series.values[i]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
