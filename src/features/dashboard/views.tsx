import { DeveloperRequestForm } from '@/features/developer-requests/form';
import { RelationshipField } from '@/features/family/relationship-field';
import { relationshipLabel } from '@/features/family/relationship';
import { saveRelationship } from '@/features/family/actions';
import {
  DataSettings,
  AccountWithdrawal,
} from '@/features/data-operations/settings';
import { NotificationSettings } from '@/features/notifications/settings';
import { ChildIcon } from '@/components/child-icon';
import { ChildSexField } from '@/features/family/sex-field';
import residenceCountries from '@/features/family/countries.json';
import { InstallAppButton } from '@/components/install-app';
import { TaskCheckbox } from '@/features/care/task-checkbox';
import { CalendarWorkspace } from '@/features/care/calendar-workspace';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Check,
  Settings as SettingsIcon,
  MapPin,
  Languages,
  Plus,
  Heart,
  Users,
  ChevronRight,
  Bell,
  MessageSquarePlus,
} from 'lucide-react';
import { ConfirmButton } from '@/components/confirm-button';
import type { CareContext } from '@/lib/data';
import { ageInDays, type Locale } from '@/lib/domain';
import { QuickCare } from '@/features/care/quick-care';
import {
  loadQuickTimeline,
  loadRecentFeedingAmounts,
} from '@/features/care/quick-data';
import { ResidenceForm } from '@/features/family/residence-form';
import { calendarTitle, calendarKind } from '@/features/care/calendar-entry';
import { LastCare } from '@/features/care/last-care';
import {
  TaskForm,
  EventForm,
  Hidden,
  DeleteCalendar,
} from '@/features/care/calendar-forms';
import {
  createInvite,
  revoke,
  saveBirthDate,
  saveChildDetails,
  addChild,
} from '@/features/family/actions';
import { SocialButtons } from '@/components/social-buttons';
import { logout, unlinkIdentity } from '@/features/auth/actions';
import { cookies } from 'next/headers';
import type { Row } from '@/lib/db';
type Props = { context: CareContext; locale: Locale };
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
            <strong>{task.title}</strong>
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
        birthDate={child.birth_date}
        key={child.id}
        locale={locale}
        childId={child.id}
        entries={quickEntries}
        recentAmounts={recentAmounts}
        writable={context.writable}
        timezone={timezone}
        today={today}
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
      <Pagination context={context} locale={locale} path="calendar" />
    </>
  );
}
export async function Family({
  context,
  locale,
  embedded = false,
  mode = 'all',
  editableChildren,
}: Props & {
  embedded?: boolean;
  editableChildren?: Props['context']['children'];
  mode?: 'all' | 'management' | 'residence' | 'child' | 'add';
}) {
  const t = await getTranslations();
  const { child, owner, members } = context;
  const manage = mode === 'all' || mode === 'management';
  const formReturn = (
    <>
      <input
        type="hidden"
        name="returnPage"
        value={embedded ? 'account' : 'family'}
      />
      <input
        type="hidden"
        name="panel"
        value={
          mode === 'child'
            ? 'child'
            : mode === 'add'
              ? 'add'
              : mode === 'residence'
                ? 'residence'
                : 'family'
        }
      />
    </>
  );
  const { data: invitations } =
    owner && manage
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
      {!embedded && <PageHeading title={t('family')} subtitle={t('tagline')} />}
      {(mode === 'all' || mode === 'residence') && (
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
              returnPage={embedded ? 'account' : 'family'}
            />
          ) : (
            <>
              <p>
                <strong>
                  {context.family.residence_country_code
                    ? [
                        residenceCountries.find(
                          (c) =>
                            c.code === context.family.residence_country_code,
                        )?.[locale] ?? context.family.residence_country_code,
                        context.family.residence_province,
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
      )}
      <div className="two-column">
        {manage && (
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
                  <span>
                    {relationshipLabel(m.relationship, locale)} · {t(m.role)}
                  </span>
                </div>
                {owner && m.role !== 'owner' && (
                  <form action={revoke}>
                    {formReturn}
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
        )}
        {owner && manage && (
          <section className="panel">
            <h2>{t('invite')}</h2>
            <p>{t('inviteSub')}</p>
            <form action={createInvite} className="form-stack">
              {formReturn}
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
        {(context.writable || editableChildren?.length) &&
          (mode === 'all' || mode === 'child') &&
          (editableChildren ?? [child]).map((item) => (
            <section
              className="panel account-child-details"
              key={item.id}
              id={item.id === child.id ? 'child-info' : `child-info-${item.id}`}
              data-child-id={item.id}
            >
              {editableChildren && <h3>{item.name}</h3>}
              {!embedded && <h2>{t('changeDates')}</h2>}
              <form
                action={embedded ? saveChildDetails : saveBirthDate}
                className="form-stack"
              >
                {formReturn}
                {editableChildren && (
                  <input type="hidden" name="returnChild" value={child.id} />
                )}
                <Hidden locale={locale} childId={item.id} />
                {embedded && (
                  <>
                    <label>
                      {t('childName')}
                      <input
                        name="name"
                        required
                        maxLength={60}
                        defaultValue={item.name}
                      />
                    </label>
                    <ChildSexField locale={locale} value={item.sex} />
                  </>
                )}
                <label>
                  {t('birthDate')}
                  <input
                    type="date"
                    name="birth"
                    required
                    max={context.today}
                    defaultValue={item.birth_date ?? ''}
                  />
                </label>
                <button className="button secondary">{t('save')}</button>
              </form>
            </section>
          ))}
        {owner && (mode === 'all' || mode === 'add') && (
          <section className="panel" id="add-child">
            {!embedded && <h2>{t('newChild')}</h2>}
            <form action={addChild} className="form-stack">
              {formReturn}
              <input name="familyId" type="hidden" value={child.family_id} />
              <input name="locale" type="hidden" value={locale} />
              <label>
                {t('childName')}
                <input name="name" required maxLength={60} />
              </label>
              <ChildSexField locale={locale} />
              <label>
                {t('birthDate')}
                <input name="birth" type="date" required max={context.today} />
              </label>
              <button className="button secondary">{t('addChild')}</button>
            </form>
          </section>
        )}
      </div>
      {owner && manage && (
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
                  {formReturn}
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
export async function ChildAccount({
  context,
  locale,
  panel,
}: Props & { panel?: string }) {
  const ko = locale === 'ko';
  const t = await getTranslations();
  const { child } = context;
  const owned = await context.db
    .from('family_members')
    .select('family_id')
    .eq('user_id', context.user.id)
    .eq('role', 'owner');
  if (owned.error) throw new Error('Child settings unavailable');
  const editableChildren = context.children.filter((item) =>
    owned.data.some((family) => family.family_id === item.family_id),
  );

  return (
    <div className="child-account-page">
      <div className="account-inline-settings" key={child.id}>
        <section
          className="panel account-children"
          aria-label={t('childSelect')}
        >
          <h2>{t('childSelect')}</h2>
          <div className="account-child-list">
            {context.children.map((item) => (
              <Link
                key={item.id}
                href={`/${locale}/account?child=${item.id}`}
                replace
                aria-current={item.id === child.id ? 'true' : undefined}
              >
                <span className="account-child-icon">
                  <ChildIcon sex={item.sex} size={22} />
                </span>
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {t('days', {
                      days: ageInDays(item.birth_date, context.today),
                    })}
                  </small>
                </span>
                {item.id === child.id && <Check size={18} aria-hidden="true" />}
              </Link>
            ))}
          </div>
        </section>
        <details
          className="panel account-settings-section"
          open={panel === 'language'}
        >
          <summary>
            <Languages size={18} />
            <span>{ko ? '언어 설정' : 'Language settings'}</span>
            <ChevronRight size={16} />
          </summary>
          <Settings
            context={context}
            locale={locale}
            embedded
            mode="language"
          />
        </details>
        <details
          className="panel account-settings-section"
          open={panel === 'account'}
        >
          <summary>
            <SettingsIcon size={18} />
            <span>{ko ? '계정 설정' : 'Account settings'}</span>
            <ChevronRight size={16} />
          </summary>
          <Settings context={context} locale={locale} embedded mode="account" />
        </details>
        <details
          className="panel account-settings-section"
          open={panel === 'notifications'}
        >
          <summary>
            <Bell size={18} />
            <span>{ko ? '알림 설정' : 'Notification settings'}</span>
            <ChevronRight size={16} />
          </summary>
          <NotificationSettings context={context} locale={locale} />
        </details>
        <details
          className="panel account-settings-section"
          open={panel === 'developer'}
        >
          <summary>
            <MessageSquarePlus size={18} />
            <span>{ko ? '개발자에게 요청하기' : 'Contact the developer'}</span>
            <ChevronRight size={16} />
          </summary>
          <DeveloperRequestForm
            locale={locale}
            initialId={crypto.randomUUID()}
          />
        </details>
        {editableChildren.length > 0 && (
          <>
            <details
              className="panel account-settings-section"
              open={panel === 'child' || panel === 'add'}
            >
              <summary>
                <ChildIcon sex={child.sex} size={18} />
                <span>
                  {ko ? '아이 설정' : 'Child settings'}
                  <small className="account-admin-badge">
                    {ko ? '가족관리자 전용' : 'Admin only'}
                  </small>
                </span>
                <ChevronRight size={16} />
              </summary>

              {editableChildren.length > 0 && (
                <>
                  <Family
                    context={context}
                    locale={locale}
                    embedded
                    mode="child"
                    editableChildren={editableChildren}
                  />
                </>
              )}
              {context.owner && (
                <>
                  <h3>{t('newChild')}</h3>
                  <Family
                    context={context}
                    locale={locale}
                    embedded
                    mode="add"
                  />
                </>
              )}
            </details>
          </>
        )}
        {context.owner && (
          <>
            <details
              className="panel account-settings-section"
              open={panel === 'residence'}
            >
              <summary>
                <MapPin size={18} />
                <span>
                  {ko ? '주소 설정' : 'Address settings'}
                  <small className="account-admin-badge">
                    {ko ? '가족관리자 전용' : 'Admin only'}
                  </small>
                </span>
                <ChevronRight size={16} />
              </summary>
              <Family
                context={context}
                locale={locale}
                embedded
                mode="residence"
              />
            </details>
            <details
              className="panel account-settings-section"
              open={panel === 'family'}
            >
              <summary>
                <Users size={18} />
                <span>
                  {ko ? '보호자 설정' : 'Caregiver settings'}
                  <small className="account-admin-badge">
                    {ko ? '가족관리자 전용' : 'Admin only'}
                  </small>
                </span>
                <ChevronRight size={16} />
              </summary>
              <Family
                context={context}
                locale={locale}
                embedded
                mode="management"
              />
            </details>
          </>
        )}
        <DataSettings context={context} locale={locale} panel={panel} />
      </div>
      <section className="panel settings-install">
        <InstallAppButton locale={locale} />
      </section>
    </div>
  );
}

export async function Settings({
  context,
  locale,
  embedded = false,
  mode = 'all',
}: Props & { embedded?: boolean; mode?: 'all' | 'language' | 'account' }) {
  const t = await getTranslations();
  return (
    <>
      {!embedded && (
        <PageHeading title={t('settings')} subtitle={t('tagline')} />
      )}
      {mode === 'all' && (
        <section className="panel settings-install">
          <InstallAppButton locale={locale} />
        </section>
      )}
      {mode !== 'account' && (
        <section className="panel settings-language">
          <h2>{locale === 'ko' ? '언어' : 'Language'}</h2>
          <div className="residence-actions">
            {(['ko', 'en'] as const).map((language) => (
              <Link
                key={language}
                className={`button ${locale === language ? 'primary' : 'secondary'}`}
                aria-current={locale === language ? 'true' : undefined}
                href={`/${language}/${embedded ? 'account' : 'settings'}?child=${context.child.id}${embedded ? '&panel=language' : ''}`}
              >
                {language === 'ko' ? '한국어' : 'English'}
              </Link>
            ))}
          </div>
        </section>
      )}
      {mode !== 'language' && (
        <section className="panel settings-panel">
          <div className="account-signed-in">
            <span className="avatar" aria-hidden="true">
              {context.profile.display_name.slice(0, 1) || <Users size={20} />}
            </span>
            <div>
              <small>
                {locale === 'ko' ? '로그인한 계정' : 'Signed in as'}
              </small>
              <strong>
                {context.profile.display_name ||
                  (locale === 'ko' ? '보호자' : 'Caregiver')}
              </strong>
              {context.user.email && <span>{context.user.email}</span>}
            </div>
          </div>
          <form
            action={saveRelationship}
            className="form-stack account-relationship-form"
          >
            <Hidden locale={locale} childId={context.child.id} />
            <RelationshipField
              locale={locale}
              value={
                context.members.find(
                  (member) => member.user_id === context.user.id,
                )?.relationship
              }
            />
            <button className="button secondary">{t('save')}</button>
          </form>
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
            next={`/${locale}/${embedded ? 'account' : 'settings'}?child=${context.child.id}`}
            link={context.recentlyAuthenticated}
          />
          {!context.recentlyAuthenticated && <p>{t('reauth')}</p>}
          <p className="small muted">{t('lastIdentity')}</p>
          <form action={logout}>
            <input type="hidden" name="locale" value={locale} />
            <button className="button secondary">{t('logout')}</button>
          </form>
          <AccountWithdrawal context={context} locale={locale} />
        </section>
      )}
    </>
  );
}
