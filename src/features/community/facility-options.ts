export const facilityKinds = [
  ['hospital', '병원', 'Hospitals'],
  ['pharmacy', '약국', 'Pharmacies'],
  ['daycare', '어린이집', 'Daycare'],
  ['kindergarten', '유치원', 'Kindergartens'],
  ['kids-cafe', '키즈카페', 'Kids cafés'],
  ['nursing', '기저귀맵', 'Diaper map'],
] as const;
export type FacilityKind = (typeof facilityKinds)[number][0];
