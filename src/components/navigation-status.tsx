'use client';
import { useLinkStatus } from 'next/link';

// A Link's pending state starts before its server response arrives.
export function NavigationStatus({ locale }: { locale: 'ko' | 'en' }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <span className="navigation-pending" role="status">
      <span className="sr-only">
        {locale === 'ko' ? '화면을 불러오는 중' : 'Loading page'}
      </span>
    </span>
  ) : null;
}
