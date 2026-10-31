export const parentingCategories = [
  ['all', '전체', 'All'],
  ['childcare', '어린이집', 'Daycare'],
  ['outings', '놀이나들이', 'Play & outings'],
  ['gear', '육아용품', 'Baby gear'],
  ['development', '발달훈육', 'Development'],
  ['feeding', '수유분유', 'Milk feeding'],
  ['birth-supplies', '출산준비물', 'Birth essentials'],
  ['postpartum', '산후조리', 'Postpartum care'],
  ['health', '건강증상', 'Health'],
  ['toddler-food', '유아식', 'Toddler meals'],
  ['birth', '출산', 'Birth'],
  ['solids', '이유식', 'Solids'],
] as const;
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
