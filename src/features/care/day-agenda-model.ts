import type { Row } from '@/lib/db';
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
