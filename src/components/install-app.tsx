'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Download, Check, ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/domain';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type InstallState = {
  prompt: InstallPrompt | null;
  installed: boolean;
  ios: boolean;
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
    ios: false,
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
        ios:
          /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
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
  const ko = locale === 'ko';
  if (!state || state.installed) return null;
  const title = ko ? '홈 화면에 추가' : 'Add to Home Screen';
  const install = async () => {
    if (!state.prompt) {
      dialog.current?.showModal();
      return;
    }
    setBusy(true);
    try {
      await state.prompt.prompt();
      await state.prompt.userChoice;
    } catch {
      dialog.current?.showModal();
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
        disabled={busy}
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
            <Download size={18} />
            {title}
          </>
        )}
      </button>
      <dialog
        ref={dialog}
        className="install-app-dialog"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        {state.ios ? (
          <ol>
            <li>
              {ko ? 'Safari에서 포둥을 열어요.' : 'Open podoong in Safari.'}
            </li>
            <li>
              {ko
                ? '공유 메뉴에서 ‘홈 화면에 추가’를 선택해요.'
                : 'Choose “Add to Home Screen” in the Share menu.'}
            </li>
            <li>
              {ko
                ? '‘웹 앱으로 열기’가 보이면 켜고, ‘추가’를 눌러요.'
                : 'If “Open as Web App” is shown, enable it, then tap Add.'}
            </li>
          </ol>
        ) : (
          <p>
            {ko
              ? '브라우저 메뉴의 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택해주세요. 메뉴가 없다면 Chrome이나 Edge에서 열어주세요.'
              : 'Choose “Install app” or “Add to Home Screen” in your browser menu. If unavailable, open this page in Chrome or Edge.'}
          </p>
        )}
        {!state.secure && (
          <p className="install-app-notice">
            {ko
              ? '현재 HTTP 개발 주소에서는 바로 설치가 지원되지 않을 수 있어요. HTTPS 주소에서 다시 이용해주세요.'
              : 'Direct installation may be unavailable on this HTTP development address. Try again on the HTTPS site.'}
          </p>
        )}
        <form method="dialog">
          <button className="button primary">
            <Check size={18} />
            {ko ? '확인' : 'Done'}
          </button>
        </form>
      </dialog>
    </>
  );
}
