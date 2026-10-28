import Link from 'next/link';
import { Database, ChevronRight } from 'lucide-react';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { dataOperation } from './actions';

function OperationFields({
  locale,
  child,
  action,
}: {
  locale: Locale;
  child: string;
  action: string;
}) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnPage" value="account" />
      <input type="hidden" name="child" value={child} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}
export async function DataSettings({
  context,
  locale,
  panel,
}: {
  context: CareContext;
  locale: Locale;
  panel?: string;
}) {
  const ko = locale === 'ko';
  const members = context.members.filter(
    (member) => member.user_id !== context.user.id,
  );
  const owned = await context.db
    .from('family_members')
    .select('family_id')
    .eq('user_id', context.user.id)
    .eq('role', 'owner');
  if (owned.error) throw new Error('Data settings unavailable');
  if (!owned.data.length) return null;
  const children = context.children.filter((child) =>
    owned.data.some((family) => family.family_id === child.family_id),
  );
  return (
    <details className="panel account-settings-section" open={panel === 'data'}>
      <summary>
        <Database size={18} />
        <span>
          {ko ? '데이터 설정' : 'Data settings'}
          <small className="account-admin-badge">
            {ko ? '가족관리자 전용' : 'Admin only'}
          </small>
        </span>
        <ChevronRight size={16} />
      </summary>
      <div className="account-data-settings">
        <p className="small muted">
          {ko
            ? '삭제와 소유권 이전은 5분 이내에 로그인한 계정으로 확인 문구를 입력해야 합니다.'
            : 'Deletion and ownership transfer require a login within five minutes and the confirmation text.'}
        </p>
        {children.map((child) => (
          <section className="account-danger-section" key={child.id}>
            <h3>{child.name}</h3>
            <p>
              {ko
                ? `${child.name}의 모든 기록·사진·일정과 공유 일기장이 삭제됩니다. 복구할 수 없습니다.`
                : `All records, photos, schedules and shared diaries for ${child.name} will be deleted. This cannot be undone.`}
            </p>
            <form action={dataOperation} className="form-stack">
              <OperationFields
                locale={locale}
                child={child.id}
                action="delete-child"
              />
              <label>
                {ko ? 'DELETE CHILD 입력' : 'Type DELETE CHILD'}
                <input
                  name="confirmation"
                  required
                  pattern="DELETE CHILD"
                  autoComplete="off"
                />
              </label>
              <button className="button account-danger-button">
                {ko ? '아이 데이터 영구 삭제' : 'Permanently delete child data'}
              </button>
            </form>
          </section>
        ))}
        {context.owner && (
          <section className="account-danger-section">
            <h3>{ko ? '가족 소유권 이전' : 'Transfer family ownership'}</h3>
            <p>
              {ko
                ? '현재 가족의 소유권을 보호자에게 이전합니다. 이전 후에도 모든 아이의 편집 권한은 유지됩니다.'
                : 'Transfer this family to another caregiver. You retain editor access to all its children.'}
            </p>
            {members.length ? (
              <form action={dataOperation} className="form-stack">
                <OperationFields
                  locale={locale}
                  child={context.child.id}
                  action="transfer"
                />
                <input
                  name="family"
                  type="hidden"
                  value={context.child.family_id}
                />
                <label>
                  {ko ? '새 소유자' : 'New owner'}
                  <select name="member" required defaultValue="">
                    <option value="" disabled>
                      {ko ? '보호자 선택' : 'Choose a caregiver'}
                    </option>
                    {members.map((member, index) => (
                      <option key={member.user_id} value={member.user_id}>
                        {context.caregivers.find(
                          (person) => person.user_id === member.user_id,
                        )?.display_name ||
                          `${ko ? '보호자' : 'Caregiver'} ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {ko ? 'TRANSFER OWNER 입력' : 'Type TRANSFER OWNER'}
                  <input
                    name="confirmation"
                    required
                    pattern="TRANSFER OWNER"
                    autoComplete="off"
                  />
                </label>
                <button className="button secondary">
                  {ko ? '소유권 이전' : 'Transfer ownership'}
                </button>
              </form>
            ) : (
              <p>
                {ko
                  ? '보호자 설정에서 다른 보호자를 초대한 후 이전할 수 있어요.'
                  : 'Invite another caregiver in Caregiver settings before transferring ownership.'}
              </p>
            )}
          </section>
        )}
      </div>
    </details>
  );
}
export async function AccountWithdrawal({
  context,
  locale,
}: {
  context: CareContext;
  locale: Locale;
}) {
  const ko = locale === 'ko';
  const { data: owned, error } = await context.db
    .from('family_members')
    .select('family_id')
    .eq('user_id', context.user.id)
    .eq('role', 'owner');
  if (error) throw new Error('Account settings unavailable');
  const others = owned?.length
    ? await context.db
        .from('family_members')
        .select('family_id')
        .in(
          'family_id',
          owned.map((family) => family.family_id),
        )
        .neq('user_id', context.user.id)
    : { data: [], error: null };
  if (others.error) throw new Error('Account settings unavailable');
  const blocked = !!others.data?.length;
  const blockedChild = context.children.find((child) =>
    others.data?.some((member) => member.family_id === child.family_id),
  );
  const ownedChildren = context.children.filter((child) =>
    owned?.some((family) => family.family_id === child.family_id),
  );
  return (
    <section className="account-danger-section account-withdrawal">
      <h3>{ko ? '회원 탈퇴' : 'Delete account'}</h3>
      <p>
        {owned?.length
          ? ko
            ? '가족관리자가 탈퇴하면 관리하는 모든 아이의 모든 데이터(기록·사진·일정·공유 일기장 포함)와 본인 계정이 자동으로 영구 삭제됩니다. 복구할 수 없습니다.'
            : 'As family administrator, deleting your account automatically and permanently deletes all data for every child you manage, including records, photos, schedules and shared diaries. This cannot be undone.'
          : ko
            ? '내 계정과 프로필이 삭제됩니다. 소유자가 아닌 가족의 아이 기록은 유지됩니다.'
            : 'Your account and profile will be deleted. Records in families you do not own are retained.'}
      </p>
      {ownedChildren.length > 0 && (
        <p className="account-deletion-scope">
          {ko ? '삭제 대상 아이: ' : 'Children to be deleted: '}
          {ownedChildren.map((child) => child.name).join(', ')}
        </p>
      )}
      <p className="small muted">
        {ko
          ? '탈퇴는 복구할 수 없으며, 5분 이내에 로그인한 계정으로 진행해야 합니다.'
          : 'This cannot be undone. Sign in within five minutes before continuing.'}
      </p>
      {blocked ? (
        <div className="account-withdrawal-guidance">
          <p>
            {ko
              ? '다른 보호자가 있어 탈퇴할 수 없습니다. 각 가족의 관리자를 다른 보호자로 변경하거나, 다른 보호자의 권한을 모두 회수해 주세요. 가족관리자로 탈퇴하려면 해당 가족의 보호자가 본인만 남아 있어야 합니다.'
              : 'You cannot delete your account while other caregivers remain in a family you manage. Transfer administration or revoke all other caregivers’ access first. To withdraw as administrator, you must be the only caregiver in each family you manage.'}
          </p>
          <Link
            className="button secondary"
            href={`/${locale}/account?child=${blockedChild?.id ?? context.child.id}&panel=data`}
          >
            {ko ? '가족관리자 변경' : 'Transfer administration'}
          </Link>
          <Link
            className="button secondary"
            href={`/${locale}/account?child=${blockedChild?.id ?? context.child.id}&panel=family`}
          >
            {ko ? '보호자 권한 관리' : 'Manage caregiver access'}
          </Link>
        </div>
      ) : (
        <form action={dataOperation} className="form-stack">
          <OperationFields
            locale={locale}
            child={context.child.id}
            action="delete-account"
          />
          <label>
            {ko ? 'DELETE ACCOUNT 입력' : 'Type DELETE ACCOUNT'}
            <input
              name="confirmation"
              required
              pattern="DELETE ACCOUNT"
              autoComplete="off"
            />
          </label>
          <button className="button account-danger-button">
            {ko ? '회원 탈퇴' : 'Delete account'}
          </button>
        </form>
      )}
    </section>
  );
}
