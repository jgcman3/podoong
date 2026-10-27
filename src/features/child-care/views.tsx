import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { loadCare, type CareContext } from '@/lib/data';
import type { Row } from '@/lib/db';
import { isLocale, type Locale } from '@/lib/domain';
import { Shell } from '@/components/shell';
import { Flash } from '@/components/flash';
import { ConfirmButton } from '@/components/confirm-button';
import { Timer } from '@/features/care/record-form';
import { childCopy, kindLabel } from './copy';
import { isChildService, type ChildService } from './schema';
import { ChildRecordForm, Submit } from './form';
import { DiarySharing } from '@/features/growth-community/sharing';
import { GrowthDiaryEntry } from './growth-diary';
import {
  deleteChildRecord,
  uploadChildPhoto,
  deleteChildPhoto,
} from './actions';

function timestamp(value: string, locale: Locale, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function RecordSummary({
  record,
  locale,
}: {
  record: Row<'child_records'>;
  locale: Locale;
}) {
  const t = childCopy(locale);
  return (
    <>
      {record.service === 'sleep' &&
        (record.ended_at ? (
          <p>
            {Math.round(
              ((Date.parse(record.ended_at) - Date.parse(record.occurred_at)) /
                60000) *
                10,
            ) / 10}{' '}
            {t.minutes}
          </p>
        ) : (
          <p>
            {t.running} · <Timer start={record.occurred_at} />
          </p>
        ))}
      {record.service === 'diaper' && (
        <p>
          {[record.stool_color, record.stool_texture]
            .filter(Boolean)
            .map((value) => kindLabel(value!, locale))
            .join(' · ')}
        </p>
      )}
      {record.height_cm !== null && (
        <p>
          {t.height}: {record.height_cm}
        </p>
      )}
      {record.weight_kg !== null && (
        <p>
          {t.weight}: {record.weight_kg}
        </p>
      )}
      {record.head_cm !== null && (
        <p>
          {t.head}: {record.head_cm}
        </p>
      )}
      {record.temperature_c != null && <p>{record.temperature_c} °C</p>}
      {record.medicine_name && (
        <p>
          {record.medicine_name}
          {record.dose_amount !== null &&
            record.dose_unit &&
            ` · ${record.dose_amount} ${record.dose_unit}`}
        </p>
      )}
      {record.duration_minutes != null && (
        <p>
          {record.duration_minutes} {t.minutes}
        </p>
      )}
      {record.service !== 'growth' && record.title && <p>{record.title}</p>}
      {record.note && <p className="record-note">{record.note}</p>}
    </>
  );
}
export async function ChildRecordList({
  context,
  locale,
  service,
  page: rawPage,
}: {
  context: CareContext;
  locale: Locale;
  service: ChildService;
  page?: string;
}) {
  const t = childCopy(locale);
  const number = Number(rawPage ?? 0);
  const page =
    Number.isSafeInteger(number) && number >= 0 ? Math.min(number, 10000) : 0;
  const [result, active, dayCount] = await Promise.all([
    context.db
      .from('child_records')
      .select('*')
      .eq('child_id', context.child.id)
      .eq('service', service)
      .order('occurred_at', { ascending: false })
      .order('id')
      .range(page * 30, page * 30 + 30),
    service === 'sleep'
      ? context.db
          .from('child_records')
          .select('*')
          .eq('child_id', context.child.id)
          .eq('service', 'sleep')
          .is('ended_at', null)
      : Promise.resolve({ data: [], error: null }),
    context.db.rpc('child_record_day_count', {
      p_child: context.child.id,
      p_service: service,
      p_day: context.today,
      p_timezone: context.timezone,
    }),
  ]);
  const preparing = result.error?.code === 'PGRST205';
  if (dayCount.error && !(preparing && dayCount.error.code === 'PGRST202'))
    throw new Error('Daily records unavailable');
  if (
    (result.error && !preparing) ||
    (active.error && active.error.code !== 'PGRST205')
  )
    throw new Error('Child records unavailable');
  const rows = [
    ...(active.data ?? []),
    ...(result.data ?? []).slice(0, 30),
  ].filter(
    (record, index, list) =>
      list.findIndex((value) => value.id === record.id) === index,
  );
  const photoGroups = new Map<string, string[]>();
  if (service === 'growth' && rows.length) {
    const photos = await context.db
      .from('child_record_photos')
      .select('id,record_id')
      .eq('child_id', context.child.id)
      .in(
        'record_id',
        rows.map((record) => record.id),
      )
      .order('created_at')
      .order('id')
      .limit(120);
    if (photos.error) throw new Error('Growth photos unavailable');
    for (const photo of photos.data)
      photoGroups.set(photo.record_id, [
        ...(photoGroups.get(photo.record_id) ?? []),
        photo.id,
      ]);
  }
  return (
    <>
      <div className="page-heading">
        <h1>{t[service]}</h1>
        <p>{t.privacy}</p>
      </div>
      <div className="section-heading">
        <span>{t.back}</span>
        {context.writable && !preparing && (
          <Link
            className="button primary"
            href={`/${locale}/care/${service}/new?child=${context.child.id}`}
          >
            {t.new}
          </Link>
        )}
      </div>
      {!preparing && (
        <p className="small muted">
          {t.today}: {dayCount.data ?? 0} {t.entries}
        </p>
      )}
      {!context.writable && <p className="flash">{t.readonly}</p>}
      {preparing ? (
        <p>{t.preparing}</p>
      ) : rows.length ? (
        <div className="child-record-list">
          {rows.map((record) =>
            service === 'growth' ? (
              <GrowthDiaryEntry
                key={record.id}
                record={record}
                photos={photoGroups.get(record.id) ?? []}
                locale={locale}
                childId={context.child.id}
                dateLabel={timestamp(
                  record.occurred_at,
                  locale,
                  context.timezone,
                )}
              />
            ) : (
              <article className="panel" key={record.id}>
                <Link
                  className="child-record-link"
                  href={`/${locale}/care/${service}/${record.id}?child=${context.child.id}`}
                >
                  <strong>{kindLabel(record.kind, locale)}</strong>
                  <time dateTime={record.occurred_at}>
                    {timestamp(record.occurred_at, locale, context.timezone)}
                  </time>
                </Link>
                <RecordSummary record={record} locale={locale} />
                {record.service === 'sleep' &&
                  !record.ended_at &&
                  context.writable && (
                    <Link
                      className="button secondary"
                      href={`/${locale}/care/sleep/${record.id}/edit?child=${context.child.id}`}
                    >
                      {t.stop}
                    </Link>
                  )}
              </article>
            ),
          )}
        </div>
      ) : (
        <section className="panel">
          <p>{t.empty}</p>
        </section>
      )}
      <nav className="pagination">
        {page > 0 && (
          <Link
            href={`/${locale}/services/${service}?child=${context.child.id}&page=${page - 1}`}
          >
            {t.prev}
          </Link>
        )}
        {result.data && result.data.length > 30 && (
          <Link
            href={`/${locale}/services/${service}?child=${context.child.id}&page=${page + 1}`}
          >
            {t.next}
          </Link>
        )}
      </nav>
    </>
  );
}
type PageParams = { locale: string; service: string; id?: string };
type Query = { child?: string; error?: string; notice?: string; kind?: string };
export async function ChildEditorPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Query>;
}) {
  const p = await params;
  const q = await searchParams;
  if (
    !isLocale(p.locale) ||
    !isChildService(p.service) ||
    (p.id && !z.uuid().safeParse(p.id).success)
  )
    notFound();
  const context = await loadCare(p.locale, q.child, []);
  if (!context.writable) notFound();
  const result = p.id
    ? await context.db
        .from('child_records')
        .select('*')
        .eq('id', p.id)
        .eq('child_id', context.child.id)
        .eq('service', p.service)
        .maybeSingle()
    : null;
  if (result?.error) throw new Error('Child record unavailable');
  if (p.id && !result?.data) notFound();
  const t = childCopy(p.locale);
  return (
    <Shell
      context={context}
      locale={p.locale}
      section="services"
      languageRoute={`care/${p.service}/${p.id ? `${p.id}/edit` : 'new'}`}
      childRoute={`services/${p.service}`}
    >
      <Flash error={q.error} notice={q.notice} />
      <Link
        href={`/${p.locale}/services/${p.service}?child=${context.child.id}`}
      >
        {t.back}
      </Link>
      <div className="page-heading">
        <h1>
          {t[p.service]} · {p.id ? t.edit : t.new}
        </h1>
      </div>
      <section className="panel">
        <ChildRecordForm
          key={result?.data?.id ?? context.child.id}
          locale={p.locale}
          childId={context.child.id}
          service={p.service}
          record={result?.data ?? undefined}
          defaultKind={q.kind}
          now={new Date().toISOString()}
        />
        <Link
          className="text-link"
          href={`/${p.locale}/services/${p.service}?child=${context.child.id}`}
        >
          {t.cancel}
        </Link>
      </section>
    </Shell>
  );
}
export async function ChildDetailPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Query>;
}) {
  const p = await params;
  const q = await searchParams;
  if (
    !isLocale(p.locale) ||
    !isChildService(p.service) ||
    !z.uuid().safeParse(p.id).success
  )
    notFound();
  const context = await loadCare(p.locale, q.child, []);
  const result = await context.db
    .from('child_records')
    .select('*')
    .eq('id', p.id!)
    .eq('child_id', context.child.id)
    .eq('service', p.service)
    .maybeSingle();
  if (result.error) throw new Error('Child record unavailable');
  if (!result.data) notFound();
  const record = result.data;
  const t = childCopy(p.locale);
  const photos =
    p.service === 'growth'
      ? await context.db
          .from('child_record_photos')
          .select('*')
          .eq('record_id', record.id)
          .order('created_at')
          .order('id')
      : { data: [], error: null };
  if (photos.error) throw new Error('Child photos unavailable');
  return (
    <Shell
      context={context}
      locale={p.locale}
      section="services"
      languageRoute={`care/${p.service}/${record.id}`}
      childRoute={`services/${p.service}`}
    >
      <Flash error={q.error} notice={q.notice} />
      <Link
        href={`/${p.locale}/services/${p.service}?child=${context.child.id}`}
      >
        {t.back}
      </Link>
      <div className="page-heading">
        <h1>{kindLabel(record.kind, p.locale)}</h1>
        <time dateTime={record.occurred_at}>
          {timestamp(record.occurred_at, p.locale, context.timezone)}
        </time>
      </div>
      <section className="panel">
        <RecordSummary record={record} locale={p.locale} />
        {context.writable && (
          <div className="record-actions">
            <Link
              className="button secondary"
              href={`/${p.locale}/care/${p.service}/${record.id}/edit?child=${context.child.id}`}
            >
              {t.edit}
            </Link>
            <form action={deleteChildRecord}>
              <input type="hidden" name="locale" value={p.locale} />
              <input type="hidden" name="childId" value={context.child.id} />
              <input type="hidden" name="service" value={p.service} />
              <input type="hidden" name="id" value={record.id} />
              <ConfirmButton label={t.delete} message={t.confirm} />
            </form>
          </div>
        )}
      </section>
      {p.service === 'growth' && (
        <section className="panel">
          <h2>{t.photo}</h2>
          <p className="small muted">{t.photoHelp}</p>
          <div className="child-photo-grid">
            {photos.data?.map((photo) => (
              <article key={photo.id}>
                <Image
                  src={`/api/care/photos/${photo.id}`}
                  alt={t.photo}
                  width={320}
                  height={240}
                  unoptimized
                />
                {context.writable && (
                  <form action={deleteChildPhoto}>
                    <input type="hidden" name="locale" value={p.locale} />
                    <input
                      type="hidden"
                      name="childId"
                      value={context.child.id}
                    />
                    <input type="hidden" name="recordId" value={record.id} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <ConfirmButton
                      label={t.deletePhoto}
                      message={t.photoConfirm}
                    />
                  </form>
                )}
              </article>
            ))}
          </div>
          {context.writable && (photos.data?.length ?? 0) < 4 && (
            <form action={uploadChildPhoto} className="form-stack">
              <input type="hidden" name="locale" value={p.locale} />
              <input type="hidden" name="childId" value={context.child.id} />
              <input type="hidden" name="recordId" value={record.id} />
              <label>
                {t.photo}
                <input
                  type="file"
                  name="photo"
                  accept="image/jpeg,image/png,image/webp"
                  required
                />
              </label>
              <Submit label={t.upload} />
            </form>
          )}
        </section>
      )}
      {p.service === 'growth' && context.writable && (
        <DiarySharing
          context={context}
          recordId={record.id}
          locale={p.locale}
        />
      )}
    </Shell>
  );
}
