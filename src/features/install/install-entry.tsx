'use client';
import { useRef, useState, type ReactNode } from 'react';
import { Smartphone, ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { InstallSheet } from './install-sheet';

export function InstallEntry({
  locale,
  child,
  children,
}: {
  locale: Locale;
  child: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const ko = locale === 'ko';
  return (
    <>
      <section className="panel settings-install settings-action-card">
        <a
          ref={trigger}
          className="settings-action-row"
          href={`/${locale}/install?child=${child}`}
          aria-label={ko ? '홈 화면에 추가' : 'Add to Home Screen'}
          aria-haspopup="dialog"
          onClick={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
        >
          <Smartphone size={18} aria-hidden="true" />
          <span className="settings-action-copy">
            {ko ? '홈 화면에 추가' : 'Add to Home Screen'}
            <small className="settings-action-description">
              {ko
                ? '아이 사진 아이콘으로 바로 시작해요.'
                : 'Open podoong with your child’s icon.'}
            </small>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </a>
      </section>
      {open && (
        <InstallSheet
          locale={locale}
          child={child}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        >
          {children}
        </InstallSheet>
      )}
    </>
  );
}
