import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { DeviceGuide } from '@/components/device-guide';
import { InstallAppButton } from '@/components/install-app';
import { IconEditor } from './icon-editor';
import styles from './install.module.css';

export function InstallContent({
  locale,
  child,
  token,
  owner,
  prepared = false,
  inline = false,
  error,
}: {
  locale: Locale;
  child: string;
  token?: string;
  owner: boolean;
  prepared?: boolean;
  inline?: boolean;
  error?: string;
}) {
  const ko = locale === 'ko';
  return (
    <section className={styles.card}>
      <p className={styles.intro}>
        {ko
          ? '아이 사진 아이콘으로, 오늘의 기록을 바로 시작해요.'
          : 'Open today’s records from your child’s photo icon.'}
      </p>
      <IconEditor
        locale={locale}
        child={child}
        token={token}
        editable={owner}
        prepared={prepared}
        inline={inline}
      />
      {error && (
        <p role="alert">
          {ko
            ? '사진을 적용하지 못했어요. 5MB 이하의 다른 사진으로 다시 시도해주세요.'
            : 'Could not apply this photo. Try another photo under 5MB.'}
        </p>
      )}
      <div className={styles.actions}>
        {inline ? (
          <a
            className="button secondary"
            href={`/api/prepare-install?locale=${locale}&child=${encodeURIComponent(child)}`}
          >
            {ko ? '홈 화면에 추가' : 'Add to Home Screen'}
          </a>
        ) : (
          <InstallAppButton locale={locale} nativeReady={prepared} />
        )}
      </div>
      <details
        className={styles.notificationNotice}
        aria-label={ko ? '웹앱 알림 안내' : 'Web app notifications'}
      >
        <summary>
          <Bell size={17} aria-hidden="true" />
          {ko ? '필요한 소식도 받아보세요' : 'Stay in the loop'}
        </summary>
        <p>
          {ko
            ? '식사 시간 알림과 동네 친구가 보낸 인사·하트·토닥토닥을 알림으로 받을 수 있어요. 식사·놀이터 알림을 따로 켜거나 끄고, 밤에는 쉬도록 설정할 수 있어요.'
            : 'Receive feeding reminders and notifications for waves, hearts and comforting pats from neighborhood friends. Choose feeding and playground alerts separately, and set quiet hours at night.'}
        </p>
        <DeviceGuide locale={locale} purpose="notifications" />
        <Link href={`/${locale}/account?child=${child}&panel=notifications`}>
          {ko ? '알림 설정하기' : 'Set up notifications'}
        </Link>
      </details>
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
      <small className={styles.note}>
        {ko
          ? '나중에도 설정 메뉴에서 변경할 수 있어요.'
          : 'You can do this later from your child’s settings.'}
      </small>
    </section>
  );
}
