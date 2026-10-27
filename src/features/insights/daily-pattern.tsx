import type { Locale } from '@/lib/domain';
import { ageInDays } from '@/lib/domain';
import { kindName } from './config';
import type { PatternCategory } from './model';
import { patternTime } from './pattern';
const position = (minute: number, radius: number) => {
  const angle = (minute / 1440) * Math.PI * 2 - Math.PI / 2;
  // Keep SVG coordinates identical across server and browser math engines.
  return [190 + Math.cos(angle) * radius, 190 + Math.sin(angle) * radius].map(
    (value) => Math.round(value * 10000) / 10000,
  );
};
function arc(start: number, end: number) {
  const outerStart = position(start, 140),
    outerEnd = position(end, 140),
    innerStart = position(start, 70),
    innerEnd = position(end, 70),
    large = end - start > 720 ? 1 : 0;
  return `M ${outerStart.join(' ')} A 140 140 0 ${large} 1 ${outerEnd.join(' ')} L ${innerEnd.join(' ')} A 70 70 0 ${large} 0 ${innerStart.join(' ')} Z`;
}
export function DailyPattern({
  expanded = false,
  categories,
  locale,
  day,
  birthDate,
}: {
  expanded?: boolean;
  categories: PatternCategory[];
  locale: Locale;
  day: string;
  birthDate: string | null;
}) {
  const age = birthDate ? ageInDays(birthDate, day) : null;
  // Sleep stays behind point records so a long sleep interval cannot hide a feeding mark.
  const layers = [...categories].sort(
    (a, b) => Number(b.kind === 'sleep') - Number(a.kind === 'sleep'),
  );
  return (
    <svg
      className="insight-daily-pattern"
      viewBox={expanded ? '8 8 364 364' : '0 0 380 380'}
      role="img"
      aria-label={
        locale === 'ko'
          ? `${day} 24시간 하루 패턴`
          : `${day} 24-hour daily pattern`
      }
    >
      <circle
        cx="190"
        cy="190"
        r="105"
        fill="none"
        stroke="#edf2f8"
        strokeWidth="70"
      />
      {Array.from({ length: 24 }, (_, hour) => {
        const a = position(hour * 60, 148),
          b = position(hour * 60, 153),
          label = position(hour * 60, 168);
        return (
          <g key={hour}>
            <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#b9c5d6" />
            {hour % 2 === 0 && (
              <text x={label[0]} y={label[1] + 5} textAnchor="middle">
                {hour}
              </text>
            )}
          </g>
        );
      })}
      {layers.map((category) => (
        <g
          key={category.kind}
          className={`quick-color-${category.kind}`}
          data-daily-kind={category.kind}
        >
          {category.days
            .find((d) => d.date === day)
            ?.segments.flatMap((segment, i) => {
              // A point uses a small fixed tick. It does not represent a measured duration.
              const end =
                segment.end > segment.start
                  ? segment.end
                  : Math.min(1440, segment.start + 6);
              const ranges =
                end - segment.start >= 1440
                  ? [
                      [0, 720],
                      [720, 1440],
                    ]
                  : [[segment.start, end]];
              return ranges.map(([start, finish], part) => (
                <path
                  key={`${i}:${part}`}
                  d={arc(start, finish)}
                  fill="var(--care-ink)"
                  opacity={category.kind === 'sleep' ? 0.45 : 0.9}
                >
                  <title>{`${kindName(category.kind, locale)} · ${patternTime(segment.start)}${segment.end > segment.start ? `–${patternTime(segment.end)}` : ''}`}</title>
                </path>
              ));
            })}
        </g>
      ))}
      <text
        className="insight-clock-center-value"
        x="190"
        y="200"
        textAnchor="middle"
      >
        {age !== null && age >= 0 ? `D+${age}` : day.slice(5).replace('-', '/')}
      </text>
    </svg>
  );
}
