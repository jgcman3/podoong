import type { CareContext } from '@/lib/data';
import type { DayAgendaData } from './day-agenda-model';
import { calendarEntry } from './calendar-model';
import { readPages } from './quick-data';
export async function loadDayAgenda(
  context: CareContext,
  day = context.today,
): Promise<DayAgendaData> {
  const [tasks, events] = await Promise.all([
    readPages((from, to) =>
      context.db
        .from('tasks')
        .select('id,title,template_key,service,due_date,status,assignee_id')
        .eq('child_id', context.child.id)
        .eq('due_date', day)
        .neq('status', 'snoozed')
        .order('id')
        .range(from, to),
    ),
    readPages((from, to) =>
      context.db
        .from('calendar_entries')
        .select('*')
        .eq('child_id', context.child.id)
        .eq('date', day)
        .eq('status', 'planned')
        .order('event_time', { nullsFirst: false })
        .order('source')
        .order('id')
        .range(from, to),
    ),
  ]);
  return { tasks, events: events.map(calendarEntry) };
}
