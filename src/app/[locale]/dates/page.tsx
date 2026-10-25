import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { loadCare } from '@/lib/data';
import { Shell } from '@/components/shell';
import { applyDates } from '@/features/family/actions';
import type { Locale } from '@/lib/domain';
export default async function Dates({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ child?: string; due?: string; birth?: string }>;
}) {
  const { locale } = await params;
  const q = await searchParams;
  const t = await getTranslations();
  const date = z
    .union([z.literal(''), z.iso.date()])
    .transform((v) => v || null);
  const parsed = z
    .object({ child: z.uuid(), due: date, birth: date })
    .refine((v) => v.due || v.birth)
    .safeParse(q);
  if (!parsed.success) redirect(`/${locale}/family?error=invalid`);
  const v = parsed.data;
  const context = await loadCare(locale, v.child, []);
  const { data: changes, error } = await context.db.rpc('preview_child_dates', {
    p_child_id: v.child,
    p_due_date: v.due,
    p_birth_date: v.birth,
  });
  if (error) redirect(`/${locale}/family?child=${v.child}&error=generic`);
  return (
    <Shell context={context} locale={locale} section="family">
      <div className="page-heading">
        <h1>{t('datePreview')}</h1>
        <p>{t('datePreviewSub')}</p>
      </div>
      <section className="panel">
        <p>
          {t('dueDate')}: {v.due ?? '—'} · {t('birthDate')}: {v.birth ?? '—'}
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('title')}</th>
                <th>{t('current')}</th>
                <th>{t('proposed')}</th>
              </tr>
            </thead>
            <tbody>
              {changes?.map((c) => (
                <tr key={c.task_id}>
                  <td>{c.title}</td>
                  <td>{c.current_due_date ?? '—'}</td>
                  <td>{c.proposed_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={applyDates}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="childId" value={v.child} />
          <input type="hidden" name="due" value={v.due ?? ''} />
          <input type="hidden" name="birth" value={v.birth ?? ''} />
          <button className="button primary">{t('applyDates')}</button>
        </form>
        <Link className="text-link" href={`/${locale}/family?child=${v.child}`}>
          {t('cancel')}
        </Link>
      </section>
    </Shell>
  );
}
