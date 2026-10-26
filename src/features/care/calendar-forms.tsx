import { Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { saveTask, saveEvent, deleteCalendar } from './actions';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { services, preparationTitle } from '@/lib/domain';
import type { Row } from '@/lib/db';
import type { CalendarEntry } from './calendar-model';
import { ConfirmButton } from '@/components/confirm-button';
export function Hidden({
  locale,
  childId,
  id,
}: {
  locale: Locale;
  childId: string;
  id?: string;
}) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="childId" value={childId} />
      {id && <input type="hidden" name="id" value={id} />}
    </>
  );
}
function MoreFields({
  simple,
  locale,
  children,
}: {
  simple: boolean;
  locale: Locale;
  children: ReactNode;
}) {
  return simple ? (
    <details className="calendar-more-fields">
      <summary>{locale === 'ko' ? '상세 설정' : 'More options'}</summary>
      <div className="form-stack">{children}</div>
    </details>
  ) : (
    <>{children}</>
  );
}
export async function TaskForm({
  context,
  locale,
  task,
  service,
  defaultDate,
  calendarDay,
}: {
  context: CareContext;
  locale: Locale;
  task?: Row<'tasks'>;
  service?: string;
  defaultDate?: string;
  calendarDay?: string;
}) {
  const t = await getTranslations();
  const { child, caregivers, user } = context;
  return (
    <form action={saveTask} className="form-stack">
      <Hidden
        locale={locale}
        childId={child.id}
        id={task?.id ?? crypto.randomUUID()}
      />
      <input type="hidden" name="calendarDay" value={calendarDay ?? ''} />
      <label>
        {t('title')}
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={task ? preparationTitle(task, locale) : undefined}
        />
      </label>
      <label>
        {t('date')}
        <input
          name="date"
          type="date"
          defaultValue={task?.due_date ?? defaultDate ?? ''}
        />
      </label>
      <MoreFields simple={Boolean(calendarDay) && !task} locale={locale}>
        <label>
          {t('service')}
          <select
            name="service"
            defaultValue={task?.service ?? service ?? 'birth'}
          >
            <option value="general">{t('serviceNames.general')}</option>
            {services.map(([key]) => (
              <option key={key} value={key}>
                {t(`serviceNames.${key}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            {t('assignee')}
            <select name="assignee" defaultValue={task?.assignee_id ?? ''}>
              <option value="">{t('unassigned')}</option>
              {caregivers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === user.id ? t('me') : m.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('todo')}
            <select name="status" defaultValue={task?.status ?? 'todo'}>
              {(['todo', 'done', 'snoozed'] as const).map((k) => (
                <option key={k} value={k}>
                  {t(k)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </MoreFields>
      <button className="button primary">{t('save')}</button>
    </form>
  );
}
export async function EventForm({
  context,
  locale,
  event,
  kind,
  defaultDate,
  calendarDay,
}: {
  context: CareContext;
  locale: Locale;
  event?: CalendarEntry;
  kind?: 'general' | 'hospital' | 'medication';
  defaultDate?: string;
  calendarDay?: string;
}) {
  const t = await getTranslations();
  const eventKind = event?.event_kind ?? kind ?? 'general';
  const ko = locale === 'ko';
  return (
    <form action={saveEvent} className="form-stack">
      <Hidden
        locale={locale}
        childId={context.child.id}
        id={event?.id ?? crypto.randomUUID()}
      />
      <input type="hidden" name="calendarDay" value={calendarDay ?? ''} />
      <input type="hidden" name="eventKind" value={eventKind} />
      <input
        type="hidden"
        name="eventTimezone"
        value={event?.record_timezone ?? context.timezone}
      />
      <label>
        {eventKind === 'hospital'
          ? ko
            ? '병원 이름·방문 목적'
            : 'Clinic / reason'
          : eventKind === 'medication'
            ? ko
              ? '약 이름'
              : 'Medicine'
            : t('title')}
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={event?.title}
        />
      </label>
      <label>
        {t('date')}
        <input
          name="date"
          type="date"
          required
          defaultValue={event?.date ?? defaultDate ?? context.today}
        />
      </label>
      <label>
        {ko ? '시간 (선택)' : 'Time (optional)'}
        <input
          type="time"
          name="eventTime"
          defaultValue={event?.event_time?.slice(0, 5) ?? ''}
        />
      </label>
      <MoreFields simple={Boolean(calendarDay)} locale={locale}>
        <label>
          {eventKind === 'medication'
            ? ko
              ? '복용량·메모'
              : 'Dose / notes'
            : t('note')}
          <textarea name="note" maxLength={2000} defaultValue={event?.note} />
        </label>
      </MoreFields>
      <button className="button primary">{t('save')}</button>
    </form>
  );
}
export async function DeleteCalendar({
  locale,
  childId,
  id,
  kind,
  calendarDay,
  iconOnly = false,
}: {
  locale: Locale;
  childId: string;
  id: string;
  kind: 'task' | 'event';
  calendarDay?: string;
  iconOnly?: boolean;
}) {
  const t = await getTranslations();
  return (
    <form action={deleteCalendar}>
      <Hidden locale={locale} childId={childId} id={id} />
      <input type="hidden" name="calendarDay" value={calendarDay ?? ''} />
      <input type="hidden" name="kind" value={kind} />
      <ConfirmButton
        label={t('delete')}
        message={t('deleteConfirm')}
        icon={iconOnly ? <Trash2 size={19} aria-hidden="true" /> : undefined}
      />
    </form>
  );
}
