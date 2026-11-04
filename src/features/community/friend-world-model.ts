export type BabyPose = 'lying' | 'sitting' | 'crawling' | 'standing';
export type WorldFriend = {
  id: string;
  nickname: string;
  family_name: string;
  child_name: string;
  status: string;
  sex: string;
  age_days: number;
};
// Illustrative poses give the room variety; these are not observed milestones.
export function babyPose(days: number): BabyPose {
  if (days < 120) return 'lying';
  if (days < 240) return 'sitting';
  if (days < 420) return 'crawling';
  return 'standing';
}
export function preschoolAge(days: number, today: string) {
  const date = new Date(`${today}T00:00:00Z`);
  const cutoff = new Date(date);
  const year = date.getUTCFullYear() - 7,
    month = date.getUTCMonth();
  cutoff.setUTCDate(1);
  cutoff.setUTCFullYear(year);
  cutoff.setUTCDate(
    Math.min(
      date.getUTCDate(),
      new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
    ),
  );
  return (
    Number.isInteger(days) &&
    days >= 0 &&
    days < (date.getTime() - cutoff.getTime()) / 86400000
  );
}
export function ageInDays(birthDate: string, today: string) {
  return Math.max(
    0,
    Math.floor(
      (Date.parse(`${today}T00:00:00Z`) -
        Date.parse(`${birthDate}T00:00:00Z`)) /
        86400000,
    ),
  );
}
export function publicChildName(family: string, child: string) {
  return [family.trim(), child.trim()].filter(Boolean).join(' ');
}
export type WorldMember = WorldFriend & { x: number; y: number };
export type Playground = {
  day: string;
  timezone: string;
  expires_at: string;
  width: number;
  min_x: number;
  max_x: number;
  height: number;
  population: number;
  left: number;
  right: number;
  own: WorldMember;
  members: WorldMember[];
};
export function stableHash(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
export function placementFor(slot: number, seed: number) {
  const group = Math.floor(slot / 3),
    column = group % 2 ? ((group + 1) / 2) * 240 : (-group / 2) * 240;
  const lane = slot % 3;
  return {
    x: column + (lane === 1 ? -55 : lane === 2 ? 55 : 0) + (seed % 49) - 24,
    y:
      (lane === 1 ? 275 : lane === 2 ? 435 : 355) +
      (Math.floor(seed / 53) % 23) -
      11,
  };
}
export function worldBounds(points: { x: number }[]) {
  const min_x = Math.min(-340, ...points.map((p) => p.x - 160));
  const max_x = Math.max(340, ...points.map((p) => p.x + 160));
  return { min_x, max_x, width: max_x - min_x };
}
export function depthScale(y: number) {
  return 0.72 + Math.max(0, Math.min(1, (y - 250) / 200)) * 0.35;
}

// Year age: a child becomes one when the birth calendar year ends.
export function calendarAge(days: number, today: string) {
  const current = new Date(`${today}T00:00:00Z`);
  const birth = new Date(current.getTime() - days * 86400000);
  return Math.max(0, current.getUTCFullYear() - birth.getUTCFullYear());
}

export function playgroundAgeLabel(
  days: number,
  today: string,
  locale: string,
) {
  if (days < 365) return `D+${days}`;
  const age = calendarAge(days, today);
  return locale === 'ko'
    ? `${age}살`
    : `${age} ${age === 1 ? 'year' : 'years'}`;
}
