'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { DevicePlatform } from '@/lib/device-platform';
import styles from './install-app.module.css';

export function InstallVisualGuide({
  locale,
  platform,
  steps,
}: {
  locale: Locale;
  platform: DevicePlatform;
  steps: string[];
}) {
  const [active, setActive] = useState(0);
  const ko = locale === 'ko';
  return (
    <div
      className={styles.visualGuide}
      role="group"
      aria-label={ko ? '화면으로 보는 설치 안내' : 'Visual installation guide'}
    >
      <noscript>
        <ol>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </noscript>
      <nav
        className={styles.steps}
        aria-label={ko ? '설치 단계' : 'Installation steps'}
      >
        {steps.map((_, index) => (
          <button
            type="button"
            key={index}
            aria-label={ko ? `${index + 1}단계` : `Step ${index + 1}`}
            aria-current={active === index ? 'step' : undefined}
            onClick={() => setActive(index)}
          >
            {index + 1}
          </button>
        ))}
      </nav>
      {steps.map((step, index) => (
        <figure className={styles.step} key={step} hidden={active !== index}>
          <Image
            src={`/guides/install/v1/${platform}-${locale}-${index + 1}.webp`}
            width={360}
            height={250}
            sizes="(max-width: 520px) calc(100vw - 70px), 420px"
            alt={
              ko
                ? `${index + 1}단계 메뉴 위치를 표시한 안내용 재현 화면`
                : `Illustrated menu location for step ${index + 1}`
            }
            loading="eager"
          />
          <figcaption>
            <strong>{String(index + 1).padStart(2, '0')}</strong>
            <span>{step}</span>
          </figcaption>
        </figure>
      ))}
      <div className={styles.stepActions}>
        <button
          type="button"
          onClick={() => setActive(active - 1)}
          disabled={active === 0}
        >
          <ChevronLeft size={17} aria-hidden="true" />
          {ko ? '이전 단계' : 'Previous'}
        </button>
        <button
          type="button"
          onClick={() => setActive(active + 1)}
          disabled={active === steps.length - 1}
        >
          {ko ? '다음 단계' : 'Next'}
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      <small className={styles.imageNote}>
        {ko
          ? '실제 포둥 화면 + 메뉴 재현 이미지예요. 브라우저 버전에 따라 메뉴가 달라질 수 있어요.'
          : 'Actual podoong page with illustrated browser menus. Menus may vary by browser version.'}
      </small>
    </div>
  );
}

export function NotificationGuideImage({
  locale,
  platform,
}: {
  locale: Locale;
  platform: DevicePlatform;
}) {
  return (
    <figure className={styles.permissionImage}>
      <Image
        src={`/guides/install/v1/${platform}-${locale}-4.webp`}
        width={360}
        height={250}
        sizes="(max-width: 520px) calc(100vw - 70px), 420px"
        alt={
          locale === 'ko'
            ? '포둥의 알림 켜기 버튼과 브라우저의 허용 버튼을 표시한 안내용 재현 화면'
            : 'Illustration of the Enable notifications and Allow buttons'
        }
      />
      <figcaption>
        {locale === 'ko'
          ? '알림 켜기를 누른 뒤, 브라우저 요청에서 허용해 주세요.'
          : 'Choose Enable on this device, then Allow in the browser prompt.'}
      </figcaption>
    </figure>
  );
}
