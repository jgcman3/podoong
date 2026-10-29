'use client';
import Image from 'next/image';
import { ImagePlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/domain';
import { QuickFieldTitle } from '@/features/care/quick-field-title';
export function GiftPhotoField({
  locale,
  photoId,
}: {
  locale: Locale;
  photoId?: string;
}) {
  const ko = locale === 'ko',
    input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null),
    [removed, setRemoved] = useState(false),
    [invalid, setInvalid] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const preview =
    url ||
    (!removed && photoId ? `/api/care/photos/${photoId}?size=480` : null);
  return (
    <div className="gift-photo-field">
      <QuickFieldTitle>
        {ko ? '사진 (선택)' : 'Photo (optional)'}
      </QuickFieldTitle>
      <input
        type="hidden"
        name="removeGiftPhoto"
        value={removed && photoId ? photoId : ''}
      />
      {preview && (
        <div className="gift-photo-preview">
          <Image
            unoptimized
            src={preview}
            width={120}
            height={120}
            alt={ko ? '선물 사진' : 'Gift photo'}
          />
          <button
            type="button"
            aria-label={ko ? '선물 사진 제거' : 'Remove gift photo'}
            onClick={() => {
              setUrl(null);
              setRemoved(true);
              setInvalid(false);
              if (input.current) input.current.value = '';
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <label className="button secondary gift-photo-picker">
        <ImagePlus size={18} />
        {preview
          ? ko
            ? '사진 바꾸기'
            : 'Replace photo'
          : ko
            ? '사진 추가'
            : 'Add photo'}
        <input
          ref={input}
          type="file"
          name="giftPhoto"
          accept="image/jpeg,image/png,image/webp"
          aria-label={ko ? '선물 사진 추가' : 'Add gift photo'}
          onChange={(e) => {
            const next = e.currentTarget.files?.[0];
            if (
              next &&
              (next.size <= 0 ||
                next.size > 5242880 ||
                !['image/jpeg', 'image/png', 'image/webp'].includes(next.type))
            ) {
              setInvalid(true);
              setUrl(null);
              e.currentTarget.value = '';
              return;
            }
            setUrl(next ? URL.createObjectURL(next) : null);
            setInvalid(false);
          }}
        />
      </label>
      {invalid && (
        <span role="alert" className="small">
          {ko
            ? '5MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.'
            : 'Choose a JPG, PNG or WebP photo up to 5MB.'}
        </span>
      )}
    </div>
  );
}
