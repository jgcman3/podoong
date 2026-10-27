import residenceCountries from '@/features/family/countries.json';
import { InstallAppButton } from '@/components/install-app';
import { loadDayAgenda } from '@/features/care/day-agenda-data';
import { TaskCheckbox } from '@/features/care/task-checkbox';
import { CalendarWorkspace } from '@/features/care/calendar-workspace';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Milk,
  Moon,
  Baby,
  Ruler,
  ArrowUpRight,
  CalendarDays,
  Plus,
  Sparkles,
  Heart,
  Backpack,
  FileCheck,
  Users,
  Grid2X2,
  ChevronRight,
  Bell,
  Database,
} from 'lucide-react';
import { Nest } from '@/components/nest';
import { ConfirmButton } from '@/components/confirm-button';
import type { CareContext } from '@/lib/data';
import { services, preparationTitle, type Locale } from '@/lib/domain';
import { QuickCare } from '@/features/care/quick-care';
import {
  loadQuickTimeline,
  loadRecentFeedingAmounts,
} from '@/features/care/quick-data';
import { ResidenceForm } from '@/features/family/residence-form';
import { calendarTitle, calendarKind } from '@/features/care/calendar-entry';
import { LastCare } from '@/features/care/last-care';
import { VaccinationList } from '@/features/vaccination/views';
import { isChildService } from '@/features/child-care/schema';
import { addTemplates } from '@/features/care/actions';
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
function PageHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
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
          <TaskCheckbox
            task={task}
            locale={locale}
            childId={context.child.id}
            writable={context.writable}
            returnTo={compact ? 'today' : 'calendar'}
          />
          <div className="task-main">
            <strong>{preparationTitle(task, locale)}</strong>
            {!compact && (
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
            )}
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
        </article>
      ))}
    </div>
  );
}
export async function Today({ context, locale }: Props) {
  const t = await getTranslations();
  const { child, timezone, today } = context;
  const now = new Date().toISOString();
  const [
    feedingResult,
    diaperResult,
    sleepResult,
    quickEntries,
    agenda,
    recentAmounts,
  ] = await Promise.all([
    context.db
      .from('care_records')
      .select('id,kind,started_at,ended_at,amount_ml,amount_g')
      .eq('child_id', child.id)
      .in('kind', ['breast', 'formula', 'solids'])
      .lte('started_at', now)
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from('child_records')
      .select('id,kind,occurred_at,ended_at')
      .eq('child_id', child.id)
      .eq('service', 'diaper')
      .lte('occurred_at', now)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from('child_records')
      .select('id,kind,occurred_at,ended_at')
      .eq('child_id', child.id)
      .eq('service', 'sleep')
      .lte('occurred_at', now)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadQuickTimeline(context),
    loadDayAgenda(context),
    loadRecentFeedingAmounts(context),
  ]);
  if (feedingResult.error || diaperResult.error || sleepResult.error)
    throw new Error('Latest care unavailable');
  const activeSleep = quickEntries.find(
    (entry) =>
      entry.service === 'sleep' && entry.running && entry.startedAt <= now,
  );
  const latestSleep = activeSleep
    ? {
        id: activeSleep.id,
        kind: activeSleep.kind,
        occurred_at: activeSleep.startedAt,
        ended_at: null,
      }
    : sleepResult.data;
  return (
    <>
      <h1 className="visually-hidden">{t('today')}</h1>
      <LastCare
        locale={locale}
        timezone={timezone}
        feeding={feedingResult.data}
        diaper={diaperResult.data}
        sleep={latestSleep}
        now={now}
      />
      <QuickCare
        key={child.id}
        locale={locale}
        childId={child.id}
        entries={quickEntries}
        recentAmounts={recentAmounts}
        writable={context.writable}
        timezone={timezone}
        today={today}
        agenda={agenda}
      />
    </>
  );
}
export async function Calendar({
  context,
  locale,
  service,
  create,
  edit,
  month,
  day,
}: {
  context: CareContext;
  locale: Locale;
  service?: string;
  create?: string;
  edit?: string;
  month?: string;
  day?: string;
}) {
  if (!service)
    return (
      <CalendarWorkspace
        context={context}
        locale={locale}
        create={create}
        edit={edit}
        month={month}
        day={day}
      />
    );
  const t = await getTranslations();
  const tasks = service
    ? context.tasks.filter((v) => v.service === service)
    : context.tasks;
  return (
    <>
      <PageHeading
        title={t(`serviceNames.${service}`)}
        subtitle={t('prepSub')}
      />
      {!context.writable && <div className="flash">{t('readonly')}</div>}
      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <h2>{t('requiredTasks')}</h2>
          </div>
          {context.writable && service && (
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
          {context.writable && service && (
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
              <article
                className={`calendar-event calendar-kind-${e.event_kind}`}
                key={`${e.source}:${e.id}`}
              >
                <strong>
                  {e.source === 'vaccination' ? (
                    <Link
                      href={`/${locale}/vaccination/${e.id}?child=${context.child.id}`}
                    >
                      {calendarTitle(e, locale)}
                    </Link>
                  ) : (
                    calendarTitle(e, locale)
                  )}
                </strong>
                <span className="badge">
                  {e.date}
                  {e.event_time ? ` · ${e.event_time.slice(0, 5)}` : ''}
                </span>
                <span className="badge">
                  {calendarKind(e.event_kind, locale)}
                  {e.status === 'completed'
                    ? ` · ${locale === 'ko' ? '완료' : 'Done'}`
                    : ''}
                </span>
                <p>{[e.clinic, e.note].filter(Boolean).join(' · ')}</p>
                {context.writable && e.source === 'event' && (
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
    </>
  );
}
export async function Services({ context, locale }: Props) {
  const t = await getTranslations();
  return (
    <>
      <PageHeading title={t('services')} subtitle={t('servicesSub')} />
      <div className="services-grid">
        <InstallAppButton locale={locale} card />
        {services
          .filter(
            ([key]) =>
              ![
                'feeding',
                'sleep',
                'diaper',
                'growth',
                'health',
                'vaccination',
              ].includes(key),
          )
          .map(([key, , status]) => {
            const Icon = glyphs[key] ?? Grid2X2;
            return (
              <Link
                className={`service-card ${status === 'planned' ? 'planned-card' : ''}`}
                href={
                  key === 'community'
                    ? `/${locale}/community?family=${context.family.id}`
                    : key === 'polls'
                      ? `/${locale}/polls`
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
                <h2>
                  {key === 'community' || key === 'polls'
                    ? t(key)
                    : t(`serviceNames.${key}`)}
                </h2>
                <ChevronRight size={17} />
              </Link>
            );
          })}
        {(
          [
            ['notifications', Bell],
            ['data', Database],
          ] as const
        ).map(([key, Icon]) => (
          <Link key={key} className="service-card" href={`/${locale}/${key}`}>
            <span className="service-icon">
              <Icon size={24} />
            </span>
            <h2>{t(key)}</h2>
            <ChevronRight size={17} />
          </Link>
        ))}
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
  if (!item && !isChildService(service)) return null;
  if (service === 'vaccination')
    return (
      <VaccinationList
        context={context}
        locale={locale}
        page={page}
        tab={tab}
      />
    );
  if (item?.[2] === 'planned')
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
                {context.family.residence_country_code
                  ? [
                      residenceCountries.find(
                        (c) => c.code === context.family.residence_country_code,
                      )?.[locale] ?? context.family.residence_country_code,
                      context.family.residence_city,
                      context.family.residence_locality,
                    ]
                      .filter(Boolean)
                      .join(' ')
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
      <section className="panel settings-install">
        <InstallAppButton locale={locale} />
      </section>
      <section className="panel settings-language">
        <h2>{locale === 'ko' ? '언어' : 'Language'}</h2>
        <div className="residence-actions">
          {(['ko', 'en'] as const).map((language) => (
            <Link
              key={language}
              className={`button ${locale === language ? 'primary' : 'secondary'}`}
              aria-current={locale === language ? 'true' : undefined}
              href={`/${language}/settings?child=${context.child.id}`}
            >
              {language === 'ko' ? '한국어' : 'English'}
            </Link>
          ))}
        </div>
      </section>
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
