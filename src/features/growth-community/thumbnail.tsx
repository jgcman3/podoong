'use client';
import Image from 'next/image';
import { useState } from 'react';
import { readThumbnail, warmThumbnail } from './thumbnail-cache';

export function DiaryThumbnail({
  source,
  scope,
  alt,
}: {
  source: string;
  scope: string;
  alt: string;
}) {
  // Initial page loads keep the normal server-rendered image URL. On client
  // navigation, only previews from this same login session can be reused.
  const [cached] = useState(() => readThumbnail(scope, source));
  return (
    <Image
      src={cached ?? source}
      alt={alt}
      width={480}
      height={480}
      unoptimized
      draggable={false}
      onLoad={() => {
        if (!cached) void warmThumbnail(scope, source);
      }}
    />
  );
}
