'use client';
import './posts.css';
import { useState } from 'react';
import { Share2 } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { PostShareSheet } from './post-share-sheet';

export function ServiceInvite({
  locale,
  url,
}: {
  locale: Locale;
  url: string;
}) {
  const [open, setOpen] = useState(false);
  const ko = locale === 'ko';
  const heading = ko ? '포둥 소개하기' : 'Share podoong';
  return (
    <aside className="panel service-invite">
      <p>
        {ko
          ? '가까운 육아 친구와 함께해요'
          : 'Parenting is better with friends nearby'}
      </p>
      <button className="button secondary" onClick={() => setOpen(true)}>
        <Share2 size={17} aria-hidden="true" />
        {heading}
      </button>
      {open && (
        <PostShareSheet
          locale={locale}
          url={url}
          title={
            ko
              ? '포둥 · 함께 돌보는, 포근한 둥지'
              : 'podoong · Care together. Grow closer.'
          }
          heading={heading}
          text={
            ko
              ? '육아 기록과 성장일기를 남기고, 동네 육아 친구도 만나는 포둥이에요. 함께 시작해요!'
              : 'Keep care records and growing memories, and meet parenting friends nearby on podoong. Join me!'
          }
          close={() => setOpen(false)}
        />
      )}
    </aside>
  );
}
