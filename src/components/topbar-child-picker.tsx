'use client';
import { useEffect, useRef, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown, Check, Baby, Settings, Users, X } from 'lucide-react';
type ChildOption = { id: string; name: string; age: string; href: string };
export function TopbarChildPicker({
  current,
  options,
  label,
  mobile = false,
  settings,
  familyActions,
  active = false,
}: {
  current: ChildOption;
  options: ChildOption[];
  label: string;
  mobile?: boolean;
  active?: boolean;
  familyActions?: { href: string; label: string }[];
  settings?: { href: string; label: string };
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!mobile || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobile, open]);
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
    <details
      ref={details}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={
        mobile
          ? `bottom-child-picker ${active ? 'active' : ''}`
          : 'topbar-child-picker'
      }
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
        {mobile && (
          <ChevronDown
            className="bottom-child-chevron"
            size={10}
            aria-hidden="true"
          />
        )}
      </summary>
      {mobile && (
        <button
          className="family-menu-scrim"
          type="button"
          aria-label="Close"
          onClick={() => {
            if (details.current) details.current.open = false;
          }}
        />
      )}
      <nav
        className={mobile ? 'bottom-child-options' : 'topbar-child-options'}
        id={id}
        aria-label={label}
      >
        {mobile && (
          <div className="family-menu-heading">
            <strong>{label}</strong>
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                if (details.current) {
                  details.current.open = false;
                  details.current.querySelector('summary')?.focus();
                }
              }}
            >
              <X size={20} />
            </button>
          </div>
        )}
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
            <span>
              <strong>{option.name}</strong>
              <small>{option.age}</small>
            </span>
            {option.id === current.id && <Check size={16} aria-hidden="true" />}
          </Link>
        ))}
        {familyActions?.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="family-menu-action"
            onClick={() => {
              if (details.current) details.current.open = false;
            }}
          >
            <span>{action.label}</span>
            <Users size={18} aria-hidden="true" />
          </Link>
        ))}
        {settings && (
          <Link
            href={settings.href}
            onClick={() => {
              if (details.current) details.current.open = false;
            }}
          >
            <span>{settings.label}</span>
            <Settings size={18} aria-hidden="true" />
          </Link>
        )}
      </nav>
    </details>
  );
}
