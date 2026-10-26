'use client';
import { CalendarDays, Check } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { TaskCheckbox } from './task-checkbox';
import { AgendaEventCard, AgendaTaskCard } from './agenda-cards';
import type { DayAgendaData } from './day-agenda-model';
export function DayAgenda({
  locale,
  childId,
  day,
  data,
  writable,
  onTaskSaved,
}: {
  locale: Locale;
  childId: string;
  day: string;
  data: DayAgendaData;
  writable: boolean;
  onTaskSaved: (id: string, status: 'todo' | 'done') => void;
}) {
  const ko = locale === 'ko';
  if (!data.tasks.length && !data.events.length) return null;
  return (
    <div
      className="today-agenda calendar-day-lists"
      role="group"
      aria-label={`${day} ${ko ? '일정과 할 일' : 'events and tasks'}`}
    >
      {data.events.length > 0 && (
        <section className="panel events-panel selected-day-events">
          <h4 className="calendar-agenda-title">
            <CalendarDays size={15} aria-hidden="true" />
            {ko ? '일정' : 'Events'}
          </h4>
          <div className="agenda-items">
            {data.events.map((entry) => (
              <AgendaEventCard
                key={`${entry.source}:${entry.id}`}
                entry={entry}
                locale={locale}
                childId={childId}
              />
            ))}
          </div>
        </section>
      )}
      {data.tasks.length > 0 && (
        <section className="panel task-panel calendar-tasks">
          <h4 className="calendar-agenda-title">
            <Check size={15} aria-hidden="true" />
            {ko ? '할 일' : 'Tasks'}
          </h4>
          <div className="agenda-items">
            {data.tasks.map((task) => (
              <AgendaTaskCard key={task.id} task={task} locale={locale}>
                <TaskCheckbox
                  task={task}
                  locale={locale}
                  childId={childId}
                  writable={writable}
                  returnTo="today"
                  onSaved={onTaskSaved}
                />
              </AgendaTaskCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
