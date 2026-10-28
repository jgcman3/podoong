'use client';
import { useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChildIcon } from './child-icon';
import { ChevronDown, Check } from 'lucide-react';
type ChildOption = { id: string; name: string; sex: string; age: string; href: string };
export function TopbarChildPicker({
  current,
  options,
  label,
}: {
  current: ChildOption;
  options: ChildOption[];
  label: string;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const id = useId();
  const pathname = usePathname();
  const query = useSearchParams();
  function childHref(option: ChildOption) {
    if (!pathname.endsWith('/insights')) return option.href;
    const params = new URLSearchParams({ child: option.id });
    for (const key of ['kind', 'week', 'interval', 'pattern', 'day']) {
      const value = query.get(key);
      if (value !== null) params.set(key, value);
    }
    return `${pathname}?${params}`;
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node))
        details.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && details.current?.open) {
        details.current.open = false;
        details.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <details ref={details} className="topbar-child-picker">
      <summary
        aria-label={`${current.name}, ${current.age}, ${label}`}
        aria-controls={id}
      >
        <ChildIcon sex={current.sex} size={22} />
        <span className="topbar-child-info">
          <strong>{current.name}</strong>
          <span>{current.age}</span>
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <nav className="topbar-child-options" id={id} aria-label={label}>
        {options.map((option) => (
          <Link
            key={option.id}
            replace
            href={childHref(option)}
            aria-current={option.id === current.id ? 'true' : undefined}
            onClick={() => {
              if (details.current) details.current.open = false;
            }}
          >
            <ChildIcon sex={option.sex} size={22} />
            <span>
              <strong>{option.name}</strong>
              <small>{option.age}</small>
            </span>
            {option.id === current.id && <Check size={16} aria-hidden="true" />}
          </Link>
        ))}
      </nav>
    </details>
  );
}
