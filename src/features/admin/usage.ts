import { z } from 'zod';

export const usageScreens = [
  'today',
  'insights',
  'diary',
  'community',
  'account',
] as const;
export const usageInput = z.object({ screen: z.enum(usageScreens) }).strict();
export function usageScreen(path: string) {
  const parts = path.split(/[?#]/, 1)[0].split('/').filter(Boolean);
  if (!['ko', 'en'].includes(parts[0])) return null;
  const section = parts[1];
  if (['today', 'insights'].includes(section) && parts.length === 2)
    return section as 'today' | 'insights';
  if (['account', 'settings', 'family'].includes(section) && parts.length === 2)
    return 'account';
  if (section === 'community')
    return parts[2] === 'diaries' ||
      parts[2] === 'new' ||
      (parts[2] &&
        !['playground', 'neighborhood', 'posts', 'settings'].includes(parts[2]))
      ? 'diary'
      : 'community';
  return null;
}
export function usageAllowed(
  cookie: string,
  doNotTrack: string | null | undefined,
) {
  return (
    doNotTrack !== '1' &&
    doNotTrack !== 'yes' &&
    !cookie.split(';').some((part) => part.trim() === 'podoong-usage=off')
  );
}
