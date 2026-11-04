export const parentingCategories = [
  ['all', '전체', 'All'],
  ['play', '놀이', 'Play'],
  ['gear', '육아용품', 'Baby gear'],
  ['development', '발달', 'Development'],
  ['discipline', '훈육', 'Discipline'],
  ['feeding', '수유·분유', 'Milk feeding'],
  ['solids', '이유식', 'Solids'],
  ['birth-supplies', '출산준비물', 'Birth essentials'],
  ['postpartum', '산후조리', 'Postpartum care'],
  ['health', '건강·증상', 'Health'],
  ['birth', '출산', 'Birth'],
  ['travel', '여행', 'Travel'],
] as const;
export const parentingTags = parentingCategories.filter(([id]) => id !== 'all');
export const neighborhoodTags = [
  ['local-daily', '동네 일상', 'Daily life'],
  ['local-friends', '동네 친구', 'Local friends'],
  ['local-childcare', '어린이집·유치원', 'Daycare & preschool'],
  ['local-outings', '동네 나들이', 'Local outings'],
  ['local-info', '생활정보', 'Local tips'],
  ['local-help', '질문·도움', 'Questions & help'],
] as const;

export function communityTags(neighborhood: boolean) {
  return neighborhood ? neighborhoodTags : parentingTags;
}
