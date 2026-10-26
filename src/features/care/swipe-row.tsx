'use client';
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
export function SwipeRow({
  title,
  editHref,
  editLabel,
  deleteAction,
  enabled,
  children,
}: {
  title: string;
  editHref: string;
  editLabel: string;
  deleteAction: ReactNode;
  enabled: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [side, setSide] = useState<'edit' | 'delete' | null>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const deletion = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    dx: number;
    locked: boolean;
    width: number;
  } | null>(null);
  const suppress = useRef(false);
  if (!enabled) return <div className="swipe-row readonly">{children}</div>;
  const position =
    offset ?? (side === 'edit' ? 86 : side === 'delete' ? -86 : 0);
  const reset = () => {
    drag.current = null;
    setOffset(null);
    setSide(null);
    setReady(false);
  };
  return (
    <div
      className={`swipe-row ${offset !== null ? 'is-dragging' : ''}`}
      role="group"
      tabIndex={-1}
      aria-label={title}
      data-swipe={side ?? 'closed'}
      data-swipe-ready={ready}
      onPointerDown={(event) => {
        suppress.current = false;
        if (
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target as Element).closest(
            'button,input,select,textarea,summary,.swipe-action',
          )
        )
          return;
        drag.current = {
          x: event.clientX,
          y: event.clientY,
          dx: 0,
          locked: false,
          width: event.currentTarget.clientWidth,
        };
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d) return;
        const dx = event.clientX - d.x,
          dy = event.clientY - d.y;
        if (!d.locked) {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
            drag.current = null;
            return;
          }
          if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
          d.locked = true;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        d.dx = dx;
        suppress.current = true;
        setOffset(Math.max(-d.width, Math.min(d.width, dx)));
        setSide(dx > 0 ? 'edit' : 'delete');
        setReady(Math.abs(dx) >= Math.min(180, d.width * 0.6));
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        setOffset(null);
        setReady(false);
        if (!d?.locked) return;
        if (Math.abs(d.dx) >= Math.min(180, d.width * 0.6)) {
          setSide(null);
          if (d.dx > 0) router.push(editHref, { scroll: false });
          else deletion.current?.querySelector('form')?.requestSubmit();
        } else
          setSide(Math.abs(d.dx) >= 45 ? (d.dx > 0 ? 'edit' : 'delete') : null);
      }}
      onPointerCancel={reset}
      onPointerLeave={() => {
        if (drag.current && !drag.current.locked) drag.current = null;
      }}
      onClickCapture={(event) => {
        if (suppress.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
          suppress.current = false;
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') reset();
      }}
    >
      <Link
        className={`swipe-action swipe-edit ${side === 'edit' && ready ? 'is-ready' : ''}`}
        href={editHref}
        scroll={false}
        onFocus={() => setSide('edit')}
        onClick={() => setSide(null)}
        aria-label={`${title} ${editLabel}`}
      >
        <Pencil size={19} aria-hidden="true" />
      </Link>
      <div
        ref={deletion}
        className={`swipe-action swipe-delete ${side === 'delete' && ready ? 'is-ready' : ''}`}
        onFocus={() => setSide('delete')}
      >
        {deleteAction}
      </div>
      <div
        onDragStart={(event) => event.preventDefault()}
        className="swipe-front"
        style={{ transform: `translateX(${position}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
