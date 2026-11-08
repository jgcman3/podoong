'use client';
import '../community/posts.css';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { LoaderCircle, UserRoundPlus, ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { familyInviteCopy } from './invite-copy';
import { createCaregiverInvite } from './direct-invite-action';

const PostShareSheet = dynamic(
  () =>
    import('@/features/community/post-share-sheet').then(
      (module) => module.PostShareSheet,
    ),
  { ssr: false },
);

export function DirectFamilyInvite({
  childId,
  locale,
  placement = 'inline',
}: {
  childId: string;
  locale: Locale;
  placement?: 'inline' | 'settings';
}) {
  const ko = locale === 'ko';
  const button = useRef<HTMLButtonElement>(null);
  const interacted = useRef(false);
  const [busy, setBusy] = useState(false),
    [url, setUrl] = useState<string | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (interacted.current && !busy && !url)
      button.current?.focus({ preventScroll: true });
  }, [busy, url]);
  async function invite() {
    if (busy) return;
    interacted.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await createCaregiverInvite({ childId, locale });
      if (!result.ok) throw new Error('Invitation unavailable');
      setUrl(new URL(result.path, window.location.origin).href);
    } catch {
      setError(
        ko
          ? '초대를 만들지 못했어요. 다시 눌러 시도해 주세요.'
          : 'Could not create an invitation. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="direct-family-invite">
      <button
        ref={button}
        type="button"
        className={`care-handoff-invite${placement === 'settings' ? ' settings-invite-trigger' : ''}`}
        disabled={busy}
        aria-busy={busy}
        aria-label={
          placement === 'settings'
            ? busy
              ? ko
                ? '초대 준비 중…'
                : 'Preparing…'
              : ko
                ? '가족 초대하기'
                : 'Invite family'
            : undefined
        }
        aria-haspopup="dialog"
        onClick={() => void invite()}
      >
        {busy ? (
          <LoaderCircle
            size={13}
            className="quick-day-spinner"
            aria-hidden="true"
          />
        ) : (
          <UserRoundPlus size={13} aria-hidden="true" />
        )}
        {placement === 'settings' ? (
          <span className="settings-action-copy">
            {busy
              ? ko
                ? '초대 준비 중…'
                : 'Preparing…'
              : ko
                ? '가족 초대하기'
                : 'Invite family'}
            <small className="settings-action-description">
              {ko
                ? '가족과 같은 기록을 보며 함께 돌봐요.'
                : 'Care together with shared records.'}
            </small>
          </span>
        ) : busy ? (
          ko ? (
            '초대 준비 중…'
          ) : (
            'Preparing…'
          )
        ) : ko ? (
          '함께 돌볼 가족 초대'
        ) : (
          'Invite a caregiver'
        )}
        {placement === 'settings' && (
          <ChevronRight
            size={16}
            className="settings-invite-chevron"
            aria-hidden="true"
          />
        )}
      </button>
      {error && (
        <span className="direct-family-invite-error" role="alert">
          {error}
        </span>
      )}
      {url && (
        <PostShareSheet
          locale={locale}
          url={url}
          title={familyInviteCopy(locale).title}
          heading={ko ? '가족 초대 공유' : 'Share family invitation'}
          text={`${familyInviteCopy(locale).description}\n\n${ko ? '초대받은 보호자는 이 아이의 기록을 보고 작성할 수 있어요.' : 'The invited caregiver can view and add records for this child.'}\n\n${familyInviteCopy(locale).security}`}
          close={() => setUrl(null)}
        />
      )}
    </div>
  );
}
