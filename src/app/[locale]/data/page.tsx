import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { isLocale } from '@/lib/domain';
import { dataOperation } from '@/features/data-operations/actions';
export default async function DataPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ko = locale === 'ko';
  const { db, user } = await requireUser(locale);
  const q = await searchParams;
  const [children, members, operator, jobs] = await Promise.all([
    db.from('children').select('id,name,family_id'),
    db.from('family_members').select('family_id,user_id,role'),
    db.rpc('is_moderator'),
    db
      .from('data_operation_jobs')
      .select('id,status,attempts,created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  if (children.error || members.error || operator.error || jobs.error)
    throw new Error('Data controls unavailable');
  const caregiverResults = await Promise.all(
    (children.data ?? []).map((child) =>
      db.rpc('list_caregivers', { p_child_id: child.id }),
    ),
  );
  if (caregiverResults.some((result) => result.error))
    throw new Error('Data controls unavailable');
  const memberNames = new Map(
    caregiverResults.flatMap((result) =>
      (result.data ?? []).map(
        (member) => [member.user_id, member.display_name] as const,
      ),
    ),
  );
  const owners = (members.data ?? []).filter(
    (m) => m.user_id === user.id && m.role === 'owner',
  );
  const hidden = (action: string) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="action" value={action} />
    </>
  );
  return (
    <main className="main-content">
      <nav>
        <Link href={`/${locale}/settings`}>{ko ? '설정' : 'Settings'}</Link> ·{' '}
        <Link href={`/${ko ? 'en' : 'ko'}/data`}>
          {ko ? 'English' : '한국어'}
        </Link>
      </nav>
      <h1>{ko ? '데이터 관리' : 'Data controls'}</h1>
      <p>
        {ko
          ? '삭제와 소유권 이전에는 5분 이내 재로그인 및 확인 문구 입력이 필요합니다.'
          : 'Deletion and ownership transfer require a login within five minutes and a typed confirmation.'}
      </p>
      {q.error && (
        <p role="alert">
          {ko
            ? '처리할 수 없습니다. 다시 로그인한 뒤 확인 문구와 가족 소유권을 확인해주세요. 계속 실패하면 잠시 후 다시 시도해주세요.'
            : 'Unable to process. Sign in again and check the confirmation and family ownership. If this continues, try again later.'}
        </p>
      )}
      {q.notice && <p role="status">{ko ? '처리했습니다.' : 'Saved.'}</p>}
      {(children.data ?? []).map((child) => (
        <section className="panel" key={child.id}>
          <h2>{child.name}</h2>
          <a href={`/api/data/export?child=${child.id}`}>
            {ko ? '전체 기록 JSON 다운로드' : 'Download all records as JSON'}
          </a>
          <p>
            {ko
              ? 'UTC 기준 기록·할 일·일정 전체를 내보냅니다. 다른 가족과 작성자 정보는 제외합니다.'
              : 'Exports all records, tasks and events in UTC, excluding other families and author information.'}
          </p>
          {owners.some((o) => o.family_id === child.family_id) && (
            <form action={dataOperation}>
              {hidden('delete-child')}
              <input type="hidden" name="child" value={child.id} />
              <p>
                {ko
                  ? '아이와 연결된 기록·일정·알림·초대가 영구 삭제됩니다.'
                  : 'Permanently deletes this child and linked records, events, notifications and invitations.'}
              </p>
              <label>
                {ko ? 'DELETE CHILD 입력' : 'Type DELETE CHILD'}
                <input
                  name="confirmation"
                  required
                  pattern="DELETE CHILD"
                  autoComplete="off"
                />
              </label>
              <button>
                {ko ? '아이 데이터 영구 삭제' : 'Permanently delete child data'}
              </button>
            </form>
          )}
        </section>
      ))}
      {owners.map((owner) => (
        <section className="panel" key={owner.family_id}>
          <h2>{ko ? '가족 소유권 이전' : 'Transfer family ownership'}</h2>
          <p>
            {ko
              ? '기존 소유자는 모든 아이의 편집자로 유지됩니다.'
              : 'You retain editor access to every child.'}
          </p>
          <form action={dataOperation}>
            {hidden('transfer')}
            <input name="family" type="hidden" value={owner.family_id} />
            <label>
              {ko ? '새 소유자' : 'New owner'}
              <select name="member" required>
                {(members.data ?? [])
                  .filter(
                    (m) =>
                      m.family_id === owner.family_id && m.user_id !== user.id,
                  )
                  .map((m, i) => (
                    <option key={m.user_id} value={m.user_id}>
                      {memberNames.get(m.user_id) ||
                        `${ko ? '가족 구성원' : 'Family member'} ${i + 1}`}{' '}
                      ({m.role})
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
            <button>{ko ? '소유권 이전' : 'Transfer ownership'}</button>
          </form>
        </section>
      ))}
      <section className="panel">
        <h2>{ko ? '계정 삭제' : 'Delete account'}</h2>
        <p>
          {ko
            ? '프로필·커뮤니티 글·투표·권한이 즉시 삭제됩니다. 다른 가족 구성원의 공유 기록은 작성자 없이 유지됩니다. 사진과 인증 계정 삭제는 관리자 작업으로 마무리됩니다. 다른 구성원이 있다면 먼저 소유권을 이전하세요.'
            : 'Your profile, community posts, votes and access are removed immediately. Shared records remain without your identity. A worker finishes photo and authentication account deletion. Transfer ownership first if other members remain.'}
        </p>
        <form action={dataOperation}>
          {hidden('delete-account')}
          <label>
            {ko ? 'DELETE ACCOUNT 입력' : 'Type DELETE ACCOUNT'}
            <input
              name="confirmation"
              required
              pattern="DELETE ACCOUNT"
              autoComplete="off"
            />
          </label>
          <button>{ko ? '계정 삭제 요청' : 'Request account deletion'}</button>
        </form>
      </section>
      {operator.data && (
        <section className="panel">
          <h2>{ko ? '운영 작업' : 'Operator jobs'}</h2>
          <form action={dataOperation}>
            {hidden('process')}
            <button>
              {ko
                ? '사진 정리 및 계정 삭제 작업 실행'
                : 'Process photo cleanup and account deletion'}
            </button>
          </form>
          <ul>
            {jobs.data?.map((j) => (
              <li key={j.id}>
                {j.status} · {j.attempts}
                {j.status === 'failed' && (
                  <form action={dataOperation}>
                    {hidden('retry-job')}
                    <input type="hidden" name="job" value={j.id} />
                    <button>
                      {ko ? '5분 후 작업 재시도' : 'Retry after five minutes'}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          <Metrics db={db} ko={ko} />
        </section>
      )}
    </main>
  );
}
async function Metrics({
  db,
  ko,
}: {
  db: Awaited<ReturnType<typeof requireUser>>['db'];
  ko: boolean;
}) {
  const { data, error } = await db.rpc('operation_metrics');
  if (error) throw new Error('Metrics unavailable');
  return (
    <>
      <h3>{ko ? '집계 지표' : 'Aggregate metrics'}</h3>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </>
  );
}
