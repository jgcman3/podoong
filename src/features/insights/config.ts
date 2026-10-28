import type { Locale } from '@/lib/domain';
export const insightKinds = [
  'breast',
  'formula',
  'solids',
  'sleep',
  'diaper',
  'stool',
  'bath',
  'hospital',
  'vaccination',
  'temperature',
  'medication',
  'snack',
  'play',
  'tummy',
  'growth',
  'development',
  'daycare',
  'kindergarten',
] as const;
export type InsightKind = (typeof insightKinds)[number];
export type Metric = {
  key: string;
  ko: string;
  en: string;
  unit: string;
  mode: 'sum' | 'average' | 'latest' | 'max';
};
const count: Metric = {
  key: 'count',
  ko: '횟수',
  en: 'Count',
  unit: 'count',
  mode: 'sum',
};
const minutes: Metric = {
  key: 'minutes',
  ko: '시간',
  en: 'Duration',
  unit: 'min',
  mode: 'sum',
};
const ml: Metric = {
  key: 'ml',
  ko: '먹인 양',
  en: 'Volume',
  unit: 'ml',
  mode: 'sum',
};
export const metrics: Record<InsightKind, Metric[]> = {
  breast: [minutes, count],
  formula: [ml, count, minutes],
  solids: [
    ml,
    count,
    { key: 'g', ko: '이전 g 기록', en: 'Legacy grams', unit: 'g', mode: 'sum' },
    minutes,
  ],
  sleep: [minutes, count],
  diaper: [
    count,
    { key: 'wet', ko: '소변', en: 'Wet', unit: 'count', mode: 'sum' },
    { key: 'dirty', ko: '대변', en: 'Dirty', unit: 'count', mode: 'sum' },
  ],
  stool: [count],
  bath: [count, minutes],
  hospital: [count],
  vaccination: [count],
  temperature: [
    {
      key: 'temperature',
      ko: '평균 체온',
      en: 'Mean temperature',
      unit: '°C',
      mode: 'average',
    },
    {
      key: 'maxTemperature',
      ko: '최고 체온',
      en: 'Max temperature',
      unit: '°C',
      mode: 'max',
    },
    count,
  ],
  medication: [count],
  snack: [count],
  play: [minutes, count],
  tummy: [minutes, count],
  growth: [
    { key: 'weight', ko: '몸무게', en: 'Weight', unit: 'kg', mode: 'latest' },
    { key: 'height', ko: '키', en: 'Height', unit: 'cm', mode: 'latest' },
    {
      key: 'head',
      ko: '머리둘레',
      en: 'Head circumference',
      unit: 'cm',
      mode: 'latest',
    },
    count,
  ],
  development: [count],
  daycare: [minutes, count],
  kindergarten: [minutes, count],
};
const ko = [
  '모유',
  '분유',
  '이유식',
  '수면',
  '기저귀',
  '배변',
  '목욕',
  '병원',
  '예방접종',
  '체온',
  '투약',
  '간식',
  '놀이',
  '터미타임',
  '성장',
  '발달',
  '어린이집',
  '유치원',
];
const en = [
  'Breast',
  'Formula',
  'Solids',
  'Sleep',
  'Diaper',
  'Stool',
  'Bath',
  'Doctor',
  'Vaccine',
  'Temperature',
  'Medicine',
  'Snack',
  'Play',
  'Tummy time',
  'Growth',
  'Development',
  'Daycare',
  'Kindergarten',
];
export function kindName(kind: InsightKind, locale: Locale) {
  return (locale === 'ko' ? ko : en)[insightKinds.indexOf(kind)];
}
export function metricName(metric: Metric, locale: Locale) {
  return locale === 'ko' ? metric.ko : metric.en;
}
export function unitName(unit: string, locale: Locale) {
  if (unit === 'h') return locale === 'ko' ? '시간' : 'h';
  return unit === 'count'
    ? locale === 'ko'
      ? '회'
      : 'times'
    : unit === 'min'
      ? locale === 'ko'
        ? '분'
        : 'min'
      : unit;
}
export function selectedKinds(value: string | undefined): InsightKind[] {
  if (value === undefined)
    return ['breast', 'formula', 'solids', 'sleep', 'diaper', 'stool'];
  const requested = value.split(',');
  return insightKinds.filter((kind) => requested.includes(kind));
}
export function toggleKind(selected: InsightKind[], kind: InsightKind) {
  return insightKinds.filter((key) =>
    key === kind ? !selected.includes(key) : selected.includes(key),
  );
}
