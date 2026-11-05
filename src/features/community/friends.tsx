import { chooseChildVisibility } from '@/features/privacy/actions';
import { FriendWorld } from './friend-world';
import { publicChildName } from './friend-world-model';
import { loadPlayground } from './playground-data.server';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { saveFriendAction } from './neighborhood-actions';

export async function NeighborhoodFriends({
  context,
  locale,
}: {
  context: CareContext;
  locale: Locale;
}) {
  const ko = locale === 'ko';
  if (!context.privacy.neighborhood)
    return (
      <section className="panel form-stack">
        <h2>{ko ? '동네 친구들과 만나요' : 'Meet neighborhood friends'}</h2>
        <p className="small muted">
          {ko
            ? '참여하면 가족·아이 닉네임, 성별·나이, 한 줄 상태와 가상 캐릭터가 같은 동네 이용자에게 보여요. 기기 위치는 사용하지 않아요. 선택은 이 아이에게 저장되어 이후에도 참여하며, 이 화면에서 참여를 중단하면 숨겨집니다. 참여하지 않아도 다른 기능은 이용할 수 있어요.'
            : 'Joining shows your family/child nickname, sex, age, status and character to neighborhood users. No device location is used. Your choice is saved for this child until you leave from this playground. Other features are available without joining.'}
        </p>
        <form action={chooseChildVisibility}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="child" value={context.child.id} />
          <input type="hidden" name="scope" value="neighborhood" />
          <input type="hidden" name="enabled" value="on" />
          <button className="button primary">
            {ko ? '참여하기' : 'Join playground'}
          </button>
        </form>
      </section>
    );
  const [world, profile] = await Promise.all([
    loadPlayground(context),
    context.db
      .from('parenting_friend_profiles')
      .select('status')
      .eq('child_id', context.child.id)
      .maybeSingle(),
  ]);
  if (profile.error) throw Error('Neighborhood profile unavailable');
  const displayName = publicChildName(context.family.name, context.child.name);
  return (
    <section
      className="neighborhood-friends"
      aria-label={ko ? '동네 친구들' : 'Neighborhood friends'}
    >
      <FriendWorld
        key={`${context.child.id}:${world.day}:${displayName}:${profile.data?.status}`}
        initial={world}
        childId={context.child.id}
        locale={locale}
        neighborhood={context.family.residence_locality ?? ''}
        statusEditor={
          context.owner ? (
            <form action={saveFriendAction} className="world-status-form">
              <input type="hidden" name="child" value={context.child.id} />
              <input type="hidden" name="locale" value={locale} />
              <div className="world-status-input-row">
                <input
                  aria-label={ko ? '한 줄 상태' : 'Status'}
                  name="status"
                  maxLength={80}
                  defaultValue={profile.data?.status ?? ''}
                  placeholder={
                    ko ? '오늘의 한 줄 상태' : 'A little update for today'
                  }
                />
                <button className="button world-status-save" type="submit">
                  {ko ? '저장' : 'Save'}
                </button>
              </div>
            </form>
          ) : undefined
        }
      />
      {context.owner && (
        <details className="playground-participation small">
          <summary>{ko ? '참여 중단' : 'Leave playground'}</summary>
          <p className="muted">
            {ko
              ? '이 아이가 동네 놀이터에서 숨겨지고 한 줄 상태와 인사·하트·토닥토닥 내역이 삭제돼요. 일기와 돌봄 기록은 유지되며 언제든 다시 참여할 수 있어요.'
              : 'Your child will be hidden from the playground. Their status and reaction history will be removed. Diaries and care records stay, and you can join again anytime.'}
          </p>
          <form action={chooseChildVisibility}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="child" value={context.child.id} />
            <button className="button secondary">
              {ko ? '참여 중단하기' : 'Confirm leaving'}
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
