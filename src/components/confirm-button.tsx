'use client';
export function ConfirmButton({
  label,
  message,
  className = 'text-button danger',
  disabled = false,
}: {
  label: string;
  message: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={className}
      disabled={disabled}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
