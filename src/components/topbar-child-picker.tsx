'use client';
import { useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import { ChevronDown, Check, Baby, Settings } from 'lucide-react';
type ChildOption = { id: string; name: string; age: string; href: string };
export function TopbarChildPicker({
  current,
  options,
  label,
  mobile = false,
  settings,
}: {
  current: ChildOption;
  options: ChildOption[];
  label: string;
  mobile?: boolean;
  settings?: { href: string; label: string };
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const id = useId();
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
    <details
      ref={details}
      className={mobile ? 'bottom-child-picker' : 'topbar-child-picker'}
    >
      <summary
        aria-label={`${current.name}, ${current.age}, ${label}`}
        aria-controls={id}
      >
        {mobile && <Baby size={21} aria-hidden="true" />}
        <span className={mobile ? 'bottom-child-info' : 'topbar-child-info'}>
          <strong>{current.name}</strong>
          {!mobile && <span>{current.age}</span>}
        </span>
        {!mobile && <ChevronDown size={17} aria-hidden="true" />}
      </summary>
      <nav
        className={mobile ? 'bottom-child-options' : 'topbar-child-options'}
        id={id}
        aria-label={label}
      >
        {options.map((option) => (
          <Link
            key={option.id}
            href={option.href}
            aria-current={option.id === current.id ? 'true' : undefined}
            onClick={() => {
              if (details.current) details.current.open = false;
            }}
          >
            <span>
              <strong>{option.name}</strong>
              <small>{option.age}</small>
            </span>
            {option.id === current.id && <Check size={16} aria-hidden="true" />}
          </Link>
        ))}
        {settings && (
          <Link href={settings.href}>
            <span>{settings.label}</span>
            <Settings size={18} aria-hidden="true" />
          </Link>
        )}
      </nav>
    </details>
  );
}
