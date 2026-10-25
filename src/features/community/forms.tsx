import { randomUUID } from 'node:crypto';
import type { ReactNode } from 'react';
import type { Locale } from '@/lib/domain';
import { communityAction } from './actions';
import { communityCopy } from './copy';
import type { CommunityCommand } from './schema';
import type { BoardChoice } from './boards';
export function Action({
  locale,
  action,
  id,
  postId,
  familyId,
  label,
  fields,
  moderation = false,
  icon,
  pressed,
}: {
  locale: Locale;
  action: CommunityCommand;
  id: string;
  postId?: string;
  familyId?: string;
  label: string;
  fields?: Record<string, string>;
  moderation?: boolean;
  icon?: ReactNode;
  pressed?: boolean;
}) {
  return (
    <form action={communityAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="id" value={id} />
      {postId && <input type="hidden" name="postId" value={postId} />}
      {familyId && <input type="hidden" name="familyId" value={familyId} />}
      <input type="hidden" name="moderation" value={String(moderation)} />
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {[
        'report',
        'hide',
        'unhide',
        'restrict',
        'unrestrict',
        'notice',
        'resolve',
      ].includes(action) && (
        <label>
          {communityCopy(locale).reason}
          <input name="reason" required maxLength={500} />
        </label>
      )}
      <button
        type="submit"
        className={`button secondary${action.startsWith('delete-') ? ' danger' : ''}`}
        aria-pressed={pressed}
      >
        {icon}
        {label}
      </button>
    </form>
  );
}
export function PostForm({
  locale,
  post,
  familyId,
  boards = [],
  defaultBoard,
  residenceVersion,
  boardLabel,
}: {
  locale: Locale;
  familyId?: string;
  boards?: BoardChoice[];
  defaultBoard?: string;
  residenceVersion?: number;
  boardLabel?: string;
  post?: { id: string; title: string; body: string };
}) {
  const t = communityCopy(locale);
  return (
    <form action={communityAction} className="panel">
      <fieldset>
        <legend>{post ? t.edit : t.create}</legend>
        {!post && <input type="hidden" name="compose" value="true" />}
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="action" value="post" />
        <input type="hidden" name="id" value={post?.id ?? randomUUID()} />
        {!post && (
          <input
            type="hidden"
            name="residenceVersion"
            value={residenceVersion}
          />
        )}
        {familyId && <input type="hidden" name="familyId" value={familyId} />}
        {post && <input type="hidden" name="postId" value={post.id} />}
        {post ? (
          <p>{boardLabel}</p>
        ) : (
          <label>
            {t.board}
            <select name="board" defaultValue={defaultBoard} required>
              {boards.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t.titleLabel}
          <input
            name="title"
            defaultValue={post?.title}
            required
            maxLength={200}
          />
        </label>
        <label>
          {t.body}
          <textarea
            name="body"
            defaultValue={post?.body}
            required
            maxLength={10000}
          />
        </label>
        <p>{t.privacy}</p>
        <button type="submit" className="button">
          {t.save}
        </button>
      </fieldset>
    </form>
  );
}
