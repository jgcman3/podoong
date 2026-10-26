export function validMonth(value: string | undefined) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 1 && year <= 9998;
}
export function monthBounds(month: string) {
  if (!validMonth(month)) throw new Error('Invalid month');
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return { start: `${month}-01`, end: date.toISOString().slice(0, 10) };
}
export function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  const value = date.toISOString().slice(0, 7);
  return validMonth(value) ? value : month;
}
export function monthDays(month: string) {
  const { start } = monthBounds(month);
  const first = new Date(`${start}T00:00:00Z`);
  const offset = first.getUTCDay();
  const { end } = monthBounds(month);
  const count = Math.round((Date.parse(end) - first.getTime()) / 86400000);
  const cells = Math.ceil((offset + count) / 7) * 7;
  return Array.from({ length: cells }, (_, i) =>
    new Date(first.getTime() + (i - offset) * 86400000)
      .toISOString()
      .slice(0, 10),
  );
}
export function calendarHref(
  locale: string,
  childId: string,
  day: string,
  extra: Record<string, string> = {},
) {
  return `/${locale}/calendar?${new URLSearchParams({ child: childId, month: day.slice(0, 7), day, ...extra })}`;
}
