'use client';
import { useState, useSyncExternalStore, useTransition } from 'react';
import { Bell, BellOff } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { saveFeedingPush, disableFeedingPush } from './push-actions';
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
}: {
  locale: Locale;
  publicKey: string | null;
  initialDevice: string | null;
  initialInterval: number;
  initialQuiet: boolean;
}) {
  const ko = locale === 'ko',
    status = useSyncExternalStore(subscribe, capability, () => 'checking');
  const [device, setDevice] = useState(initialDevice),
    [interval, setInterval] = useState(initialInterval),
    [quiet, setQuiet] = useState(initialQuiet),
    [error, setError] = useState(false),
    [pending, start] = useTransition();
  const available = status === 'ready' && !!publicKey;
  const problem =
    status === 'https'
      ? ko
        ? '알림을 받으려면 HTTPS 주소로 접속해 주세요.'
        : 'Use an HTTPS address to receive notifications.'
      : status === 'install'
        ? ko
          ? '아이폰은 홈 화면에 추가한 포둥에서 알림을 켤 수 있어요.'
          : 'On iPhone, add Podung to your Home Screen, then open it to enable notifications.'
        : status === 'denied'
          ? ko
            ? '기기 설정에서 포둥의 알림을 허용해 주세요.'
            : 'Allow Podung notifications in your device settings.'
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
        const result = await saveFeedingPush({
          locale,
          interval,
          quiet,
          subscription: subscription.toJSON(),
        });
        if (!('id' in result)) {
          if (created) await created.unsubscribe();
          setError(true);
          return;
        }
        setDevice(result.id!);
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
        const result = await saveFeedingPush({ locale, interval, quiet });
        setError(!!result.error);
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
      <h3>
        <Bell size={18} />
        {ko ? '다음 먹이기 알림' : 'Next feeding reminder'}
      </h3>
      <p className="small muted">
        {ko
          ? '마지막 모유·분유·이유식 기록부터 설정한 시간이 지나면 한 번 알려드려요.'
          : 'One reminder after your chosen interval from the latest breast milk, formula or solids record.'}
      </p>
      <fieldset disabled={pending}>
        <legend>{ko ? '알림 간격' : 'Reminder interval'}</legend>
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
        <label className="notification-setting-toggle">
          <input
            type="checkbox"
            checked={quiet}
            onChange={(e) => setQuiet(e.target.checked)}
          />
          {ko ? '밤에는 쉬기 (22:00–07:00)' : 'Quiet at night (22:00–07:00)'}
        </label>
      </fieldset>
      {problem && <p className="small feeding-push-availability">{problem}</p>}
      {error && (
        <p role="alert" className="small">
          {ko
            ? '알림 설정을 확인한 뒤 다시 시도해 주세요.'
            : 'Check notification settings and try again.'}
        </p>
      )}
      <div className="feeding-push-buttons">
        {device ? (
          <>
            <button
              className="button"
              disabled={pending || !available}
              onClick={save}
            >
              {ko ? '설정 저장' : 'Save settings'}
            </button>
            <button
              className="button secondary"
              disabled={pending}
              onClick={disconnect}
            >
              <BellOff size={16} />
              {ko ? '이 기기 알림 끄기' : 'Turn off on this device'}
            </button>
          </>
        ) : (
          <button
            className="button"
            disabled={pending || !available}
            onClick={connect}
          >
            <Bell size={16} />
            {ko ? '이 기기에서 알림 켜기' : 'Enable on this device'}
          </button>
        )}
      </div>
    </div>
  );
}
