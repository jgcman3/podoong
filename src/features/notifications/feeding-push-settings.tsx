'use client';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import Link from 'next/link';
import { Bell, BellOff } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { savePushSettings, disableFeedingPush } from './push-actions';
import { DeviceGuide } from '@/components/device-guide';
function capability() {
  if (!window.isSecureContext) return 'https';
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (
    ios &&
    !window.matchMedia('(display-mode: standalone)').matches &&
    !(navigator as Navigator & { standalone?: boolean }).standalone
  )
    return 'install';
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  )
    return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ready';
}
function subscribe(change: () => void) {
  window.addEventListener('focus', change);
  return () => window.removeEventListener('focus', change);
}
function applicationKey(value: string) {
  const bytes = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bytes, (c) => c.charCodeAt(0));
}
export function FeedingPushSettings({
  locale,
  publicKey,
  initialDevice,
  initialInterval,
  initialQuiet,
  initialMode,
  initialPlayground,
  initialPlaygroundQuiet,
  compact = false,
  onSaved,
  onPendingChange,
}: {
  locale: Locale;
  publicKey: string | null;
  initialDevice: string | null;
  initialInterval: number;
  initialQuiet: boolean;
  initialMode: 'interval' | 'yesterday' | 'off';
  initialPlayground: boolean;
  initialPlaygroundQuiet: boolean;
  compact?: boolean;
  onSaved?: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const ko = locale === 'ko',
    status = useSyncExternalStore(subscribe, capability, () => 'checking');
  const [device, setDevice] = useState(initialDevice),
    [interval, setInterval] = useState(initialInterval),
    [quiet, setQuiet] = useState(initialQuiet),
    [mode, setMode] = useState(initialMode),
    [playground, setPlayground] = useState(initialPlayground),
    [playgroundQuiet, setPlaygroundQuiet] = useState(initialPlaygroundQuiet),
    [error, setError] = useState(false),
    [pending, start] = useTransition();
  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);
  const available = status === 'ready' && !!publicKey;
  const problem =
    status === 'https'
      ? ko
        ? '알림을 받으려면 HTTPS 주소로 접속해 주세요.'
        : 'Use an HTTPS address to receive notifications.'
      : status === 'install'
        ? ko
          ? '아이폰은 홈 화면에 추가한 포둥에서 알림을 켤 수 있어요.'
          : 'On iPhone, add podoong to your Home Screen, then open it to enable notifications.'
        : status === 'denied'
          ? ko
            ? '기기 설정에서 포둥의 알림을 허용해 주세요.'
            : 'Allow podoong notifications in your device settings.'
          : status === 'unsupported'
            ? ko
              ? '이 브라우저에서는 웹 알림을 지원하지 않아요.'
              : 'This browser does not support web notifications.'
            : !publicKey
              ? ko
                ? '알림 서비스를 준비하고 있어요.'
                : 'Notifications are being set up.'
              : null;
  async function registration() {
    return await navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready);
  }
  function connect() {
    start(async () => {
      setError(false);
      let created: PushSubscription | undefined;
      try {
        if (!available) return;
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setError(true);
          return;
        }
        const worker = await registration();
        let subscription = await worker.pushManager.getSubscription();
        if (!subscription) {
          subscription = await worker.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationKey(publicKey!),
          });
          created = subscription;
        }
        const result = await savePushSettings({
          locale,
          interval,
          quiet,
          mode,
          playground,
          playgroundQuiet,
          subscription: subscription.toJSON(),
        });
        if (!('id' in result)) {
          if (created) await created.unsubscribe();
          setError(true);
          return;
        }
        setDevice(result.id!);
        onSaved?.();
      } catch {
        if (created) await created.unsubscribe().catch(() => {});
        setError(true);
      }
    });
  }
  function save() {
    start(async () => {
      setError(false);
      try {
        if (playground && device) await registration();
        const result = await savePushSettings({
          locale,
          interval,
          quiet,
          mode,
          playground,
          playgroundQuiet,
        });
        setError(!!result.error);
        if (!result.error) onSaved?.();
      } catch {
        setError(true);
      }
    });
  }
  function disconnect() {
    start(async () => {
      setError(false);
      try {
        const result = await disableFeedingPush(locale);
        if (result.error) {
          setError(true);
          return;
        }
        setDevice(null);
        const worker = await navigator.serviceWorker.getRegistration('/');
        await (await worker?.pushManager.getSubscription())?.unsubscribe();
      } catch {
        setError(true);
      }
    });
  }
  return (
    <div className="feeding-push-settings">
      {!compact && (
        <>
          <h3>
            <Bell size={18} />
            {ko ? '식사 알림' : 'Feeding reminders'}
          </h3>
          <p className="small muted">
            {mode === 'yesterday'
              ? ko
                ? '어제 모유·분유·이유식을 먹은 시각에 지난 기록을 알려드려요. 최근 90분 안에 먹였다면 알리지 않아요.'
                : 'A reference to yesterday’s breastfeed, formula or solids at the same local time. Skipped if a feed was recorded in the past 90 minutes.'
              : mode === 'off'
                ? ko
                  ? '식사 알림을 받지 않아요.'
                  : 'Feeding reminders are off.'
                : ko
                  ? '마지막 모유·분유·이유식 기록부터 설정한 시간이 지나면 한 번 알려드려요.'
                  : 'One reminder after your chosen interval from the latest breast milk, formula or solids record.'}
          </p>
          <fieldset disabled={pending}>
            <legend>{ko ? '알림 기준' : 'Reminder mode'}</legend>
            <div
              className="quick-choices feeding-push-modes"
              role="group"
              aria-label={ko ? '알림 기준' : 'Reminder mode'}
            >
              {(['interval', 'yesterday', 'off'] as const).map((value, i) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {ko
                    ? ['간격 기준', '어제 식사 시간', '끄기'][i]
                    : ['Interval', 'Yesterday', 'Off'][i]}
                </button>
              ))}
            </div>
            {mode === 'interval' && (
              <>
                <span className="feeding-push-interval-label">
                  {ko ? '알림 간격' : 'Reminder interval'}
                </span>
                <div className="quick-choices feeding-push-intervals">
                  {[120, 180, 240, 300, 360].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      aria-pressed={interval === minutes}
                      onClick={() => setInterval(minutes)}
                    >
                      {minutes / 60}
                      {ko ? '시간' : 'h'}
                    </button>
                  ))}
                </div>
              </>
            )}
            {mode !== 'off' && (
              <label className="notification-setting-toggle">
                <input
                  type="checkbox"
                  checked={quiet}
                  onChange={(e) => setQuiet(e.target.checked)}
                />
                {ko
                  ? '밤에는 쉬기 (22:00–07:00)'
                  : 'Quiet at night (22:00–07:00)'}
              </label>
            )}
          </fieldset>
          <section
            className="playground-push-settings"
            aria-label={
              ko ? '놀이터 알림 설정' : 'Playground notification settings'
            }
          >
            <h3>
              <Bell size={18} />
              {ko ? '놀이터 알림' : 'Playground notifications'}
            </h3>
            <p className="small muted">
              {ko
                ? '동네 친구가 보낸 인사·하트·토닥토닥을 알려드려요. 2분 동안 받은 마음은 모아서 한 번 알려드려요.'
                : 'Get notified about waves, hearts and comforting pats from neighborhood friends. Reactions received within two minutes are grouped into one notification.'}
            </p>
            <label className="notification-setting-toggle">
              <input
                type="checkbox"
                checked={playground}
                disabled={pending}
                onChange={(e) => setPlayground(e.target.checked)}
              />
              {ko
                ? '인사·하트·토닥토닥 알림 받기'
                : 'Receive wave, heart and comfort notifications'}
            </label>
            {playground && (
              <label className="notification-setting-toggle">
                <input
                  type="checkbox"
                  checked={playgroundQuiet}
                  disabled={pending}
                  onChange={(e) => setPlaygroundQuiet(e.target.checked)}
                />
                {ko
                  ? '놀이터 알림도 밤에는 쉬기 (22:00–07:00)'
                  : 'Quiet playground notifications at night (22:00–07:00)'}
              </label>
            )}
          </section>
        </>
      )}
      {compact && (
        <div className="guide-alert-choices">
          <label className="notification-setting-toggle">
            <input
              type="checkbox"
              checked={mode !== 'off'}
              disabled={pending}
              onChange={(e) => setMode(e.target.checked ? 'interval' : 'off')}
            />
            {ko ? '식사 알림' : 'Feeding reminders'}
          </label>
          <label className="notification-setting-toggle">
            <input
              type="checkbox"
              checked={playground}
              disabled={pending}
              onChange={(e) => setPlayground(e.target.checked)}
            />
            {ko
              ? '놀이터 인사·하트·토닥토닥'
              : 'Playground waves, hearts & comfort'}
          </label>
        </div>
      )}
      {problem && (mode !== 'off' || playground) && (
        <p className="small feeding-push-availability">{problem}</p>
      )}
      {!compact && <DeviceGuide locale={locale} purpose="notifications" />}
      {compact && status === 'install' && (
        <Link href={`/${locale}/install`}>
          {ko ? '홈 화면에 추가하는 방법' : 'How to add to Home Screen'}
        </Link>
      )}
      {error && (
        <p role="alert" className="small">
          {ko
            ? '알림 설정을 확인한 뒤 다시 시도해 주세요.'
            : 'Check notification settings and try again.'}
        </p>
      )}
      <div className="feeding-push-buttons">
        {device || (mode === 'off' && !playground) ? (
          <>
            <button className="button" disabled={pending} onClick={save}>
              {compact
                ? ko
                  ? '선택 저장하고 마치기'
                  : 'Save and finish'
                : ko
                  ? '설정 저장'
                  : 'Save settings'}
            </button>
            {device && (
              <button
                className="button secondary"
                disabled={pending}
                onClick={disconnect}
              >
                <BellOff size={16} />
                {ko ? '이 기기 알림 끄기' : 'Turn off on this device'}
              </button>
            )}
          </>
        ) : (
          <button
            className="button"
            disabled={pending || !available}
            onClick={connect}
          >
            <Bell size={16} />
            {compact
              ? ko
                ? '선택한 알림 켜기'
                : 'Enable selected notifications'
              : ko
                ? '이 기기에서 알림 켜기'
                : 'Enable on this device'}
          </button>
        )}
      </div>
    </div>
  );
}
