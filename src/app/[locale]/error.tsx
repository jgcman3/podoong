'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createRecordId } from '@/lib/record-id';
import { reportServiceError } from '@/features/admin/error-report';
import { type errorSections } from '@/features/admin/model';
export default function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  const path = usePathname(),
    reported = useRef<Error | null>(null);
  useEffect(() => {
    if (reported.current === error) return;
    reported.current = error;
    const part = path.split('/')[2],
      section =
        part === 'community' || part === 'share'
          ? 'diary'
          : ['today', 'calendar', 'insights', 'account', 'admin'].includes(part)
            ? part
            : 'other';
    void reportServiceError({
      id: createRecordId(),
      section: section as (typeof errorSections)[number],
      code: 'render_failed',
      digest:
        error.digest && /^\d{1,20}$/.test(error.digest) ? error.digest : null,
    });
  }, [error, path]);
  return (
    <main className="onboarding-page">
      <section className="onboard-card">
        <h1>{t('errorGeneric')}</h1>
        <button onClick={reset} className="button primary">
          {t('back')}
        </button>
      </section>
    </main>
  );
}
