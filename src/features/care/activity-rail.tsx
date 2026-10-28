'use client';
import { useRef, type ReactNode } from 'react';
import type { Locale } from '@/lib/domain';
import { careIcons, careKinds, careLabels } from './activity-config';

export function ActivityRail({
  locale,
  leading,
  label,
  selected,
  onSelect,
  className = '',
  disabled = false,
  multiple = false,
  popup = false,
  pending = false,
}: {
  locale: Locale;
  leading?: ReactNode;
  label: string;
  selected: readonly string[];
  onSelect: (kind: (typeof careKinds)[number]) => void;
  className?: string;
  disabled?: boolean;
  multiple?: boolean;
  popup?: boolean;
  pending?: boolean;
}) {
  const drag = useRef<{
    x: number;
    y: number;
    scroll: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const labels = careLabels(locale);
  return (
    <div
      className={`quick-grid quick-orbit mobile-function-rail ${className}`}
      role="group"
      aria-label={label}
      aria-busy={pending}
      onPointerDown={(event) => {
        suppressClick.current = false;
        if ((event.target as Element).closest('dialog')) return;
        // Touch scrolling stays native, including momentum and vertical scrolling.
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          scroll: event.currentTarget.scrollLeft,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d) return;
        const dx = event.clientX - d.x,
          dy = event.clientY - d.y;
        if (!d.moved) {
          if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
            drag.current = null;
            return;
          }
          if (Math.abs(dx) <= 6) return;
          d.moved = true;
          suppressClick.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        event.currentTarget.scrollLeft = d.scroll - dx;
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onPointerLeave={() => {
        if (!drag.current?.moved) drag.current = null;
      }}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {leading}
      {careKinds.map((kind) => {
        const Icon = careIcons[kind],
          active = selected.includes(kind);
        return (
          <button
            type="button"
            key={kind}
            draggable={false}
            className={`quick-orbit-item quick-color-${kind} ${active ? 'is-current' : ''}`}
            aria-label={labels[kind]}
            aria-pressed={multiple ? active : undefined}
            aria-expanded={multiple ? undefined : active}
            aria-haspopup={popup ? 'dialog' : undefined}
            disabled={disabled}
            onClick={() => onSelect(kind)}
          >
            <span className="quick-orbit-icon">
              <Icon size={27} />
            </span>
            <strong>{labels[kind]}</strong>
          </button>
        );
      })}
    </div>
  );
}
