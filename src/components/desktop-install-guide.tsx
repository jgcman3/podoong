'use client';

import { useSyncExternalStore } from 'react';
import type { Locale } from '@/lib/domain';
import { desktopBrowser, type DesktopBrowser } from '@/lib/device-platform';
import styles from './install-app.module.css';

const subscribe = () => () => {};
export function DesktopInstallGuide({
  locale,
  initialBrowser = 'other',
}: {
  locale: Locale;
  initialBrowser?: DesktopBrowser;
}) {
  const detected = useSyncExternalStore(
    subscribe,
    () => desktopBrowser(navigator.userAgent),
    () => initialBrowser,
  );
  const ko = locale === 'ko';
  const guides = [
    {
      id: 'chrome',
      name: 'Google Chrome',
      url: `https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=${locale}`,
      steps: ko
        ? [
            '오른쪽 위 더보기(⋮)를 열어요.',
            '전송, 저장 및 공유 → 페이지를 앱으로 설치…를 선택해요.',
            '표시되는 설치 창에서 확인해요. 주소창에 설치 아이콘이 있다면 그 아이콘으로도 설치할 수 있어요.',
          ]
        : [
            'Open More (⋮) at the top right.',
            'Choose Cast, save, and share → Install page as app….',
            'Confirm in the installation window. You can also use an install icon in the address bar when available.',
          ],
    },
    {
      id: 'edge',
      name: 'Microsoft Edge',
      url: 'https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge',
      steps: ko
        ? [
            '오른쪽 위 설정 및 기타(···)를 열어요.',
            '기타 도구 → 앱 → 이 사이트를 앱으로 설치를 찾아요. 버전에 따라 앱 메뉴가 바로 보일 수도 있어요.',
            '설치를 확인해요. 설치한 앱은 edge://apps에서 확인할 수 있어요.',
          ]
        : [
            'Open Settings and more (···) at the top right.',
            'Choose More tools → Apps → Install this site as an app. Some versions show Apps directly in the main menu.',
            'Confirm Install. Manage installed apps at edge://apps.',
          ],
    },
    {
      id: 'safari',
      name: 'Safari · Mac',
      url: `https://support.apple.com/${ko ? 'ko-kr' : 'en-us'}/104996`,
      steps: ko
        ? [
            'macOS Sonoma 14 이상에서 Safari로 포둥을 열어요.',
            '화면 맨 위 메뉴 막대에서 파일 → Dock에 추가를 선택해요. Safari의 공유 메뉴에서도 찾을 수 있어요.',
            '이름을 확인하고 추가를 눌러요.',
          ]
        : [
            'Open podoong in Safari on macOS Sonoma 14 or later.',
            'Choose File → Add to Dock in the menu bar at the top of the screen, or use Safari’s Share menu.',
            'Check the name and choose Add.',
          ],
    },
  ];
  return (
    <div className={styles.browserGuides}>
      <p>
        {ko
          ? '사용 중인 브라우저의 안내를 펼쳐주세요.'
          : 'Open the instructions for your browser.'}
      </p>
      {guides.map((guide) => (
        <details
          key={guide.id}
          open={guide.id === (detected === 'other' ? 'chrome' : detected)}
        >
          <summary>{guide.name}</summary>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a href={guide.url} target="_blank" rel="noreferrer">
            {ko ? '공식 설치 안내' : 'Official installation guide'} ↗
          </a>
        </details>
      ))}
    </div>
  );
}
