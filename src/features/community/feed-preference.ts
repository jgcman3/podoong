export type FeedArea = 'neighborhood';
export function feedPreferenceCookie(area: FeedArea) {
  return `podoong-feed-${area}`;
}
export function feedPreference(
  value: string | undefined,
  tags: readonly (readonly string[])[],
) {
  const [savedCategory, savedSort] = (value ?? '').split(':');
  const category = tags.some(([id]) => id === savedCategory)
    ? savedCategory
    : 'all';
  return {
    category,
    sort: category === 'all' && savedSort === 'popular' ? 'popular' : 'all',
  };
}
