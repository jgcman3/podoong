import type { CareContext } from '@/lib/data';
import { calendarEntry, type CalendarEntry } from './calendar-model';
import { monthBounds } from './month-model';
export async function loadMonthEntries(context: CareContext, month: string) {
  const { start, end } = monthBounds(month),
    entries: CalendarEntry[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await context.db
      .from('calendar_entries')
      .select('*')
      .eq('child_id', context.child.id)
      .gte('date', start)
      .lt('date', end)
      .order('date')
      .order('event_time', { nullsFirst: false })
      .order('source')
      .order('id')
      .range(offset, offset + 499);
    if (result.error) throw new Error('Calendar unavailable');
    entries.push(...(result.data ?? []).map(calendarEntry));
    if (!result.data || result.data.length < 500) return entries;
  }
}

export async function loadMonthTasks(context: CareContext, month: string) {
  const { start, end } = monthBounds(month);
  const tasks: import('@/lib/db').Row<'tasks'>[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await context.db
      .from('tasks')
      .select('*')
      .eq('child_id', context.child.id)
      .gte('due_date', start)
      .lt('due_date', end)
      .order('due_date')
      .order('id')
      .range(offset, offset + 499);
    if (result.error) throw new Error('Tasks unavailable');
    tasks.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) return tasks;
  }
}
