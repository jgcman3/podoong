'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { usageAllowed, usageScreen } from './usage';
import type { Locale } from '@/lib/domain';

export function UsageTracker() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const screen = usageScreen(pathname);
    if (!screen || !usageAllowed(document.cookie, navigator.doNotTrack)) return;
    void fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen }),
      credentials: 'same-origin',
    }).catch(() => {});
  }, [pathname]);
  return null;
}

const preferenceEvent = 'podoong-usage-preference';
function subscribePreference(notify: () => void) {
  window.addEventListener(preferenceEvent, notify);
  return () => window.removeEventListener(preferenceEvent, notify);
}
function preferenceSnapshot() {
  return usageAllowed(document.cookie, navigator.doNotTrack);
}
export function UsageStatisticsToggle({ locale }: { locale: Locale }) {
  const enabled = useSyncExternalStore(
    subscribePreference,
    preferenceSnapshot,
    () => true,
  );
  return (
    <label>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => {
          const value = event.target.checked;
          document.cookie = `podoong-usage=${value ? 'on' : 'off'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
          window.dispatchEvent(new Event(preferenceEvent));
        }}
      />
      {locale === 'ko'
        ? '익명 화면 이용 통계 허용'
        : 'Allow anonymous screen usage statistics'}
    </label>
  );
}
