import type { Locale } from '@/lib/domain';
import { communityCopy } from './copy';
export type BoardLocation = {
  family_id: string;
  country_code: string;
  country_name: string;
  scope: string;
  region_code: string | null;
  region_name: string | null;
};
export type BoardChoice = {
  key: string;
  label: string;
  scope: string;
  countryCode: string;
  regionCode: string | null;
  topic: string | null;
};
export function boardCaption(
  board: { scope: string; region_label: string; topic: string | null },
  locale: Locale,
) {
  const t = communityCopy(locale);
  const name =
    board.scope === 'topic'
      ? (t.topics[board.topic as keyof typeof t.topics] ?? '')
      : (board.region_label.trim().split(/\s+/).at(-1) ?? '');
  return `${name} ${locale === 'ko' ? '게시판' : 'board'}`;
}
export function makeBoards(
  locations: BoardLocation[],
  locale: Locale,
): BoardChoice[] {
  const regional = ['district', 'locality'].flatMap((scope) => {
    const location = locations.find((l) => l.scope === scope);
    return location
      ? [
          {
            key: scope,
            scope,
            countryCode: location.country_code,
            regionCode: location.region_code,
            topic: null,
            label: boardCaption(
              { scope, region_label: location.region_name!, topic: null },
              locale,
            ),
          },
        ]
      : [];
  });
  const country = locations.find((l) => l.scope === 'topic');
  const topics = country
    ? Object.keys(communityCopy(locale).topics).map((topic) => ({
        key: `topic:${topic}`,
        scope: 'topic',
        countryCode: country.country_code,
        regionCode: null,
        topic,
        label: boardCaption(
          { scope: 'topic', region_label: country.country_name, topic },
          locale,
        ),
      }))
    : [];
  return [...regional, ...topics];
}
export function chooseBoard(boards: BoardChoice[], key?: string) {
  return boards.find((b) => b.key === key) ?? boards[0];
}
export function boardQuery(
  familyId: string | undefined,
  board?: string,
  extra: Record<string, string> = {},
) {
  return new URLSearchParams({
    ...extra,
    ...(familyId ? { family: familyId } : {}),
    ...(board ? { board } : {}),
  }).toString();
}
