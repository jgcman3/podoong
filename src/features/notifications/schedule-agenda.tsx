import Link from 'next/link';
import { CalendarDays, CheckSquare, ChevronRight } from 'lucide-react';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
export async function ScheduleAgenda({
  context,
  locale,
  day,
}: {
  context: CareContext;
  locale: Locale;
  day: string;
}) {
  const { data, error } = await context.db.rpc('my_schedule_items', {
    p_day: day,
  });
  if (error) throw new Error('Schedule unavailable');
  const items = [...(data ?? [])].sort(
    (a, b) =>
      (a.event_time ?? '99:99').localeCompare(b.event_time ?? '99:99') ||
      a.title.localeCompare(b.title),
  );
  const ko = locale === 'ko';
  return (
    <section className="panel schedule-agenda">
      <header>
        <CalendarDays size={22} />
        <div>
          <h1>
            {day === context.today
              ? ko
                ? '오늘의 일정'
                : 'Today’s plans'
              : ko
                ? '이날의 일정'
                : 'Plans for this day'}
          </h1>
          <p className="small muted">
            {day} · {ko ? `${items.length}개` : `${items.length} plans`}
          </p>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="muted">
          {ko
            ? '등록된 일정이나 할 일이 없어요.'
            : 'No plans or tasks for this day.'}
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              {item.kind === 'task' ? (
                <CheckSquare size={19} />
              ) : (
                <CalendarDays size={19} />
              )}
              <div>
                <small className="muted">
                  {context.children.find((c) => c.id === item.child_id)?.name} ·{' '}
                  {item.event_time?.slice(0, 5) ?? (ko ? '종일' : 'All day')}
                </small>
                <strong>{item.title}</strong>
              </div>
              <Link
                href={`/${locale}/calendar?child=${item.child_id}&day=${day}`}
                aria-label={ko ? '일정에서 보기' : 'View in calendar'}
              >
                <ChevronRight size={19} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        className="button secondary"
        href={`/${locale}/calendar?child=${context.child.id}&day=${day}`}
      >
        {ko ? '달력으로 보기' : 'View calendar'}
      </Link>
    </section>
  );
}
