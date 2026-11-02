'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { deleteParentingPost } from './post-action';
export function PostRowMenu({
  id,
  child,
  source,
  locale,
}: {
  id: string;
  child: string;
  source: 'boards' | 'neighborhood';
  locale: Locale;
}) {
  const ko = locale === 'ko',
    router = useRouter(),
    lock = useRef(false);
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  return (
    <details className="parenting-own-menu parenting-row-menu">
      <summary aria-label={ko ? '내 글 관리' : 'Manage my post'}>
        <MoreHorizontal size={21} />
      </summary>
      <div>
        <Link
          href={`/${locale}/community/posts/${id}?${new URLSearchParams({ child, source, edit: '1' })}`}
        >
          <Pencil size={15} />
          {ko ? '편집' : 'Edit'}
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            if (
              lock.current ||
              !window.confirm(
                ko
                  ? '이 글을 삭제할까요? 댓글과 첨부 사진도 함께 삭제됩니다.'
                  : 'Delete this post, its comments and photos?',
              )
            )
              return;
            lock.current = true;
            setPending(true);
            setError('');
            try {
              if (!(await deleteParentingPost({ post: id, locale })))
                throw Error();
              router.refresh();
            } catch {
              setError(
                ko
                  ? '삭제하지 못했어요. 다시 시도해 주세요.'
                  : 'Could not delete. Please try again.',
              );
            } finally {
              lock.current = false;
              setPending(false);
            }
          }}
        >
          <Trash2 size={15} />
          {ko ? '삭제' : 'Delete'}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
