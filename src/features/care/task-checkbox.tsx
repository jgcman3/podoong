'use client';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';
import type { AgendaTask } from './day-agenda-model';
import { type Locale } from '@/lib/domain';
import { saveTask } from './actions';

export function TaskCheckbox({
  task,
  locale,
  childId,
  writable,
  returnTo = 'calendar',
  onSaved,
}: {
  task: AgendaTask;
  locale: Locale;
  childId: string;
  writable: boolean;
  returnTo?: 'today' | 'calendar';
  onSaved?: (id: string, status: 'todo' | 'done') => void;
}) {
  const t = useTranslations();
  const done = task.status === 'done';
  return (
    <form
      action={
        onSaved
          ? async (form) => {
              await saveTask(form);
              onSaved(task.id, done ? 'todo' : 'done');
            }
          : saveTask
      }
      className="task-check-form"
    >
      <input type="hidden" name="intent" value="toggle" />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="id" value={task.id} />
      <input type="hidden" name="title" value={task.title} />
      <input type="hidden" name="service" value={task.service} />
      <input type="hidden" name="date" value={task.due_date ?? ''} />
      <input type="hidden" name="assignee" value={task.assignee_id ?? ''} />
      <input type="hidden" name="status" value={done ? 'todo' : 'done'} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Toggle
        done={done}
        label={`${task.title} ${done ? t('reopen') : t('complete')}`}
        writable={writable}
      />
    </form>
  );
}

function Toggle({
  done,
  label,
  writable,
}: {
  done: boolean;
  label: string;
  writable: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      className={`task-check ${done ? 'checked' : ''}`}
      disabled={!writable || pending}
    >
      {done && <Check size={15} />}
    </button>
  );
}
