'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  Download,
  Check,
  ChevronRight,
  PlusSquare,
  AppWindow,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import type { Locale } from '@/lib/domain';
import { DeviceGuide } from './device-guide';
import { devicePlatform, type DevicePlatform } from '@/lib/device-platform';
import styles from './install-app.module.css';

const subscribeMounted = () => () => {};
const clientMounted = () => true;
const serverMounted = () => false;

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type InstallState = {
  prompt: InstallPrompt | null;
  installed: boolean;
  platform: DevicePlatform;
  secure: boolean;
  clearPrompt: () => void;
};
const InstallContext = createContext<InstallState | null>(null);

export function InstallAppProvider({ children }: { children: ReactNode }) {
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
    platform: 'desktop' as DevicePlatform,
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
}: {
  locale: Locale;
  card?: boolean;
}) {
  const state = useContext(InstallContext);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeMounted,
    clientMounted,
    serverMounted,
  );
  const ko = locale === 'ko';
  if (!state || state.installed) return null;
  const mobile = state.platform === 'ios' || state.platform === 'android';
  const title = mobile
    ? ko
      ? '홈 화면에 추가'
      : 'Add to Home Screen'
    : ko
      ? '앱으로 설치'
      : 'Install app';
  const showGuide = () => {
    dialog.current?.showModal();
    dialog.current?.querySelector('h2')?.focus({ preventScroll: true });
  };
  const install = async () => {
    if (!state.prompt) {
      showGuide();
      return;
    }
    setBusy(true);
    try {
      await state.prompt.prompt();
      await state.prompt.userChoice;
    } catch {
      showGuide();
    } finally {
      state.clearPrompt();
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className={card ? 'service-card install-app-card' : 'button secondary'}
        onClick={install}
        disabled={busy || !mounted}
      >
        {card ? (
          <>
            <span className="service-icon">
              <Download size={24} />
            </span>
            <span className="install-app-label">{title}</span>
            <ChevronRight size={17} />
          </>
        ) : (
          <>
            {mobile ? <PlusSquare size={18} /> : <AppWindow size={18} />}
            {title}
          </>
        )}
      </button>
      {mounted &&
        createPortal(
          <dialog
            ref={dialog}
            className={`install-app-dialog ${styles.dialog}`}
            aria-labelledby={titleId}
          >
            <h2 id={titleId} tabIndex={-1}>
              {title}
            </h2>
            <div className={styles.dialogBody}>
              <DeviceGuide locale={locale} purpose="install" />
              {!state.secure && (
                <p className="install-app-notice">
                  {ko
                    ? '현재 HTTP 개발 주소에서는 바로 설치가 지원되지 않을 수 있어요. HTTPS 주소에서 다시 이용해주세요.'
                    : 'Direct installation may be unavailable on this HTTP development address. Try again on the HTTPS site.'}
                </p>
              )}
            </div>
            <form method="dialog">
              <button className="button primary">
                <Check size={18} />
                {ko ? '확인' : 'Done'}
              </button>
            </form>
          </dialog>,
          document.body,
        )}
    </>
  );
}
