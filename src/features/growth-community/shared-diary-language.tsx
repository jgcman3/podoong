'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Languages } from 'lucide-react';
export function SharedDiaryLanguage({ ko }: { ko: boolean }) {
  const pathname = usePathname();
  const locale = ko ? 'en' : 'ko';
  return (
    <Link
      replace
      className="shared-diary-language"
      href={pathname.replace(/^\/(ko|en)(?=\/|$)/, `/${locale}`)}
      hrefLang={locale}
      lang={locale}
      aria-label={ko ? 'Switch to English' : '한국어로 보기'}
    >
      <Languages size={15} strokeWidth={1.6} aria-hidden="true" />
      {ko ? 'English' : '한국어'}
    </Link>
  );
}
