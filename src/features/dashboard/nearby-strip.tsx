'use client';
import { useEffect, useState } from 'react';
import { Baby, Hospital, Pill, Thermometer } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { NearbySummary } from '@/features/community/nearby.server';
import { mapLinks, distanceLabel } from '@/features/community/public-data';
const symbols: Record<string, string> = {
  clear: '☀️',
  cloudy: '⛅',
  overcast: '☁️',
  rain: '🌧️',
  sleet: '🌨️',
  snow: '❄️',
};
const grades = {
  good: ['좋음', 'Good'],
  moderate: ['보통', 'Moderate'],
  bad: ['나쁨', 'Unhealthy'],
  'very-bad': ['매우 나쁨', 'Very unhealthy'],
};
let recent:
  { key: string; at: number; summary: NearbySummary | null } | undefined;
export function NearbyStrip({
  locale,
  childId,
  enabled,
}: {
  locale: Locale;
  childId: string;
  enabled: boolean;
}) {
  return enabled ? (
    <ActiveNearbyStrip key={childId} locale={locale} childId={childId} />
  ) : null;
}
function ActiveNearbyStrip({
  locale,
  childId,
}: {
  locale: Locale;
  childId: string;
}) {
  const [summary, setSummary] = useState<NearbySummary | null>(null);
  useEffect(() => {
    if (!window.isSecureContext || !navigator.geolocation) return;
    let active = true,
      status: PermissionStatus | undefined;
    const controller = new AbortController();
    let sequence = 0;
    let refreshTimer: number | undefined;
    function permissionLost() {
      return status !== undefined && status.state !== 'granted';
    }
    function hide() {
      setSummary(null);
      recent = undefined;
      controller.abort();
    }
    function locate() {
      if (!active || document.hidden || controller.signal.aborted) return;
      const current = ++sequence;
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!active || current !== sequence || permissionLost()) return;
          const key = `${Math.round(position.coords.latitude * 1000)},${Math.round(position.coords.longitude * 1000)}`;
          if (recent?.key === key && Date.now() - recent.at < 300000) {
            setSummary(recent.summary);
            return;
          }
          try {
            const response = await fetch('/api/nearby', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                childId,
                lat: position.coords.latitude,
                lon: position.coords.longitude,
              }),
              cache: 'no-store',
              signal: controller.signal,
            });
            if (!response.ok) {
              if (response.status === 401 || response.status === 403) hide();
              return;
            }
            const data = await response.json();
            if (
              active &&
              current === sequence &&
              !permissionLost() &&
              data.ok
            ) {
              recent = { key, at: Date.now(), summary: data.summary };
              setSummary(data.summary);
            }
          } catch {
            /* Optional context never interrupts care recording. */
          }
        },
        () => {
          if (active && current === sequence) hide();
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
      );
    }
    function changed() {
      if (permissionLost()) hide();
    }
    void (async () => {
      try {
        status = await navigator.permissions.query({ name: 'geolocation' });
        if (!active) return;
        status.addEventListener('change', changed);
        if (status.state === 'denied') return;
      } catch {
        /* Safari may not expose Permissions API. */
      }
      if (active) {
        locate();
        refreshTimer = window.setInterval(locate, 300000);
        document.addEventListener('visibilitychange', locate);
      }
    })();
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', locate);
      status?.removeEventListener('change', changed);
    };
  }, [childId]);
  const ko = locale === 'ko';
  if (
    !summary ||
    !(
      summary.temperature !== null ||
      summary.dust ||
      summary.hospital ||
      summary.pharmacy ||
      summary.diaper
    )
  )
    return null;
  return (
    <aside
      className="today-nearby"
      aria-label={ko ? '현재 위치 주변 정보' : 'Around your location'}
    >
      <div className="today-nearby-weather">
        <span className="today-nearby-temperature">
          {summary.condition ? (
            <span aria-hidden>{symbols[summary.condition]}</span>
          ) : (
            <Thermometer size={16} aria-hidden />
          )}
          <strong>
            {summary.temperature === null ? '—' : `${summary.temperature}°`}
          </strong>
        </span>
        <span
          className={summary.dust ? `air-quality ${summary.dust}` : 'muted'}
          title={summary.station ?? undefined}
        >
          {ko ? '미세먼지' : 'Air'}{' '}
          {summary.dust ? grades[summary.dust][ko ? 0 : 1] : '—'}
        </span>
      </div>
      {(
        [
          ['hospital', Hospital, ko ? '소아과' : 'Pediatrics'],
          ['pharmacy', Pill, ko ? '약국' : 'Pharmacy'],
          ['diaper', Baby, ko ? '기저귀맵' : 'Diaper map'],
        ] as const
      ).map(([kind, Icon, label]) => {
        const row = summary[kind];
        return row ? (
          <a
            key={kind}
            className={`today-nearby-place ${kind}`}
            href={mapLinks(row).naver}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label}: ${row.name}, ${row.distanceKm === undefined ? '' : distanceLabel(row.distanceKm, ko)}`}
            title={row.name}
          >
            <span>
              <Icon size={13} aria-hidden />
              <span>{label}</span>
            </span>
            <strong>{row.name}</strong>
            <small>
              {row.distanceKm === undefined
                ? ''
                : distanceLabel(row.distanceKm, ko)}
            </small>
          </a>
        ) : (
          <div key={kind} className="today-nearby-place muted">
            <span>
              <Icon size={13} aria-hidden />
              <span>{label}</span>
            </span>
            <span>{ko ? '정보 없음' : 'Unavailable'}</span>
          </div>
        );
      })}
    </aside>
  );
}
