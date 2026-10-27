import type { LucideProps } from 'lucide-react';

/** Simple breast outline, sharing the care icons' stroke and colour. */
export function BreastIcon({
  size = 24,
  strokeWidth = 2,
  ...props
}: LucideProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M7 3c0 3 1.5 4.5 4.5 5.5 3.5 1.2 6 3 6.5 6l2 1v2l-2 1c-1 2-3 3-6 3-4.5 0-7-3-7-7" />
      <path d="M15.5 14.5c1 1 1 2.5 0 3.5" />
    </svg>
  );
}
