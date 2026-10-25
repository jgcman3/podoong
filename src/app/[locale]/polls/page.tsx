import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/data';
import { dateInTimeZone, isLocale } from '@/lib/domain';
import { pollCopy, pollOptions, pollCounts } from '@/features/polls/copy';
import { examplePolls } from '@/features/polls/examples';
import { pollAction } from '@/features/polls/actions';
export default async function Polls({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; error?: string; notice?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { db, user } = await requireUser(locale);
  const t = pollCopy(locale);
  const q = await searchParams;
  const today = dateInTimeZone(new Date(), 'Asia/Seoul');
  const raw = Number(q.page);
  const page = Number.isSafeInteger(raw) && raw >= 0 ? Math.min(raw, 1000) : 0;
  const { data: polls, error } = await db
    .from('daily_polls')
    .select('*')
    .eq('hidden', false)
    .lte('day', today)
    .order('day', { ascending: false })
    .range(page * 10, page * 10 + 10);
  if (error && error.code !== 'PGRST205') throw new Error('Polls unavailable');
  const preview = page === 0 && !polls?.length;
  const visible = preview ? examplePolls(today) : (polls ?? []).slice(0, 10);
  const ownVotes =
    !preview && visible.length
      ? await db
          .from('daily_poll_votes')
          .select('poll_id,option_index')
          .in(
            'poll_id',
            visible.map((poll) => poll.id),
          )
          .eq('user_id', user.id)
      : { data: [], error: null };
  if (ownVotes.error) throw new Error('Poll results unavailable');
  const ownByPoll = new Map(
    (ownVotes.data ?? []).map((vote) => [vote.poll_id, vote]),
  );
  const entries = await Promise.all(
    visible.map(async (poll) => {
      const results = preview
        ? { data: { total: 0, counts: {} }, error: null }
        : await db.rpc('poll_results', { p_id: poll.id });
      if (results.error) throw new Error('Poll results unavailable');
      return {
        poll,
        own: ownByPoll.get(poll.id),
        results: pollCounts(results.data),
      };
    }),
  );
  return (
    <main className="main-content">
      <nav>
        <Link href={`/${locale}/today`}>{t.home}</Link> ·{' '}
        <Link href={`/${locale === 'ko' ? 'en' : 'ko'}/polls`}>
          {locale === 'ko' ? 'English' : '한국어'}
        </Link>
      </nav>
      <h1>{t.title}</h1>
      <p>{t.basis}</p>
      <p>{t.privacy}</p>
      {q.error && <p role="alert">{t.error}</p>}
      {q.notice && <p role="status">{t.saved}</p>}
      <nav className="board-links">
        <a href="#current">
          {locale === 'ko' ? '오늘의 투표' : "Today's poll"}
        </a>
        <a href="#history">
          {locale === 'ko' ? '지난 투표 목록' : 'Past polls'}
        </a>
      </nav>
      {preview && (
        <p className="flash">
          {locale === 'ko'
            ? '미리보기: 관리자가 등록한 상황을 보여주는 예시 질문입니다. 실제 투표와 참여 집계에는 포함되지 않습니다.'
            : 'Preview questions show how published polls look. They do not accept real votes or contribute to participation counts.'}
        </p>
      )}
      <h2 id="current">{locale === 'ko' ? '오늘의 투표' : "Today's poll"}</h2>
      {!entries.some(({ poll }) => poll.day === today) && <p>{t.empty}</p>}
      {entries.map(({ poll, own, results }, index) => {
        const options = pollOptions(poll.options);
        const open =
          !preview &&
          new Date().getTime() >= new Date(poll.opens_at!).getTime() &&
          new Date().getTime() < new Date(poll.closes_at!).getTime();
        return (
          <div key={poll.id}>
            {poll.day < today &&
              (index === 0 || entries[index - 1].poll.day >= today) && (
                <h2 id="history">
                  {locale === 'ko' ? '지난 투표 목록' : 'Past polls'}
                </h2>
              )}
            <article className="panel">
              <p>
                {poll.day} ·{' '}
                {preview && poll.day === today
                  ? locale === 'ko'
                    ? '예시 질문'
                    : 'Example question'
                  : open
                    ? t.vote
                    : t.closed}
              </p>
              <h2>{locale === 'ko' ? poll.question_ko : poll.question_en}</h2>
              {!preview && (
                <p>
                  {t.total}: {results.total}
                </p>
              )}
              <form action={pollAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="action" value="vote" />
                <input type="hidden" name="id" value={poll.id} />
                <fieldset disabled={!open}>
                  <legend>{t.selected}</legend>
                  {options.map((option, index) => (
                    <label key={index}>
                      <input
                        type="radio"
                        name="option"
                        value={index}
                        defaultChecked={own?.option_index === index}
                        required
                      />
                      {option[locale]}
                      {!preview && (
                        <>
                          {' '}
                          · {results.counts[String(index)] ?? 0} {t.votes}
                        </>
                      )}
                    </label>
                  ))}
                  {open && <button className="button">{t.vote}</button>}
                </fieldset>
              </form>
            </article>
          </div>
        );
      })}
      {!entries.some(({ poll }) => poll.day < today) && (
        <section id="history">
          <h2>{locale === 'ko' ? '지난 투표 목록' : 'Past polls'}</h2>
          <p>{t.empty}</p>
        </section>
      )}
      <nav>
        {page > 0 && (
          <Link href={`/${locale}/polls?page=${page - 1}`}>{t.prev}</Link>
        )}{' '}
        {polls && polls.length > 10 && (
          <Link href={`/${locale}/polls?page=${page + 1}`}>{t.next}</Link>
        )}
      </nav>
    </main>
  );
}
