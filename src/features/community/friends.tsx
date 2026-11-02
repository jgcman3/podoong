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
    </section>
  );
}
