'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import styles from './install.module.css';

export function InstallSheet({
  locale,
  child,
  children,
  onClose,
}: {
  locale: Locale;
  child: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const close = () => {
    if (onClose) {
      dialog.current?.close();
      onClose();
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Restore Settings after installation rewrote the document URL to Today.
    window.location.assign(
      `/${locale}/account?child=${encodeURIComponent(child)}`,
    );
  };
  useEffect(() => {
    const current = dialog.current;
    // Keep server-rendered guidance usable before hydration, then make it modal.
    if (current?.open) current.close();
    current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      current?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      open
      className={styles.sheet}
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <header className={styles.sheetHeader}>
        <span className={styles.handle} aria-hidden="true" />
        <h2 id={title}>
          {locale === 'ko' ? '홈 화면에 추가' : 'Add to Home Screen'}
        </h2>
        <form action={`/${locale}/account`} method="get">
          <input type="hidden" name="child" value={child} />
          <button
            type="submit"
            onClick={(event) => {
              event.preventDefault();
              close();
            }}
            aria-label={locale === 'ko' ? '닫기' : 'Close'}
          >
            <X size={20} />
          </button>
        </form>
      </header>
      <div className={styles.sheetBody}>{children}</div>
    </dialog>
  );
}
