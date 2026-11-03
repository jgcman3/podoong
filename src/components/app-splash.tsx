'use client';
import { useEffect, useRef } from 'react';
import type { Locale } from '@/lib/domain';
import styles from './app-splash.module.css';
export function AppSplash({ locale }: { locale: Locale }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let first = 0,
      second = 0;
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() =>
          root.current?.setAttribute('data-dismissed', ''),
        );
      });
    };
    // No minimum wait: leave after the initial document loads, with a safety cap.
    const deadline = window.setTimeout(dismiss, 4000);
    if (document.readyState === 'complete') dismiss();
    else window.addEventListener('load', dismiss, { once: true });
    const restore = () => dismiss();
    window.addEventListener('pageshow', restore);
    return () => {
      window.clearTimeout(deadline);
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      window.removeEventListener('load', dismiss);
      window.removeEventListener('pageshow', restore);
    };
  }, []);
  return (
    <div
      ref={root}
      className={styles.screen}
      data-app-splash=""
      aria-hidden="true"
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
