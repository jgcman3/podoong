'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Download, PlusSquare, AppWindow } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { DeviceGuide } from './device-guide';
import {
  devicePlatform,
  desktopBrowser,
  type DesktopBrowser,
  type DevicePlatform,
} from '@/lib/device-platform';
import styles from './install-app.module.css';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type InstallState = {
  prompt: InstallPrompt | null;
  installed: boolean;
  platform: DevicePlatform;
  browser: DesktopBrowser;
  secure: boolean;
  clearPrompt: () => void;
};
const InstallContext = createContext<InstallState | null>(null);

export function InstallAppProvider({
  children,
  initialPlatform = 'desktop',
  initialBrowser = 'other',
}: {
  children: ReactNode;
  initialPlatform?: DevicePlatform;
  initialBrowser?: DesktopBrowser;
}) {
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const isStandalone = () =>
      display.matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const update = () =>
      document.documentElement.toggleAttribute(
        'data-standalone',
        isStandalone(),
      );
    // Safari gesture events supplement touch-action in installed iOS web apps.
    const preventZoom = (event: Event) => {
      if (isStandalone()) event.preventDefault();
    };
    update();
    display.addEventListener('change', update);
    document.addEventListener('gesturestart', preventZoom, { passive: false });
    document.addEventListener('gesturechange', preventZoom, { passive: false });
    return () => {
      document.documentElement.removeAttribute('data-standalone');
      display.removeEventListener('change', update);
      document.removeEventListener('gesturestart', preventZoom);
      document.removeEventListener('gesturechange', preventZoom);
    };
  }, []);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [device, setDevice] = useState({
    installed: false,
    platform: initialPlatform,
    browser: initialBrowser,
    secure: true,
  });
  useEffect(() => {
    const display = window.matchMedia('(display-mode: standalone)');
    const update = () =>
      setDevice({
        installed:
          display.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
        platform: devicePlatform(
          navigator.userAgent,
          navigator.platform,
          navigator.maxTouchPoints,
        ),
        browser: desktopBrowser(navigator.userAgent),
        secure: window.isSecureContext,
      });
    const frame = requestAnimationFrame(update);
    const available = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const installed = () => {
      setPrompt(null);
      setDevice((current) => ({ ...current, installed: true }));
    };
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', installed);
    display.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('beforeinstallprompt', available);
      window.removeEventListener('appinstalled', installed);
      display.removeEventListener('change', update);
    };
  }, []);
  return (
    <InstallContext.Provider
      value={{ prompt, ...device, clearPrompt: () => setPrompt(null) }}
    >
      {children}
    </InstallContext.Provider>
  );
}

export function InstallAppButton({
  locale,
  card = false,
  nativeReady = true,
}: {
  locale: Locale;
  card?: boolean;
  nativeReady?: boolean;
}) {
  const state = useContext(InstallContext);
  const guide = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const ko = locale === 'ko';
  if (!state) return null;
  const mobile = state.platform === 'ios' || state.platform === 'android';
  const title = state.installed
    ? ko
      ? '다시 설치 안내'
      : 'Reinstallation guide'
    : mobile
      ? ko
        ? '홈 화면에 추가'
        : 'Add to Home Screen'
      : ko
        ? '앱으로 설치'
        : 'Install app';
  const nativePrompt =
    nativeReady && state.platform !== 'ios' && !state.installed
      ? state.prompt
      : null;
  const openGuide = () => {
    if (guide.current) {
      guide.current.open = true;
      guide.current.querySelector('summary')?.focus({ preventScroll: true });
    }
  };
  const install = async () => {
    if (!nativePrompt) {
      openGuide();
      return;
    }
    setBusy(true);
    try {
      await nativePrompt.prompt();
      if ((await nativePrompt.userChoice).outcome !== 'accepted') openGuide();
    } catch {
      openGuide();
    } finally {
      state.clearPrompt();
      setBusy(false);
    }
  };
  return (
    <div className={styles.installControl}>
      {nativePrompt && (
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={install}
        >
          <Download size={18} />
          {title}
        </button>
      )}
      <details
        ref={guide}
        className={styles.inlineGuide}
        onToggle={(event) => {
          if (event.currentTarget.open)
            event.currentTarget.scrollIntoView({
              block: 'start',
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
            });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && guide.current) {
            guide.current.open = false;
            guide.current.querySelector('summary')?.focus();
          }
        }}
      >
        <summary
          role="button"
          className={
            card ? 'service-card install-app-card' : 'button secondary'
          }
        >
          {mobile ? <PlusSquare size={18} /> : <AppWindow size={18} />}
          {nativePrompt
            ? ko
              ? '설치 방법 보기'
              : 'Installation instructions'
            : title}
        </summary>
        <section
          role="region"
          aria-label={ko ? '설치 안내' : 'Installation guide'}
          className={styles.inlineBody}
        >
          <DeviceGuide
            locale={locale}
            purpose="install"
            initialPlatform={state.platform}
            initialBrowser={state.browser}
          />
          {!state.secure && (
            <p className="install-app-notice">
              {ko
                ? '홈 화면 추가는 HTTPS 주소에서 이용해주세요.'
                : 'Use the HTTPS site to add the app to your Home Screen.'}
            </p>
          )}
        </section>
      </details>
    </div>
  );
}
