'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
export function CalendarComposer({
  title,
  back,
  closeLabel,
  children,
}: {
  title: string;
  back: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    router = useRouter();
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="calendar-composer"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        router.replace(back, { scroll: false });
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          className="quick-close"
          aria-label={closeLabel}
          onClick={() => router.replace(back, { scroll: false })}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
