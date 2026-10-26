import type { Locale } from '@/lib/domain';
import { kindName } from './config';
import type { PatternCategory } from './model';
export function patternTime(minute: number) {
  const whole = Math.floor(minute);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
export function PatternLegend({
  categories,
  locale,
}: {
  categories: PatternCategory[];
  locale: Locale;
}) {
  return (
    <div className="insight-overlay-legend">
      {categories.map((category) => (
        <span key={category.kind} className={`quick-color-${category.kind}`}>
          <i />
          {kindName(category.kind, locale)}
        </span>
      ))}
    </div>
  );
}
export function UntimedPattern({
  categories,
  locale,
  day,
}: {
  categories: PatternCategory[];
  locale: Locale;
  day?: string;
}) {
  const records = categories.flatMap((category) =>
    category.days
      .filter((d) => d.untimed > 0 && (!day || d.date === day))
      .map((d) => ({ kind: category.kind, date: d.date, count: d.untimed })),
  );
  if (!records.length) return null;
  return (
    <div className="insight-untimed-records">
      <span>{locale === 'ko' ? '시각 없음' : 'No time'}</span>
      {records.map((record) => (
        <span
          key={`${record.kind}:${record.date}`}
          className={`quick-color-${record.kind}`}
        >
          <i />
          {record.date.slice(5).replace('-', '/')} ·{' '}
          {kindName(record.kind, locale)} {record.count}
          {locale === 'ko' ? '회' : ' times'}
        </span>
      ))}
    </div>
  );
}
export function PatternTable({
  categories,
  locale,
  day,
}: {
  categories: PatternCategory[];
  locale: Locale;
  day?: string;
}) {
  const ko = locale === 'ko';
  return (
    <details className="insight-table">
      <summary>{ko ? '패턴 기록 보기' : 'View pattern records'}</summary>
      <div className="insight-pattern-table">
        <table>
          <thead>
            <tr>
              {(ko
                ? ['날짜', '시각', '기능']
                : ['Date', 'Time', 'Activity']
              ).map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.flatMap((category) =>
              category.days
                .filter((d) => !day || d.date === day)
                .flatMap((d) => [
                  ...d.segments.map((segment, i) => (
                    <tr key={`${category.kind}:${d.date}:${i}`}>
                      <td>{d.date}</td>
                      <td>
                        {patternTime(segment.start)}
                        {segment.end > segment.start
                          ? `–${patternTime(segment.end)}`
                          : ''}
                      </td>
                      <td>{kindName(category.kind, locale)}</td>
                    </tr>
                  )),
                  ...(d.untimed
                    ? [
                        <tr key={`${category.kind}:${d.date}:untimed`}>
                          <td>{d.date}</td>
                          <td>{ko ? '시각 없음' : 'No time'}</td>
                          <td>
                            {kindName(category.kind, locale)} · {d.untimed}
                            {ko ? '회' : ' times'}
                          </td>
                        </tr>,
                      ]
                    : []),
                ]),
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
export function WeeklyPattern({
  categories,
  locale,
}: {
  categories: PatternCategory[];
  locale: Locale;
}) {
  const days = categories[0]?.days ?? [],
    left = 42,
    top = 24,
    dayWidth = 70,
    height = 432;
  return (
    <svg
      className="insight-overlay-chart insight-weekly-pattern"
      viewBox="0 0 544 490"
      role="img"
      aria-label={
        locale === 'ko'
          ? '날짜·시각별 주간 패턴'
          : 'Weekly activity pattern by date and time'
      }
    >
      {days.map((day, d) => (
        <g key={day.date}>
          <rect
            x={left + d * dayWidth + 4}
            y={top}
            width={dayWidth - 8}
            height={height}
            rx="5"
            fill="#f4f7fb"
          />
          <text
            x={left + (d + 0.5) * dayWidth}
            y={top + height + 27}
            textAnchor="middle"
          >
            {Number(day.date.slice(5, 7))}/{Number(day.date.slice(8))}
          </text>
        </g>
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i}>
          <line
            x1={left}
            x2={left + 7 * dayWidth}
            y1={top + (i * height) / 8}
            y2={top + (i * height) / 8}
            stroke="#dfe6ef"
          />
          <text x={left - 9} y={top + (i * height) / 8 + 5} textAnchor="end">
            {String(i * 3).padStart(2, '0')}
          </text>
        </g>
      ))}
      {categories.map((category) => (
        <g
          key={category.kind}
          className={`quick-color-${category.kind}`}
          data-pattern-kind={category.kind}
        >
          {category.days.flatMap((day, d) =>
            day.segments.map((segment, i) => (
              <g key={`${d}:${i}`}>
                {category.kind === 'sleep' && segment.end > segment.start && (
                  <rect
                    x={left + d * dayWidth + 6}
                    y={top + (segment.start / 1440) * height}
                    width={dayWidth - 12}
                    height={((segment.end - segment.start) / 1440) * height}
                    fill="var(--care-ink)"
                    opacity="0.15"
                  />
                )}
                <line
                  x1={left + d * dayWidth + 6}
                  x2={left + (d + 1) * dayWidth - 6}
                  y1={top + (segment.start / 1440) * height}
                  y2={top + (segment.start / 1440) * height}
                  stroke="var(--care-ink)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.9"
                  data-pattern-mark="true"
                >
                  <title>{`${day.date} ${patternTime(segment.start)}${segment.end > segment.start ? `–${patternTime(segment.end)}` : ''} · ${kindName(category.kind, locale)}`}</title>
                </line>
              </g>
            )),
          )}
        </g>
      ))}
    </svg>
  );
}
