export const parentingCategories = [
  ['all', '전체', 'All'],
  ['daily', '일상', 'Daily life'],
  ['play', '놀이', 'Play'],
  ['development', '발달', 'Development'],
  ['discipline', '훈육', 'Discipline'],
  ['travel', '나들이', 'Outings'],
  ['solids', '이유식', 'Solids'],
  ['feeding', '수유·분유', 'Milk feeding'],
  ['gear', '육아용품', 'Baby gear'],
  ['health', '건강·증상', 'Health'],
  ['birth-supplies', '출산준비물', 'Birth essentials'],
  ['postpartum', '산후조리', 'Postpartum care'],
  ['birth', '출산', 'Birth'],
  ['other', '기타', 'Other'],
] as const;
export const parentingTags = parentingCategories.filter(([id]) => id !== 'all');
export const neighborhoodTags = [
  ['local-daily', '동네일상', 'Daily life'],
  ['local-outings', '동네나들이', 'Local outings'],
  ['local-info', '생활정보', 'Local tips'],
  ['local-help', '질문·도움', 'Questions & help'],
  ['local-childcare', '어린이집·유치원', 'Daycare & preschool'],
  ['local-market', '중고나눔·거래', 'Sharing & resale'],
  ['local-other', '기타', 'Other'],
] as const;

export function communityTags(neighborhood: boolean) {
  return neighborhood ? neighborhoodTags : parentingTags;
}
