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
