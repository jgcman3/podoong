'use client';
import { useEffect, useRef } from 'react';
import type { Locale } from '@/lib/domain';
import styles from './app-splash.module.css';
export function AppSplash({ locale }: { locale: Locale }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) root.current?.setAttribute('data-dismissed', '');
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, []);
  return (
    <div
      ref={root}
      className={styles.screen}
      data-app-splash=""
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget)
          event.currentTarget.setAttribute('data-dismissed', '');
      }}
    >
      <div className={styles.content}>
        <div className={styles.mascot} />
        <strong>podoong</strong>
        <p>
          {locale === 'ko'
            ? '함께 돌보는, 포근한 둥지'
            : 'A cozy nest, cared for together'}
        </p>
      </div>
    </div>
  );
}
