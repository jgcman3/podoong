'use client';
import { useRef, useState } from 'react';
import {
  Heart,
  Milk,
  Utensils,
  Moon,
  Baby,
  Toilet,
  Bath,
  Hospital,
  Syringe,
  Thermometer,
  Pill,
  Apple,
  Shapes,
  Smile,
  Ruler,
  BookHeart,
  Check,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { insightKinds, kindName } from './config';
import { useInsightsNavigation } from './navigation';
const icons = [
  Heart,
  Milk,
  Utensils,
  Moon,
  Baby,
  Toilet,
  Bath,
  Hospital,
  Syringe,
  Thermometer,
  Pill,
  Apple,
  Shapes,
  Smile,
  Ruler,
  BookHeart,
];
export function KindPicker({ locale }: { locale: Locale }) {
  const { selected: optimistic, toggle, pending } = useInsightsNavigation();
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    scroll: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      ref={rail}
      className={`insight-kind-rail mobile-function-rail ${dragging ? 'is-dragging' : ''}`}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        suppressClick.current = false;
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
          if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
          d.moved = true;
          suppressClick.current = true;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        event.currentTarget.scrollLeft = d.scroll - dx;
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerLeave={() => {
        if (drag.current && !drag.current.moved) drag.current = null;
      }}
      onClickCapture={(event) => {
        if (suppressClick.current && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      role="group"
      aria-label={locale === 'ko' ? '기능별 분석' : 'Analysis by activity'}
      aria-busy={pending}
    >
      {insightKinds.map((kind, index) => {
        const Icon = icons[index],
          active = optimistic.includes(kind);
        return (
          <button
            type="button"
            draggable={false}
            key={kind}
            aria-pressed={active}
            className={`quick-color-${kind}`}
            onClick={() => toggle(kind)}
          >
            <span>
              <Icon size={20} />
              {active && <Check className="insight-kind-check" size={12} />}
            </span>
            <strong>{kindName(kind, locale)}</strong>
          </button>
        );
      })}
    </div>
  );
}
