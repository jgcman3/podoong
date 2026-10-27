'use client';
import Image from 'next/image';
import { Images } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function SharedDiaryPhotos({
  token,
  photos,
  ko,
  eager,
}: {
  token: string;
  photos: string[];
  ko: boolean;
  eager: boolean;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const current = useRef(0);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const [sizes, setSizes] = useState<
    Record<string, { width: number; height: number }>
  >({});
  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    let previousWidth = 0;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth === previousWidth) return;
      previousWidth = node.clientWidth;
      setWidth(node.clientWidth);
      node.scrollLeft = current.current * node.clientWidth;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const size = sizes[photos[active]];
  const height =
    size && width
      ? (size.height * Math.min(width, size.width)) / size.width
      : undefined;
  return (
    <div
      ref={rail}
      className="shared-diary-gallery"
      aria-label={ko ? '일기 사진' : 'Diary photos'}
      tabIndex={0}
      style={{ height }}
      onScroll={(event) => {
        const node = event.currentTarget;
        if (node.clientWidth) {
          current.current = Math.max(
            0,
            Math.min(
              photos.length - 1,
              Math.round(node.scrollLeft / node.clientWidth),
            ),
          );
          setActive(current.current);
        }
      }}
    >
      {photos.map((id, i) => (
        <figure key={id}>
          <Image
            src={`/api/share/diary/${token}/photos/${id}`}
            alt={ko ? `아기 사진 ${i + 1}` : `Baby photo ${i + 1}`}
            width={1600}
            height={1600}
            unoptimized
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            loading={eager && i === 0 ? 'eager' : 'lazy'}
            style={{ width: sizes[id]?.width ?? '100%' }}
            onLoad={(event) => {
              const image = event.currentTarget;
              setSizes((previous) => ({
                ...previous,
                [id]: {
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                },
              }));
            }}
          />
          {photos.length > 1 && (
            <figcaption>
              <Images size={13} strokeWidth={1.6} aria-hidden="true" />
              {i + 1} / {photos.length}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
