import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Milk,
  Utensils,
  Moon,
  Baby,
  Ruler,
  Clock,
  ArrowUpRight,
  CalendarDays,
  Check,
  Plus,
  Sparkles,
  Heart,
  Backpack,
  FileCheck,
  Users,
  Grid2X2,
  ChevronRight,
} from 'lucide-react';
import { Nest } from '@/components/nest';
import { ConfirmButton } from '@/components/confirm-button';
import type { CareContext } from '@/lib/data';
import { services, preparationTitle, type Locale } from '@/lib/domain';
import { RecordForm, Timer } from '@/features/care/record-form';
import { ResidenceForm } from '@/features/family/residence-form';
import { relativeDay } from '@/features/care/calendar-model';
import { NextMeals } from '@/features/care/next-meals';
import { MealPlanEditor } from '@/features/care/meal-plan-editor';
import { ChildRecordList } from '@/features/child-care/views';
import {
  VaccinationList,
  UpcomingVaccinations,
} from '@/features/vaccination/views';
import { isChildService } from '@/features/child-care/schema';
import {
  quickFeedingKinds,
  isFood,
  isFeedingKind,
} from '@/features/care/feeding-record';
import { saveTask, addTemplates, deleteRecord } from '@/features/care/actions';
import {
  TaskForm,
  EventForm,
  Hidden,
  DeleteCalendar,
} from '@/features/care/calendar-forms';
import {
  createInvite,
  revoke,
  previewDates,
  addChild,
} from '@/features/family/actions';
import { SocialButtons } from '@/components/social-buttons';
import { logout, unlinkIdentity } from '@/features/auth/actions';
import { cookies } from 'next/headers';
import type { Row } from '@/lib/db';
type Props = { context: CareContext; locale: Locale };
const glyphs: Record<string, typeof Milk> = {
  pregnancy: Sparkles,
  birth: Backpack,
  administration: FileCheck,
  postpartum: Heart,
  feeding: Milk,
  sleep: Moon,
  diaper: Baby,
  growth: Ruler,
  health: CalendarDays,
  support: Heart,
  community: Users,
};
export function formatTime(iso: string, locale: Locale, timezone: string) {
  return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(iso));
}
function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}
function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Heart size={22} />
      </span>
      <strong>{title}</strong>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
