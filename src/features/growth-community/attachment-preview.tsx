'use client';
import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
export type DiaryAttachment = { key: string; id?: string; file?: File };
export function AttachmentPreview({
  item,
  index,
  count,
  locale,
  onMove,
  onRemove,
}: {
  item: DiaryAttachment;
  index: number;
  count: number;
  locale: 'ko' | 'en';
  onMove: (direction: -1 | 1) => void;
  onRemove?: () => void;
}) {
  const image = useRef<HTMLImageElement>(null);
  const ko = locale === 'ko';
  useEffect(() => {
    const url = item.file
      ? URL.createObjectURL(item.file)
      : `/api/care/photos/${item.id}?size=480`;
    if (image.current) image.current.src = url;
    return () => {
      if (item.file) URL.revokeObjectURL(url);
    };
  }, [item]);
  return (
    <div className="diary-attachment">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={image}
        alt={ko ? `첨부 사진 ${index + 1}` : `Attachment ${index + 1}`}
      />
      <span className="diary-attachment-number">{index + 1}</span>
      {onRemove && (
        <button
          type="button"
          className="diary-attachment-remove"
          onClick={onRemove}
          aria-label={
            ko ? `${index + 1}번 사진 제거` : `Remove photo ${index + 1}`
          }
        >
          <X size={16} />
        </button>
      )}
      <div className="diary-attachment-order">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={
            ko
              ? `${index + 1}번 사진 앞으로`
              : `Move photo ${index + 1} earlier`
          }
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          aria-label={
            ko ? `${index + 1}번 사진 뒤로` : `Move photo ${index + 1} later`
          }
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
