'use client';
import '../community/posts.css';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Share2 } from 'lucide-react';
import dynamic from 'next/dynamic';
const PostShareSheet = dynamic(
  () =>
    import('@/features/community/post-share-sheet').then(
      (module) => module.PostShareSheet,
    ),
  { ssr: false },
);
import type { Locale } from '@/lib/domain';

export function InviteShare({ locale, url }: { locale: Locale; url: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(params.get('notice') === 'invite-created');
  const ko = locale === 'ko';
  useEffect(() => {
    if (params.get('notice') !== 'invite-created') return;
    button.current?.focus({ preventScroll: true });
    const next = new URLSearchParams(params.toString());
    next.delete('notice');
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [params, pathname, router]);
  return (
    <>
      <button
        ref={button}
        className="button secondary"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Share2 size={18} aria-hidden="true" />
        {ko ? '초대 링크 공유' : 'Share invitation'}
      </button>
      {open && (
        <PostShareSheet
          locale={locale}
          url={url}
          title={
            ko
              ? '가족을 초대합니다 · 포둥'
              : 'You’re invited to join your family · podoong'
          }
          heading={ko ? '가족 초대 공유' : 'Share family invitation'}
          text={
            ko
              ? '포둥에서 우리 아이의 하루를 함께 기록하고 돌봐요.'
              : 'Record and care for your little one together on podoong.'
          }
          close={() => setOpen(false)}
        />
      )}
    </>
  );
}
