'use client';
import { useState } from 'react';
import { Share2, Sprout } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { PostShareSheet } from './post-share-sheet';
import './posts.css';

export function NeighborhoodOpening({
  locale,
  neighborhood,
  families,
}: {
  locale: Locale;
  neighborhood: string;
  families: number;
}) {
  const [sharing, setSharing] = useState(false);
  const ko = locale === 'ko';
  return (
    <section className="neighborhood-opening">
      <span className="neighborhood-opening-icon" aria-hidden="true">
        <Sprout size={32} />
      </span>
      <p className="neighborhood-opening-place">{neighborhood}</p>
      <h2>
        {ko
          ? '동네 육아 친구를 모으고 있어요'
          : 'Let’s bring neighborhood families together'}
      </h2>
      <p>
        {ko
          ? '같은 동네의 3가족이 모이면 동네 이야기 게시판이 열려요. 가까이 사는 부모님에게 포둥을 소개해 주세요.'
          : 'Neighborhood stories open when 3 families join your neighborhood. Invite nearby parents to join podoong.'}
      </p>
      <div
        className="neighborhood-opening-progress"
        aria-label={
          ko
            ? `${families}가족 참여, 3가족이 모이면 열려요`
            : `${families} of 3 families joined`
        }
      >
        {[1, 2, 3].map((n) => (
          <span key={n} data-joined={families >= n} aria-hidden="true">
            🌱
          </span>
        ))}
        <small>{ko ? `${families} / 3가족` : `${families} / 3 families`}</small>
      </div>
      <button className="button" onClick={() => setSharing(true)}>
        <Share2 size={17} />
        {ko ? '동네 친구에게 포둥 소개하기' : 'Invite a neighborhood friend'}
      </button>
      {sharing && (
        <PostShareSheet
          usage="introduction"
          locale={locale}
          heading={
            ko ? '동네 친구에게 포둥 소개하기' : 'Invite a neighborhood friend'
          }
          url={new URL(`/${locale}/intro`, window.location.origin).href}
          title={
            ko
              ? `${neighborhood} 육아 친구를 만나요 · 포둥`
              : `Meet parenting friends in ${neighborhood} · podoong`
          }
          text={
            ko
              ? `${neighborhood} 부모님, 포둥에서 함께 이야기해요! 가입 후 거주지를 등록하면 우리 동네 이야기에서 만날 수 있어요.`
              : `Join me on podoong! Set your neighborhood to ${neighborhood} after signing up so we can connect.`
          }
          close={() => setSharing(false)}
        />
      )}
    </section>
  );
}
