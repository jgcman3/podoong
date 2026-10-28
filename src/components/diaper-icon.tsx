import type { LucideProps } from 'lucide-react';

export function DiaperIcon({
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
      <path d="M3 5h18v5c0 6-4 10-9 10S3 16 3 10Z" />
      <path d="M3 8h5v3H3m18-3h-5v3h5M4 13c4 0 6 3 6 7m10-7c-4 0-6 3-6 7" />
      <path d="M9 5v2m3-2v2m3-2v2" />
    </svg>
  );
}
