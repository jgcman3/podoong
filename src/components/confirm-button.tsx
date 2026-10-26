'use client';
import type { ReactNode } from 'react';
export function ConfirmButton({
  label,
  message,
  className = 'text-button danger',
  disabled = false,
  icon,
}: {
  label: string;
  message: string;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      className={className}
      disabled={disabled}
      aria-label={icon ? label : undefined}
      title={icon ? label : undefined}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {icon ?? label}
    </button>
  );
}
