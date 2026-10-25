'use client';
import { useTranslations } from 'next-intl';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations();
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
