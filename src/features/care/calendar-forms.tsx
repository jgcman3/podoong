import { getTranslations } from 'next-intl/server';
import { saveTask, saveEvent, deleteCalendar } from './actions';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { services, preparationTitle } from '@/lib/domain';
import type { Row } from '@/lib/db';
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
export async function TaskForm({
  context,
  locale,
  task,
  service,
}: {
  context: CareContext;
  locale: Locale;
  task?: Row<'tasks'>;
  service?: string;
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
      <label>
        {t('title')}
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={task ? preparationTitle(task, locale) : undefined}
        />
      </label>
      <div className="form-row">
        <label>
          {t('date')}
          <input name="date" type="date" defaultValue={task?.due_date ?? ''} />
        </label>
        <label>
          {t('service')}
          <select
            name="service"
            defaultValue={task?.service ?? service ?? 'birth'}
          >
            {services.map(([key]) => (
              <option key={key} value={key}>
                {t(`serviceNames.${key}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
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
      <button className="button primary">{t('save')}</button>
    </form>
  );
}
export async function EventForm({
  context,
  locale,
  event,
}: {
  context: CareContext;
  locale: Locale;
  event?: Row<'events'>;
}) {
  const t = await getTranslations();
  return (
    <form action={saveEvent} className="form-stack">
      <Hidden
        locale={locale}
        childId={context.child.id}
        id={event?.id ?? crypto.randomUUID()}
      />
      <label>
        {t('title')}
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
          defaultValue={event?.date ?? context.today}
        />
      </label>
      <label>
        {t('note')}
        <textarea name="note" maxLength={2000} defaultValue={event?.note} />
      </label>
      <button className="button primary">{t('save')}</button>
    </form>
  );
}
export async function DeleteCalendar({
  locale,
  childId,
  id,
  kind,
}: {
  locale: Locale;
  childId: string;
  id: string;
  kind: 'task' | 'event';
}) {
  const t = await getTranslations();
  return (
    <form action={deleteCalendar}>
      <Hidden locale={locale} childId={childId} id={id} />
      <input type="hidden" name="kind" value={kind} />
      <ConfirmButton label={t('delete')} message={t('deleteConfirm')} />
    </form>
  );
}
