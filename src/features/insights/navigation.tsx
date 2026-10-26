'use client';
import {
  createContext,
  useContext,
  useEffect,
  useOptimistic,
  useRef,
  useTransition,
  type ReactNode,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toggleKind, type InsightKind } from './config';
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
}: {
  selected: InsightKind[];
  children: ReactNode;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    query = useSearchParams();
  const latest = useRef(selected);
  const [optimistic, update] = useOptimistic(selected);
  const [pending, transition] = useTransition();
  useEffect(() => {
    if (!pending) latest.current = selected;
  }, [selected, pending]);
  function visit(patch: Record<string, string | null>, replace: boolean) {
    const params = new URLSearchParams(query.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    params.set('kind', latest.current.join(','));
    const url = `${pathname}?${params}`;
    if (replace) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }
  return (
    <Context.Provider
      value={{
        selected: optimistic,
        pending,
        toggle(kind) {
          const next = toggleKind(latest.current, kind);
          latest.current = next;
          transition(() => {
            update(next);
            visit({}, true);
          });
        },
        navigate(patch, replace = false) {
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
