'use client';

import { useSyncExternalStore } from 'react';
import type { Locale } from '@/lib/domain';
import {
  devicePlatform,
  type DevicePlatform,
  type DesktopBrowser,
} from '@/lib/device-platform';
import { DesktopInstallGuide } from './desktop-install-guide';
import {
  InstallVisualGuide,
  NotificationGuideImage,
} from './install-visual-guide';
import styles from './install-app.module.css';

function subscribe(change: () => void) {
  const media = matchMedia('(display-mode: standalone)');
  media.addEventListener('change', change);
  window.addEventListener('focus', change);
  return () => {
    media.removeEventListener('change', change);
    window.removeEventListener('focus', change);
  };
}
function snapshot() {
  const platform = devicePlatform(
    navigator.userAgent,
    navigator.platform,
    navigator.maxTouchPoints,
  );
  const installed =
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone;
  return `${platform}:${installed ? 'installed' : 'browser'}`;
}

export function DeviceGuide({
  locale,
  purpose = 'notifications',
  initialPlatform = 'desktop',
  initialBrowser = 'other',
}: {
  locale: Locale;
  purpose?: 'install' | 'notifications';
  initialPlatform?: DevicePlatform;
  initialBrowser?: DesktopBrowser;
}) {
  const environment = useSyncExternalStore(
    subscribe,
    snapshot,
    () => `${initialPlatform}:browser`,
  );
  const ko = locale === 'ko',
    [platform, state] = environment.split(':');
  if (platform === 'checking') return null;
  const installed = state === 'installed';
  const name =
    platform === 'ios'
      ? ko
        ? '아이폰·아이패드'
        : 'iPhone / iPad'
      : platform === 'android'
        ? ko
          ? '안드로이드'
          : 'Android'
        : platform === 'mac-safari'
          ? 'Mac · Safari'
          : 'PC';
  const installation =
    platform === 'ios'
      ? ko
        ? [
            'Safari에서 포둥을 열고 공유 메뉴를 눌러요.',
            '공유 메뉴를 내려서 ‘홈 화면에 추가’를 선택해요. 공유가 안 보이면 더보기(···)에서 찾아주세요.',
            '‘웹 앱으로 열기’가 보이면 켜고 ‘추가’를 눌러요. 이후 홈 화면의 포둥 아이콘으로 실행해요.',
          ]
        : [
            'Open podoong in Safari and open the Share menu.',
            'Scroll through the Share menu and choose “Add to Home Screen”. If Share is hidden, check the More (···) menu.',
            'Enable “Open as Web App” if shown, then tap Add. Launch podoong from its Home Screen icon.',
          ]
      : platform === 'android'
        ? ko
          ? [
              'Chrome에서 포둥을 열고 주소창 오른쪽의 더보기(⋮)를 눌러요.',
              '‘설치 및 바로가기 만들기 → 설치’를 선택해요. 버전에 따라 ‘홈 화면에 추가’ 또는 ‘앱 설치’로 표시돼요.',
              '설치 창에서 ‘설치’를 눌러요. 홈 화면이나 앱 목록의 포둥 아이콘으로 실행해요.',
            ]
          : [
              'Open podoong in Chrome and tap More (⋮) beside the address bar.',
              'Choose “Install & create shortcuts → Install”. Some versions show “Add to Home screen” or “Install app”.',
              'Confirm Install, then launch podoong from your Home Screen or app list.',
            ]
        : [];
  const notifications =
    platform === 'ios'
      ? ko
        ? [
            ...(!installed
              ? [
                  'iOS·iPadOS 16.4 이상에서 홈 화면에 추가하고, 그 아이콘으로 실행해요.',
                ]
              : []),
            '알림 기준을 선택한 뒤 ‘이 기기에서 알림 켜기’를 누르고 허용해요.',
            '차단했다면 기기 설정의 ‘알림 → 포둥’에서 허용해요.',
          ]
        : [
            ...(!installed
              ? [
                  'On iOS / iPadOS 16.4 or later, add podoong to the Home Screen and launch its icon.',
                ]
              : []),
            'Choose a reminder mode, select “Enable on this device” and allow notifications.',
            'If blocked, allow podoong under Notifications in device settings.',
          ]
      : ko
        ? [
            '홈 화면 추가나 앱 설치 없이도 지원 브라우저에서 알림을 받을 수 있어요.',
            '알림 기준을 선택한 뒤 ‘이 기기에서 알림 켜기’를 누르고 허용해요.',
            platform === 'android'
              ? '차단했다면 Chrome의 사이트 설정과 안드로이드의 Chrome 앱 알림 설정을 확인해요.'
              : '차단했다면 브라우저의 사이트 알림과 운영체제의 브라우저·포둥 알림 설정을 확인해요.',
          ]
        : [
            'Supported browsers can receive notifications without installing the app.',
            'Choose a reminder mode, select “Enable on this device” and allow notifications.',
            platform === 'android'
              ? 'If blocked, check Chrome site permissions and Android notification permissions for Chrome.'
              : 'If blocked, check site permissions and OS notification settings for your browser or podoong.',
          ];
  return (
    <details className="device-guide" open={purpose === 'install'}>
      <summary>
        {name} ·{' '}
        {ko
          ? purpose === 'install'
            ? '설치 및 알림 안내'
            : '알림 이용 안내'
          : purpose === 'install'
            ? 'Installation & notifications'
            : 'Notification guide'}
      </summary>
      {purpose === 'install' && (
        <>
          <h4>{ko ? '앱처럼 사용하기' : 'Use it like an app'}</h4>
          {installed && (
            <p>
              {ko
                ? '아이 사진을 바꿨다면 기존 포둥 앱을 삭제한 뒤, 브라우저에서 다시 추가해주세요. 저장한 육아 기록은 유지됩니다.'
                : 'After changing the photo, remove the existing podoong app and add it again from your browser. Your saved care records are kept.'}
            </p>
          )}
          {platform === 'desktop' || platform === 'mac-safari' ? (
            <DesktopInstallGuide
              locale={locale}
              initialBrowser={initialBrowser}
            />
          ) : (
            <InstallVisualGuide
              key={`${platform}-${locale}`}
              locale={locale}
              platform={platform as DevicePlatform}
              steps={installation}
            />
          )}
        </>
      )}
      {purpose === 'install' ? (
        <details className={styles.notificationDetails}>
          <summary>
            {ko
              ? '설치 후, 식사 알림도 켜보세요'
              : 'After installation: enable feeding reminders'}
          </summary>
          <NotificationGuideImage
            locale={locale}
            platform={platform as DevicePlatform}
          />
          <ol>
            {notifications.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </details>
      ) : (
        <>
          <h4>{ko ? '알림 받기' : 'Receive notifications'}</h4>
          <NotificationGuideImage
            locale={locale}
            platform={platform as DevicePlatform}
          />
          <ol>
            {notifications.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      )}
      <p>
        {ko
          ? '포둥의 HTTPS 주소에서 이용해 주세요. 집중 모드·절전 설정·네트워크 상태에 따라 알림이 늦어질 수 있어요.'
          : 'Use podoong over HTTPS. Focus modes, battery settings and network conditions may delay notifications.'}
      </p>
    </details>
  );
}
