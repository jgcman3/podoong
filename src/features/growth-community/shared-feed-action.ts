'use server';
import { diaryLinkClient, validDiaryToken } from './public-link';
export async function loadSharedDiaries(token: string, page: number) {
  if (
    !validDiaryToken(token) ||
    !Number.isInteger(page) ||
    page < 0 ||
    page > 10000
  )
    return { status: 'error' as const };
  const db = diaryLinkClient(token);
  const profile = await db
    .rpc('child_diary_link_profile', { p_token: token })
    .maybeSingle();
  if (profile.error) return { status: 'error' as const };
  if (!profile.data) return { status: 'closed' as const };
  const result = await db.rpc('read_child_diary_link', {
    p_token: token,
    p_page: page,
  });
  if (result.error) return { status: 'error' as const };
  return { status: 'ok' as const, entries: result.data ?? [] };
}
