'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/domain';
export function DiaryAgeNavigation({
  age,
  previous,
  next,
  locale,
}: {
  age: number;
  previous?: string;
  next?: string;
  locale: Locale;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const ko = locale === 'ko';
  return (
    <nav
      className="diary-age-nav"
      aria-label={ko ? '생후 일수 선택' : 'Age in days'}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        start.current = { x: event.clientX, y: event.clientY };
        swiped.current = false;
      }}
      onPointerUp={(event) => {
        const origin = start.current;
        start.current = null;
        if (!origin) return;
        const dx = event.clientX - origin.x,
          dy = event.clientY - origin.y;
        if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
        swiped.current = true;
        const target = dx > 0 ? previous : next;
        if (target) router.push(target, { scroll: false });
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onClickCapture={(event) => {
        if (swiped.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {previous ? (
        <Link
          href={previous}
          scroll={false}
          aria-label={ko ? '이전 생후 일수' : 'Previous day of age'}
        >
          <ChevronLeft size={20} />
        </Link>
      ) : (
        <button
          disabled
          aria-label={ko ? '이전 생후 일수' : 'Previous day of age'}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <strong aria-live="polite">D+{age}</strong>
      {next ? (
        <Link
          href={next}
          scroll={false}
          aria-label={ko ? '다음 생후 일수' : 'Next day of age'}
        >
          <ChevronRight size={20} />
        </Link>
      ) : (
        <button disabled aria-label={ko ? '다음 생후 일수' : 'Next day of age'}>
          <ChevronRight size={20} />
        </button>
      )}
    </nav>
  );
}
