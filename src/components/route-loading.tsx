import { LoaderCircle } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import styles from './route-loading.module.css';

export function RouteLoading({ locale }: { locale: Locale }) {
  return (
    <main className={styles.screen} aria-busy="true">
      <div className={styles.content} role="status">
        <strong>podoong</strong>
        <LoaderCircle size={22} className={styles.spinner} aria-hidden="true" />
        <span>
          {locale === 'ko'
            ? '화면을 준비하고 있어요.'
            : 'Getting things ready.'}
        </span>
      </div>
    </main>
  );
}
