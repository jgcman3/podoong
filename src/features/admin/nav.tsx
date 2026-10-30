'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquareText,
  ChartNoAxesCombined,
  Users,
  MapPin,
  Activity,
  History,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { adminSections, adminText } from './model';
const icons = [
  LayoutDashboard,
  MessageSquareText,
  ChartNoAxesCombined,
  Users,
  MapPin,
  Activity,
  History,
];
export function AdminNav({ locale }: { locale: Locale }) {
  const path = usePathname(),
    copy = adminText(locale);
  return (
    <nav
      className="admin-nav"
      aria-label={locale === 'ko' ? '관리자 메뉴' : 'Admin navigation'}
    >
      {adminSections.map((section, index) => {
        const Icon = icons[index],
          href = `/${locale}/admin${section === 'dashboard' ? '' : `/${section}`}`;
        return (
          <Link
            key={section}
            prefetch={false}
            href={href}
            aria-current={path === href ? 'page' : undefined}
          >
            <Icon size={18} />
            <span>{copy.sections[section]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
