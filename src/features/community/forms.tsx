import type { Locale } from '@/lib/domain';
import { communityAction } from './actions';
import { communityCopy } from './copy';
import type { CommunityCommand } from './schema';
export function Action({
  locale,
  action,
  id,
  label,
  fields,
  moderation = false,
}: {
  locale: Locale;
  action: CommunityCommand;
  id: string;
  label: string;
  fields?: Record<string, string>;
  moderation?: boolean;
}) {
  return (
    <form action={communityAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="moderation" value={String(moderation)} />
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {['hide', 'unhide', 'restrict', 'unrestrict', 'resolve'].includes(
        action,
      ) && (
        <label>
          {communityCopy(locale).reason}
          <input name="reason" required maxLength={500} />
        </label>
      )}
      <button type="submit" className="button secondary">
        {label}
      </button>
    </form>
  );
}
