'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { PlusSquare, X } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { claimInstallGuide } from './account-guide-actions';
import styles from './account-guide.module.css';

export function AccountInstallGuide({
  locale,
  child,
}: {
  locale: Locale;
  child: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const claim = useRef<Promise<boolean> | null>(null);
  const ko = locale === 'ko';
  useEffect(() => {
    let active = true;
    // A prefetched page must not consume the account's first visit.
    claim.current ??= claimInstallGuide(locale);
    void claim.current
      .then((firstVisit) => {
        const installed =
          matchMedia('(display-mode: standalone)').matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone;
        if (active && firstVisit && !installed && !dialog.current?.open)
          dialog.current?.showModal();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [locale]);
  const close = () => dialog.current?.close();
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="account-install-title"
    >
      <div className={styles.content}>
        <header>
          <PlusSquare size={28} aria-hidden="true" />
          <button
            type="button"
            onClick={close}
            aria-label={ko ? '닫기' : 'Close'}
          >
            <X size={20} />
          </button>
        </header>
        <h2 id="account-install-title">
          {ko ? '홈 화면에 포둥 추가하기' : 'Add podoong to your Home Screen'}
        </h2>
        <p>
          {ko
            ? '홈 화면에서 바로 육아 기록을 시작해 보세요. 아이 사진을 앱 아이콘으로 꾸밀 수도 있어요.'
            : 'Open your care records straight from your Home Screen. You can also make the app icon your child’s photo.'}
        </p>
        <p>
          {ko
            ? '설치 방법을 누르면 이 기기에 맞는 방법을 안내해 드려요. 나중에도 설정 메뉴에서 다시 볼 수 있어요.'
            : 'Open the installation guide for steps that match this device. You can find it again in Settings.'}
        </p>
        <footer>
          <button type="button" className="button secondary" onClick={close}>
            {ko ? '나중에' : 'Not now'}
          </button>
          <Link
            className="button"
            href={`/${locale}/install?child=${child}`}
            prefetch={false}
          >
            {ko ? '설치 방법 보기' : 'Installation guide'}
          </Link>
        </footer>
      </div>
    </dialog>
  );
}
