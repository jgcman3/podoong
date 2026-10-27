import { ageInDays, dateInTimeZone } from '@/lib/domain';
export type GrowthMetric = 'weight' | 'height' | 'head';
export type GrowthPoint = {
  id: string;
  day: number;
  date: string;
  weight: number | null;
  height: number | null;
  head: number | null;
};
export const percentiles = [
  { p: 3, z: -1.880793608 },
  { p: 10, z: -1.281551566 },
  { p: 25, z: -0.67448975 },
  { p: 50, z: 0 },
  { p: 75, z: 0.67448975 },
  { p: 90, z: 1.281551566 },
  { p: 97, z: 1.880793608 },
];
export function referenceValue(lms: number[], z: number) {
  const [l, m, s] = lms;
  return l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
}
export function percentileRank(lms: number[] | undefined, value: number) {
  if (!lms || value <= 0 || !Number.isFinite(value)) return null;
  const [l, m, s] = lms;
  const z =
    l === 0 ? Math.log(value / m) / s : (Math.pow(value / m, l) - 1) / (l * s);
  // Standard normal CDF (Abramowitz–Stegun 26.2.17; error < 7.5e-8).
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const tail =
    (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 100 * (z >= 0 ? 1 - tail : tail);
}
export function growthPoint(
  record: {
    id: string;
    occurred_at: string;
    record_timezone: string;
    weight_kg: number | null;
    height_cm: number | null;
    head_cm: number | null;
  },
  birth: string,
  today: string,
): GrowthPoint | null {
  const date = dateInTimeZone(
      new Date(record.occurred_at),
      record.record_timezone,
    ),
    day = ageInDays(birth, date);
  return day < 0 || date > today
    ? null
    : {
        id: record.id,
        date,
        day,
        weight: record.weight_kg,
        height: record.height_cm,
        head: record.head_cm,
      };
}
