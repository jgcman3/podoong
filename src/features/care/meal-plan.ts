import { z } from 'zod';

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const mealPlanSchema = z.object({
  feedingMinutes: z.number().int().min(30).max(1440).nullable(),
  solids: z.array(clock).max(3),
});
export type MealPlan = z.infer<typeof mealPlanSchema>;

export function nextFeeding(
  latest: { ended_at: string | null } | null,
  minutes: number | null,
): number | null {
  if (!latest?.ended_at || minutes === null) return null;
  const end = Date.parse(latest.ended_at);
  return Number.isFinite(end) ? end + minutes * 60000 : null;
}

// Resolve wall-clock schedules in the profile timezone, including DST changes.
// Nonexistent spring-forward times are skipped; repeated times use the next occurrence.
export function nextMealTime(
  times: readonly string[],
  now: number,
  timezone: string,
): number | null {
  if (!times.length) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const wall = (timestamp: number) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(timestamp).map((p) => [p.type, p.value]),
    );
    return Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
  };
  const localDate = new Date(wall(now)).toISOString().slice(0, 10);
  const midnight = Date.parse(`${localDate}T00:00:00Z`);
  const offsets = new Set(
    [-1, 0, 1, 2].map((day) => {
      const sample = Math.floor((now + day * 86400000) / 1000) * 1000;
      return wall(sample) - sample;
    }),
  );
  const candidates: number[] = [];
  for (let day = 0; day <= 2; day++) {
    for (const time of times) {
      if (!clock.safeParse(time).success) continue;
      const [hour, minute] = time.split(':').map(Number);
      const target =
        midnight + day * 86400000 + hour * 3600000 + minute * 60000;
      for (const offset of offsets) {
        const candidate = target - offset;
        if (candidate >= now && wall(candidate) === target)
          candidates.push(candidate);
      }
    }
  }
  return candidates.length ? Math.min(...candidates) : null;
}
