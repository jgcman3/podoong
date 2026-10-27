import type { ReactNode } from 'react';
import styles from './quick-field-title.module.css';

export function QuickFieldTitle({ children }: { children: ReactNode }) {
  return <span className={styles.title}>{children}</span>;
}
