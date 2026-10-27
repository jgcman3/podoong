import { SharedDiarySurface } from './shared-diary-surface';
import { SharedDiaryLanguage } from './shared-diary-language';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { BookHeart } from 'lucide-react';
import { Nest } from '@/components/nest';

// Both the diary and its not-found boundary own this frame so direct visits
// and client navigation receive the same typography and background.
export function SharedDiaryFrame({
  ko,
  children,
}: {
  ko: boolean;
  children: ReactNode;
}) {
  return (
    <SharedDiarySurface>
      <main className="shared-diary-page">
        <header className="shared-diary-brand">
          <Link href={`/${ko ? 'ko' : 'en'}/login`}>
            <Nest />
            <strong>{ko ? '포둥' : 'Podung'}</strong>
          </Link>
          <SharedDiaryLanguage ko={ko} />
        </header>
        {children}
      </main>
    </SharedDiarySurface>
  );
}
export function SharedDiaryHeading({
  title,
  description,
}: {
  title: ReactNode;
  description: string;
}) {
  return (
    <section className="diary-notebook-cover">
      <span className="diary-hero-icon" aria-hidden="true">
        <BookHeart size={24} strokeWidth={1.5} />
      </span>
      <h1 className="shared-diary-title">{title}</h1>
      <p>{description}</p>
    </section>
  );
}
