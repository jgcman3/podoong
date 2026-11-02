'use client';
import { useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Include the clicked button in FormData: facility categories use
// named submit buttons. Replace the URL without reloading the document.
export function FacilityNavigationForm({
  action,
  className,
  children,
  label,
  autoSubmit = false,
}: {
  action: string;
  className?: string;
  children: ReactNode;
  label?: string;
  autoSubmit?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(
      event.currentTarget,
      (event.nativeEvent as SubmitEvent).submitter,
    );
    const query = new URLSearchParams();
    for (const [name, value] of values)
      if (typeof value === 'string') query.set(name, value);
    startTransition(() => router.replace(`${action}?${query}`));
  }
  return (
    <form
      action={action}
      method="get"
      className={['facility-navigation-form', className]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
      aria-busy={pending}
      onSubmit={submit}
      onChange={
        autoSubmit ? (event) => event.currentTarget.requestSubmit() : undefined
      }
    >
      {children}
    </form>
  );
}
