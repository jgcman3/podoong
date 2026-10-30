import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
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
  const { db } = await requireUser(locale);
  const q = await searchParams;
  const operator = await db.rpc('is_service_admin');
  if (operator.error) throw new Error('Data controls unavailable');
  if (!operator.data) redirect(`/${locale}/account?panel=data`);
  const jobs = await db
    .from('data_operation_jobs')
    .select('id,status,attempts,created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (jobs.error) throw new Error('Data controls unavailable');
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
