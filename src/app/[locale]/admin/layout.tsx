import Link from 'next/link';
import { ShieldCheck, ArrowUpRight, LogOut } from 'lucide-react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/domain';
import { adminSession } from '@/features/admin/auth';
import { adminText } from '@/features/admin/model';
import { AdminNav } from '@/features/admin/nav';
import { adminLogout } from '@/features/admin/actions';
export const metadata = {
  title: '운영 관리자',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { user } = await adminSession(locale),
    copy = adminText(locale),
    ko = locale === 'ko';
  return (
    <div className="podung-admin">
      <header className="admin-header">
        <Link href={`/${locale}/admin`} className="admin-brand">
          <span>
            <ShieldCheck size={23} />
          </span>
          <strong>{copy.title}</strong>
          <small>ADMIN</small>
        </Link>
        <div className="admin-header-actions">
          <span className="admin-session">
            {user.email || (ko ? '운영자 계정' : 'Operator account')}
          </span>
          <Link href={`/${locale}/today`} className="admin-app-link">
            {ko ? '서비스' : 'App'}
            <ArrowUpRight size={16} />
          </Link>
          <form action={adminLogout}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="admin-icon-button"
              aria-label={ko ? '관리자 로그아웃' : 'Sign out'}
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </header>
      <div className="admin-workspace">
        <aside>
          <AdminNav locale={locale} />
          <p className="admin-sidebar-note">
            {ko ? '서비스 운영 전용' : 'Service operations'}
            <br />
            {ko ? '서울 데이터베이스' : 'Seoul database'}
          </p>
        </aside>
        <main className="admin-main" id="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
