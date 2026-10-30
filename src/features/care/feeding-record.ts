export const feedingKinds = ['breast', 'formula', 'solids'] as const;
export function endFromDuration(start: string, minutes: string) {
  if (!minutes.trim()) return '';
  const duration = Number(minutes);
  const end = new Date(Date.parse(start) + duration * 60000);
  return Number.isFinite(duration) &&
    duration >= 0 &&
    Number.isFinite(end.getTime())
    ? end.toISOString()
    : '';
}

export function endFromClock(startLocal: string, clock: string) {
  if (!startLocal || !/^\d{2}:\d{2}$/.test(clock)) return '';
  const start = new Date(startLocal),
    end = new Date(`${startLocal.slice(0, 10)}T${clock}`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()))
    return '';
  if (clock < startLocal.slice(11, 16)) end.setDate(end.getDate() + 1);
  return end.toISOString();
}
