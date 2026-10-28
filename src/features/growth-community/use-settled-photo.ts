'use client';
import { useEffect, useState, type RefObject } from 'react';

// Changing the active image resizes the gallery. Wait for the finger and
// momentum scrolling to finish so that the swipe target does not move.
export function useSettledPhoto(
  rail: RefObject<HTMLDivElement | null>,
  count: number,
  initial = 0,
) {
  const [index, setIndex] = useState(initial);
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    let touching = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      if (touching) return;
      timer = setTimeout(() => {
        if (node.clientWidth)
          setIndex(
            Math.max(
              0,
              Math.min(
                count - 1,
                Math.round(node.scrollLeft / node.clientWidth),
              ),
            ),
          );
      }, 150);
    };
    const start = () => {
      touching = true;
      clearTimeout(timer);
    };
    const end = () => {
      touching = false;
      settle();
    };
    node.addEventListener('scroll', settle, { passive: true });
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchend', end, { passive: true });
    node.addEventListener('touchcancel', end, { passive: true });
    return () => {
      clearTimeout(timer);
      node.removeEventListener('scroll', settle);
      node.removeEventListener('touchstart', start);
      node.removeEventListener('touchend', end);
      node.removeEventListener('touchcancel', end);
    };
  }, [rail, count]);
  return index;
}
