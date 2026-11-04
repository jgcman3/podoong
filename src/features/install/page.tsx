import { appleStartupImages } from '@/lib/app-startup.mjs';
import { appName, appManifestPath } from './manifest';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { DeviceGuide } from '@/components/device-guide';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { InstallAppButton } from '@/components/install-app';
import { IconEditor } from '@/features/install/icon-editor';
import styles from '@/features/install/install.module.css';

export type InstallProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ child?: string; error?: string; ready?: string }>;
};
async function installation(locale: Locale, child?: string) {
  const { db } = await requireUser(locale);
  let query = db
    .from('children')
    .select('id,family_id')
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
export async function installationMetadata({
  params,
  searchParams,
}: InstallProps): Promise<Metadata> {
  const { locale } = await params;
  const { token } = await installation(locale, (await searchParams).child);
  return {
    title: { absolute: appName(locale) },
    applicationName: appName(locale),
    robots: { index: false, follow: false },
    ...(token
      ? {
          manifest: appManifestPath(locale, token),
          icons: {
            icon: `/api/app-icon/${token}/192`,
            apple: `/api/app-icon/${token}/180`,
          },
        }
      : {
          manifest: appManifestPath(locale),
          icons: {
            icon: '/icons/podung-192.png?v=full-20261029',
            apple: '/icons/podung-180.png?v=full-20261029',
          },
        }),
    appleWebApp: {
      capable: true,
      title: appName(locale),
      statusBarStyle: 'default',
      startupImage: appleStartupImages(),
    },
  };
}
export async function Installation({ params, searchParams }: InstallProps) {
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
          token={token}
          editable={owner}
          prepared={query.ready === '1'}
        />
        {query.error && (
          <p role="alert">
            {ko
              ? '사진을 적용하지 못했어요. 5MB 이하의 다른 사진으로 다시 시도해주세요.'
              : 'Could not apply this photo. Try another photo under 5MB.'}
          </p>
        )}
        <div className={styles.actions}>
          <InstallAppButton locale={locale} nativeReady={query.ready === '1'} />
        </div>
        <aside
          className={styles.notificationNotice}
          aria-label={ko ? '웹앱 알림 안내' : 'Web app notifications'}
        >
          <strong>
            <Bell size={17} aria-hidden="true" />
            {ko ? '필요한 소식도 받아보세요' : 'Stay in the loop'}
          </strong>
          <p>
            {ko
              ? '식사 시간 알림과 동네 친구가 보낸 인사·하트·토닥토닥을 알림으로 받을 수 있어요. 식사·놀이터 알림을 따로 켜거나 끄고, 밤에는 쉬도록 설정할 수 있어요.'
              : 'Receive feeding reminders and notifications for waves, hearts and comforting pats from neighborhood friends. Choose feeding and playground alerts separately, and set quiet hours at night.'}
          </p>
          <DeviceGuide locale={locale} purpose="notifications" />
          <Link
            href={`/${locale}/account?child=${selected.id}&panel=notifications`}
          >
            {ko ? '알림 설정하기' : 'Set up notifications'}
          </Link>
        </aside>
        <aside
          className={styles.reinstallNotice}
          aria-label={ko ? '아이콘 사진 변경 안내' : 'Updating your app icon'}
        >
          <strong>
            {ko
              ? '설치한 웹앱의 사진을 바꿀 때'
              : 'Changing the photo of an installed app'}
          </strong>
          <p>
            {ko
              ? '기존 포둥 앱 삭제 → 브라우저에서 포둥 열기 → 홈 화면에 다시 추가'
              : 'Remove the existing podoong app → open podoong in your browser → add it to your Home Screen again'}
          </p>
          <small>
            {ko
              ? '새 사진은 다시 설치한 아이콘에 반영돼요. 저장한 육아 기록은 유지됩니다. 로그인이나 알림 설정은 다시 필요할 수 있어요.'
              : 'Reinstall to use the new photo. Your saved care records are kept. You may need to sign in or enable notifications again.'}
          </small>
        </aside>
        {/* A full load leaves setup after its address has become the Today URL. */}
        <a
          className={styles.continue}
          href={`/${locale}/today?child=${selected.id}`}
        >
          {ko ? '포둥 시작하기' : 'Start using podoong'}{' '}
          <span aria-hidden="true">→</span>
        </a>
        <small className={styles.note}>
          {ko
            ? '나중에도 아이 이름 메뉴에서 설정할 수 있어요.'
            : 'You can do this later from your child’s settings.'}
        </small>
      </section>
    </main>
  );
}
