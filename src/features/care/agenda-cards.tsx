import Link from 'next/link';
import type { ReactNode } from 'react';
import { type Locale } from '@/lib/domain';
import { calendarKind, calendarTitle } from './calendar-entry';
import type { CalendarEntry } from './calendar-model';
import type { AgendaTask } from './day-agenda-model';

export function AgendaEventCard({
  entry,
  locale,
  childId,
}: {
  entry: CalendarEntry;
  locale: Locale;
  childId: string;
}) {
  const ko = locale === 'ko';
  const name = calendarTitle(entry, locale);
  return (
    <article
      className={`calendar-event agenda-event calendar-kind-${entry.event_kind}`}
    >
      <div className="calendar-event-summary">
        <span className="calendar-event-meta">
          <span>
            {entry.event_time?.slice(0, 5) ?? (ko ? '종일' : 'All day')}
          </span>
          <span>
            {calendarKind(entry.event_kind, locale)}
            {entry.status === 'completed' ? ` · ${ko ? '완료' : 'Done'}` : ''}
          </span>
        </span>
        <strong>
          {entry.source === 'vaccination' ? (
            <Link
              href={`/${locale}/vaccination/${entry.id}?child=${childId}`}
              draggable={false}
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </strong>
      </div>
      {(entry.clinic || entry.note) && (
        <p>{[entry.clinic, entry.note].filter(Boolean).join(' · ')}</p>
      )}
    </article>
  );
}
export function AgendaTaskCard({
  task,
  locale,
  children,
}: {
  task: AgendaTask;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <article
      className={`calendar-task ${task.status === 'done' ? 'is-done' : ''}`}
    >
      {children}
      <div className="calendar-task-main">
        <strong>{task.title}</strong>
        {task.status === 'snoozed' && (
          <div className="calendar-row-meta">
            <span>{locale === 'ko' ? '미룸' : 'Snoozed'}</span>
          </div>
        )}
      </div>
    </article>
  );
}
