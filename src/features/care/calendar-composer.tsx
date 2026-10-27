'use client';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CalendarDays, Hospital, Syringe, Pill, Check } from 'lucide-react';
import type { Locale } from '@/lib/domain';
const mobileQuery = '(max-width: 900px)';
function subscribeMobile(change: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
}
const icons = {
  event: CalendarDays,
  hospital: Hospital,
  vaccination: Syringe,
  medication: Pill,
  task: Check,
};
const ComposerContext = createContext<{
  close: () => void;
  setPending: (pending: boolean) => void;
} | null>(null);

export function CalendarComposer({
  title,
  back,
  kind,
  children,
}: {
  title: string;
  back: string;
  kind: keyof typeof icons;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    router = useRouter();
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  );
  const [pending, setPending] = useState(false);
  const Icon = icons[kind];
  const close = () => {
    if (!pending) router.replace(back, { scroll: false });
  };
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const focused =
      document.activeElement instanceof HTMLElement &&
      node.contains(document.activeElement)
        ? document.activeElement
        : null;
    if (node.open) node.close();
    if (mobile) node.showModal();
    else {
      node.show();
      node.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'nearest',
      });
    }
    (focused ?? heading.current)?.focus({ preventScroll: true });
  }, [mobile]);
  useEffect(() => {
    const node = dialog.current;
    return () => node?.close();
  }, []);
  return (
    <ComposerContext.Provider value={{ close, setPending }}>
      <dialog
        ref={dialog}
        className="calendar-composer"
        aria-label={title}
        onKeyDown={(event) => {
          if (!mobile && event.key === 'Escape') {
            event.preventDefault();
            close();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <header className="quick-composer-heading">
          <span className={`quick-kind-badge quick-color-${kind}`}>
            <Icon size={19} />
          </span>
          <h2 ref={heading} tabIndex={-1}>
            {title}
          </h2>
        </header>
        {children}
      </dialog>
    </ComposerContext.Provider>
  );
}

export function CalendarFormActions({
  locale,
  disabled = false,
}: {
  locale: Locale;
  disabled?: boolean;
}) {
  const composer = useContext(ComposerContext);
  const { pending } = useFormStatus();
  const setPending = composer?.setPending;
  useEffect(() => {
    setPending?.(pending);
  }, [pending, setPending]);
  return (
    <footer className="quick-composer-footer">
      <button
        type="button"
        className="button secondary quick-cancel"
        disabled={pending}
        onClick={composer?.close}
      >
        {locale === 'ko' ? '취소' : 'Cancel'}
      </button>
      <button
        type="submit"
        className="button primary quick-confirm"
        disabled={pending || disabled}
        aria-busy={pending}
      >
        <Check size={18} />
        {pending
          ? locale === 'ko'
            ? '저장 중…'
            : 'Saving…'
          : locale === 'ko'
            ? '저장하기'
            : 'Save'}
      </button>
    </footer>
  );
}
