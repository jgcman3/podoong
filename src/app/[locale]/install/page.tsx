import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { InstallAppButton } from '@/components/install-app';
import { IconEditor } from '@/features/install/icon-editor';
import styles from '@/features/install/install.module.css';

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ child?: string; error?: string; ready?: string }>;
};
async function installation(locale: Locale, child?: string) {
  const { db } = await requireUser(locale);
  let query = db
    .from('children')
    .select('id,name,family_id')
    .order('created_at')
    .limit(1);
  if (child) query = query.eq('id', child);
  const { data, error } = await query;
  if (error) throw new Error('Child unavailable');
  const selected = data?.[0];
  if (!selected) redirect(`/${locale}/today`);
  const [icon, owner] = await Promise.all([
    db
      .from('child_app_icons')
      .select('token')
      .eq('child_id', selected.id)
      .maybeSingle(),
    db.rpc('is_family_owner', { fid: selected.family_id }),
  ]);
  if (icon.error || owner.error) throw new Error('Installation unavailable');
  return { selected, token: icon.data?.token, owner: Boolean(owner.data) };
}
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { locale } = await params;
  const { selected, token } = await installation(
    locale,
    (await searchParams).child,
  );
  return {
    title: locale === 'ko' ? '우리 아이와 시작하기' : 'Start with your child',
    robots: { index: false, follow: false },
    ...(token
      ? {
          manifest: `/api/app-manifest/${token}`,
          icons: {
            icon: `/api/app-icon/${token}/192`,
            apple: `/api/app-icon/${token}/180`,
          },
        }
      : {
          manifest: '/manifest.webmanifest',
          icons: {
            icon: '/icons/podung-192.png?v=full-20261029',
            apple: '/icons/podung-180.png?v=full-20261029',
          },
        }),
    appleWebApp: {
      capable: true,
      title: selected.name,
      statusBarStyle: 'default',
    },
  };
}
export default async function Install({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const { selected, token, owner } = await installation(locale, query.child);
  const ko = locale === 'ko';
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <span className={styles.brand}>podoong</span>
        <h1>
          {ko
            ? '홈 화면에서도, 우리 아이와'
            : 'Your little one, on your Home Screen'}
        </h1>
        <p>
          {ko
            ? '아이 사진으로 포둥 아이콘을 꾸며보세요. 홈 화면에서 바로 기록할 수 있어요.'
            : 'Make podoong’s app icon your child’s photo, and open your records from your Home Screen.'}
        </p>
        <IconEditor
          locale={locale}
          child={selected.id}
          name={selected.name}
          token={token}
          editable={owner}
        />
        {query.error && (
          <p role="alert">
            {ko
              ? '사진을 적용하지 못했어요. 5MB 이하의 다른 사진으로 다시 시도해주세요.'
              : 'Could not apply this photo. Try another photo under 5MB.'}
          </p>
        )}
        <div className={styles.actions}>
          {query.ready === '1' && <InstallAppButton locale={locale} />}
        </div>
        <p className={styles.note}>
          {ko
            ? '사진을 적용한 다음 홈 화면에 추가해주세요. 이미 설치했다면 아이콘을 바꾸기 위해 삭제 후 다시 추가해야 할 수 있어요.'
            : 'Apply your photo before installing. If already installed, you may need to remove and add the app again to change its icon.'}
        </p>
        <Link
          className={styles.continue}
          href={`/${locale}/today?child=${selected.id}`}
        >
          {ko ? '포둥 시작하기' : 'Start using podoong'} <span aria-hidden="true">→</span>
        </Link>
        <small className={styles.note}>
          {ko
            ? '나중에도 아이 이름 메뉴에서 설정할 수 있어요.'
            : 'You can do this later from your child’s settings.'}
        </small>
      </section>
    </main>
  );
}
