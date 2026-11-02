'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { Facility } from './public-data';
import type { FacilityKind } from './facility-options';
import { FacilityCard } from './facility-card';

export function FacilityFeed({
  initialRows,
  total,
  holiday: initialHoliday,
  asOf: initialTime,
  locale,
  childId,
  kind,
  place,
  open,
  diaper,
  specialty,
}: {
  initialRows: Facility[];
  total: number;
  holiday: boolean | null;
  asOf: string;
  locale: Locale;
  childId: string;
  kind: FacilityKind;
  place: string;
  open: boolean;
  diaper: boolean;
  specialty: 'pediatrics' | 'all';
}) {
  const [rows, setRows] = useState(initialRows),
    [page, setPage] = useState(1),
    [count, setCount] = useState(total);
  const [holiday, setHoliday] = useState(initialHoliday),
    [asOf, setAsOf] = useState(initialTime);
  const [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false);
  const pending = useRef(false),
    sentinel = useRef<HTMLDivElement>(null),
    request = useRef<AbortController | null>(null);
  const more = kind !== 'nursing' && page * 10 < count,
    ko = locale === 'ko';
  const loadMore = useCallback(async () => {
    if (pending.current || !more) return;
    pending.current = true;
    setLoading(true);
    setFailed(false);
    const controller = new AbortController();
    request.current = controller;
    try {
      const params = new URLSearchParams({
        locale,
        childId,
        kind,
        place,
        page: String(page + 1),
        specialty,
        open: open ? '1' : '0',
        diaper: diaper ? '1' : '0',
      });
      const response = await fetch(`/api/community/facilities?${params}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('facilities-unavailable');
      const data = (await response.json()) as {
        ok: boolean;
        facilities: Facility[];
        total: number;
        holiday: boolean | null;
        asOf: string;
      };
      if (
        !data.ok ||
        !Array.isArray(data.facilities) ||
        !Number.isSafeInteger(data.total) ||
        data.total < 0 ||
        !Number.isFinite(Date.parse(data.asOf))
      )
        throw new Error('invalid-facility-page');
      if (controller.signal.aborted) return;
      setRows((previous) => [
        ...new Map(
          [...previous, ...data.facilities].map((row) => [row.id, row]),
        ).values(),
      ]);
      setCount(data.facilities.length ? data.total : page * 10);
      setHoliday(data.holiday);
      setAsOf(data.asOf);
      setPage(page + 1);
    } catch {
      if (!controller.signal.aborted) setFailed(true);
    } finally {
      pending.current = false;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [more, locale, childId, kind, place, page, open, diaper, specialty]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (
      !more ||
      loading ||
      failed ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: '160px' },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [more, loading, failed, loadMore]);
  return (
    <>
      <div className="facility-list" aria-busy={loading}>
        {rows.map((facility) => (
          <FacilityCard
            key={facility.id}
            facility={facility}
            locale={locale}
            holiday={holiday}
            medical={kind === 'hospital' || kind === 'pharmacy'}
            asOf={asOf}
          />
        ))}
      </div>
      {more && (
        <div
          className="facility-load-more"
          ref={sentinel}
          role="status"
          aria-live="polite"
        >
          {loading ? (
            <>
              <LoaderCircle size={17} aria-hidden />
              {ko ? '시설을 불러오고 있어요.' : 'Loading facilities…'}
            </>
          ) : failed ? (
            <button
              className="button secondary"
              onClick={() => void loadMore()}
            >
              {ko ? '다시 불러오기' : 'Try again'}
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}
