'use client';
import { useLinkStatus } from 'next/link';
import { useEffect, useState } from 'react';

// Keep fast menu transitions quiet, but retain feedback for slower requests.
export function NavigationStatus({ locale }: { locale: 'ko' | 'en' }) {
  const { pending } = useLinkStatus();
  return pending ? <DelayedStatus locale={locale} /> : null;
}

function DelayedStatus({ locale }: { locale: 'ko' | 'en' }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <span className="navigation-pending" role="status">
      <span className="sr-only">
        {locale === 'ko' ? '화면을 불러오는 중' : 'Loading page'}
      </span>
    </span>
  );
}
