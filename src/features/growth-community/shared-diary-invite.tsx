import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function SharedDiaryInvite({
  ko,
  compact = false,
}: {
  ko: boolean;
  compact?: boolean;
}) {
  if (compact)
    return (
      <aside
        className="shared-diary-invite-compact"
        aria-label={ko ? '포둥 소개' : 'About podoong'}
      >
        <div>
          <strong>podoong</strong>
          <p>
            {ko ? '함께 돌보는, 포근한 둥지' : 'Caring together, a cozy nest.'}
          </p>
        </div>
        <Link
          className="diary-invite-cta"
          href={`/${ko ? 'ko' : 'en'}/login`}
          aria-label={ko ? '포둥 시작하기' : 'Get started with podoong'}
        >
          {ko ? '시작하기' : 'Get started'}
          <ArrowRight size={16} />
        </Link>
      </aside>
    );
  return (
    <footer className="shared-diary-invite">
      <div className="diary-invite-brand">
        <strong>podoong</strong>
      </div>
      <h2>
        {ko ? '함께 돌보는, 포근한 둥지' : 'Caring together, a cozy nest.'}
      </h2>
      <p>
        {ko
          ? '매일의 육아 기록과 성장일기를 한곳에.'
          : 'Everyday care and growing memories, together.'}
      </p>
      <Link className="diary-invite-cta" href={`/${ko ? 'ko' : 'en'}/login`}>
        {ko ? '포둥 시작하기' : 'Get started with podoong'}
        <ArrowRight size={18} />
      </Link>
    </footer>
  );
}