async function Pagination({
  context,
  locale,
  path,
}: {
  context: CareContext;
  locale: Locale;
  path: string;
}) {
  const t = await getTranslations();
  return (
    <nav className="pagination" aria-label={t('pages')}>
      {context.page > 0 && (
        <Link
          className="button secondary"
          href={`/${locale}/${path}?child=${context.child.id}&page=${context.page - 1}`}
        >
          {t('previous')}
        </Link>
      )}
      {context.hasMore && (
        <Link
          className="button secondary"
          href={`/${locale}/${path}?child=${context.child.id}&page=${context.page + 1}`}
        >
          {t('nextPage')}
        </Link>
      )}
    </nav>
  );
}
export async function TaskList({
  context,
  locale,
  tasks,
  compact = false,
}: {
  context: CareContext;
  locale: Locale;
  tasks: Row<'tasks'>[];
  compact?: boolean;
}) {
  const t = await getTranslations();
  return (
    <div className="task-list">
      {tasks.map((task) => (
        <article
          className={`task-row ${task.status === 'done' ? 'completed' : ''}`}
          key={task.id}
        >
          <div
            className={`task-check ${task.status === 'done' ? 'checked' : ''}`}
          >
            {task.status === 'done' ? <Check size={15} /> : <span />}
          </div>
          <div className="task-main">
            <strong>{preparationTitle(task, locale)}</strong>
            <div className="task-meta">
              <span>{t(`serviceNames.${task.service}`)}</span>
              <span
                className={
                  task.due_date &&
                  task.due_date < context.today &&
                  task.status === 'todo'
                    ? 'overdue'
                    : ''
                }
              >
                {task.due_date ?? '—'}
              </span>
              <span>{t(task.source)}</span>
              {task.assignee_id && (
                <span>
                  {t('assignee')}:{' '}
                  {task.assignee_id === context.user.id
                    ? t('me')
                    : (context.caregivers.find(
                        (m) => m.user_id === task.assignee_id,
                      )?.display_name ?? t('formerMember'))}
                </span>
              )}
            </div>
            {!compact && context.writable && (
              <details className="edit-details">
                <summary>{t('edit')}</summary>
                <TaskForm context={context} locale={locale} task={task} />
                <DeleteCalendar
                  locale={locale}
                  childId={context.child.id}
                  id={task.id}
                  kind="task"
                />
              </details>
            )}
          </div>
          <span className={`badge ${task.status}`}>{t(task.status)}</span>
          {context.writable && (
            <form action={saveTask}>
              <Hidden locale={locale} childId={context.child.id} id={task.id} />
              <input type="hidden" name="title" value={task.title} />
              <input type="hidden" name="service" value={task.service} />
              <input type="hidden" name="date" value={task.due_date ?? ''} />
              <input
                type="hidden"
                name="assignee"
                value={task.assignee_id ?? ''}
              />
              <input
                type="hidden"
                name="status"
                value={task.status === 'done' ? 'todo' : 'done'}
              />
              <button
                className="round-button"
                aria-label={
                  task.status === 'done' ? t('reopen') : t('complete')
                }
              >
                <Check size={17} />
              </button>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}
export async function Today({ context, locale }: Props) {
  const t = await getTranslations();
  const { child, tasks, events, timezone, today } = context;
  const [latestResult, milkResult, mealResult] = await Promise.all([
    context.db
      .from('care_records')
      .select('*')
      .eq('child_id', child.id)
      .in('kind', quickFeedingKinds)
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from('care_records')
      .select('*')
      .eq('child_id', child.id)
      .in('kind', ['breast', 'formula'])
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from('child_meal_plans')
      .select('*')
      .eq('child_id', child.id)
      .maybeSingle(),
  ]);
  if (latestResult.error || milkResult.error)
    throw new Error('Latest feeding unavailable');
  const latest = latestResult.data;
  if (mealResult.error && mealResult.error.code !== 'PGRST205')
    throw new Error('Meal plan unavailable');
  const mealPlan = mealResult.data
    ? {
        feedingMinutes: mealResult.data.feeding_minutes,
        solids: mealResult.data.solids_times,
      }
    : null;
  const upcoming = events.filter((e) => e.date >= today).slice(0, 4);
  const priority = tasks.filter((v) => v.status === 'todo').slice(0, 3);
  return (
    <>
      <section className="today-hero">
        <div>
          <span className="eyebrow">YOUR FAMILY, YOUR PACE</span>
          <h1>{t('hello')}</h1>
          <p>{t('helloSub')}</p>
          <Link
            href={`/${locale}/family?child=${child.id}`}
            className="hero-link"
          >
            <Users size={16} />
            {t('invite')}
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <Nest large />
      </section>
      <NextMeals
        key={`${context.user.id}:${child.id}:${JSON.stringify(mealPlan)}`}
        locale={locale}
        childId={child.id}
        plan={mealPlan}
        available={!mealResult.error}
        timezone={mealResult.data?.timezone ?? timezone}
        latest={milkResult.data}
        now={new Date().toISOString()}
      />
      <div className="section-heading">
        <h2>{t('quickRecord')}</h2>
        <span>{t('quickRecordSub')}</span>
      </div>
      <div className="quick-grid">
        {quickFeedingKinds.map((kind, index) => (
          <Link
            className={`quick-card quick-${index}`}
            href={`/${locale}/records?child=${child.id}&kind=${kind}`}
            key={kind}
          >
            <span className="quick-icon">
              {isFood(kind) ? <Utensils size={23} /> : <Milk size={23} />}
            </span>
            <strong>{t(kind)}</strong>
            <span className="quick-add">
              <Plus size={18} />
            </span>
          </Link>
        ))}
        {(
          [
            ['sleep', Moon],
            ['diaper', Baby],
            ['growth', Ruler],
          ] as const
        ).map(([service, Icon], index) => (
          <Link
            className={`quick-card quick-${index}`}
            key={service}
            href={
              context.writable
                ? `/${locale}/care/${service}/new?child=${child.id}`
                : `/${locale}/services/${service}?child=${child.id}`
            }
          >
            <span className="quick-icon">
              <Icon size={23} />
            </span>
            <strong>{t(`serviceNames.${service}`)}</strong>
            <span className="quick-add">
              <Plus size={18} />
            </span>
          </Link>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel task-panel">
          <div className="panel-heading">
            <h2>
              <Check size={19} />
              {t('topTasks')}
            </h2>
            <Link href={`/${locale}/calendar?child=${child.id}`}>
              {t('allTasks')}
              <ChevronRight size={15} />
            </Link>
          </div>
          {priority.length ? (
            <TaskList
              context={context}
              locale={locale}
              tasks={priority}
              compact
            />
          ) : (
            <Empty title={t('noTasks')} subtitle={t('noTasksSub')} />
          )}
        </section>
        <section className="panel last-panel">
          <div className="panel-heading">
            <h2>
              <Clock size={19} />
              {t('lastFeeding')}
            </h2>
          </div>
          {latest ? (
            <>
              <div className="last-kind">{t(latest.kind)}</div>
              <div className="last-time">
                {formatTime(latest.started_at, locale, timezone)}
              </div>
              <div className="last-detail">
                {(isFood(latest.kind) ? latest.amount_g : latest.amount_ml) !==
                null
                  ? `${isFood(latest.kind) ? latest.amount_g : latest.amount_ml} ${isFood(latest.kind) ? 'g' : 'ml'}`
                  : latest.ended_at
                    ? `${Math.round((Date.parse(latest.ended_at) - Date.parse(latest.started_at)) / 60000)} min`
                    : t('running')}
              </div>
              <span className="small muted">
                {t('author')}:{' '}
                {latest.created_by === context.user.id
                  ? context.profile.display_name
                  : (context.caregivers.find(
                      (m) => m.user_id === latest.created_by,
                    )?.display_name ?? t('formerMember'))}
              </span>
            </>
          ) : (
            <Empty title={t('notYet')} />
          )}
        </section>
      </div>
      <section className="panel events-panel">
        <div className="panel-heading">
          <h2>
            <CalendarDays size={19} />
            {t('weekEvents')}
          </h2>
          <Link href={`/${locale}/calendar?child=${child.id}`}>
            {t('allEvents')}
            <ChevronRight size={15} />
          </Link>
        </div>
        {upcoming.length ? (
          <div className="event-grid">
            {upcoming.map((e) => (
              <article className="event-tile" key={e.id}>
                <div className="event-date">
                  <span>{e.date.slice(5, 7)}</span>
                  <strong>{e.date.slice(8)}</strong>
                </div>
                <div>
                  <strong>{e.title}</strong>
                  <span className="event-countdown">
                    {relativeDay(e.date, today, locale)}
                  </span>
                  <p>{e.note || t('manual')}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title={t('noEvents')} subtitle={t('noEventsSub')} />
        )}
      </section>
      <UpcomingVaccinations context={context} locale={locale} />
      <div className="gentle-banner">
        <Heart size={23} />
        <div>
          <strong>{t('helpTitle')}</strong>
          <p>{t('helpBody')}</p>
        </div>
      </div>
    </>
  );
}
export async function Records({
  context,
  locale,
  edit,
  kind,
}: {
  context: CareContext;
  locale: Locale;
  edit?: string;
  kind?: string;
}) {
  const t = await getTranslations();
  const selected = context.records.find((r) => r.id === edit);
  const mealResult = await context.db
    .from('child_meal_plans')
    .select('*')
    .eq('child_id', context.child.id)
    .maybeSingle();
  if (mealResult.error && mealResult.error.code !== 'PGRST205')
    throw new Error('Meal plan unavailable');
  const mealPlan = mealResult.data
    ? {
        feedingMinutes: mealResult.data.feeding_minutes,
        solids: mealResult.data.solids_times,
      }
    : null;
  return (
    <>
      <PageHeading title={t('records')} subtitle={t('quickRecordSub')} />
      {!context.writable && <div className="flash">{t('readonly')}</div>}
      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <Milk size={19} />
              {selected ? t('edit') : t('quickRecord')}
            </h2>
          </div>
          {context.writable && (
            <RecordForm
              key={selected?.id ?? crypto.randomUUID()}
              locale={locale}
              childId={context.child.id}
              record={selected}
              defaultKind={isFeedingKind(kind) ? kind : 'breast'}
              now={new Date().toISOString()}
            />
          )}
          {context.writable && (
            <MealPlanEditor
              key={`${context.child.id}:${JSON.stringify(mealPlan)}`}
              locale={locale}
              childId={context.child.id}
              plan={mealPlan}
              timezone={mealResult.data?.timezone ?? context.timezone}
              available={!mealResult.error}
            />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <Clock size={19} />
              {t('history')}
            </h2>
          </div>
          {context.records.length ? (
            <div className="record-list">
              {context.records.map((r) => (
                <article key={r.id} className="record-row">
                  <div className="record-icon">
                    {isFood(r.kind) ? (
                      <Utensils size={20} />
                    ) : (
                      <Milk size={20} />
                    )}
                  </div>
                  <div className="record-info">
                    <strong>{t(r.kind)}</strong>
                    <span>
                      {formatTime(r.started_at, locale, context.timezone)}
                    </span>
                    {r.ended_at ? (
                      <span className="record-amount">
                        {isFood(r.kind)
                          ? r.amount_g != null
                            ? `${r.amount_g} g · `
                            : ''
                          : r.amount_ml !== null
                            ? `${r.amount_ml} ml · `
                            : ''}
                        {Math.round(
                          (Date.parse(r.ended_at) - Date.parse(r.started_at)) /
                            60000,
                        )}{' '}
                        min
                      </span>
                    ) : (
                      <Timer start={r.started_at} />
                    )}
                    {r.food_name && <p>{r.food_name}</p>}
                    <p>{r.note}</p>
                    <span className="small muted">
                      {t('author')}:{' '}
                      {r.created_by === context.user.id
                        ? context.profile.display_name
                        : (context.caregivers.find(
                            (m) => m.user_id === r.created_by,
                          )?.display_name ?? t('formerMember'))}
                    </span>
                  </div>
                  {context.writable && (
                    <div className="record-actions">
                      <Link
                        href={`/${locale}/records?child=${context.child.id}&page=${context.page}&edit=${r.id}`}
                        className="text-link"
                      >
                        {r.ended_at ? t('edit') : t('stopTimer')}
                      </Link>
                      <form action={deleteRecord}>
                        <Hidden
                          locale={locale}
                          childId={context.child.id}
                          id={r.id}
                        />
                        <ConfirmButton
                          label={t('delete')}
                          message={t('deleteConfirm')}
                        />
                      </form>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty title={t('empty')} subtitle={t('emptySub')} />
          )}
        </section>
      </div>
      <Pagination context={context} locale={locale} path="records" />
    </>
  );
}
export async function Calendar({
  context,
  locale,
  service,
}: {
  context: CareContext;
  locale: Locale;
  service?: string;
}) {
  const t = await getTranslations();
  const tasks = service
    ? context.tasks.filter((v) => v.service === service)
    : context.tasks;
  return (
    <>
      <PageHeading
        title={service ? t(`serviceNames.${service}`) : t('calendar')}
        subtitle={t('prepSub')}
      />
      {!context.writable && <div className="flash">{t('readonly')}</div>}
      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('topTasks')}</h2>
          </div>
          {context.writable && (
            <details className="add-details">
              <summary>
                <Plus size={17} />
                {t('addTask')}
              </summary>
              <TaskForm context={context} locale={locale} service={service} />
            </details>
          )}
          {tasks.length ? (
            <TaskList context={context} locale={locale} tasks={tasks} />
          ) : (
            <Empty title={t('noTasks')} subtitle={t('noTasksSub')} />
          )}
          <div className="starter-checklist">
            <p>{t('templateHelp')}</p>
            {context.writable && (
              <form action={addTemplates}>
                <Hidden locale={locale} childId={context.child.id} />
                <button className="button secondary">{t('templates')}</button>
              </form>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('weekEvents')}</h2>
          </div>
          {context.writable && (
            <details className="add-details">
              <summary>
                <Plus size={17} />
                {t('addEvent')}
              </summary>
              <EventForm context={context} locale={locale} />
            </details>
          )}
          {context.events.length ? (
            context.events.map((e) => (
              <article className="calendar-event" key={e.id}>
                <strong>{e.title}</strong>
                <span className="badge">{e.date}</span>
                <p>{e.note}</p>
                {context.writable && (
                  <details className="edit-details">
                    <summary>{t('edit')}</summary>
                    <EventForm context={context} locale={locale} event={e} />
                    <DeleteCalendar
                      locale={locale}
                      childId={context.child.id}
                      id={e.id}
                      kind="event"
                    />
                  </details>
                )}
              </article>
            ))
          ) : (
            <Empty title={t('noEvents')} subtitle={t('noEventsSub')} />
          )}
        </section>
      </div>
      <Pagination
        context={context}
        locale={locale}
        path={service ? `services/${service}` : 'calendar'}
      />
      {!service && <UpcomingVaccinations context={context} locale={locale} />}
    </>
  );
}
export async function Services({ context, locale }: Props) {
  const t = await getTranslations();
  return (
    <>
      <PageHeading title={t('services')} subtitle={t('servicesSub')} />
      <div className="services-grid">
        {services.map(([key, , status]) => {
          const Icon = glyphs[key] ?? Grid2X2;
          return (
            <Link
              className={`service-card ${status === 'planned' ? 'planned-card' : ''}`}
              href={
                key === 'community' || key === 'polls'
                  ? `/${locale}/${key}`
                  : `/${locale}/services/${key}?child=${context.child.id}`
              }
              key={key}
            >
              <span className="service-icon">
                <Icon size={24} />
              </span>
              {status === 'planned' && (
                <span className="badge planned">{t('planned')}</span>
              )}
              <h2>{t(`serviceNames.${key}`)}</h2>
              <ChevronRight size={17} />
            </Link>
          );
        })}
      </div>
    </>
  );
}
export async function ServiceDetail({
  context,
  locale,
  service,
  page,
  tab,
}: {
  context: CareContext;
  locale: Locale;
  service: string;
  page?: string;
  tab?: string;
}) {
  const t = await getTranslations();
  const item = services.find((v) => v[0] === service);
  if (!item) return null;
  if (service === 'vaccination')
    return (
      <VaccinationList
        context={context}
        locale={locale}
        page={page}
        tab={tab}
      />
    );
  if (isChildService(service))
    return (
      <ChildRecordList
        context={context}
        locale={locale}
        service={service}
        page={page}
      />
    );
  if (service === 'feeding')
    return <Records context={context} locale={locale} />;
  if (item[2] === 'planned')
    return (
      <>
        <PageHeading
          title={t(`serviceNames.${service}`)}
          subtitle={t('planned')}
        />
        <section className="panel">
          <Nest />
          <Empty title={t('planned')} subtitle={t('servicesSub')} />
        </section>
      </>
    );
  const { data: content, error } = await context.db
    .from('content_items')
    .select('*,content_translations(*)')
    .eq('service', service)
    .eq('status', 'published');
  if (error) throw new Error('Content unavailable');
  const links: Record<string, string> = {
    administration: 'https://www.gov.kr/',
    support: 'https://www.bokjiro.go.kr/',
    health: 'https://www.nhis.or.kr/',
  };
  return (
    <>
      {content?.length ? (
        <section className="panel content-guide">
          {content.map((c) => {
            const v = c.content_translations.find((v) => v.locale === locale);
            return v ? (
              <article key={c.key}>
                <h2>{v.title}</h2>
                <p>{v.body}</p>
                <p className="small muted">
                  {t('source')}: {c.region} · {c.last_reviewed_at} ·{' '}
                  {c.reviewer}
                </p>
                {c.source_url && (
                  <a
                    className="text-link"
                    href={c.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('official')}
                    <ArrowUpRight size={15} />
                  </a>
                )}
              </article>
            ) : null;
          })}
        </section>
      ) : links[service] ? (
        <section className="panel content-guide">
          <h2>{t('contentPending')}</h2>
          <p>{t('contentPendingSub')}</p>
          <a
            className="button secondary"
            href={links[service]}
            target="_blank"
            rel="noreferrer"
          >
            {t('official')}
            <ArrowUpRight size={16} />
          </a>
          <p className="small muted">{t('externalNote')}</p>
        </section>
      ) : null}
      <Calendar context={context} locale={locale} service={service} />
    </>
  );
}
export async function Family({ context, locale }: Props) {
  const t = await getTranslations();
  const { child, owner, members } = context;
  const { data: invitations } = owner
    ? await context.db
        .from('invitations')
        .select('id,role,expires_at,accepted_at,revoked_at')
        .eq('family_id', child.family_id)
        .order('expires_at', { ascending: false })
    : { data: [] };
  const token = (await cookies()).get('podung_invite')?.value;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://127.0.0.1:3187';
  return (
    <>
      <PageHeading title={t('family')} subtitle={t('tagline')} />
      <section className="panel family-residence">
        <div className="panel-heading">
          <h2>{t('familyResidence')}</h2>
          <span className="small muted">{context.family.name}</span>
        </div>
        <p>{t('residenceHelp')}</p>
        {owner ? (
          <ResidenceForm
            key={`${context.family.id}:${context.family.residence_version}`}
            family={context.family}
            childId={child.id}
            locale={locale}
          />
        ) : (
          <>
            <p>
              <strong>
                {context.family.residence_city &&
                context.family.residence_locality
                  ? `${context.family.residence_city} ${context.family.residence_locality}`
                  : t('residenceEmpty')}
              </strong>
            </p>
            <p className="small muted">{t('residenceOwnerOnly')}</p>
          </>
        )}
      </section>
      <div className="two-column">
        <section className="panel">
          <h2>{t('members')}</h2>
          {members.map((m) => (
            <div className="member-row" key={m.user_id}>
              <span className="avatar">
                {m.user_id === context.user.id ? (
                  context.profile.display_name.slice(0, 1)
                ) : (
                  <Users size={18} />
                )}
              </span>
              <div>
                <strong>
                  {m.user_id === context.user.id
                    ? context.profile.display_name
                    : (context.caregivers.find((c) => c.user_id === m.user_id)
                        ?.display_name ?? t('otherChildMember'))}
                </strong>
                <span>{t(m.role)}</span>
              </div>
              {owner && m.role !== 'owner' && (
                <form action={revoke}>
                  <Hidden locale={locale} childId={child.id} />
                  <input name="id" type="hidden" value={m.user_id} />
                  <input
                    name="familyId"
                    type="hidden"
                    value={child.family_id}
                  />
                  <ConfirmButton label={t('revoke')} message={t('revoke')} />
                </form>
              )}
            </div>
          ))}
        </section>
        {owner && (
          <section className="panel">
            <h2>{t('invite')}</h2>
            <p>{t('inviteSub')}</p>
            <form action={createInvite} className="form-stack">
              <Hidden locale={locale} childId={child.id} />
              <label>
                {t('role')}
                <select name="role">
                  <option value="editor">{t('editor')}</option>
                  <option value="viewer">{t('viewer')}</option>
                </select>
              </label>
              <button className="button primary">{t('createInvite')}</button>
            </form>
            {token && (
              <div className="invite-result">
                <label>
                  {t('inviteLink')}
                  <input
                    aria-label={t('inviteLink')}
                    readOnly
                    value={`${origin}/${locale}/invite/${token}`}
                  />
                </label>
                <p>{t('inviteExpiry')}</p>
              </div>
            )}
          </section>
        )}
        {context.writable && (
          <section className="panel">
            <h2>{t('changeDates')}</h2>
            <form action={previewDates} className="form-stack">
              <Hidden locale={locale} childId={child.id} />
              <label>
                {t('dueDate')}
                <input
                  type="date"
                  name="due"
                  defaultValue={child.due_date ?? ''}
                />
              </label>
              <label>
                {t('birthDate')}
                <input
                  type="date"
                  name="birth"
                  defaultValue={child.birth_date ?? ''}
                />
              </label>
              <button className="button secondary">{t('previewDates')}</button>
            </form>
          </section>
        )}
        {owner && (
          <section className="panel">
            <h2>{t('newChild')}</h2>
            <form action={addChild} className="form-stack">
              <input name="familyId" type="hidden" value={child.family_id} />
              <input name="locale" type="hidden" value={locale} />
              <label>
                {t('childName')}
                <input name="name" required maxLength={60} />
              </label>
              <label>
                {t('dueDate')}
                <input name="due" type="date" />
              </label>
              <label>
                {t('birthDate')}
                <input name="birth" type="date" />
              </label>
              <button className="button secondary">{t('addChild')}</button>
            </form>
          </section>
        )}
      </div>
      {owner && (
        <section className="panel">
          <h2>{t('invitations')}</h2>
          {invitations?.map((i) => (
            <div className="invitation-row" key={i.id}>
              <span className="badge">
                {t(
                  i.revoked_at
                    ? 'revoked'
                    : i.accepted_at
                      ? 'accepted'
                      : 'pending',
                )}
              </span>
              <span>
                {t(i.role)} · {t('expires')}:{' '}
                {formatTime(i.expires_at, locale, context.timezone)}
              </span>
              {!i.accepted_at && !i.revoked_at && (
                <form action={revoke}>
                  <Hidden locale={locale} childId={child.id} />
                  <input type="hidden" name="id" value={i.id} />
                  <input
                    type="hidden"
                    name="familyId"
                    value={child.family_id}
                  />
                  <input type="hidden" name="kind" value="invite" />
                  <ConfirmButton label={t('revoke')} message={t('revoke')} />
                </form>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
export async function Settings({ context, locale }: Props) {
  const t = await getTranslations();
  return (
    <>
      <PageHeading title={t('settings')} subtitle={t('tagline')} />
      <p>
        <Link className="button secondary" href={`/${locale}/data`}>
          {t('data')}
        </Link>
      </p>
      <section className="panel settings-panel">
        <h2>{t('identities')}</h2>
        {context.user.identities?.map((identity) => (
          <div className="member-row" key={identity.identity_id}>
            <strong>{identity.provider}</strong>
            <form action={unlinkIdentity}>
              <input type="hidden" name="locale" value={locale} />
              <input
                type="hidden"
                name="identityId"
                value={identity.identity_id}
              />
              <ConfirmButton
                label={t('unlink')}
                message={t('unlinkConfirm')}
                disabled={
                  (context.user.identities?.length ?? 0) <= 1 ||
                  !context.recentlyAuthenticated
                }
              />
            </form>
          </div>
        ))}
        <p>{t('linkHelp')}</p>
        <SocialButtons
          locale={locale}
          next={`/${locale}/settings`}
          link={context.recentlyAuthenticated}
        />
        {!context.recentlyAuthenticated && <p>{t('reauth')}</p>}
        <p className="small muted">{t('lastIdentity')}</p>
        <form action={logout}>
          <input type="hidden" name="locale" value={locale} />
          <button className="button secondary">{t('logout')}</button>
        </form>
      </section>
    </>
  );
}
