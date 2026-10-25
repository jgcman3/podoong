import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { isLocale } from '@/lib/domain';
import { notificationCopy } from '@/features/notifications/copy';
import { notificationAction } from '@/features/notifications/actions';
import { pollCopy, pollOptions } from '@/features/polls/copy';
import { pollAction } from '@/features/polls/actions';
export default async function Operations({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; error?: string; notice?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { db } = await requireUser(locale);
  const t = notificationCopy(locale),
    p = pollCopy(locale);
  const q = await searchParams;
  const { data: moderator, error: modError } = await db.rpc('is_moderator');
  if (modError) throw new Error('Operations unavailable');
  if (!moderator) notFound();
  const raw = Number(q.page);
  const page = Number.isSafeInteger(raw) && raw >= 0 ? Math.min(raw, 1000) : 0;
  const [jobs, questions] = await Promise.all([
    db
      .from('notification_job_runs')
      .select('id,started_at,status,attempts,error_code,delivered_count')
      .order('started_at', { ascending: false })
      .order('id')
      .range(page * 30, page * 30 + 30),
    db
      .from('daily_polls')
      .select('*')
      .order('day', { ascending: false })
      .limit(30),
  ]);
  if (jobs.error || questions.error) throw new Error('Operations unavailable');
  return (
    <main className="main-content">
      <nav>
        <Link href={`/${locale}/today`}>{t.home}</Link> ·{' '}
        <Link href={`/${locale}/notifications`}>{t.title}</Link> ·{' '}
        <Link href={`/${locale}/polls`}>{t.polls}</Link> ·{' '}
        <Link href={`/${locale === 'ko' ? 'en' : 'ko'}/operations`}>
          {locale === 'ko' ? 'English' : '한국어'}
        </Link>
      </nav>
      <h1>{t.operations}</h1>
      <p>
        <Link href={`/${locale}/data`}>
          {locale === 'ko'
            ? '데이터 삭제 작업과 이용 집계'
            : 'Deletion jobs and usage metrics'}
        </Link>
      </p>
      {q.error && <p role="alert">{t.error}</p>}
      {q.notice && <p role="status">{t.saved}</p>}
      <section className="panel">
        <h2>{t.jobs}</h2>
        <p>{t.info}</p>
        {!jobs.data?.length && <p>{t.noJobs}</p>}
        {jobs.data?.slice(0, 30).map((job) => (
          <article key={job.id}>
            <p>
              {job.started_at} · {t.status}:{' '}
              {t[job.status as 'running' | 'succeeded' | 'failed']} ·{' '}
              {t.attempts}: {job.attempts} · {t.count}: {job.delivered_count}
              {job.error_code && (
                <>
                  {' '}
                  · {t.failure}: <code>{job.error_code}</code>
                </>
              )}
            </p>
            {job.status === 'failed' && (
              <form action={notificationAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="action" value="retry" />
                <input type="hidden" name="id" value={job.id} />
                <button className="button">{t.retry}</button>
              </form>
            )}
          </article>
        ))}
        <nav>
          {page > 0 && (
            <Link href={`/${locale}/operations?page=${page - 1}`}>
              {t.prev}
            </Link>
          )}{' '}
          {jobs.data && jobs.data.length > 30 && (
            <Link href={`/${locale}/operations?page=${page + 1}`}>
              {t.next}
            </Link>
          )}
        </nav>
      </section>
      <section className="panel">
        <h2>{p.create}</h2>
        <p>{p.configuration}</p>
        <form action={pollAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="action" value="save" />
          <label>
            {p.id}
            <input
              name="id"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </label>
          <label>
            {p.day}
            <input name="day" type="date" required />
          </label>
          <label>
            {p.questionKo}
            <input name="questionKo" maxLength={300} required />
          </label>
          <label>
            {p.questionEn}
            <input name="questionEn" maxLength={300} required />
          </label>
          {Array.from({ length: 6 }, (_, index) => (
            <fieldset key={index}>
              <legend>{index + 1}</legend>
              <label>
                {p.optionKo}
                <input
                  name={`ko${index}`}
                  maxLength={120}
                  required={index < 2}
                />
              </label>
              <label>
                {p.optionEn}
                <input
                  name={`en${index}`}
                  maxLength={120}
                  required={index < 2}
                />
              </label>
            </fieldset>
          ))}
          <button className="button">{p.submit}</button>
        </form>
      </section>
      {questions.data?.map((poll) => (
        <section className="panel" key={poll.id}>
          <p>
            {poll.day} · {poll.hidden ? p.hidden : ''}
          </p>
          <h2>{locale === 'ko' ? poll.question_ko : poll.question_en}</h2>
          <p>
            {p.opens}: {poll.opens_at} · {p.closes}: {poll.closes_at}
          </p>
          <details>
            <summary>{p.edit}</summary>
            <form action={pollAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="action" value="save" />
              <input type="hidden" name="id" value={poll.id} />
              <label>
                {p.day}
                <input
                  name="day"
                  type="date"
                  defaultValue={poll.day}
                  required
                />
              </label>
              <label>
                {p.questionKo}
                <input
                  name="questionKo"
                  defaultValue={poll.question_ko}
                  maxLength={300}
                  required
                />
              </label>
              <label>
                {p.questionEn}
                <input
                  name="questionEn"
                  defaultValue={poll.question_en}
                  maxLength={300}
                  required
                />
              </label>
              {Array.from({ length: 6 }, (_, i) => {
                const option = pollOptions(poll.options)[i];
                return (
                  <fieldset key={i}>
                    <legend>{i + 1}</legend>
                    <label>
                      {p.optionKo}
                      <input
                        name={`ko${i}`}
                        defaultValue={option?.ko ?? ''}
                        required={i < 2}
                        maxLength={120}
                      />
                    </label>
                    <label>
                      {p.optionEn}
                      <input
                        name={`en${i}`}
                        defaultValue={option?.en ?? ''}
                        required={i < 2}
                        maxLength={120}
                      />
                    </label>
                  </fieldset>
                );
              })}
              <button
                className="button"
                disabled={
                  new Date().getTime() >= new Date(poll.opens_at!).getTime()
                }
              >
                {p.submit}
              </button>
            </form>
          </details>
          <form action={pollAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="action" value="hide" />
            <input type="hidden" name="id" value={poll.id} />
            <input type="hidden" name="hidden" value={String(!poll.hidden)} />
            <label>
              {p.reason}
              <input name="reason" maxLength={500} required />
            </label>
            <button className="button">
              {poll.hidden ? p.unhide : p.hide}
            </button>
          </form>
        </section>
      ))}
    </main>
  );
}
