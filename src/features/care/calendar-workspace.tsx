import { AgendaEventCard, AgendaTaskCard } from './agenda-cards';
import { TaskCheckbox } from './task-checkbox';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  CalendarDays,
  Hospital,
  Syringe,
  Pill,
  Check,
  Trash2,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import type { CareContext } from '@/lib/data';
import { preparationTitle, type Locale } from '@/lib/domain';
import { ConfirmButton } from '@/components/confirm-button';
import { VaccinationForm } from '@/features/vaccination/form';
import { deleteVaccination } from '@/features/vaccination/actions';
import { CalendarComposer } from './calendar-composer';
import { TaskForm, EventForm, Hidden, DeleteCalendar } from './calendar-forms';
import { calendarEntry } from './calendar-model';
import { calendarTitle } from './calendar-entry';
import { calendarHref, validMonth } from './month-model';
import { loadMonthEntries, loadMonthTasks } from './month-data';
import { MonthCalendar } from './month-calendar';
import { SwipeRow } from './swipe-row';

export async function CalendarWorkspace({
  context,
  locale,
  create,
  edit,
  month: requestedMonth,
  day: requestedDay,
}: {
  context: CareContext;
  locale: Locale;
  create?: string;
  edit?: string;
  month?: string;
  day?: string;
}) {
  const t = await getTranslations(),
    ko = locale === 'ko',
    childId = context.child.id;
  const month = validMonth(requestedMonth)
    ? requestedMonth!
    : context.today.slice(0, 7);
  const parsedDay = z.iso.date().safeParse(requestedDay);
  const day =
    parsedDay.success && parsedDay.data.startsWith(month)
      ? parsedDay.data
      : context.today.startsWith(month)
        ? context.today
        : `${month}-01`;
  const [entries, tasks] = await Promise.all([
    loadMonthEntries(context, month),
    loadMonthTasks(context, month),
  ]);
  const selectedTasks = tasks.filter((task) => task.due_date === day);
  const back = calendarHref(locale, childId, day);
  const labels = ko
    ? {
        event: '일정',
        hospital: '병원',
        vaccination: '예방접종',
        medication: '투약',
        task: '할 일',
      }
    : {
        event: 'Event',
        hospital: 'Doctor',
        vaccination: 'Vaccine',
        medication: 'Medicine',
        task: 'To-do',
      };
  type Kind = keyof typeof labels;
  const selected =
    context.writable && create && Object.hasOwn(labels, create)
      ? (create as Kind)
      : undefined;
  let composerKind: Kind = selected ?? 'event';
  let form: ReactNode = null,
    title = '';
  if (context.writable && edit) {
    const [source, id] = edit.split(':');
    if (
      !z.uuid().safeParse(id).success ||
      !['task', 'event', 'vaccination'].includes(source)
    )
      notFound();
    title = ko ? '수정' : 'Edit';
    if (source === 'task') {
      composerKind = 'task';
      const result = await context.db
        .from('tasks')
        .select('*')
        .eq('id', id)
        .eq('child_id', childId)
        .maybeSingle();
      if (result.error) throw new Error('Task unavailable');
      if (!result.data) notFound();
      form = (
        <TaskForm
          context={context}
          locale={locale}
          task={result.data}
          calendarDay={day}
        />
      );
    } else if (source === 'vaccination') {
      composerKind = 'vaccination';
      const result = await context.db
        .from('vaccination_records')
        .select('*')
        .eq('id', id)
        .eq('child_id', childId)
        .maybeSingle();
      if (result.error) throw new Error('Vaccination unavailable');
      if (!result.data) notFound();
      form = (
        <VaccinationForm
          locale={locale}
          childId={childId}
          today={context.today}
          timezone={context.timezone}
          record={result.data}
          returnTo="calendar"
          calendarDay={day}
        />
      );
    } else {
      const result = await context.db
        .from('calendar_entries')
        .select('*')
        .eq('id', id)
        .eq('child_id', childId)
        .eq('source', 'event')
        .maybeSingle();
      if (result.error) throw new Error('Event unavailable');
      if (!result.data) notFound();
      composerKind =
        result.data.event_kind === 'hospital'
          ? 'hospital'
          : result.data.event_kind === 'medication'
            ? 'medication'
            : 'event';
      form = (
        <EventForm
          context={context}
          locale={locale}
          event={calendarEntry(result.data)}
          calendarDay={day}
        />
      );
    }
  } else if (selected) {
    title = labels[selected];
    form =
      selected === 'vaccination' ? (
        <VaccinationForm
          locale={locale}
          childId={childId}
          today={context.today}
          timezone={context.timezone}
          returnTo="calendar"
          defaultDate={day}
          calendarDay={day}
        />
      ) : selected === 'task' ? (
        <TaskForm
          context={context}
          locale={locale}
          service="general"
          defaultDate={day}
          calendarDay={day}
        />
      ) : (
        <EventForm
          context={context}
          locale={locale}
          kind={selected === 'event' ? 'general' : selected}
          defaultDate={day}
          calendarDay={day}
        />
      );
  }
  const rowProps = {
    enabled: context.writable,
    editLabel: t('edit'),
  };
  const selectedEntries = entries.filter((entry) => entry.date === day);
  return (
    <>
      <h1 className="visually-hidden">{t('calendar')}</h1>
      {!context.writable && <div className="flash">{t('readonly')}</div>}
      {context.writable && (
        <nav
          className="calendar-quick-actions mobile-function-rail"
          aria-label={ko ? '일정 바로 추가' : 'Add a schedule'}
        >
          {(
            [
              ['event', CalendarDays],
              ['hospital', Hospital],
              ['vaccination', Syringe],
              ['medication', Pill],
              ['task', Check],
            ] as const
          ).map(([key, Icon]) => (
            <Link
              key={key}
              className={`quick-orbit-item quick-color-${key}`}
              href={calendarHref(locale, childId, day, { create: key })}
              scroll={false}
            >
              <span className="quick-orbit-icon">
                <Icon size={26} />
              </span>
              <strong>{labels[key]}</strong>
            </Link>
          ))}
        </nav>
      )}
      <div
        className={`quick-care-layout calendar-workspace-layout ${form ? 'has-editor' : ''}`}
      >
        <section
          className="panel calendar-workspace"
          aria-label={
            ko ? '날짜별 일정과 할 일' : 'Schedules and tasks by date'
          }
        >
          <MonthCalendar
            locale={locale}
            childId={childId}
            today={context.today}
            month={month}
            day={day}
            entries={entries}
            tasks={tasks}
          />
          <section
            className="calendar-day-agenda"
            aria-label={
              ko
                ? '선택한 날짜의 일정과 할 일'
                : 'Schedules and tasks for selected date'
            }
          >
            <div className="calendar-day-lists">
              <section
                className="panel selected-day-events"
                aria-labelledby="calendar-events-title"
              >
                <h3
                  id="calendar-events-title"
                  className="calendar-agenda-title"
                >
                  <CalendarDays size={15} aria-hidden="true" />
                  {ko ? '일정' : 'Events'}
                </h3>
                {selectedEntries.length ? (
                  selectedEntries.map((entry) => {
                    const name = calendarTitle(entry, locale);
                    return (
                      <SwipeRow
                        key={`${entry.source}:${entry.id}`}
                        {...rowProps}
                        title={name}
                        editHref={calendarHref(locale, childId, day, {
                          edit: `${entry.source}:${entry.id}`,
                        })}
                        deleteAction={
                          entry.source === 'vaccination' ? (
                            <form action={deleteVaccination}>
                              <Hidden
                                locale={locale}
                                childId={childId}
                                id={entry.id}
                              />
                              <input
                                type="hidden"
                                name="returnTo"
                                value="calendar"
                              />
                              <input
                                type="hidden"
                                name="calendarDay"
                                value={day}
                              />
                              <ConfirmButton
                                label={t('delete')}
                                message={t('deleteConfirm')}
                                icon={<Trash2 size={19} aria-hidden="true" />}
                              />
                            </form>
                          ) : (
                            <DeleteCalendar
                              locale={locale}
                              childId={childId}
                              id={entry.id}
                              kind="event"
                              iconOnly
                              calendarDay={day}
                            />
                          )
                        }
                      >
                        <AgendaEventCard
                          entry={entry}
                          locale={locale}
                          childId={childId}
                        />
                      </SwipeRow>
                    );
                  })
                ) : (
                  <p className="muted calendar-empty">{t('noEvents')}</p>
                )}
              </section>
              <section
                className="panel calendar-tasks"
                aria-labelledby="calendar-tasks-title"
              >
                <h3 id="calendar-tasks-title" className="calendar-agenda-title">
                  <Check size={15} aria-hidden="true" />
                  {ko ? '할 일' : 'Tasks'}
                </h3>
                {selectedTasks.length ? (
                  selectedTasks.map((task) => (
                    <SwipeRow
                      key={task.id}
                      {...rowProps}
                      title={preparationTitle(task, locale)}
                      editHref={calendarHref(locale, childId, day, {
                        edit: `task:${task.id}`,
                      })}
                      deleteAction={
                        <DeleteCalendar
                          locale={locale}
                          childId={childId}
                          id={task.id}
                          kind="task"
                          iconOnly
                          calendarDay={day}
                        />
                      }
                    >
                      <AgendaTaskCard task={task} locale={locale}>
                        <TaskCheckbox
                          task={task}
                          locale={locale}
                          childId={childId}
                          writable={context.writable}
                        />
                      </AgendaTaskCard>
                    </SwipeRow>
                  ))
                ) : (
                  <p className="muted calendar-empty">{t('noTasks')}</p>
                )}
              </section>
            </div>
          </section>
        </section>
        {form && (
          <div className="quick-editor-host">
            <CalendarComposer
              key={`${childId}:${edit ?? selected}`}
              title={title}
              back={back}
              kind={composerKind}
            >
              {form}
            </CalendarComposer>
          </div>
        )}
      </div>
    </>
  );
}
