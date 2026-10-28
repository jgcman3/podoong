import Link from 'next/link';
import { ShieldCheck, ChevronRight, Heart } from 'lucide-react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { loadCare, type CareContext } from '@/lib/data';
import { isLocale, type Locale } from '@/lib/domain';
import type { Row } from '@/lib/db';
import { Shell } from '@/components/shell';
import { Flash } from '@/components/flash';
import { ConfirmButton } from '@/components/confirm-button';
import { vaccinationCopy, vaccineName, sources } from './copy';
import { VaccinationForm } from './form';
import { deleteVaccination } from './actions';
import { relativeDay } from '@/features/care/calendar-model';
type Vaccination = Row<'vaccination_records'>;
function Summary({
  record: r,
  locale,
}: {
  record: Vaccination;
  locale: Locale;
}) {
  const t = vaccinationCopy(locale);
  return (
    <>
      <p>
        {r.status === 'completed' ? t.completed : t.planned} ·{' '}
        {r.status === 'completed' ? r.completed_date : r.scheduled_date}
      </p>
      {r.dose !== null && (
        <p>
          {t.dose}: {r.dose}
        </p>
      )}
      {r.season && (
        <p>
          {t.season}: {r.season}
        </p>
      )}
      {r.clinic && (
        <p>
          {t.clinic}: {r.clinic}
        </p>
      )}
      {r.note && <p className="record-note">{r.note}</p>}
    </>
  );
}
function Guidance({ locale }: { locale: Locale }) {
  const t = vaccinationCopy(locale);
  return (
    <section className="panel content-guide">
      <h2>{t.guideTitle}</h2>
      <p>{t.guideBody}</p>
      <a
        className="text-link"
        href={sources.schedule}
        target="_blank"
        rel="noreferrer"
      >
        {t.scheduleLink} ↗
      </a>
      <h2>{t.fluTitle}</h2>
      <p>{t.fluBody}</p>
      <p>
        <a
          className="text-link"
          href={sources.flu}
          target="_blank"
          rel="noreferrer"
        >
          {t.fluLink} ↗
        </a>
      </p>
      <p>
        <a
          className="text-link"
          href={sources.clinic}
          target="_blank"
          rel="noreferrer"
        >
          {t.clinicLink} ↗
        </a>
      </p>
      <p className="small muted">{t.verified}</p>
      <p className="small muted">{t.region}</p>
    </section>
  );
}
export async function VaccinationList({
  context,
  locale,
  tab: rawTab,
  page: rawPage,
}: {
  context: CareContext;
  locale: Locale;
  tab?: string;
  page?: string;
}) {
  const t = vaccinationCopy(locale);
  const tab = rawTab === 'completed' || rawTab === 'guide' ? rawTab : 'planned';
  const n = Number(rawPage ?? 0);
  const page = Number.isSafeInteger(n) && n >= 0 ? Math.min(n, 10000) : 0;
  const base = `/${locale}/vaccinations?child=${context.child.id}`;
  const result =
    tab === 'guide'
      ? null
      : await context.db
          .from('vaccination_records')
          .select('*')
          .eq('child_id', context.child.id)
          .eq('status', tab)
          .order(tab === 'completed' ? 'completed_date' : 'scheduled_date', {
            ascending: tab === 'planned',
          })
          .order('id')
          .range(page * 30, page * 30 + 30);
  if (result?.error) throw new Error('Vaccinations unavailable');
  return (
    <>
      <div className="page-heading">
        <h1>{t.title}</h1>
        <p>{t.history}</p>
      </div>
      <nav className="section-heading" aria-label={t.title}>
        {(['planned', 'completed', 'guide'] as const).map((key) => (
          <Link
            className={tab === key ? 'button primary' : 'button secondary'}
            aria-current={tab === key ? 'page' : undefined}
            key={key}
            href={`${base}&tab=${key}`}
          >
            {t[key]}
          </Link>
        ))}
      </nav>
      {tab === 'guide' ? (
        <Guidance locale={locale} />
      ) : (
        <>
          <div className="section-heading">
            <h2>{t[tab]}</h2>
            {context.writable && (
              <Link
                className="button primary"
                href={`/${locale}/vaccination/new?child=${context.child.id}`}
              >
                {t.add}
              </Link>
            )}
          </div>
          {!context.writable && <p className="flash">{t.readonly}</p>}
          {result?.data?.length ? (
            <div className="list-grid">
              {result.data.slice(0, 30).map((r) => (
                <article className="panel" key={r.id}>
                  <Link
                    className="text-link"
                    href={`/${locale}/vaccination/${r.id}?child=${context.child.id}`}
                  >
                    <h3>{vaccineName(r.vaccine, r.custom_name, locale)}</h3>
                  </Link>
                  <Summary record={r} locale={locale} />
                  {tab === 'planned' && r.scheduled_date! < context.today && (
                    <span className="badge planned">{t.overdue}</span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <section className="panel">
              <p>{t.empty}</p>
            </section>
          )}
          <nav className="section-heading">
            {page > 0 && (
              <Link
                className="text-link"
                href={`${base}&tab=${tab}&page=${page - 1}`}
              >
                {t.previous}
              </Link>
            )}
            {(result?.data?.length ?? 0) > 30 && (
              <Link
                className="text-link"
                href={`${base}&tab=${tab}&page=${page + 1}`}
              >
                {t.nextPage}
              </Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}
type PageProps = {
  params: Promise<{ locale: string; id?: string }>;
  searchParams: Promise<{ child?: string; error?: string; notice?: string }>;
};
async function pageContext(props: PageProps) {
  const p = await props.params;
  const q = await props.searchParams;
  if (!isLocale(p.locale) || (p.id && !z.uuid().safeParse(p.id).success))
    notFound();
  const locale = p.locale;
  const context = await loadCare(locale, q.child, []);
  const result = p.id
    ? await context.db
        .from('vaccination_records')
        .select('*')
        .eq('id', p.id)
        .eq('child_id', context.child.id)
        .maybeSingle()
    : null;
  if (result?.error) throw new Error('Vaccination unavailable');
  if (p.id && !result?.data) notFound();
  return { locale, context, record: result?.data ?? undefined, q };
}
export async function VaccinationEditor(props: PageProps) {
  const { locale, context, record, q } = await pageContext(props);
  if (!context.writable) notFound();
  const t = vaccinationCopy(locale);
  return (
    <Shell
      context={context}
      locale={locale}
      section="calendar"
      languageRoute={`vaccination/${record ? `${record.id}/edit` : 'new'}`}
      childRoute="vaccinations"
    >
      <Flash error={q.error} notice={q.notice} />
      <Link
        className="text-link"
        href={`/${locale}/vaccinations?child=${context.child.id}`}
      >
        {t.back}
      </Link>
      <div className="page-heading">
        <h1>{record ? t.editing : t.new}</h1>
      </div>
      <section className="panel">
        <VaccinationForm
          locale={locale}
          childId={context.child.id}
          today={context.today}
          timezone={context.timezone}
          record={record}
        />
      </section>
    </Shell>
  );
}
export async function VaccinationDetail(props: PageProps) {
  const { locale, context, record, q } = await pageContext(props);
  if (!record) notFound();
  const t = vaccinationCopy(locale);
  return (
    <Shell
      context={context}
      locale={locale}
      section="calendar"
      languageRoute={`vaccination/${record.id}`}
      childRoute="vaccinations"
    >
      <Flash error={q.error} notice={q.notice} />
      <Link
        className="text-link"
        href={`/${locale}/vaccinations?child=${context.child.id}&tab=${record.status}`}
      >
        {t.back}
      </Link>
      <div className="page-heading">
        <h1>{vaccineName(record.vaccine, record.custom_name, locale)}</h1>
        <p>{t.history}</p>
      </div>
      <section className="panel">
        <Summary record={record} locale={locale} />
        {context.writable && (
          <div className="section-heading">
            <Link
              className="button secondary"
              href={`/${locale}/vaccination/${record.id}/edit?child=${context.child.id}`}
            >
              {t.edit}
            </Link>
            <form action={deleteVaccination}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="childId" value={context.child.id} />
              <ConfirmButton label={t.remove} message={t.confirm} />
            </form>
          </div>
        )}
      </section>
    </Shell>
  );
}
export async function UpcomingVaccinations({
  context,
  locale,
}: {
  context: CareContext;
  locale: Locale;
}) {
  const t = vaccinationCopy(locale);
  const result = await context.db
    .from('vaccination_records')
    .select('*')
    .eq('child_id', context.child.id)
    .eq('status', 'planned')
    .order('scheduled_date')
    .order('id')
    .limit(3);
  if (result.error) throw new Error('Planned vaccinations unavailable');
  return (
    <section className="panel events-panel">
      <div className="panel-heading">
        <h2>
          <ShieldCheck size={19} />
          {t.next}
        </h2>
        <Link href={`/${locale}/vaccinations?child=${context.child.id}`}>
          {t.all}
          <ChevronRight size={15} />
        </Link>
      </div>
      {result.data.length ? (
        <div className="event-grid">
          {result.data.map((r) => (
            <article className="event-tile" key={r.id}>
              <div className="event-date" aria-hidden="true">
                <span>{r.scheduled_date!.slice(5, 7)}</span>
                <strong>{r.scheduled_date!.slice(8)}</strong>
              </div>
              <div>
                <strong>
                  <Link
                    aria-label={`${r.scheduled_date} · ${vaccineName(r.vaccine, r.custom_name, locale)}`}
                    href={`/${locale}/vaccination/${r.id}?child=${context.child.id}`}
                  >
                    {vaccineName(r.vaccine, r.custom_name, locale)}
                  </Link>
                </strong>
                <span className="event-countdown">
                  {relativeDay(r.scheduled_date!, context.today, locale)}
                </span>
                <p>
                  {[
                    r.dose !== null ? `${t.dose}: ${r.dose}` : null,
                    r.season,
                    r.clinic,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {r.scheduled_date! < context.today && (
                  <span className="badge planned">{t.overdue}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Heart size={22} />
          </span>
          <strong>{t.empty}</strong>
        </div>
      )}
    </section>
  );
}
