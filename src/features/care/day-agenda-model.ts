import type { Row } from '@/lib/db';
import type { CalendarEntry } from './calendar-model';
export type AgendaTask = Pick<
  Row<'tasks'>,
  | 'id'
  | 'title'
  | 'template_key'
  | 'service'
  | 'due_date'
  | 'status'
  | 'assignee_id'
>;
export type DayAgendaData = { tasks: AgendaTask[]; events: CalendarEntry[] };
