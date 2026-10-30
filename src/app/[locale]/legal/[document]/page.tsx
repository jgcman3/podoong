import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { isLocale, safeReturnPath } from '@/lib/domain';
import {
  isLegalDocument,
  legalDocuments,
  readLegalDocument,
  readSignupDocument,
} from '@/features/legal/documents';
import { LegalMarkdown } from '@/features/legal/markdown';
export const metadata = { robots: { index: false, follow: false } };
export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; document: string }>;
  searchParams: Promise<{
    child?: string;
    source?: string;
    next?: string;
    version?: string;
  }>;
}) {
  const { locale, document } = await params,
    query = await searchParams;
  if (!isLocale(locale) || !isLegalDocument(document)) notFound();
  const ko = locale === 'ko';
  const doc = query.version
    ? await readSignupDocument(document, query.version)
    : await readLegalDocument(document);
  if (!doc) notFound();
  const child = z.uuid().safeParse(query.child);
  const returnTo: { source: 'signup' | 'login'; next: string } | undefined =
    query.source === 'signup' || query.source === 'login'
      ? { source: query.source, next: safeReturnPath(query.next, locale) }
      : undefined;
  const back = returnTo
    ? `/${locale}/${returnTo.source === 'signup' ? 'onboarding' : 'login'}?next=${encodeURIComponent(returnTo.next)}`
    : `/${locale}/account?panel=service${child.success ? `&child=${child.data}` : ''}`;
  return (
    <main className="legal-page">
      <header className="legal-toolbar">
        <Link href={back} aria-label={ko ? '돌아가기' : 'Back'}>
          <ArrowLeft size={21} />
        </Link>
        <span>
          {returnTo
            ? ko
              ? '가입 안내'
              : 'Signup information'
            : ko
              ? '서비스 정보'
              : 'Service information'}
        </span>
      </header>
      <article className="panel legal-document" lang="ko">
        <div className="legal-heading">
          <span className="legal-icon">
            <FileText size={22} />
          </span>
          <span className="legal-draft">
            {ko ? '검토용 초안 · 미시행' : 'Draft · not yet in effect'}
          </span>
        </div>
        <h1>
          {ko ? legalDocuments[document].ko : legalDocuments[document].en}
        </h1>
        <p className="legal-version">
          {/^[\d.]+$/.test(doc.version) ? 'v' : ''}
          {doc.version} · {doc.updated}
          {!ko ? ' · Korean original' : ''}
        </p>
        <LegalMarkdown
          body={doc.body}
          locale={locale}
          childId={child.success ? child.data : undefined}
          returnTo={returnTo}
        />
      </article>
    </main>
  );
}
