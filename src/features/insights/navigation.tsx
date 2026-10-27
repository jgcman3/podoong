'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useTransition,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { selectedKinds, toggleKind, type InsightKind } from './config';
type Navigation = {
  selected: InsightKind[];
  pending: boolean;
  toggle: (kind: InsightKind) => void;
  navigate: (patch: Record<string, string | null>, replace?: boolean) => void;
};
const Context = createContext<Navigation | null>(null);
export function InsightsNavigation({
  selected,
  children,
  loadedStart,
  loadedSpan,
}: {
  selected: InsightKind[];
  children: ReactNode;
  loadedStart?: string;
  loadedSpan?: number;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    query = useSearchParams();
  const current = query.has('kind')
    ? selectedKinds(query.get('kind')!)
    : selected;
  const latest = useRef(current);
  const [pending, transition] = useTransition();
  useEffect(() => {
    if (!pending) latest.current = current;
  }, [current, pending]);
  function visit(patch: Record<string, string | null>, replace: boolean) {
    const params = new URLSearchParams(query.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    params.set('kind', latest.current.join(','));
    const url = `${pathname}?${params}`;
    const mode = params.get('pattern') ?? 'weekly';
    if (
      loadedStart &&
      (params.get('week') ?? loadedStart) === loadedStart &&
      ['daily', 'weekly', 'stats'].includes(mode) &&
      (mode !== 'stats' ||
        params.get('interval') !== 'week' ||
        loadedSpan === 6)
    ) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
      return;
    }
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }
  return (
    <Context.Provider
      value={{
        selected: current,
        pending,
        toggle(kind) {
          const next = toggleKind(latest.current, kind);
          latest.current = next;
          const params = new URLSearchParams(window.location.search);
          params.set('kind', next.join(','));
          // Only presentation changes: reuse this child's already loaded period.
          window.history.replaceState(null, '', `${pathname}?${params}`);
        },
        navigate(patch, replace = true) {
          transition(() => visit(patch, replace));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useInsightsNavigation() {
  const value = useContext(Context);
  if (!value) throw new Error('Insights navigation context missing');
  return value;
}
