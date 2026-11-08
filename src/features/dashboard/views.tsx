import { InstallEntry } from '@/features/install/install-entry';
import { InstallContent } from '@/features/install/install-content';
import { DirectFamilyInvite } from '@/features/family/direct-invite';
import { ServiceInvite } from '@/features/community/service-invite';
import { serviceContacts } from '@/lib/contacts';
import { DeveloperRequestForm } from '@/features/developer-requests/form';
import { AppearanceSettings } from '@/components/appearance';
import { RelationshipField } from '@/features/family/relationship-field';
import { FamilyJoinEntry } from '@/features/family/join-entry';
import { relationshipLabel } from '@/features/family/relationship';
import { saveRelationship } from '@/features/family/actions';
import {
  DataSettings,
  AccountWithdrawal,
} from '@/features/data-operations/settings';
import { AccountInstallGuide } from '@/features/install/account-guide';
import { NotificationSettings } from '@/features/notifications/settings';
import { ChildIcon } from '@/components/child-icon';
import { TopbarChildPicker } from '@/components/topbar-child-picker';
import { ChildSexField } from '@/features/family/sex-field';
import residenceCountries from '@/features/family/countries.json';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Settings as SettingsIcon,
  MapPin,
  Languages,
  Users,
  ChevronRight,
  Bell,
  MessageSquarePlus,
  Palette,
  FileText,
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
import { LastCare } from '@/features/care/last-care';
import {
  revoke,
  saveBirthDate,
  saveChildDetails,
  addChild,
} from '@/features/family/actions';
import { SocialButtons } from '@/components/social-buttons';
import { logout, unlinkIdentity } from '@/features/auth/actions';
function Hidden({ locale, childId }: { locale: Locale; childId: string }) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="childId" value={childId} />
    </>
  );
}
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
      .select(
        'id,kind,started_at,ended_at,amount_ml,timer_started,created_by,note',
      )
      .eq('child_id', child.id)
      .in('kind', ['breast', 'formula', 'solids'])
      .lte('started_at', now)
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from('child_records')
      .select('id,kind,occurred_at,ended_at,created_by,note')
      .eq('child_id', child.id)
      .eq('service', 'diaper')
      .lte('occurred_at', now)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle(),
    context.db
      .from('child_records')
      .select('id,kind,occurred_at,ended_at,created_by,note')
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
  const activeFeeding = quickEntries.find(
    (entry) =>
      entry.source === 'feeding' && entry.running && entry.startedAt <= now,
  );
  const activeSleep = quickEntries.find(
    (entry) =>
      entry.service === 'sleep' && entry.running && entry.startedAt <= now,
  );
  const latestSleep = activeSleep?.childRecord ?? sleepResult.data;
  const caregivers = context.caregivers.map((caregiver) => ({
    id: caregiver.user_id,
    relationship: context.members.find(
      (member) => member.user_id === caregiver.user_id,
    )?.relationship,
  }));
  const childOptions = context.children.map((item) => ({
    id: item.id,
    name: item.name,
    sex: item.sex,
    age: `D+${ageInDays(item.birth_date, today)}`,
    href: `/${locale}/today?child=${item.id}`,
  }));
  return (
    <>
      <h1 className="visually-hidden">{t('today')}</h1>
      <LastCare
        locale={locale}
        feeding={activeFeeding?.feedingRecord ?? feedingResult.data}
        diaper={diaperResult.data}
        sleep={latestSleep}
        now={now}
        caregivers={caregivers}
        childPicker={
          <TopbarChildPicker
            key={child.id}
            current={childOptions.find((item) => item.id === child.id)!}
            options={childOptions}
            label={t('childSelect')}
          />
        }
        inviteAction={
          context.owner ? (
            <DirectFamilyInvite
              key={child.id}
              childId={child.id}
              locale={locale}
            />
          ) : undefined
        }
      />
      <QuickCare
        privacy={context.privacy}
        birthDate={child.birth_date}
        key={child.id}
        locale={locale}
        childId={child.id}
        entries={quickEntries}
        recentAmounts={recentAmounts}
        now={now}
        writable={context.writable}
        timezone={timezone}
        today={today}
      />
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
                    {relationshipLabel(m.relationship, locale)} ·{' '}
                    {m.role === 'owner'
                      ? t('owner')
                      : locale === 'ko'
                        ? '참여 가족'
                        : 'Family member'}
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
                    <ConfirmButton
                      label={
                        locale === 'ko' ? '가족에서 제거' : 'Remove from family'
                      }
                      message={
                        locale === 'ko'
                          ? '이 가족에서 제거할까요? 기존 기록과 상대방 계정은 삭제되지 않으며, 이 가족의 기록에는 더 이상 접근할 수 없어요.'
                          : 'Remove this member? Their account and existing records will remain, but access to this family’s records will end.'
                      }
                    />
                  </form>
                )}
              </div>
            ))}
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
    </>
  );
}
export async function ChildAccount({
  context,
  locale,
  panel,
  showInstallGuide = true,
}: Props & { panel?: string; showInstallGuide?: boolean }) {
  const ko = locale === 'ko';
  const t = await getTranslations();
  const { child } = context;
  const [owned, serviceAdmin, appIcon] = await Promise.all([
    context.db
      .from('family_members')
      .select('family_id')
      .eq('user_id', context.user.id)
      .eq('role', 'owner'),
    context.db.rpc('is_service_admin'),
    context.db
      .from('child_app_icons')
      .select('token')
      .eq('child_id', child.id)
      .maybeSingle(),
  ]);
  if (owned.error || appIcon.error)
    throw new Error('Child settings unavailable');
  const editableChildren = context.children.filter((item) =>
    owned.data.some((family) => family.family_id === item.family_id),
  );

  return (
    <div className="child-account-page">
      {showInstallGuide && !context.profile.install_guide_seen_at && (
        <AccountInstallGuide
          key={context.user.id}
          locale={locale}
          child={child.id}
        />
      )}
      <div className="account-inline-settings" key={child.id}>
        <ServiceInvite
          locale={locale}
          url={`${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://podoong.com'}/${locale}/intro`}
        />
        <InstallEntry locale={locale} child={child.id}>
          <InstallContent
            locale={locale}
            child={child.id}
            token={appIcon.data?.token}
            owner={context.owner}
            inline
          />
        </InstallEntry>
        {context.owner && (
          <section className="panel account-primary-item settings-family-invite">
            <DirectFamilyInvite
              key={child.id}
              childId={child.id}
              locale={locale}
              placement="settings"
            />
          </section>
        )}

        <details
          className="panel account-settings-section account-primary-item"
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
          className="panel account-settings-section account-primary-item"
          open={panel === 'appearance'}
        >
          <summary>
            <Palette size={18} />
            <span>{ko ? '화면 설정' : 'Appearance settings'}</span>
            <ChevronRight size={16} />
          </summary>
          <AppearanceSettings locale={locale} />
        </details>
        <details
          className="panel account-settings-section account-primary-item"
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
          className="panel account-settings-section account-primary-item account-primary-account"
          open={['account', 'data'].includes(panel ?? '')}
        >
          <summary>
            <SettingsIcon size={18} />
            <span>{ko ? '계정 설정' : 'Account settings'}</span>
            <ChevronRight size={16} />
          </summary>
          <Settings context={context} locale={locale} embedded mode="account" />
          <DataSettings context={context} locale={locale} panel={panel} />
        </details>
        {editableChildren.length > 0 && (
          <section
            className="account-management-settings"
            aria-label={ko ? '가족 관리' : 'Family management'}
          >
            <h2 className="account-group-title">
              {ko ? '가족 관리' : 'Family management'}
              <small>{ko ? '가족관리자 전용' : 'Family admin only'}</small>
            </h2>
            {context.owner && (
              <details
                className="panel account-settings-section"
                open={panel === 'join'}
              >
                <summary>
                  <Users size={18} />
                  <span>
                    {ko ? '기존 가족에 참여하기' : 'Join an existing family'}
                  </span>
                  <ChevronRight size={16} />
                </summary>
                <FamilyJoinEntry locale={locale} settings />
              </details>
            )}
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
                      {ko ? '가족 설정' : 'Family settings'}
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
          </section>
        )}
        <details
          className="panel account-settings-section account-primary-item account-primary-service"
          open={panel === 'service' || panel === 'developer'}
        >
          <summary>
            <FileText size={18} />
            <span>{ko ? '서비스 정보' : 'Service information'}</span>
            <ChevronRight size={16} />
          </summary>
          <div className="account-service-links">
            <Link href={`/${locale}/intro`} prefetch={false}>
              <span>{ko ? '서비스 소개' : 'About podoong'}</span>
              <ChevronRight size={16} />
            </Link>
            {serviceAdmin.data && (
              <Link href={`/${locale}/admin`} prefetch={false}>
                <span>{ko ? '관리자 사이트' : 'Admin site'}</span>
                <ChevronRight size={16} />
              </Link>
            )}
            {[
              ['terms', ko ? '서비스 이용약관' : 'Terms of Service'],
              ['privacy', ko ? '개인정보 처리방침' : 'Privacy Policy'],
              ['community', ko ? '육아 소통 운영정책' : 'Community Policy'],
            ].map(([key, label]) => (
              <Link
                key={key}
                prefetch={false}
                href={`/${locale}/legal/${key}?child=${child.id}`}
              >
                <span>{label}</span>

                <ChevronRight size={16} />
              </Link>
            ))}
            <p className="small muted">
              {ko ? '운영자 정경철' : 'Operator: Jeong Gyeongcheol'} ·{' '}
              <a href={`mailto:${serviceContacts.support}`}>
                {serviceContacts.support}
              </a>
              <br />
              {ko ? '개인정보 문의' : 'Privacy enquiries'} ·{' '}
              <a href={`mailto:${serviceContacts.privacy}`}>
                {serviceContacts.privacy}
              </a>
            </p>
          </div>
          <details
            className="panel account-settings-section"
            open={panel === 'developer'}
          >
            <summary>
              <MessageSquarePlus size={18} />
              <span>
                {ko ? '개발자에게 요청하기' : 'Contact the developer'}
              </span>
              <ChevronRight size={16} />
            </summary>
            <DeveloperRequestForm
              locale={locale}
              initialId={crypto.randomUUID()}
            />
          </details>
        </details>
      </div>
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
          <Link
            className="button secondary"
            href={`/${locale}/install?child=${context.child.id}`}
          >
            {locale === 'ko'
              ? '아이 사진으로 홈 화면에 추가'
              : 'Add to Home Screen'}
          </Link>
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
