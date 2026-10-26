import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Row } from '@/lib/db';
import type { Locale } from '@/lib/domain';
import type { CalendarEntry } from './calendar-model';
import { monthDays, shiftMonth, calendarHref } from './month-model';
export function MonthCalendar({
  locale,
  childId,
  today,
  month,
  day,
  entries,
  tasks,
}: {
  locale: Locale;
  childId: string;
  today: string;
  month: string;
  day: string;
  entries: CalendarEntry[];
  tasks: Row<'tasks'>[];
}) {
  const ko = locale === 'ko',
    days = monthDays(month),
    counts = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const list = counts.get(entry.date) ?? [];
    list.push(entry);
    counts.set(entry.date, list);
  }
  const taskCounts = new Map<string, Row<'tasks'>[]>();
  for (const task of tasks) {
    if (!task.due_date) continue;
    const list = taskCounts.get(task.due_date) ?? [];
    list.push(task);
    taskCounts.set(task.due_date, list);
  }
  const label = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
  return (
    <section
      className="panel month-calendar"
      aria-label={ko ? '월간 일정' : 'Monthly schedule'}
    >
      <header>
        <Link
          aria-label={ko ? '이전 달' : 'Previous month'}
          href={calendarHref(locale, childId, `${shiftMonth(month, -1)}-01`)}
          scroll={false}
          prefetch={false}
        >
          <ChevronLeft size={20} />
        </Link>
        <h2>{label}</h2>
        <Link
          aria-label={ko ? '다음 달' : 'Next month'}
          href={calendarHref(locale, childId, `${shiftMonth(month, 1)}-01`)}
          scroll={false}
          prefetch={false}
        >
          <ChevronRight size={20} />
        </Link>
        <Link
          className="month-today"
          href={calendarHref(locale, childId, today)}
          scroll={false}
          prefetch={false}
        >
          {ko ? '오늘' : 'Today'}
        </Link>
      </header>
      <table>
        <thead>
          <tr>
            {(ko
              ? ['일', '월', '화', '수', '목', '금', '토']
              : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            ).map((label, i) => (
              <th key={i} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: days.length / 7 }, (_, week) => (
            <tr key={week}>
              {days.slice(week * 7, week * 7 + 7).map((date) => {
                const dayTasks = taskCounts.get(date) ?? [];
                const list = counts.get(date) ?? [],
                  inMonth = date.startsWith(month);
                const visibleEntries = list.slice(0, dayTasks.length ? 2 : 3);
                const extraCount =
                  list.length +
                  dayTasks.length -
                  visibleEntries.length -
                  (dayTasks.length ? 1 : 0);
                return (
                  <td key={date}>
                    <Link
                      className={`month-day ${date === day ? 'selected' : ''} ${date === today ? 'is-today' : ''} ${inMonth ? '' : 'other-month'}`}
                      href={calendarHref(locale, childId, date)}
                      scroll={false}
                      prefetch={false}
                      aria-label={
                        inMonth
                          ? `${date} · ${ko ? `일정 ${list.length}건` : `${list.length} events`}${dayTasks.length ? (ko ? ` · 할 일 ${dayTasks.length}건` : ` · ${dayTasks.length} tasks`) : ''}`
                          : date
                      }
                      aria-current={date === day ? 'date' : undefined}
                      data-date={date}
                    >
                      <span>{Number(date.slice(8))}</span>
                      <i className="month-markers" aria-hidden="true">
                        {visibleEntries.map((entry) => (
                          <b
                            key={`${entry.source}:${entry.id}`}
                            className={`marker-${entry.event_kind}`}
                          />
                        ))}
                        {dayTasks.length > 0 && <b className="marker-task" />}
                        {extraCount > 0 && <small>+{extraCount}</small>}
                      </i>
                    </Link>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
