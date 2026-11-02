'use client';
import { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { DevicePlatform } from '@/lib/device-platform';
import { copyTextToClipboard } from '@/lib/clipboard';
import styles from './install-app.module.css';

export function KakaoBrowserGuide({
  locale,
  platform,
}: {
  locale: Locale;
  platform: DevicePlatform;
}) {
  const ko = locale === 'ko';
  const browser = platform === 'ios' ? 'Safari' : 'Chrome';
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <section
      className={styles.kakaoGuide}
      aria-label={ko ? '카카오톡 설치 안내' : 'KakaoTalk installation guide'}
    >
      <h4>
        <ExternalLink size={18} />
        {ko ? '먼저 브라우저에서 열어주세요' : 'First, open in your browser'}
      </h4>
      <p>
        {ko
          ? '카카오톡 화면에서는 홈 화면 추가와 알림 설정을 진행하기 어려워요.'
          : 'Home Screen installation and notification setup may not be available inside KakaoTalk.'}
      </p>
      <ol>
        <li>
          {ko
            ? '카카오톡 웹 화면의 메뉴(···)에서 ‘다른 브라우저로 열기’를 찾아주세요.'
            : 'In the KakaoTalk page menu (···), look for “Open in another browser”.'}
        </li>
        <li>
          {ko
            ? `메뉴가 보이지 않으면 아래에서 주소를 복사하고 ${browser} 주소창에 붙여넣어 주세요.`
            : `If that option is missing, copy the address below and paste it into ${browser}.`}
        </li>
        <li>
          {platform === 'ios'
            ? ko
              ? 'Safari에서 공유 메뉴 → 홈 화면에 추가를 선택해요.'
              : 'In Safari, choose Share → Add to Home Screen.'
            : ko
              ? 'Chrome에서 더보기(⋮) → 홈 화면에 추가 또는 앱 설치를 선택해요.'
              : 'In Chrome, choose More (⋮) → Add to Home screen or Install app.'}
        </li>
      </ol>
      <button
        type="button"
        className="button secondary"
        onClick={async () =>
          setCopied(await copyTextToClipboard(window.location.href))
        }
      >
        <Copy size={16} />
        {ko ? '주소 복사' : 'Copy address'}
      </button>
      {copied !== null && (
        <p role="status">
          {copied
            ? ko
              ? `주소를 복사했어요. ${browser} 주소창에 붙여넣어 주세요.`
              : `Address copied. Paste it into ${browser}.`
            : ko
              ? '복사하지 못했어요. 카카오톡 메뉴에서 주소를 복사해 주세요.'
              : 'Could not copy. Use the KakaoTalk menu to copy the address.'}
        </p>
      )}
    </section>
  );
}
