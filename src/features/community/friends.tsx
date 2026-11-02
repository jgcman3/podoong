import Link from 'next/link';
import { MessageCircle, Sparkles, ChevronRight } from 'lucide-react';
import { ChildIcon } from '@/components/child-icon';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { saveFriendAction } from './neighborhood-actions';

export async function NeighborhoodFriends({
  context,
  locale,
  scope,
  place,
  before,
  beforeId,
}: {
  context: CareContext;
  locale: Locale;
  scope: string;
  place: string;
  before?: string;
  beforeId?: string;
}) {
  const ko = locale === 'ko';
  const [friends, own] = await Promise.all([
    context.db.rpc('parenting_friends', {
      p_family: context.family.id,
      p_scope: scope,
      p_place: place,
      ...(before && !Number.isNaN(Date.parse(before))
        ? { p_before: new Date(before).toISOString() }
        : {}),
      ...(beforeId &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        beforeId,
      )
        ? { p_before_id: beforeId }
        : {}),
    }),
    context.owner
      ? context.db
          .from('parenting_friend_profiles')
          .select('nickname,status,enabled')
          .eq('child_id', context.child.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (friends.error || own.error)
    throw Error('Neighborhood friends unavailable');
  return (
    <section
      className="neighborhood-friends"
      aria-label={ko ? '동네 친구들' : 'Neighborhood friends'}
    >
      {context.owner && (
        <details className="panel friend-introduction">
          <summary>
            <span>
              <Sparkles size={17} />
              {ko ? '우리 아이 소개' : 'Introduce your child'}
            </span>
            <ChevronRight size={17} />
          </summary>
          <form action={saveFriendAction} className="form-stack">
            <input type="hidden" name="child" value={context.child.id} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="place" value={place} />
            <label>
              {ko ? '공개 닉네임' : 'Public nickname'}
              <input
                name="nickname"
                required
                maxLength={40}
                defaultValue={own.data?.nickname ?? ''}
                placeholder={
                  ko ? '예: 포둥네 지혜' : 'e.g. Podoong’s little one'
                }
              />
            </label>
            <label>
              {ko ? '한 줄 상태' : 'A little status'}
              <input
                name="status"
                maxLength={80}
                defaultValue={own.data?.status ?? ''}
                placeholder={
                  ko
                    ? '오늘은 처음으로 뒤집었어요 🌱'
                    : 'I rolled over for the first time 🌱'
                }
              />
            </label>
            <label className="friend-sharing-choice">
              <input
                type="checkbox"
                name="enabled"
                value="yes"
                defaultChecked={own.data?.enabled ?? false}
              />
              <span>
                {ko ? '동네 친구들에게 공개' : 'Show to neighborhood friends'}
              </span>
            </label>
            <p className="small muted">
              {ko
                ? '닉네임·성별·D+일수·구/동 지역·상태가 로그인한 사용자에게 보여요. 공개를 끄면 목록에서 사라져요.'
                : 'Signed-in users can see the nickname, sex, age in days, district/neighborhood and status. Turn sharing off to remove the card.'}
            </p>
            <div className="friend-form-actions">
              <button className="button primary">{ko ? '저장' : 'Save'}</button>
            </div>
          </form>
        </details>
      )}
      {friends.data.length ? (
        <div className="friend-grid">
          {friends.data.map((friend) => (
            <article
              className={`friend-card friend-${friend.sex}`}
              key={friend.id}
            >
              <div className="friend-face">
                <ChildIcon sex={friend.sex} size={46} />
              </div>
              <div className="friend-identity">
                <h2>{friend.nickname}</h2>
                <div className="friend-age">
                  <span>
                    {friend.sex === 'female'
                      ? ko
                        ? '여아'
                        : 'Girl'
                      : ko
                        ? '남아'
                        : 'Boy'}
                  </span>
                  <strong>D+{friend.age_days}</strong>
                </div>
                <p className="friend-area" title={friend.area_label}>
                  {friend.area_label}
                </p>
              </div>
              <p className="friend-status">
                <MessageCircle size={14} aria-hidden />
                <span title={friend.status}>
                  {friend.status ||
                    (ko
                      ? '반가워요, 동네 친구들!'
                      : 'Hello, neighborhood friends!')}
                </span>
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel friend-empty">
          <ChildIcon sex="female" size={38} />
          <ChildIcon sex="male" size={38} />
          <p>
            {ko
              ? '첫 동네 친구를 기다리고 있어요.'
              : 'Waiting for our first neighborhood friends.'}
          </p>
        </div>
      )}
      {friends.data.length === 30 && (
        <Link
          className="button secondary"
          href={`/${locale}/community?${new URLSearchParams({ child: context.child.id, category: 'friends', scope, place, before: friends.data.at(-1)!.created_at, beforeId: friends.data.at(-1)!.id })}`}
        >
          {ko ? '다른 친구들' : 'More friends'}
        </Link>
      )}
    </section>
  );
}
