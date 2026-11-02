export const parentingCategories = [
  ['friends', '동네 친구들', 'Neighborhood friends'],
  ['all', '전체', 'All'],
  ['pediatrics', '소아과', 'Pediatrics'],
  ['childcare', '어린이집', 'Daycare'],
  ['outings', '놀이-나들이', 'Play & outings'],
  ['gear', '육아용품', 'Baby gear'],
  ['development', '발달-훈육', 'Development'],
  ['feeding', '수유-분유', 'Milk feeding'],
  ['birth-supplies', '출산준비물', 'Birth essentials'],
  ['postpartum', '산후조리', 'Postpartum care'],
  ['health', '건강-증상', 'Health'],
  ['toddler-food', '유아식', 'Toddler meals'],
  ['birth', '출산', 'Birth'],
  ['travel', '여행', 'Travel'],
] as const;
export const parentingTags = parentingCategories.filter(
  ([id]) => id !== 'friends' && id !== 'all',
);
export const regionScopes = ['city', 'district', 'locality'] as const;
export type RegionScope = (typeof regionScopes)[number];
export function homeArea(family: {
  residence_country_code: string | null;
  residence_province: string | null;
  residence_city: string | null;
  residence_locality: string | null;
}) {
  const district = family.residence_city ?? '';
  const parts = district.split(' ');
  const city =
    family.residence_country_code === 'KR'
      ? parts.slice(0, /[시군]$/.test(parts[1] ?? '') ? 2 : 1).join(' ')
      : [family.residence_province, district].filter(Boolean).join(' ');
  return {
    city,
    district,
    locality: [district, family.residence_locality].filter(Boolean).join(' '),
  };
}
