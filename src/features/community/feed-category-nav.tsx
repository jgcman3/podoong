'use client';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { communityTags } from './options';
import {
  feedPreference,
  feedPreferenceCookie,
  type FeedArea,
} from './feed-preference';

export function FeedCategoryNav({
  area,
  label,
  children,
}: {
  area: FeedArea;
  label: string;
  children: ReactNode;
}) {
  const remember = (category: string | null, sort: string | null) => {
    const preference = feedPreference(
      `${category ?? 'all'}:${sort ?? 'all'}`,
      communityTags(area === 'neighborhood'),
    );
    document.cookie = `${feedPreferenceCookie(area)}=${preference.category}:${preference.sort}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  };
  const router = useRouter(),
    pathname = usePathname(),
    query = useSearchParams();
  useEffect(() => {
    if (!pathname.endsWith(`/${area}`)) return;
    const name = feedPreferenceCookie(area);
    if (query.has('category')) {
      const preference = feedPreference(
        `${query.get('category')}:${query.get('sort') ?? 'all'}`,
        communityTags(area === 'neighborhood'),
      );
      document.cookie = `${name}=${preference.category}:${preference.sort}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      return;
    }
    const saved = document.cookie
      .split('; ')
      .find((value) => value.startsWith(`${name}=`))
      ?.slice(name.length + 1);
    if (!saved) return;
    const preference = feedPreference(
      saved,
      communityTags(area === 'neighborhood'),
    );
    const params = new URLSearchParams(query.toString());
    params.set('category', preference.category);
    params.set('sort', preference.sort);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }, [area, pathname, query, router]);
  return (
    <nav
      className="community-pills category-pills"
      aria-label={label}
      onChangeCapture={(event) => {
        if (!(event.target instanceof HTMLSelectElement)) return;
        const url = new URL(event.target.value, location.origin);
        if (url.pathname.endsWith(`/${area}`))
          remember(
            url.searchParams.get('category'),
            url.searchParams.get('sort'),
          );
      }}
      onClickCapture={(event) => {
        const target =
          event.target instanceof Element ? event.target.closest('a') : null;
        if (
          !target ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const url = new URL(target.href);
        if (url.pathname.endsWith(`/${area}`))
          remember(
            url.searchParams.get('category'),
            url.searchParams.get('sort'),
          );
      }}
    >
      {children}
    </nav>
  );
}
