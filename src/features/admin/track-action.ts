import { usageAllowed, type UsageAction } from './usage';

export function trackServiceAction(action: UsageAction) {
  if (!usageAllowed(document.cookie, navigator.doNotTrack)) return;
  void fetch('/api/usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify({ action }),
  }).catch(() => {});
}
